// modules/ai-director/scripts/engines/contested-orchestrator.js

import { MODULE_ID } from "../settings.js";
import { ContestedCheckPrompts } from "../prompt-factory/contested-prompts.js";
import { FlagFactory, PROCESS_TYPES } from "../../core/flag-factory.js";

/**
 * CONTESTED ENCOUNTER FLOW ORCHESTRATOR
 * Manages asymmetric local LLM processing, target resolution, 
 * card rendering, and hook interception for opposed skill matchups.
 */
export const ContestedOrchestrator = {
  
  /**
   * Main entry point called by the App Routing Layer.
   * Evaluates the matchup scenario, calls the local LLM, and creates the chat card.
   * 
   * @param {Object} data - Configuration parameters from the UI dispatch
   */
  async requestContestedCard(data) {
    // --- BEGIN AUTOMATIC PLAYER CHARACTER MAP RESOLUTION ---
    let initiatorToken = null;
    let initiatorActor = null;

    if (canvas.ready && canvas.tokens?.placeables) {
      const controlled = canvas.tokens.controlled || [];
      
      // Helper function to unify validation rules
      const isValidPCActor = (actor) => {
        if (!actor) return false;
        return actor.hasPlayerOwner || actor.folder?.name === "PCs";
      };

      // 1. First priority: Check if the user is actively selecting a specific valid PC token they own
      const validControlledPCs = controlled.filter(t => {
        if (!t.actor || !isValidPCActor(t.actor)) return false;
        return t.actor.testUserPermission(game.user, "OWNER");
      });

      if (validControlledPCs.length > 0) {
        initiatorToken = validControlledPCs[validControlledPCs.length - 1];
        initiatorActor = initiatorToken.actor;
      } 
      // 2. Automatic Fallback: Nothing is selected, find the token the player actually owns on this map
      else {
        // If the player has a character assigned to their user profile, prioritize that token on the map
        if (game.user.character && isValidPCActor(game.user.character)) {
          initiatorActor = game.user.character;
          initiatorToken = canvas.tokens.placeables.find(t => t.actor?.id === initiatorActor.id) || null;
        }

        // If no profile character is assigned, look for any token on the map that fits PC criteria and user ownership
        if (!initiatorToken) {
          const ownedMapTokens = canvas.tokens.placeables.filter(t => {
            if (!t.actor || !isValidPCActor(t.actor)) return false;
            
            // If GM is testing, look for a PC that has explicit player ownership
            if (game.user.isGM) {
              const ownership = t.actor.ownership || {};
              return Object.entries(ownership).some(([userId, level]) => {
                const assocUser = game.users.get(userId);
                return assocUser && !assocUser.isGM && level === 3;
              });
            }
            
            // For players, verify true ownership of the sheet
            return t.actor.testUserPermission(game.user, "OWNER");
          });

          if (ownedMapTokens.length > 0) {
            // FIXED: Explicitly assign the found element to the initiator token references
            initiatorToken = ownedMapTokens[ownedMapTokens.length - 1];
            initiatorActor = initiatorToken.actor;
          }
        }
      }
    }
    
    // Strict Guardrail: Halt if absolutely no character can be automatically mapped
    if (!initiatorToken || !initiatorActor) {
      ui.notifications.error("AI Director | Auto-Target Failed. Could not find a valid Player Character token you own on this map.");
      return;
    }
    // --- END AUTOMATIC PLAYER CHARACTER MAP RESOLUTION ---

    // Capture user's targeted token as the defender
    const defenderToken = game.user.targets.first() || null;
    if (!defenderToken || !defenderToken.actor) {
      ui.notifications.warn("AI Director | Contested checks require targeting an opposing token on the canvas.");
    }

    const initiatorName = initiatorToken?.name || initiatorActor.name;
    const defenderName = defenderToken?.name || defenderToken?.actor?.name || "The Opposition";

    // --- FACEDOWN DETECTION AND INTERCEPTION CORE ---
    // Catch if Facedown is explicitly overridden via the dropdown panel select data payload
    const isFacedownDuel = data.skill === "Facedown" && game.system.id === "cpr";

    // 1. Compile context and build the factory prompt
    const promptContext = {
      characterName: initiatorName,
      targetName: defenderName,
      playerIntent: data.intent,
      requestedSkill: isFacedownDuel ? "Facedown" : (data.skill || "Athletics") // Default fallback if none selected
    };

    const systemPrompt = ContestedCheckPrompts.buildContestedPrompt(promptContext);

    // 2. Query Local LLM via Ollama endpoint configuration
    let analysis = {
      rationale: isFacedownDuel 
        ? "A tense standstill as a psychological war of wills locks eyes across the hot zone."
        : "Friction encountered in direct conflict.",
      opposingSkillKey: isFacedownDuel ? "facedown" : "athletics",
      opposingSkillName: isFacedownDuel ? "Facedown" : "Athletics"
    };

    // Skip LLM query step if Facedown is explicitly forced via user control
    if (!isFacedownDuel) {
      let model = "hermes3";
      let host = "http://localhost:11434";

      try {
        if (game.settings.settings.has(`${MODULE_ID}.modelName`)) {
          model = game.settings.get(MODULE_ID, "modelName");
        }
        if (game.settings.settings.has(`${MODULE_ID}.ollamaHost`)) {
          host = game.settings.get(MODULE_ID, "ollamaHost");
        }
      } catch (settingErr) {
        console.warn("AI Director | Settings registry bypass. Defaulting to hermes3 fallback core pipeline.", settingErr);
      }

      try {
        const response = await fetch(`${host}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: model,
            prompt: systemPrompt,
            stream: false,
            options: { temperature: 0.2 }
          })
        });

        if (response.ok) {
          const jsonRes = await response.json();
          let cleanText = jsonRes.response?.trim() || "";
          
          if (cleanText.includes("{")) {
            cleanText = cleanText.substring(cleanText.indexOf("{"), cleanText.lastIndexOf("}") + 1);
            const parsedAnalysis = JSON.parse(cleanText);
            if (parsedAnalysis.opposingSkillName === "Facedown" && game.system.id !== "cpr") {
              parsedAnalysis.opposingSkillName = "Intimidation";
              parsedAnalysis.opposingSkillKey = "intimidation";
            }
            analysis = parsedAnalysis;
          }
        }
      } catch (err) {
        console.error("AI Director | Contested analysis pipeline failed. Falling back to default match.", err);
      }
    }

    // Force an automatic Facedown response loop from the defender if a Cyberpunk RED facedown occurs
    const finalIsFacedown = isFacedownDuel || (analysis.opposingSkillName === "Facedown" && game.system.id === "cpr");

    // 3. Assemble structural metadata tracking tokens
    const correlationId = foundry.utils.randomID();
    const flagPayload = FlagFactory.createFlags({
      isAi: true,
      processType: PROCESS_TYPES.CONTESTED_RESOLUTION,
      correlationId: correlationId,
      context: {
        status: "pending_rolls",
        scenario: data.intent,
        isFacedown: finalIsFacedown,
        initiator: {
          actorId: initiatorActor.id,
          tokenId: initiatorToken?.id || null,
          name: initiatorName,
          skill: finalIsFacedown ? "Facedown" : promptContext.requestedSkill,
          targetStat: finalIsFacedown ? "cool" : null,
          rollResult: null
        },
        defender: {
          actorId: defenderToken?.actor?.id || null,
          tokenId: defenderToken?.id || null,
          name: defenderName,
          skill: finalIsFacedown ? "Facedown" : analysis.opposingSkillName,
          skillKey: finalIsFacedown ? "facedown" : analysis.opposingSkillKey,
          targetStat: finalIsFacedown ? "cool" : null,
          rollResult: null
        }
      }
    });

    // 4. Construct interactive user interface HTML
    const cardHtml = `
      <div class="ai-director-card contested-card ${finalIsFacedown ? 'facedown-duel-theme' : ''}" data-correlation-id="${correlationId}">
        <div class="card-header">
          <i class="${finalIsFacedown ? 'fas fa-eye' : 'fas fa-gavel'}"></i> 
          <span>${finalIsFacedown ? 'Cyberpunk Facedown Duel' : 'Contested Face-Off'}</span>
        </div>
        <div class="card-body">
          <p class="scenario-intent"><strong>Intent:</strong> "${data.intent}"</p>
          <blockquote class="director-rationale">"${analysis.rationale}"</blockquote>
          
          <div class="contested-ledger">
            <div class="ledger-lane initiator-lane" data-actor-id="${initiatorActor.id}">
              <span class="actor-label">${initiatorName}</span>
              <span class="skill-tag">${finalIsFacedown ? 'Facedown (1d10 + COOL + Rep)' : promptContext.requestedSkill}</span>
              <button class="roll-contested-btn" data-type="initiator"><i class="fas fa-dice"></i> Roll</button>
            </div>
            
            <div class="ledger-versus">VS</div>
            
            <div class="ledger-lane defender-lane" data-actor-id="${defenderToken?.actor?.id || ''}">
              <span class="actor-label">${defenderName}</span>
              <span class="skill-tag">${finalIsFacedown ? 'Facedown (1d10 + COOL + Rep)' : analysis.opposingSkillName}</span>
              <button class="roll-contested-btn" data-type="defender" ${!defenderToken ? 'disabled' : ''}><i class="fas fa-dice"></i> Roll</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // 5. Broadcast directly into the system Chat Log
    await ChatMessage.create({
      user: game.user.id,
      speaker: { alias: "AI Director" },
      content: cardHtml,
      flags: flagPayload,
      style: CONST.CHAT_MESSAGE_STYLES?.OTHER || 0
    });
  }
};