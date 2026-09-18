// modules/ai-director/scripts/listeners/contested-button-listener.js

import { MODULE_ID } from "../settings.js";
import { ContestedCheckPrompts } from "../prompt-factory/contested-prompts.js";

export class ContestedButtonListener {
  /**
   * Binds global click handlers to the chat log to intercept contested roll button interactions.
   */
  static activateListeners() {
    Hooks.on("renderChatLog", (app, html, data) => {
      html.addEventListener("click", (event) => {
        const button = event.target.closest(".roll-contested-btn") || event.target.closest(".ai-director-roll-action-btn");
        if (!button) return;

        ContestedButtonListener.onRollContestedClick(event, button);
      });
    });

    // --- AUTOMATION HOOK FOR DETECTING NEW CARDS ---
    Hooks.on("createChatMessage", async (message, options, userId) => {
      if (!game.user.isGM) return;

      // 1. STRICT ID ENFORCEMENT: Ignore core database transactions lacking IDs
      if (!message.id) return;

      // 2. ABSOLUTE GUARDRAIL: Immediately bail if the message has no flag signatures for our module
      const hasModuleFlag = message.flags && (Object.prototype.hasOwnProperty.call(message.flags, MODULE_ID) || Object.prototype.hasOwnProperty.call(message.flags, "ai-director"));
      if (!hasModuleFlag) return;

      const rawFlags = message.flags?.[MODULE_ID] || message.flags?.["ai-director"];
      if (!rawFlags) return;

      // 3. STRUCTURAL HOOK LOCK: Only touch the message if it actually contains a context bundle
      const ctx = rawFlags.context;
      const routing = rawFlags.routing;
      if (!ctx || ctx.status !== "pending_rolls") return;

      const flagKey = message.flags?.["ai-director"] ? "flags.ai-director" : `flags.${MODULE_ID}`;

      // 4. TRACKING ID INJECTION: Ensure internal tracking IDs exist safely in the flag array
      if (!rawFlags.correlationId && !ctx.correlationId) {
        const assignedTrackingId = randomID();
        console.log(`AI Director | Injected missing correlation ID (${assignedTrackingId}) to message ${message.id}`);
        
        rawFlags.correlationId = assignedTrackingId;
        ctx.correlationId = assignedTrackingId;
        
        // Push update to DB immediately to keep flags in sync
        await message.update({
          [`${flagKey}.correlationId`]: assignedTrackingId,
          [`${flagKey}.context.correlationId`]: assignedTrackingId
        });
      }

      if (routing?.process === "RAW_CONVERSATION" || !routing?.processType) {
        
        // --- TARGET FALLBACK IMPLEMENTATION ---
        const targetedTokens = Array.from(game.user.targets);
        const targetToken = targetedTokens[0] || canvas.tokens?.controlled[0];
        const actor = targetToken?.actor;

        if (actor) {
          const actorFolder = actor.folder?.name;
          const isNPC = !actorFolder || actorFolder.trim().toUpperCase() !== "PCS";

          // Only automate if it's an NPC, AND we haven't already automated this instance
          if (isNPC && !ctx.npcAutomationExecuted) {
            console.log(`AI Director | NPC automated via target/folder criteria ("${actorFolder}"). Rolling for ${actor.name}`);
            try {
              const sideData = {
                skill: ctx.targetSkill || "Facedown",
                stat: ctx.targetStat || "COOL"
              };

              // Capture the system check evaluation
              const isSystemCPR = game.system.id === "cyberpunk-red-core" || game.system.id === "cpr";
              const html = $(message.content);
              const htmlText = html.text().toLowerCase();
              const globalIntent = ctx.scenario?.toLowerCase() || ctx.intent?.toLowerCase() || "";
              
              const isFacedownForced = isSystemCPR && (
                ctx.isFacedown || 
                sideData.skill?.toLowerCase() === "facedown" ||
                globalIntent.includes("facedown") ||
                htmlText.includes("facedown")
              );

              const totalRollValue = await ContestedButtonListener.executeSystemRoll(actor, sideData, ctx, message);
              
              ctx.npcAutomationExecuted = true;
              ctx.npcRollTotal = totalRollValue;
              ctx.npcActorName = actor.name;
              
              // Target the specific column belonging to the NPC by matching text names roughly/safely
              let targetedLane = null;
              html.find(".defender-lane, .initiator-lane, div").each((i, el) => {
                const text = $(el).text() || "";
                if (text.includes(actor.name) || (ctx.actorName && text.includes(ctx.actorName))) {
                  if ($(el).hasClass("defender-lane") || $(el).hasClass("initiator-lane")) {
                    targetedLane = $(el);
                    return false;
                  }
                }
              });

              if (!targetedLane) {
                targetedLane = html.find(".defender-lane").length ? html.find(".defender-lane") : html.find(".ledger-lane").last();
              }

              if (isFacedownForced && targetedLane) {
                targetedLane.find(".skill-tag").text("Facedown");
              }

              let targetedButton = targetedLane ? targetedLane.find(".roll-contested-btn, .ai-director-roll-action-btn") : null;
              if (!targetedButton || !targetedButton.length) {
                targetedButton = html.find(`[data-type="defender"], .roll-contested-btn, .ai-director-roll-action-btn`).last();
              }

              if (targetedButton && targetedButton.length) {
                targetedButton.replaceWith(`<span class="roll-score">${totalRollValue}</span>`);
              }

              const targetContextKey = message.flags?.["ai-director"] ? "flags.ai-director.context" : `flags.${MODULE_ID}.context`;
              
              // Check if the player already rolled before the NPC got automated.
              if (ctx.playerRollTotal !== undefined && ctx.playerRollTotal !== null) {
                await ContestedButtonListener.finalizeContestedMatchup(message, ctx, html);
              } else {
                await message.update({
                  content: html[0].outerHTML || html.html(),
                  [targetContextKey]: ctx
                });
              }
            } catch (err) {
              console.error("AI Director | Target NPC automation failed:", err);
            }
          }
        }
        return;
      }

      const activeProcessType = rawFlags.processType || routing?.processType;
      if (activeProcessType === "CONTESTED_RESOLUTION") {
        if (ctx.initiator && ctx.initiator.rollResult === null) {
          await ContestedButtonListener.checkAndTriggerStrictNPCRoll(message, ctx, "initiator");
        }
        if (ctx.defender && ctx.defender.rollResult === null) {
          await ContestedButtonListener.checkAndTriggerStrictNPCRoll(message, ctx, "defender");
        }
      }
    });
  }

