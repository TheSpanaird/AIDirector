// modules/ai-director/scripts/engines/resolution-engine.js

import { buildPrompt } from "../ai/prompt-builder.js";
import { MechanicsBridge } from "./mechanics-bridge.js";
import { FlagFactory, PROCESS_TYPES } from "/modules/ai-director/core/flag-factory.js";

// 🗺️ ALIGNED DATA DOMAIN: Pulls from renamed telemetry module instead of rag-engine
import { retrieveRelevantContext } from "../ai/short-term-telemetry.js";

// =========================================================================
// TWO-TIER SKILL RESOLVER UTILITY
// =========================================================================
/**
 * Resolves a UI skill string to the actual actor skill data block.
 * Handles CPR, 5e, and custom/item-based skill structures.
 */
function resolveActorSkill(actor, uiSkillString) {
  if (!actor || !uiSkillString) return null;

  // Normalize: lowercase, strip common parenthetical metadata wrappers, then drop non-alphanumeric text
  const normalize = (str) => {
    return String(str || "")
      .toLowerCase()
      .replace(/\s*\((attribute|skill|stat)\)\s*/g, "")
      .replace(/[^a-z0-9]/g, "");
  };
  
  const targetNormalized = normalize(uiSkillString);
  const skillsObj = actor.system.skills || {};
  
  // Tier 1: Direct Key Match (Fastest path)
  if (skillsObj[uiSkillString]) {
    return { key: uiSkillString, data: skillsObj[uiSkillString] };
  }

  // Tier 2: Deep Iteration (Check keys, labels, names)
  for (let [key, skillData] of Object.entries(skillsObj)) {
    const cleanKey = normalize(key);
    const cleanLabel = normalize(skillData.label || "");
    const cleanName = normalize(skillData.name || "");

    // Exact Match Strategy
    if (targetNormalized === cleanKey || targetNormalized === cleanLabel || targetNormalized === cleanName) {
      return { key, data: skillData };
    }

    // Bidirectional Substring Match (Ensures system keys match UI strings with embedded helper texts)
    if (targetNormalized.length >= 4) {
      const isKeyMatch = cleanKey.includes(targetNormalized) || targetNormalized.includes(cleanKey);
      const isLabelMatch = cleanLabel.includes(targetNormalized) || targetNormalized.includes(cleanLabel);
      const isNameMatch = cleanName.includes(targetNormalized) || targetNormalized.includes(cleanName);

      if (isKeyMatch || isLabelMatch || isNameMatch) {
        return { key, data: skillData };
      }
    }
  }

  return null;
}

