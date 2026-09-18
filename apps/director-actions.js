// modules/ai-director/apps/director-actions.js

import { executeDirectorPulse } from "/modules/ai-director/scripts/modes/director-pulse.js";
import { MODULE_ID } from "/modules/ai-director/scripts/settings.js";
import { FactionManager } from "/modules/ai-director/scripts/simulation/faction-manager.js";
import { generateDirectorCardHtml } from "/modules/ai-director/ui/chat-card-renderer.js";
import { SYSTEM_RULES_REGISTRY } from "/modules/ai-director/scripts/prompt-factory/system-rules.js";

// 🛠️ FIXED: Paths mapped parallel to scripts/ at the module root level
import { FlagFactory, PROCESS_TYPES } from "/modules/ai-director/core/flag-factory.js";
import { DirectorRouter } from "/modules/ai-director/core/director-router.js";
import { MapForge } from "/modules/ai-director/scripts/ai/map-forge.js";

/**
 * DirectorActions — Integrated Context Forcing, Action Dispatch, and Faction Orchestration
 */
export class DirectorActions {
  
  /**
   * Dynamically retrieves and localizes a standardized skill list based on the active game system and controlled token data model.
   * @returns {Array<{id: string, name: string}>} Sorted array of standardized skill objects.
   */
  static getSystemSkills() {
    let systemId = typeof game !== "undefined" ? game.system?.id : "cpr";
    
    // Map system variants safely to matching registry keys
    let registryKey = "cpr";
    if (systemId === "cyberpunk-red-core" || systemId === "cyberpunk-red" || systemId === "cpr") {
      registryKey = "cpr";
    } else if (systemId === "dnd5e") {
      registryKey = "dnd5e";
    } else if (systemId === "sw5e") {
      registryKey = "sw5e";
    }

    const ruleText = SYSTEM_RULES_REGISTRY[registryKey];
    if (!ruleText) return [];

    // Isolate the text block between "SKILLS:" and "DIFFICULTY METRIC:"
    const skillsMatch = ruleText.match(/SKILLS:\s*([\s\S]*?)\s*DIFFICULTY METRIC:/);
    if (!skillsMatch) return [];

    const rawSkillsText = skillsMatch[1];
    const skillRegex = /([\w\s/&'-]+)\s*\([\w]+\)/g;
    let matches;
    const parsedSkills = [];

    while ((matches = skillRegex.exec(rawSkillsText)) !== null) {
      const skillName = matches[1].trim();
      const cleanName = skillName.replace(/^[\s,]+|[\s,]+$/g, "").trim();
      
      if (cleanName) {
        parsedSkills.push({
          id: cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
          name: cleanName
        });
      }
    }

    return parsedSkills.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  static async onAddFaction(event, target) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!game.user.isGM) return;

    const content = `
      <div class="form-group"><label>Faction Name</label><input type="text" id="faction-dialog-name" required/></div>
      <div class="form-group"><label>Operational Tier</label><select id="faction-dialog-tier"><option value="major">Major Power</option><option value="minor" selected>Minor Force</option><option value="micro">Micro Cell</option></select></div>
    `;

    new Dialog({
      title: "Manifest New Relational Entity",
      content: content,
      buttons: {
        create: {
          icon: '<i class="fas fa-check"></i>', label: "Register",
          callback: async (html) => {
            const name = html.find("#faction-dialog-name").val()?.trim();
            const tier = html.find("#faction-dialog-tier").val();
            if (!name) return;
            const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
            await FactionManager.registerFaction(id, name, { tier: tier });
          }
        }
      }
    }).render(true);
  }

  static async onEditFaction(event, target) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const row = target.closest("tr");
    const factionId = row?.dataset.factionId;
    const registry = FactionManager.getRegistry();
    const faction = registry.find(f => f.id === factionId);
    if (!faction) return;

    const currentTier = faction.tier || "minor";
    const currentSentiment = faction.sentiment || "neutral";

    const content = `
      <div class="form-group"><label>Name</label><input type="text" id="edit-name" value="${faction.name}" /></div>
      <div class="form-group">
        <label>Operational Tier</label>
        <select id="edit-tier">
          <option value="major" ${currentTier === "major" ? "selected" : ""}>Major Power</option>
          <option value="minor" ${currentTier === "minor" ? "selected" : ""}>Minor Force</option>
          <option value="micro" ${currentTier === "micro" ? "selected" : ""}>Micro Cell</option>
        </select>
      </div>
      <div class="form-group">
        <label>Sentiment Tier</label>
        <select id="edit-sentiment">
          <option value="hostile" ${currentSentiment === "hostile" ? "selected" : ""}>Hostile</option>
          <option value="neutral" ${currentSentiment === "neutral" ? "selected" : ""}>Neutral</option>
          <option value="allied" ${currentSentiment === "allied" ? "selected" : ""}>Allied</option>
        </select>
      </div>
      <div class="form-group">
        <label>Trust Matrix Balance</label>
        <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
          <input type="range" id="edit-trust" min="0" max="100" step="10" value="${faction.trust ?? 50}" list="tickmarks" style="flex: 1;" oninput="this.nextElementSibling.value = this.value + '%'"/>
          <output style="min-width: 40px; font-weight: bold; text-align: right;">${faction.trust ?? 50}%</output>
          <datalist id="tickmarks">
            <option value="0"></option><option value="10"></option><option value="20"></option><option value="30"></option><option value="40"></option>
            <option value="50"></option><option value="60"></option><option value="70"></option><option value="80"></option><option value="90"></option><option value="100"></option>
          </datalist>
        </div>
      </div>
      <div class="form-group"><label>Influence</label><input type="number" id="edit-inf" value="${faction.influence ?? 15}" /></div>
      <div class="form-group"><label>Aggression</label><input type="number" id="edit-agg" value="${faction.aggression ?? 30}" /></div>
      <div class="form-group"><label>Hostility (%)</label><input type="number" id="edit-host" value="${faction.hostilityToParty || 0}" /></div>
    `;

    new Dialog({
      title: `Editing: ${faction.name}`,
      content: content,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>', label: "Save",
          callback: async (html) => {
            faction.name = html.find("#edit-name").val();
            faction.tier = html.find("#edit-tier").val();
            faction.sentiment = html.find("#edit-sentiment").val();
            faction.trust = Number(html.find("#edit-trust").val());
            faction.influence = Number(html.find("#edit-inf").val());
            faction.aggression = Number(html.find("#edit-agg").val());
            faction.hostilityToParty = Number(html.find("#edit-host").val());
            await FactionManager.saveRegistry(registry);
          }
        }
      }
    }).render(true);
  }

  static async onDeleteFaction(event, target) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!game.user.isGM) return;
    const row = target.closest("tr");
    const factionId = row?.dataset.factionId;
    if (!factionId) return;
    const confirm = await Dialog.confirm({ title: "Remove Entity", content: "<p>Remove this faction?</p>" });
    if (!confirm) return;
    const updatedRegistry = FactionManager.getRegistry().filter(f => f.id !== factionId);
    await FactionManager.saveRegistry(updatedRegistry);
    ui.notifications.warn("AI Director: Record removed.");
  }

  static async onPulse(event, target) {
    event.preventDefault();
    event.stopImmediatePropagation();
    ui.notifications.info("AI Director | Invoking background simulation heartbeat...");
    await executeDirectorPulse();
  }

  static async onSend(event, target) {
    event.preventDefault();
    
    const appContainer = target?.closest(".ai-director-app") || document.querySelector(".ai-director-app") || this.element;
    const chatInputEl = appContainer.querySelector("[name='chat-input']") || appContainer.querySelector(".chat-input") || appContainer.querySelector(".prompt-textarea");
    const message = chatInputEl?.value?.trim();
    if (!message) return;

    // =========================================================================
    // INTERCEPT ACTIVE CHALLENGE CARD RUNTIME
    // =========================================================================
    const activeChallengeCard = game.messages.contents
      .reverse()
      .find(m => m.flags?.["ai-director"]?.isChallengeCard === true);

    if (activeChallengeCard) {
      try {
        await activeChallengeCard.update({
          "flags.ai-director.challengeContext": message
        });

        let updatedContent = activeChallengeCard.content;
        const matchRegex = /The environment challenges your action\. Direct mechanics resolution required\./g;
        
        if (matchRegex.test(updatedContent)) {
          updatedContent = updatedContent.replace(matchRegex, message);
        } else {
          updatedContent = updatedContent.replace(
            /<em>"[\s\S]*?"<\/em>|<i>"[\s\S]*?"<\/i>|"[The environment challenges your action[^"]*"]/i,
            `"${message}"`
          );
        }

        await activeChallengeCard.update({ content: updatedContent });
        
        if (chatInputEl) chatInputEl.value = "";
        return; 
      } catch (err) {
        console.error("AI Director | Failed to inject context into active challenge card:", err);
      }
    }
    
    // =========================================================================
    // PARSE MODE & SKILL MODIFIERS
    // =========================================================================
    const modeEl = appContainer.querySelector("[name='mode']") || appContainer.querySelector("#mode");
    const rawMode = modeEl?.value || "Auto";
    
    const identityEl = appContainer.querySelector("[name='answer-as']") || appContainer.querySelector("#answer-as");
    const chosenIdentity = identityEl?.value || "Game Master";
    
    let chosenMode = "auto";
    const cleanRawMode = rawMode.toLowerCase().replace(/[^a-z]/g, ""); 
    const modeMap = { "auto": "auto", "question": "question", "yesno": "yesno", "description": "description", "action": "action", "npcchat": "npc" };
    chosenMode = modeMap[cleanRawMode] || "auto";

    ui.notifications.info("AI Director | Assessing intent vectors...");
    
    let mechanicsDecision;
    const isExplicitAction = chosenMode === "action";
    
    if (isExplicitAction) {
      const explicitSkillKey = (appContainer.querySelector("[name='actionSkill']") || appContainer.querySelector("#actionSkill"))?.value;
      const explicitTarget = (appContainer.querySelector("[name='actionTarget']") || appContainer.querySelector("#actionTarget"))?.value || "the environment";
      const isBlind = (appContainer.querySelector("[name='actionBlindRoll']") || appContainer.querySelector("#actionBlindRoll"))?.checked || false;
      
      if (!explicitSkillKey || explicitSkillKey === "none" || explicitSkillKey === "na") {
        mechanicsDecision = {
          requiresRoll: false,
          reasoning: "User selected a raw narrative action or N/A override. Bypassing check generation."
        };
      } else {
        let systemId = game?.system?.id || "cpr";
        let registryKey = "cpr";
        if (systemId === "cyberpunk-red-core" || systemId === "cyberpunk-red") registryKey = "cpr";
        else if (systemId === "dnd5e") registryKey = "dnd5e";
        else if (systemId === "sw5e") registryKey = "sw5e";

        let inferredStat = "INT";
        const ruleText = SYSTEM_RULES_REGISTRY[registryKey];
        if (ruleText) {
          const findStatRegex = new RegExp(`([^,\\n\\(]+)\\s*\\(([A-Z]+)\\)`, "g");
          let statMatch;
          while ((statMatch = findStatRegex.exec(ruleText)) !== null) {
            const registrySkillName = statMatch[1].trim();
            const registrySlug = registrySkillName.toLowerCase().replace(/[^a-z0-9]/g, "_");
            if (registrySlug === explicitSkillKey) {
              inferredStat = statMatch[2].trim();
              break;
            }
          }
        }

        let listSkills = DirectorActions.getSystemSkills();
        let matchedSkill = listSkills.find(s => s.id === explicitSkillKey);
        let localizedSkillName = matchedSkill ? matchedSkill.name : explicitSkillKey;

        const baseDiffEl = appContainer.querySelector("[name='baseDifficulty']") || appContainer.querySelector("#baseDifficulty");
        mechanicsDecision = {
          requiresRoll: true,
          skill: localizedSkillName,
          skillKey: explicitSkillKey,
          stat: inferredStat,
          suggestedDV: Number(baseDiffEl?.value) || 13,
          suggestedDC: Number(baseDiffEl?.value) || 13,
          targetEntity: explicitTarget,
          isBlindRoll: isBlind,
          checkType: "STANDARD",
          opposingSkill: null,
          reasoning: "User explicitly executed this mechanics selection matrix via panel overrides."
        };
      }
    } else {
      try {
        const { classifyPlayerIntent } = await import("/modules/ai-director/scripts/prompt-factory/system-rules.js");
        mechanicsDecision = await classifyPlayerIntent(message);
      } catch (err) {
        console.error("AI Director | Intent classification pipeline failure, falling back to narrative:", err);
        mechanicsDecision = { requiresRoll: false };
      }
    }

    // =========================================================================
    // EXECUTE DISPATCH VIA ROUTER & FACTORY PAYLOADS
    // =========================================================================
    if (mechanicsDecision.requiresRoll) {
      ui.notifications.warn(`AI Director | Verification required: ${mechanicsDecision.skill || mechanicsDecision.stat}`);
      
      const nativeCardHtml = generateDirectorCardHtml(
          mechanicsDecision, 
          message || `The environment challenges your action. Direct mechanics resolution required.`
      );

      const streamOutput = appContainer.querySelector(".stream-output");
      if (streamOutput) {
          const challengePara = document.createElement("div");
          challengePara.className = "chat-line mechanics-challenge-intercepted";
          challengePara.innerHTML = nativeCardHtml;
          streamOutput.appendChild(challengePara);
          streamOutput.scrollTop = streamOutput.scrollHeight;
      }

      const characterName = game.user.character?.name || canvas.tokens?.controlled[0]?.actor?.name || "The Character";

      const resolutionMetadata = {
          isChallengeCard: true,
          targetDC: mechanicsDecision.suggestedDV || mechanicsDecision.suggestedDC,
          stat: mechanicsDecision.stat,
          skill: mechanicsDecision.skill,
          skillKey: mechanicsDecision.skillKey,
          checkType: mechanicsDecision.checkType,
          opposingSkill: mechanicsDecision.opposingSkill,
          challengeContext: message || "The environment challenges your action. Direct mechanics resolution required.",
          characterName: characterName,
          targetEntity: mechanicsDecision.targetEntity || "the environment",
          rollMode: mechanicsDecision.isBlindRoll ? "blindroll" : "normal"
      };

      const flagPayload = FlagFactory.createFlags({
          isAi: true,
          processType: PROCESS_TYPES.MECHANICAL_RESOLUTION,
          context: {
              status: "pending_roll",
              targetValue: mechanicsDecision.suggestedDV || mechanicsDecision.suggestedDC || 14,
              targetSkill: mechanicsDecision.skill,
              challengeContext: message
          }
      });

      const chatMessageData = {
          user: game.user.id,
          speaker: { alias: characterName },
          content: nativeCardHtml,
          style: CONST.CHAT_MESSAGE_STYLES?.OTHER || 0,
          flags: { ...flagPayload, "ai-director": { ...flagPayload["ai-director"], ...resolutionMetadata } }
      };

      if (mechanicsDecision.isBlindRoll) {
          chatMessageData.rollMode = CONST.DICE_ROLL_MODES.BLIND;
          chatMessageData.whisper = ChatMessage.getWhisperRecipients("GM");
          chatMessageData.blind = true;
      }

      await ChatMessage.create(chatMessageData);
      
      if (chatInputEl) chatInputEl.value = "";
      return; 
    }

    if (chatInputEl) chatInputEl.value = "";

    let activeSpeakerAlias = game.user.name;
    let targetTokenId = "";
    let targetActorId = "";

    if (canvas.ready && canvas.tokens?.placeables) {
      const controlledOwnedTokens = canvas.tokens.controlled.filter(t => t.actor?.isOwner);
      if (controlledOwnedTokens.length > 0) {
        const targetToken = controlledOwnedTokens[controlledOwnedTokens.length - 1];
        activeSpeakerAlias = targetToken.name;
        targetTokenId = targetToken.document.id;
        targetActorId = targetToken.actor?.id || "";
      } else if (game.user.character) {
        activeSpeakerAlias = game.user.character.name;
        targetActorId = game.user.character.id;
      }
    }

    const finalSpeaker = { alias: activeSpeakerAlias, scene: canvas.scene?.id || "", actor: targetActorId, token: targetTokenId };
    const streamOutput = appContainer.querySelector(".stream-output");
    if (streamOutput) {
       const userPara = document.createElement("p");
       userPara.className = "chat-line user-line";
       userPara.innerHTML = `<strong>${activeSpeakerAlias}:</strong> ${message}`;
       streamOutput.appendChild(userPara);
       streamOutput.scrollTop = streamOutput.scrollHeight;
    }

    await ChatMessage.create({ user: game.user.id, speaker: finalSpeaker, content: message, type: CONST.CHAT_MESSAGE_TYPES?.IC || 1 });

    try {
      let aiResponse = "";
      let sanitizedHistoryHTML = "";
      if (streamOutput) {
        const clone = streamOutput.cloneNode(true);
        clone.querySelectorAll(".mechanics-challenge-intercepted, .challenge-card, .ai-director-chat-card").forEach(el => el.remove());
        sanitizedHistoryHTML = clone.innerHTML;
      }

      const contextData = { currentOutput: sanitizedHistoryHTML, journalText: "", memoryText: "", chatHistoryText: "" };
      const chatHistoryElements = $("#chat-history").find("div");
      if (chatHistoryElements.length) contextData.chatHistoryText = chatHistoryElements.map((i, el) => $(el).text().trim()).get().join("\n");
      try { contextData.memoryText = game.settings.get("ai-director", "worldMemory") || "None"; } catch(e) {}
      
      const currentChaosFactor = game.settings.get(MODULE_ID, "chaosFactor") ?? 5;
      const agencySafetyPrompt = `\n[SYSTEM: Identity: ${activeSpeakerAlias}. Mode: ${chosenMode}. Chaos: ${currentChaosFactor}. Output ONLY narrative response.]`;
      const modifiedMessage = message + agencySafetyPrompt;

      if (chosenIdentity !== "Game Master" || chosenMode === "npc") {
        let targetActor = game.actors.contents.find(a => a.name === chosenIdentity) || null;
        const { executeNPCChatMode } = await import("/modules/ai-director/scripts/modes/npc-chat.js");
        aiResponse = await executeNPCChatMode(modifiedMessage, targetActor, chosenIdentity, contextData);
      } else {
        const { executeGMMode } = await import("/modules/ai-director/scripts/modes/gm-modes.js");
        aiResponse = await executeGMMode(modifiedMessage, chosenMode, contextData);
      }

      if (streamOutput && aiResponse) {
         const responsePara = document.createElement("p");
         responsePara.className = "chat-line director-line";
         responsePara.innerHTML = `<strong>${chosenIdentity}:</strong> ${aiResponse}`;
         streamOutput.appendChild(responsePara);
         streamOutput.scrollTop = streamOutput.scrollHeight;
      }
    } catch (err) {
      console.error("AI Director Error:", err);
      ui.notifications.error("AI Director failed.");
    }
  }

  static async onRecap(event, target) {
    event.preventDefault();
    const appContainer = target?.closest(".ai-director-app") || document.querySelector(".ai-director-app") || this.element;
    const streamOutput = appContainer.querySelector(".stream-output");
    if (streamOutput) streamOutput.innerHTML = "";
    try {
      const { executeSessionRecap } = await import("/modules/ai-director/scripts/ai/recap-manager.js");
      await executeSessionRecap(streamOutput);
    } catch (err) {
      ui.notifications.error("Recap error.");
    }
  }

  static async onScene(event, target) {
    event.preventDefault();
    const appContainer = target?.closest(".ai-director-app") || document.querySelector(".ai-director-app") || this.element;
    const streamOutput = appContainer.querySelector(".stream-output");
    const chaosFactor = Number(appContainer.querySelector("#chaos-factor")?.value) || 5;
    
    // Extract input text if provided, otherwise pass empty string for random generation
    const promptInput = appContainer?.querySelector("textarea[name='chat-input']") || appContainer?.querySelector(".prompt-textarea");
    const rawDirective = promptInput?.value?.trim() || "";

    if (promptInput && rawDirective) {
      promptInput.value = ""; // Clear input after reading
    }

    try {
      const { executeSceneGeneration } = await import("../scripts/data/scene-manager.js");
      await executeSceneGeneration(streamOutput, chaosFactor, this, rawDirective);
    } catch (err) {
      console.error("AI Director | Extraction failure inside onScene action interceptor:", err);
      ui.notifications.error("Scene error.");
    }
  }

  static async onNPC(event, target, autoContext = null) {
    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    try {
      if (autoContext) {
        const { generateHeadlessNPC } = await import("/modules/ai-director/scripts/engines/npc-generator.js");
        await generateHeadlessNPC(autoContext);
        return;
      }

      const controlled = canvas.tokens?.controlled || [];
      const currentActor = controlled[0]?.actor || game.user.character;

      if (!currentActor) {
        ui.notifications.warn("AI Director: Please control a token or assign an Actor document to run profile routing.");
        return;
      }

      const { processAiDirectorHandoff } = await import("/modules/ai-director/scripts/ai/npc-profile-builder.js");
      await processAiDirectorHandoff(currentActor);

    } catch (err) {
      console.error("AI Director | NPC routing execution exception captured:", err);
      ui.notifications.error("NPC Processing Error.");
    }
  }

  static async onClear(event, target) {
    event.preventDefault();
    const appContainer = target?.closest(".ai-director-app") || document.querySelector(".ai-director-app") || this.element;
    const streamOutput = appContainer.querySelector(".stream-output");
    if (streamOutput) streamOutput.innerHTML = "";
    ui.notifications.info("AI Director: Stream cleared.");
  }

  // =========================================================================
  // PRODUCTION FORGE ASSET ACTIONS (UNIFIED SINGLE RESPONSIBILITY LOOP)
  // =========================================================================

  /**
   * Refines a narrative scene context through Hermes 3, checks routing settings,
   * and triggers either ComfyUI diffusion generation or Dungeon Draw vector generation.
   */
  static async executeBackgroundMapForge(sceneText, originalName, options = {}) {
    if (!game.user?.isGM) return null;

    const configuredEngine = String(
      options.mapEngine ||
      game.settings.get(MODULE_ID, "mapEngine") ||
      "cartographer"
    ).trim();
    const engine = configuredEngine.toLowerCase() === "comfyui"
      ? "comfyUI"
      : "cartographer";
    const rawTitle = originalName ||
      (typeof sceneText === "object" ? sceneText.name : "Map Sector");
    const cleanTitle = String(rawTitle || "Map Sector")
      .replace(/^(?:\[(?:Map|Scene)\]\s*)+/gi, "")
      .trim();

    if (engine === "cartographer") {
      const manifest =
        options.manifest ||
        (sceneText && typeof sceneText === "object" && Array.isArray(sceneText.sectors)
          ? sceneText
          : null);

      if (!manifest?.sectors?.length) {
        ui.notifications.warn(
          "AI Director | Cartographer requires a multi-sector manifest. No new scene was created."
        );
        return null;
      }

      const generationKey = String(
        manifest.manifestId ||
        manifest.layoutSeed ||
        manifest.dungeonTitle ||
        cleanTitle
      )
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const expectedName = `[Map] ${cleanTitle}`;
      const destinationScene =
        options.scene ||
        game.scenes.contents.find(scene =>
          scene.getFlag(MODULE_ID, "sceneGenerationKey") === generationKey &&
          scene.getFlag(MODULE_ID, "sceneGenerationOwner") === "cartographer"
        ) ||
        game.scenes.contents.find(scene =>
          scene.name === expectedName &&
          (
            scene.drawings.contents.some(document =>
              document.flags?.[MODULE_ID]?.cartographer
            ) ||
            scene.walls.contents.some(document =>
              document.flags?.[MODULE_ID]?.cartographer
            )
          )
        ) ||
        canvas.scene;

      if (!destinationScene) {
        throw new Error("Cartographer destination scene could not be resolved.");
      }

      console.log(
        "AI Director | Reusing Cartographer destination scene:",
        destinationScene.id,
        destinationScene.name
      );

      const result = await MapForge.buildConnectedDungeonLayout(manifest, {
        scene: destinationScene,
        floor: Number(options.floor) || 1,
        gridSize: Number(options.gridSize) || Number(destinationScene.grid?.size) || 100,
        clearExisting: options.clearExisting !== false,
        renderRooms: true,
        renderCorridors: true,
        renderLabels: true,
        renderWalls: true,
        renderFloorLayer: true,
        renderVentilation: options.renderVentilation !== false,
        layoutProfile: options.layoutProfile || manifest.layoutProfile || null,
        architecturalScale: options.architecturalScale || null,
        genre: options.genre || manifest.genre || "auto"
      });

      if (canvas.scene?.id !== destinationScene.id) {
        await destinationScene.activate();
        await destinationScene.view();
      }

      ui.notifications.success(
        `AI Director | Cartographer map ready in ${destinationScene.name}.`
      );
      return result;
    }

    if (game.settings.get(MODULE_ID, "enableComfyUI") !== true) {
      ui.notifications.warn("AI Director | ComfyUI is disabled.");
      return null;
    }

    ui.notifications.info("AI Director | Condensing scene parameters for ComfyUI...");
    const extractionPrompt = `Extract only structural environment layouts, physical spatial configurations, obstacles, and tactical room details from this scene text into one descriptive prompt under 75 words. Do not include characters, tokens, grids, or plot points:

"${sceneText}"`;
    let refinedPrompt = typeof sceneText === "string"
      ? sceneText
      : sceneText?.description || sceneText?.name || "Tactical Encounter Map";

    try {
      const { OllamaClient } = await import("../scripts/api/ollama-client.js");
      const activeModel = game.settings.get(MODULE_ID, "modelName") || "hermes3";
      refinedPrompt = await OllamaClient.generateText(
        extractionPrompt,
        "You are a top-down tactical map architect specializing in spatial layouts.",
        { model: activeModel }
      );
    } catch (error) {
      console.warn("AI Director | ComfyUI prompt refinement failed; using source text.", error);
    }

    let destinationScene = options.scene || null;
    if (!destinationScene) {
      destinationScene = await Scene.create({
        name: `[Map] ${cleanTitle}`,
        navName: cleanTitle,
        navigation: true,
        width: 2048,
        height: 2048,
        grid: { type: CONST.GRID_TYPES.SQUARE, size: 100 },
        padding: 0.05,
        tokenVision: true,
        globalLight: false,
        flags: {
          [MODULE_ID]: {
            sceneGenerationOwner: "comfyUI"
          }
        }
      });
    }

    await destinationScene.activate();
    await destinationScene.view();
    const { ComfyMapPipeline } = await import("../scripts/pipelines/comfy-map-pipeline.js");
    const result = await ComfyMapPipeline.generateAndApplyMap(
      refinedPrompt,
      destinationScene
    );
    ui.notifications.success(
      `AI Director | ComfyUI map ready in ${destinationScene.name}.`
    );
    return result;
  }

  /**
   * Refines a narrative scene context through Hermes 3 to construct an atmospheric panorama.
   * Generates and logs asset without forcing automatic scene document creation.
   */
  static async executeBackgroundPanoramaForge(sceneText, originalName) {
    ui.notifications.info("AI Director | Extracting first-person environment framing...");

    // UPDATED PROMPT: Explicitly commands first-person POV and immediate interior/eye-level sightlines
    const extractionPrompt = `Convert this scene context into a detailed first-person perspective (POV) image generation prompt under 75 words. 
Focus strictly on what someone standing directly in the room sees looking forward at eye-level (architecture, lighting, atmosphere, focal points, doors, textures). 
Do NOT include characters, wide landscape views, floor plans, or meta-narrative text:\n\n"${sceneText}"`;

    let refinedPrompt = "";
    try {
      const { OllamaClient } = await import("../scripts/api/ollama-client.js");
      
      const settingKey = `${MODULE_ID}.defaultModel`;
      const activeModel = game.settings.settings.has(settingKey)
        ? game.settings.get(MODULE_ID, "defaultModel")
        : "hermes3";
      
      refinedPrompt = await OllamaClient.generate(
        extractionPrompt, 
        "You are an expert concept artist crafting first-person environment descriptions for image generation.", 
        { model: activeModel }
      );
    } catch (err) {
      console.error("AI Director | Refinement step failed on local client request:", err);
      refinedPrompt = typeof sceneText === "string" ? sceneText : (sceneText?.description || sceneText?.name || "Interior Chamber");
    }

    try {
      const { AIDirectorPanoramaForge } = await import("../scripts/ai/panorama-forge.js");
      const systemId = game.system.id;
      const cleanTitle = (originalName || "Scene").replace(/^(\[Scene\]\s*)+/i, "").trim();
      
      // Pass parameters into panorama backend (renders card and journal entry without scene creation)
      const panoramaPath = await AIDirectorPanoramaForge.forgeScenePanorama(systemId, refinedPrompt, false, cleanTitle);
      
      if (panoramaPath) {
        ui.notifications.success(`AI Director | Cinematic panorama scenery successfully forged!`);
      }
    } catch (err) {
      console.error("AI Director | Panorama pipeline threw exception:", err);
      ui.notifications.error("Failed to generate cinematic scenery.");
    }
  }
}