  /**
   * Helper function for structural automation lanes using targets and folder validation
   */
  static async checkAndTriggerStrictNPCRoll(message, ctx, laneType) {
    const sideData = ctx[laneType];
    
    let actor = sideData.tokenId ? canvas.tokens.get(sideData.tokenId)?.actor : game.actors.get(sideData.actorId);
    if (!actor) {
      const targetedTokens = Array.from(game.user.targets);
      const targetToken = targetedTokens[0] || canvas.tokens?.controlled[0];
      actor = targetToken?.actor;
    }
    
    if (!actor) return;

    const actorFolder = actor.folder?.name;
    const isNPC = !actorFolder || actorFolder.trim().toUpperCase() !== "PCS";
    if (!isNPC) return;

    try {
      const totalRollValue = await ContestedButtonListener.executeSystemRoll(actor, sideData, ctx, message);
      sideData.rollResult = totalRollValue;

      const html = $(message.content);
      
      const isSystemCPR = game.system.id === "cyberpunk-red-core" || game.system.id === "cpr";
      if (isSystemCPR && (ctx.isFacedown || sideData.skill?.toLowerCase() === "facedown")) {
        html.find(`.${laneType}-lane .skill-tag`).text("Facedown");
      }

      html.find(`.${laneType}-lane .roll-contested-btn`).replaceWith(`<span class="roll-score">${totalRollValue}</span>`);

      const hasInit = ctx.initiator.rollResult !== null && ctx.initiator.rollResult !== undefined;
      const hasDef = ctx.defender.rollResult !== null && ctx.defender.rollResult !== undefined;

      if (hasInit && hasDef) {
        await ContestedButtonListener.finalizeContestedMatchup(message, ctx, html);
      } else {
        const flagKey = message.flags?.["ai-director"] ? "flags.ai-director.context" : `flags.${MODULE_ID}.context`;
        await message.update({ content: html[0].outerHTML || html.html(), [flagKey]: ctx });
      }
    } catch (e) {
      console.error("AI Director | Lane NPC automation failed:", e);
    }
  }