export const ResolutionEngine = {
  init() {
    // =========================================================================
    // 1. CHAT RENDER HOOK (V13 UPGRADED UI CONTROLS)
    // =========================================================================
    Hooks.on("renderChatMessageHTML", (message, element, data) => {
      if (!element) return;
      
      // Bind the interactive dice triggers using native event listeners
      element.addEventListener("click", async (event) => {
        const button = event.target.closest(".ai-director-roll-action-btn");
        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        // 🔍 EXPORT UI INPUT TO CHAT: Grab standard user inputs cleanly
        const uiTextArea = document.querySelector("#ai-director-app .prompt-textarea, #ai-director-app textarea, #ai-director-app input[type='text']");
        if (uiTextArea && uiTextArea.value.trim()) {
          const explicitUserIntent = uiTextArea.value.trim();
          
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: game.user.character }),
            content: `<strong>Action Declaration:</strong> "${explicitUserIntent}"`,
            style: CONST.CHAT_MESSAGE_STYLES?.OTHER || 0
          });

          uiTextArea.value = "";
        }

        // 🛠️ Extract Correlation ID from DOM Element or its ancestral card container
        const correlationId = button.dataset.correlationId || button.closest("[data-correlation-id]")?.dataset.correlationId || message.id;

        // FIX 1: Read the exact dataset properties exported by skill-check-orchestrator.js
        const skillKey = button.dataset.skillKey;
        const skillName = button.dataset.skillName || button.dataset.skill;
        const { stat, target } = button.dataset;

        const actor = game.user.character || canvas.tokens.controlled[0]?.actor;
        if (!actor) {
          ui.notifications.warn("AI Director | Please select a token or assign a character sheet to roll.");
          return;
        }

        if (game.cyberpunk?.rollSkillMacro) {
          ui.notifications.info(`AI Director | Rolling ${skillKey || skillName} for ${actor.name} (Target DV ${target})...`);
          game.cyberpunk.rollSkillMacro(actor.id, skillKey || skillName);
        } else {
          const cleanStat = (stat || "").toLowerCase().trim();
          let finalModifier = 0;

          // FIX 2: Try to resolve using skillKey first, fallback to human-readable skillName
          const resolvedSkill = resolveActorSkill(actor, skillKey) || resolveActorSkill(actor, skillName);

          if (resolvedSkill) {
            const skillData = resolvedSkill.data;
            const statVal = Number(skillData.stat || 0);
            const lvlVal = Number(skillData.level || 0);
            const modVal = Number(skillData.mods || 0);
            finalModifier = statVal + lvlVal + modVal;
          } else if (cleanStat && cleanStat !== "attribute" && actor.system.stats?.[cleanStat]) {
            // Safe system fallback to raw primary character statistics blocks (e.g., actor.system.stats.tech)
            finalModifier = Number(actor.system.stats[cleanStat]?.value || actor.system.stats[cleanStat] || 0);
          } else {
            console.warn(`AI Director | Could not map UI skill "${skillKey || skillName}" or stat "${stat}" to actor sheet:`, actor);
          }

          const rollExpression = `1d10x + ${finalModifier}`;
          const roll = new Roll(rollExpression, actor.getRollData());

          // FIX 3: Route this message process type to "SKILL_CHECK_SEQUENCE" so legacy intercepts skip it
          const outboundFlags = FlagFactory.createFlags({
            isAi: false,
            processType: "SKILL_CHECK_SEQUENCE",
            correlationId: correlationId,
            context: {
              characterName: actor.name,
              actorId: actor.id,
              skill: skillName,
              skillKey: skillKey,
              stat: stat,
              targetDC: Number(target || 15),
              isResolutionProcessing: false
            }
          });

          // Explicitly assign internal system flags wrapper to satisfy strict structural boundaries
          outboundFlags["ai-director"] = {
            process: "SKILL_CHECK_SEQUENCE",
            correlationId: correlationId
          };

          await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor }),
            flavor: `🎲 <strong>${actor.name}</strong> checks <strong>${skillName || stat}</strong> (DV ${target})`,
            flags: outboundFlags
          });
        }
      });

      // Target text area and workflow elements using native selectors instead of jQuery wrappers
      const card = element.querySelector(".ai-director-chat-card");
      if (!card) return;

      const textBlock = card.querySelector(".ai-director-draft-text");

      if (textBlock && game.user.role >= CONST.USER_ROLES.ASSISTANT) {
        textBlock.addEventListener("input", (e) => {
          game.socket.emit("module.cpr-ollama-importer", {
            type: "LIVE_TEXT_EDIT",
            messageId: message.id,
            text: e.target.innerHTML
          });
        });
      }

      const approveBtn = card.querySelector(".approve-scene-btn");
      if (approveBtn && textBlock) {
        approveBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          const finalProse = textBlock.innerHTML.trim();
          const rawAttr = card.getAttribute("data-gm-notes") || "";
          let unencodedNotes = "";
          
          try {
            unencodedNotes = decodeURIComponent(rawAttr);
          } catch (err) {
            unencodedNotes = rawAttr;
          }

          const formattedGMNotes = unencodedNotes.replace(/\\n/g, "<br>").replace(/\n/g, "<br>").trim();

          game.socket.emit("module.cpr-ollama-importer", { 
            type: "COMMIT_LOCK", 
            messageId: message.id, 
            user: game.user.name 
          });

          await JournalEntry.create({
            name: `Scene - ${new Date().toLocaleString()}`,
            folder: game.folders.contents.find(f => f.name === "AI Director Canon" && f.type === "JournalEntry")?.id,
            pages: [{
              name: "Narrative & Metadata",
              type: "text",
              text: { 
                content: `<h3>Player Narrative</h3><div>${finalProse}</div><hr><h3>GM Notes & NPC List</h3><div>${formattedGMNotes}</div>`, 
                format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML 
              }
            }]
          });

          await ChatMessage.create({
            speaker: { alias: "Game Master" },
            content: `<div class="ai-director-chat-card"><h3>✨ Scene Committed to Canon</h3><div class="ai-director-draft-text">${finalProse}</div></div>`,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER
          });

          if (unencodedNotes) {
            const listMatch = unencodedNotes.match(/NPC[\s-_]*GENERATION[\s-_]*LIST\s*:?([\s\S]*?)(?=\n\n|##|$)/i);
            if (listMatch && listMatch[1]) {
              const npcLines = listMatch[1].split("\n").map(l => l.trim()).filter(l => l.length > 0);
              
              // 🛠️ REALIGNMENT FIX: Swapped out dead path for modern profile engine
              const { generateHeadlessNPC } = await import("/modules/ai-director/scripts/engines/npc-profile-builder.js");
              
              ui.notifications.info("AI Director | Processing approved NPC list metadata...");

              for (let line of npcLines) {
                let npcDataContext = null;
                if (line.includes("[") && line.includes("]")) {
                  const bracketRegex = /\[\s*NAME\s*:\s*["']?([^"',\]]+)["']?,\s*ROLE\s*:\s*["']?([^"',\]]+)["']?\s*,\s*SPECIES\s*:\s*["']?([^"',\]]+)["']?\s*\]/i;
                  const match = line.match(bracketRegex);
                  if (match) {
                    npcDataContext = { npcName: match[1].trim(), npcRole: match[2].trim(), species: match[3].trim(), parentScene: finalProse };
                  }
                } else {
                  const cleanedLine = line.replace(/^[\s*\-•\d.]+\s*/, "").trim();
                  const structuralParts = cleanedLine.split(/[:,\-–]+/);
                  if (structuralParts.length >= 3) {
                    npcDataContext = { npcName: structuralParts[0].trim(), npcRole: structuralParts[1].trim(), species: structuralParts[2].trim(), parentScene: finalProse };
                  }
                }

                if (npcDataContext && npcDataContext.npcName) {
                  try { await generateHeadlessNPC(npcDataContext); } catch (execErr) { console.error("AI Director | NPC manifestation crashed:", execErr); }
                }
              }
            }
          }
          ui.notifications.info(`✅ Scene approved and committed.`);
        });
      }
    });

    // =========================================================================
    // 2. UNIFIED SINGLE DICE INTERCEPTOR (DELETED)
    // =========================================================================
    // Legacy roll catching workflow completely removed to make room for decoupled orchestration architecture.

    // =========================================================================
    // 3. SOCKET READY SYSTEM LINK
    // =========================================================================
    Hooks.once("ready", () => {
      game.socket.on("module.cpr-ollama-importer", async (payload) => {
        const msg = document.querySelector(`[data-message-id="${payload.messageId}"]`);
        if (!msg) return;

        switch (payload.type) {
          case "LIVE_TEXT_EDIT": {
            const draft = msg.querySelector(".ai-director-draft-text");
            if (draft) draft.innerHTML = payload.text;
            break;
          }
          case "COMMIT_LOCK": {
            const controls = msg.querySelector(".ai-director-controls");
            if (controls) controls.style.display = "none";
            
            const draft = msg.querySelector(".ai-director-draft-text");
            if (draft) draft.setAttribute("contenteditable", "false");
            
            const banner = msg.querySelector(".ai-director-status-banner");
            if (banner) {
              banner.style.display = "block";
              banner.innerHTML = `[✅ Committed by ${payload.user}]`;
            }
            break;
          }
        }
      });
    });
  }
};