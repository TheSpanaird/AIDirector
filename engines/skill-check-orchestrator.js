// modules/ai-director/scripts/engines/skill-check-orchestrator.js

import { FlagFactory } from "../../core/flag-factory.js";
import { SkillCheckPrompts } from "../prompt-factory/skill-check-prompts.js";

// =========================================================================
// STRING CLEANING & FORMATTING HELPER
// =========================================================================
/**
 * Cleans and formats raw system keys or dirty strings into human-readable Title Case.
 * Example: "basic_tech (Attribute)" -> "Basic Tech"
 */
function formatButtonSkillName(str) {
  if (!str) return "";
  return str
    .replace(/\s*\((attribute|skill|stat)\)\s*/gi, "") // Strip parenthetical metadata
    .replace(/[_-]+/g, " ")                            // Convert snake_case or dashes to spaces
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Title Case
    .join(" ");
}

export const SkillCheckOrchestrator = {
  /**
   * Sequence 1: Dynamically maps the running system's data structure, respects explicit player 
   * selections, and handles fallback AI difficulty/rationale generation without overriding choices.
   */
  async requestChallengeCard(transactionContext) {
    const actor = game.actors.get(transactionContext.actorId) || game.user.character;
    if (!actor) {
      ui.notifications.error("AI Director | Active character context is missing.");
      return;
    }

    ui.notifications.info("AI Director | Mapping active system schema...");

    const systemId = game.system.id;
    let availableSkills = [];
    let systemTerminology = { targetLabel: "DC", systemContext: "Standard Attribute/Skill check" };

    // 1. DYNAMIC DATA EXTRACTION
    if ((systemId === "cpr" || systemId === "cyberpunk-red-core") && actor.system?.skills) {
      systemTerminology = { targetLabel: "DV", systemContext: "Cyberpunk RED Core Rules" };
      
      availableSkills = Object.entries(actor.system.skills).map(([key, data]) => {
        const localizationKey = `CPR.global.itemType.skill.${key}`;
        const localizedName = game.i18n.has(localizationKey) ? game.i18n.localize(localizationKey) : null;
        
        let rawStat = "TECH";
        if (data && data.stat !== undefined) {
          rawStat = typeof data.stat === "object" ? (data.stat.value || "TECH") : data.stat;
        }

        return {
          key: key,
          name: localizedName || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          stat: String(rawStat).toUpperCase()
        };
      });
    } else if (actor.system?.skills) {
      systemTerminology = { targetLabel: "DC", systemContext: `${systemId.toUpperCase()} Core Rules` };
      availableSkills = Object.entries(actor.system.skills).map(([key, data]) => {
        const localizationKey = `CONFIG.${systemId.toUpperCase().replace(/-/g, '_')}.skills.${key}`;
        const localizedName = game.i18n.has(localizationKey) ? game.i18n.localize(localizationKey) : null;
        
        let rawStat = data.ability || data.stat || "";
        if (rawStat && typeof rawStat === "object") {
          rawStat = rawStat.value || "";
        }

        return {
          key: key,
          name: localizedName || data.name || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          stat: String(rawStat).toUpperCase()
        };
      });
    }

    // 2. CHECK FOR EXPLICIT USER SELECTION
    const incomingSkillString = transactionContext.skillKey || transactionContext.skill;
    let explicitMatch = null;
    
    if (incomingSkillString) {
      const searchStr = incomingSkillString.toLowerCase().trim();
      explicitMatch = availableSkills.find(s => 
        s.name.toLowerCase().trim() === searchStr || 
        s.key.toLowerCase().trim() === searchStr
      );
    }

    const explicitTarget = transactionContext.targetThreshold || transactionContext.target || transactionContext.difficulty;
    let llmResponseJson = { 
      targetThreshold: explicitTarget !== undefined ? Number(explicitTarget) : 15, 
      rationale: explicitTarget !== undefined ? "Context calibrated difficulty value." : "System baseline calibration.", 
      skillName: explicitMatch ? explicitMatch.name : (transactionContext.skill || "General Check"), 
      skillKey: explicitMatch ? explicitMatch.key : "general", 
      stat: explicitMatch ? explicitMatch.stat : (transactionContext.stat || "Attribute") 
    };

    // 3. BUILD AI PROMPT
    const baseSystemPrompt = SkillCheckPrompts.buildChallengePrompt({
      characterName: actor.name,
      playerIntent: transactionContext.intent,
      checkType: transactionContext.checkType || "STANDARD",
      requestedSkill: llmResponseJson.skillName,
      targetStat: llmResponseJson.stat
    });

    let payloadPrompt = `
${baseSystemPrompt}

[SYSTEM RUNNING: ${systemTerminology.systemContext}]
`;

    if (explicitMatch) {
      payloadPrompt += `
CRITICAL: The user has explicitly selected the skill "${explicitMatch.name}" (Key: "${explicitMatch.key}"). 
You MUST return this exact skillName and skillKey in your JSON response. Do not change it or assess an alternative.
`;
    } else {
      const formattedSchemaList = availableSkills
        .map(s => `- Skill: "${s.name}" (Key: "${s.key}", Associated Attribute: ${s.stat})`)
        .join("\n");

      payloadPrompt += `
You must cross-reference the intent with the active character's exact schema attributes. Select the single best fit from this list:
${formattedSchemaList || "- Generic Attribute Check"}
`;
    }

    if (explicitTarget !== undefined) {
      payloadPrompt += `\nCRITICAL: The target difficulty threshold is historically set to ${explicitTarget}. Maintain this targetThreshold property value explicitly inside your output schema structure.`;
    } else {
      payloadPrompt += `\nINSTRUCTION: Determine the numerical difficulty threshold (${systemTerminology.targetLabel}) appropriate for the task and provide a concise rationale.`;
    }

    // 4. LLM INQUIRY
    try {
      const response = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "hermes3",
          messages: [
            { role: "system", content: payloadPrompt },
            { 
              role: "user", 
              content: `Intent: "${transactionContext.intent}". Output RAW JSON format only: {"targetThreshold": number, "rationale": "string", "skillName": "${llmResponseJson.skillName}", "skillKey": "${llmResponseJson.skillKey}", "stat": "${llmResponseJson.stat}"}` 
            }
          ],
          stream: false,
          options: { temperature: 0.1, num_predict: 250 }
        })
      });

      if (!response.ok) throw new Error(`Ollama Orchestrator Error: ${response.statusText}`);
      const data = await response.json();
      const rawResult = data.message?.content || "";
      const cleanJsonString = rawResult.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedJson = JSON.parse(cleanJsonString);

      if (explicitTarget !== undefined) {
        llmResponseJson.targetThreshold = Number(explicitTarget);
      } else {
        llmResponseJson.targetThreshold = parsedJson.targetThreshold || 15;
      }
      llmResponseJson.rationale = parsedJson.rationale || "System baseline calibration.";
    } catch (err) {
      console.warn("AI Director | Error parsing local JSON response. Defaulting.", err);
    }

    // 5. RENDER INITIAL COMPONENT FRAME
    const challengeCard = await ChatMessage.create({
      speaker: { alias: "AI Director" },
      style: CONST.CHAT_MESSAGE_STYLES?.OTHER || 0,
      content: `<div class="ai-director-loading" style="padding: 10px; text-align: center; font-style: italic; opacity: 0.7;">Calibrating Vector Matrix...</div>`
    });

    const realMessageId = challengeCard.id;

    // 6. BUILD FLAGS LINKED DIRECTLY TO THE REAL ID
    const coreFlags = {
      isAi: true,
      processType: "SKILL_CHECK_SEQUENCE",
      correlationId: realMessageId,
      context: {
        characterName: actor.name,
        actorId: actor.id,
        skill: llmResponseJson.skillName,
        skillKey: llmResponseJson.skillKey,
        stat: llmResponseJson.stat,
        targetDC: llmResponseJson.targetThreshold,
        challengeContext: transactionContext.intent,
        isResolutionProcessing: false
      }
    };

    const challengeFlags = foundry.utils.mergeObject(
      FlagFactory.createFlags(coreFlags) || {},
      coreFlags,
      { overwrite: true }
    );

    const displayLabel = `${systemTerminology.targetLabel} ${llmResponseJson.targetThreshold}`;

    // 7. INJECT FINAL COMPONENT CONTENT WITH REAL ID
    await challengeCard.update({
      "flags.ai-director": challengeFlags,
      content: `
        <div class="ai-director-chat-card challenge-card sandbox-v2" data-correlation-id="${realMessageId}" style="border: 1px solid var(--color-border-dark); background: var(--color-bg); border-radius: 4px; overflow: hidden; border-left: 4px solid #3498db;">
          <div style="background: rgba(0, 0, 0, 0.2); padding: 6px 10px; font-weight: bold; font-size: 0.9em; display: flex; justify-content: space-between;">
            <span>🎯 CHALLENGE PROMPT (${systemId.toUpperCase()})</span>
            <span style="color: #3498db;">${displayLabel}</span>
          </div>
          <div style="padding: 10px;">
            <p style="margin: 0 0 8px 0;"><strong>${actor.name}</strong> intends to: <em>"${transactionContext.intent}"</em></p>
            <p style="margin: 0 0 12px 0; font-size: 0.9em; opacity: 0.85;"><strong>Rationale:</strong> ${llmResponseJson.rationale}</p>
            
            <button class="ai-director-roll-action-btn" 
                    data-correlation-id="${realMessageId}"
                    data-skill-name="${llmResponseJson.skillName}"
                    data-skill-key="${llmResponseJson.skillKey}"
                    data-stat="${llmResponseJson.stat}"
                    data-target="${llmResponseJson.targetThreshold}"
                    style="width: 100%; background: #2c3e50; color: #fff; border: 1px solid #34495e; padding: 6px; cursor: pointer; border-radius: 3px; font-weight: bold;">
              Roll ${formatButtonSkillName(llmResponseJson.skillName || llmResponseJson.stat)} vs ${displayLabel}
            </button>
          </div>
        </div>
      `
    });
  },

  /**
   * Sequence 2: Intercepts the transactional roll results and cleans up secondary artifacts.
   */
  async resolveChallengeRoll(messageDoc, activeFlags) {
    // UNIFY FLAGS FOOTPRINT: Check direct footprint as well as the alternative layout discovered in forensics
    const rawContext = activeFlags.context || activeFlags;
    const correlationId = activeFlags.correlationId || messageDoc.flags?.["ai-director"]?.correlationId;

    if (rawContext.isResolutionProcessing || rawContext.status === "processing") return;
    rawContext.isResolutionProcessing = true;

    // Cross-reference original card document metadata flags
    const challengeCard = game.messages.get(correlationId) || game.messages.contents.find(m => m.flags?.["ai-director"]?.correlationId === correlationId);
    const originCardContext = challengeCard?.flags?.["ai-director"]?.context || {};

    // PARSE HTML BACKUP VALUES: Capture target directly out of the button markup to defeat hardcoded 15 fallbacks
    let htmlButtonTarget = null;
    if (challengeCard?.content) {
      const match = challengeCard.content.match(/data-target=["'](\d+)["']/);
      if (match && match[1]) {
        htmlButtonTarget = Number(match[1]);
      }
    }

    if (challengeCard) {
      await challengeCard.update({
        "flags.ai-director.context.isResolutionProcessing": true,
        "flags.ai-director.context.status": "processing",
        content: challengeCard.content + `<p style="text-align:center; color:gray; font-size:0.8em; margin: 4px 0 0 0;">&mdash; Processing Final Consequences &mdash;</p>`
      });
    }

    const resolvedCharacterName = rawContext.characterName || originCardContext.characterName || messageDoc.speaker?.alias || "The character";
    
    // HEURISTIC DIFFICULTY DISCOVERY: Prioritize explicit UI button targets over the database default fallback
    const targetThreshold = htmlButtonTarget || rawContext.targetDC || rawContext.targetValue || originCardContext.targetDC || 13;

    const totalRollValue = (messageDoc.rolls && messageDoc.rolls[0]) ? messageDoc.rolls[0].total : Number(messageDoc.content.replace(/<[^>]*>/g, '').trim()) || 0;
    const isSuccess = totalRollValue >= targetThreshold;
    const margin = totalRollValue - targetThreshold;

    ui.notifications.info(`AI Director | Sandbox Resolution: ${totalRollValue} vs Target ${targetThreshold}`);

    // SUPPRESS SYSTEM OVERRIDE DISPLAYS: Intercept and rewrite the raw message display text to respect the true target value
    if (messageDoc.content.includes("System Determination")) {
      const displayId = game.system.id.toUpperCase();
      await messageDoc.update({
        content: `
          <div style="margin-bottom:8px; font-family:var(--font-primary)">
            <strong style="text-transform:uppercase">System Determination:</strong> 
            <span style="color:${isSuccess ? '#2ecc71' : '#e74c3c'}; font-weight:bold;">[${isSuccess ? 'SUCCESS' : 'FAILURE'}]</span>
            <br><span style="font-size:0.9em; opacity:0.8;">The check total (${totalRollValue}) beats or meets the true challenge threshold of ${targetThreshold}.</span>
          </div>
        `
      });
    }

    const historyLimit = 6;
    const recentChatContext = game.messages.contents
      .slice(-historyLimit)
      .filter(m => !m.flags?.["ai-director"]?.processType?.includes("COMPLETED") && m.id !== messageDoc.id)
      .map(m => `${m.alias || m.speaker?.alias || "System"}: ${m.content.replace(/<[^>]*>/g, '').trim()}`)
      .join("\n");

    // RETRIEVE SHORT-TERM TELEMETRY MEMORY
    let relevantCanonContext = "NO_MATCHING_CANON_DATA_FOUND";
    try {
      const { retrieveRelevantContext, getJournalMemory } = await import("../ai/short-term-telemetry.js");
      const masterJournalText = await getJournalMemory();
      relevantCanonContext = retrieveRelevantContext(rawContext.challengeContext || originCardContext.challengeContext, masterJournalText, 3);
    } catch (memErr) {
      console.warn("AI Director | RAG Short-term memory collection lookup errored:", memErr);
    }

    const resolutionPayload = {
      characterName: resolvedCharacterName,
      requestedSkill: rawContext.skill || originCardContext.skill || "pick_lock",
      targetStat: rawContext.stat || originCardContext.stat || "COOL",
      originalScenario: rawContext.challengeContext || originCardContext.challengeContext || "Lockpicking task",
      totalRollValue: totalRollValue,
      targetThreshold: targetThreshold,
      isSuccess: isSuccess,
      margin: margin,
      chatHistory: recentChatContext
    };

    const promptBundle = SkillCheckPrompts.buildOutcomePrompt(resolutionPayload);

    let contextEnforcerPrompt = `
${promptBundle.system}

CRITICAL ENVIRONMENT RULES:
1. You must describe the resolution EXACTLY where the action occurs based on the Current Scenario context.
2. CURRENT SCENARIO CONTEXT: "${resolutionPayload.originalScenario}".
3. CHARACTER IDENTIFICATION: The character active in this sequence is named "${resolvedCharacterName}". You must refer to them exactly by this name. Do NOT output 'undefined'.
`;

    if (relevantCanonContext && relevantCanonContext !== "NO_MATCHING_CANON_DATA_FOUND") {
      contextEnforcerPrompt += `\nCRITICAL CAMPAIGN CONTEXT (ABSOLUTE CANON):\n${relevantCanonContext}`;
    }

    contextEnforcerPrompt += `
STRICT NARRATIVE CONSTRAINTS:
1. Absolute Restriction: Do NOT introduce external environmental traits like random alleys, rain, weathered handle elements, or outside lanes unless explicitly detailed in the chat history logs or absolute canon. Keep the character focused strictly on the scene elements described (e.g. the security doors, the vestibule walls).
2. Refuse any tendency to invent a standard open-world generic description for picking a lock. Anchor the results into the present scene or hazard.
3. Keep the subject and content of the message relevant to the skill check.
4. Provide resolution to the skill check only and do not introduce any new elements.
`;

    try {
      const response = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "hermes3",
          messages: [
            { role: "system", content: contextEnforcerPrompt },
            { role: "user", content: promptBundle.user }
          ],
          stream: false,
          options: { temperature: 0.3, num_predict: 350 }
        })
      });

      if (!response.ok) throw new Error(`Ollama Resolution Prose Error: ${response.statusText}`);
      const data = await response.json();
      const generatedProse = data.message?.content || "";
      
      let cleanProse = (generatedProse || "").trim();
      cleanProse = cleanProse.replace(/^(Game Master|AI Director|Resolution|Result|Narration):\s*/i, "");

      const finalOutputFlags = FlagFactory.createFlags({
        isAi: true,
        processType: "SKILL_CHECK_SEQUENCE_COMPLETED",
        correlationId: correlationId
      });

      const systemId = game?.system?.id || "cpr";
      const borderHex = isSuccess ? "#2ecc71" : "#e74c3c";

      // BUILD THE CLEAN CARD UNDER PLAYER NAME
      await ChatMessage.create({
        speaker: { alias: resolvedCharacterName },
        flags: finalOutputFlags,
        content: `
          <div class="ai-director-chat-card cinematic-outcome-card system-${systemId}" style="border: 1px solid var(--color-border-dark); background: var(--color-bg); border-radius: 4px; overflow: hidden; border-left: 4px solid ${borderHex};">
            <div style="background: rgba(0, 0, 0, 0.15); padding: 5px 10px; font-size: 0.8em; opacity: 0.8; font-weight: bold; text-transform: uppercase;">
              ${isSuccess ? "Success" : "Failure"} (Rolled ${totalRollValue} vs ${targetThreshold})
            </div>
            <div style="padding: 10px;">
              <p style="margin: 0; font-style: italic; line-height: 1.4;">${cleanProse}</p>
            </div>
          </div>
        `,
        style: CONST.CHAT_MESSAGE_STYLES?.OTHER || 0
      });

      // CLEANUP ARTIFACT GHOST MESSAGES: Scan and delete the unflagged twin block before it prints
      setTimeout(() => {
        const ghostTwin = game.messages.contents.find(m => 
          m.id !== correlationId && 
          m.speaker?.alias === "AI Director" && 
          !m.flags?.["ai-director"]?.processType &&
          m.content.includes(cleanProse.substring(0, 20))
        );
        if (ghostTwin) ghostTwin.delete();
      }, 250);

    } catch (err) {
      console.error("AI Director | Sandbox execution failed at resolution boundary:", err);
    }
  }
};