  /**
   * CORE MECHANICAL ROLLING ENGINE
   */
  static async executeSystemRoll(actor, sideData, ctx, message = null) {
    let totalRollValue = 0;
    const isSystemCPR = game.system.id === "cyberpunk-red-core" || game.system.id === "cpr";

    if (isSystemCPR) {
      const globalIntent = ctx.scenario?.toLowerCase() || ctx.intent?.toLowerCase() || "";
      const htmlText = message?.content ? $(message.content).text().toLowerCase() : "";

      const isFacedownMatchup = ctx.isFacedown || 
                                sideData.skill === "Facedown" || 
                                sideData.skill?.toLowerCase() === "facedown" ||
                                ctx.initiator?.skill?.toLowerCase() === "facedown" ||
                                ctx.defender?.skill?.toLowerCase() === "facedown" ||
                                globalIntent.includes("facedown") ||
                                htmlText.includes("facedown");

      if (isFacedownMatchup) {
        const coolValue = actor.system?.stats?.cool?.value || 0;
        const repValue = actor.system?.reputation?.value || actor.system?.rep?.value || 0;

        const roll = await new Roll(`1d10 + ${coolValue} + ${repValue}`).evaluate();
        await roll.toMessage({ 
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: `<strong>Facedown Duel</strong> (COOL ${coolValue} + Rep ${repValue})`
        });
        totalRollValue = roll.total;
      } else {
        const skillName = sideData.skill || "Human Perception";
        const skillItem = actor.items.find(i => i.type === "skill" && i.name.toLowerCase() === skillName.toLowerCase());
        const skillLevel = skillItem?.system?.level || 0;
        const statKey = skillItem?.system?.stat || "BODY";
        const statValue = actor.system?.stats?.[statKey.toLowerCase()]?.value || 0;

        const roll = await new Roll(`1d10 + ${statValue} + ${skillLevel}`).evaluate();
        await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
        totalRollValue = roll.total;
      }
    } else {
      const roll = await new Roll("1d20").evaluate();
      await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
      totalRollValue = roll.total;
    }
    return totalRollValue;
  }

  /**
   * Manual Roll Click Engine
   */
  static async onRollContestedClick(event, button) {
    event.preventDefault();
    const rollType = button.dataset.type || button.getAttribute("data-check-type") || "initiator";
    
    const card = button.closest(".ai-director-card");
    const correlationId = card?.dataset.correlationId;
    const messageId = button.closest(".message")?.dataset.messageId || button.closest(".chat-message")?.dataset.messageId;
    const message = game.messages.get(messageId);

    if (!message) return;

    const processType = message.getFlag(MODULE_ID, "processType");
    const rootProcessType = message.flags?.[MODULE_ID]?.processType || message.flags?.["ai-director"]?.processType;
    const activeProcessType = processType || rootProcessType;

    const isStrictContested = activeProcessType === "CONTESTED_RESOLUTION";

    if (isStrictContested && correlationId) {
      const flaggedCorrelationId = message.getFlag(MODULE_ID, "correlationId") || message.flags?.[MODULE_ID]?.correlationId;
      if (flaggedCorrelationId !== correlationId) return;
    }

    const ctx = message.getFlag(MODULE_ID, "context") || message.flags?.[MODULE_ID]?.context || message.flags?.["ai-director"]?.context;
    if (!ctx) return;

    let sideData = isStrictContested ? (rollType === "initiator" ? ctx.initiator : ctx.defender) : null;
    
    if (!sideData) {
      sideData = {
        actorId: button.getAttribute("data-actor-id") || ctx.actorId,
        tokenId: button.getAttribute("data-token-id") || ctx.tokenId,
        skill: button.getAttribute("data-skill") || ctx.targetSkill || "Skill",
        stat: button.getAttribute("data-stat") || ctx.targetStat || "BODY",
        name: button.getAttribute("data-actor-name") || ctx.actorName || "Character"
      };
    }

    let actor = sideData.tokenId ? canvas.tokens.get(sideData.tokenId)?.actor : game.actors.get(sideData.actorId);
    
    if (!actor) {
      actor = game.user?.character;
      if (!actor) {
        const controlled = canvas.tokens?.controlled || [];
        const validPCOption = controlled.find(t => {
          const folderName = t.actor?.folder?.name || "";
          return folderName.trim().toUpperCase() === "PCS" && t.actor?.isOwner;
        });
        actor = validPCOption?.actor;
      }
    }

    if (!actor) {
      ui.notifications.warn("AI Director | Could not identify your controlled PC character to roll.");
      return;
    }

    if (!actor.isOwner && !game.user.isGM) {
      ui.notifications.warn(`AI Director | You do not have permission to roll for ${actor.name}.`);
      return;
    }

    button.setAttribute("disabled", "true");
    const originalButtonHTML = button.innerHTML;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Rolling...`;

    try {
      const totalRollValue = await ContestedButtonListener.executeSystemRoll(actor, sideData, ctx, message);
      const html = $(message.content);
      const flagKey = message.flags?.["ai-director"] ? "flags.ai-director.context" : `flags.${MODULE_ID}.context`;

      const isSystemCPR = game.system.id === "cyberpunk-red-core" || game.system.id === "cpr";
      if (isSystemCPR) {
        const globalIntent = ctx.scenario?.toLowerCase() || ctx.intent?.toLowerCase() || "";
        if (globalIntent.includes("facedown") || html.text().toLowerCase().includes("facedown")) {
          html.find(`.${rollType}-lane .skill-tag, [data-type="${rollType}"]`).closest(".ledger-lane, .initiator-lane, .defender-lane").find(".skill-tag").text("Facedown");
        }
      }

      const targetBtn = html.find(`[data-type="${rollType}"], .roll-contested-btn, .ai-director-roll-action-btn`).first();
      if (targetBtn.length) {
        targetBtn.replaceWith(`<span class="roll-score">${totalRollValue}</span>`);
      } else {
        button.replaceWith(`<span class="roll-score">${totalRollValue}</span>`);
      }

      if (isStrictContested) {
        sideData.rollResult = totalRollValue;

        const hasInit = ctx.initiator.rollResult !== null && ctx.initiator.rollResult !== undefined;
        const hasDef = ctx.defender.rollResult !== null && ctx.defender.rollResult !== undefined;

        if (hasInit && hasDef) {
          await ContestedButtonListener.finalizeContestedMatchup(message, ctx, html);
        } else {
          await message.update({ content: html[0].outerHTML || html.html(), [flagKey]: ctx });
        }
      } else {
        ctx.playerRollTotal = totalRollValue;
        ctx.playerActorName = actor.name;

        if (ctx.npcAutomationExecuted && ctx.npcRollTotal !== undefined && ctx.npcRollTotal !== null) {
          await ContestedButtonListener.finalizeContestedMatchup(message, ctx, html);
        } else {
          await message.update({ content: html[0].outerHTML || html.html(), [flagKey]: ctx });
        }
      }

    } catch (err) {
      console.error("AI Director | Manual roll click failed:", err);
      button.removeAttribute("disabled");
      button.innerHTML = originalButtonHTML;
    }
  }

  /**
   * SHARED NARRATION FINALIZATION LAYER
   */
  static async finalizeContestedMatchup(message, ctx, html) {
    let initRoll, defRoll, initName, defName, initSkill, defSkill;

    if (ctx.initiator && ctx.defender) {
      initRoll = ctx.initiator.rollResult;
      defRoll = ctx.defender.rollResult;
      initName = ctx.initiator.name;
      defName = ctx.defender.name;
      initSkill = ctx.initiator.skill || "Facedown";
      defSkill = ctx.defender.skill || "Facedown";
    } else {
      initRoll = ctx.playerRollTotal;
      defRoll = ctx.npcRollTotal;
      initName = ctx.playerActorName || "Player";
      defName = ctx.npcActorName || "NPC";
      initSkill = "Facedown";
      defSkill = "Facedown";
    }

    const isInitiatorSuccess = initRoll >= defRoll;
    const marginValue = initRoll - defRoll;

    if (isInitiatorSuccess) html.find(".initiator-lane").addClass("winner-highlight");
    else html.find(".defender-lane").addClass("winner-highlight");

    const outcomeResolutionPayload = {
      originalScenario: ctx.scenario || ctx.intent,
      initiatorName: initName,
      initiatorSkill: initSkill,
      initiatorRoll: initRoll,
      defenderName: defName,
      defenderSkill: defSkill,
      defenderRoll: defRoll,
      isInitiatorSuccess,
      margin: marginValue
    };

    const prosePrompts = ContestedCheckPrompts.buildContestedOutcomePrompt(outcomeResolutionPayload);
    let descriptiveProse = "The clash concludes in a sudden scramble for dominance.";

    try {
      const model = game.settings.get(MODULE_ID, "modelName") || "hermes3";
      const host = game.settings.get(MODULE_ID, "ollamaHost") || "http://localhost:11434";

      const response = await fetch(`${host}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, system: prosePrompts.system, prompt: prosePrompts.user, stream: false, options: { temperature: 0.7 } })
      });

      if (response.ok) {
        const jsonRes = await response.json();
        descriptiveProse = jsonRes.response?.trim() || descriptiveProse;
      }
    } catch (e) {
      console.error("AI Director | Prose narrative crashed:", e);
    }

    html.find(".card-body").append(`<div class="prose-resolution-block"><hr /><p class="cinematic-prose-output"><i class="fas fa-quote-left"></i> ${descriptiveProse}</p></div>`);
    
    ctx.status = "resolved";
    ctx.finalProse = descriptiveProse;

    const flagKey = message.flags?.["ai-director"] ? "flags.ai-director.context" : `flags.${MODULE_ID}.context`;
    await message.update({ content: html[0].outerHTML || html.html(), [flagKey]: ctx });
  }
}