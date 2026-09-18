// modules/ai-director/scripts/ai/prompt-builder.js

import { classifyPlayerIntent } from "../prompt-factory/system-rules.js";
import { buildGMPrompt } from "../prompt-factory/gm-prompts.js";
import { buildScenePrompt } from "../prompt-factory/scene-prompts.js";
import { buildActorPrompt } from "../prompt-factory/actor-prompts.js";
import { logSocialInteraction } from "./short-term-telemetry.js";
import { getOrInitializeProfile, getBehaviorModifiers, getRelationshipDirectives } from "./npc-profile-builder.js";

/**
 * MASTER PROMPT FACTORY ORCHESTRATOR
 * Evaluates player intent telemetry, gathers deep character behavioral traits, 
 * maps Foundry VTT scene contexts, and handles structured sub-factory routing.
 * 
 * @param {string} rawInput - The plain text string typed into the terminal workspace.
 * @param {object} baseContext - Core structural tracking overrides passed from the UI.
 * @returns {Promise<{system: string, user: string, intent: object}>} Complete compiled instructions.
 */
export async function buildPrompt(rawInput, baseContext = {}) {
  // Track if this was dynamically determined by the auto engine or explicitly chosen via UI
  const isExplicitOverride = baseContext.mode && baseContext.mode !== "auto";
  const routingSource = isExplicitOverride ? "explicit_ui" : "auto_intent_engine";
  
  let intent = { requiresRoll: false, suggestedMode: "action" };

  // 🛠️ INTEGRATED FIX: Only hit the LLM Classifier if the user hasn't explicitly locked a UI tab/mode
  if (!isExplicitOverride) {
    console.log("AI Director | Assessing intent classification metrics...");
    intent = await classifyPlayerIntent(rawInput);
    console.log("AI Director | Classification engine signatures resolved:", intent);
  } else {
    console.log(`AI Director | Bypassing classification. Explicit UI Mode requested: ${baseContext.mode}`);
    // Match structure for down-stream checks
    intent.suggestedMode = baseContext.mode; 
  }
  
  // Determine final operating mode based on structural priority
  const operationalMode = isExplicitOverride ? baseContext.mode : intent.suggestedMode;

  // 2. Safely capture active scene coordinates and document references
  // EXPERT TARGETING UPDATE: Check UI overrides -> then targeted tokens -> then controlled selection
  const targetedToken = game.user.targets.first();
  const activeToken = baseContext.token || targetedToken || canvas.tokens?.controlled[0] || null;
  let activeActor = baseContext.actor || activeToken?.actor || game.user.character || null;

  // =========================================================================
  // AUTOMATED IDENTITY GUARDRAIL (Only runs during fully automated routing)
  // =========================================================================
  if (operationalMode === "npcchat" && routingSource === "auto_intent_engine") {
    if (!activeToken || activeActor?.hasPlayerOwner || activeActor?.folder?.name === "PCs") {
      console.log("AI Director | Intent engine predicted NPC Chat but active token is a PC. Scanning canvas for targets...");
      
      // Look for any targeted tokens on screen first
      const currentTarget = game.user.targets.first();
      if (currentTarget && !currentTarget.actor?.hasPlayerOwner) {
        activeActor = currentTarget.actor;
        console.log(`AI Director | Auto-routed target actor to targeted token: ${activeActor.name}`);
      } else {
        // Fallback: Clear activeActor reference so it falls back cleanly to environmental narrative rules
        activeActor = null;
      }
    }
  }
  // =========================================================================

  // 3. Assemble full system and narrative parameters expected by your prompt ecosystem
  const contextPackage = {
    actor: activeActor,
    actorName: activeActor ? activeActor.name : (baseContext.actorName || "Unknown Entity"),
    userCharacterName: game.user.character?.name || baseContext.userCharacterName || "The Player",
    systemFlavorDirective: `Active System Profile: ${game.system.id.toUpperCase()}. Adhere to tactical immersion boundaries.`,
    routingSource: routingSource,
    
    // Dynamic RAG / Document defaults
    journalText: baseContext.journalText || "NO_MATCHING_CANON_DATA_FOUND",
    chatHistoryText: baseContext.chatHistoryText || "No previous remarks recorded this scene.",
    availableHooksText: baseContext.availableHooksText || "No hooks currently floating in active deck pools.",
    currentOutput: baseContext.currentOutput || canvas.scenes?.active?.name || "Immediate setting.",
    
    state: {
      recentEvents: baseContext.recentEvents || ["Campaign state sub-routines active."]
    },

    // Default behavioral placeholders
    behaviorDirectives: "",
    relationshipDirectives: ""
  };

  let systemDirective = "";
  let userPayload = "";

  // 4. Coordinate routing targets and handle data extraction loops
  switch (operationalMode) {
    // 🌟 ADDED: Explicit routing case to intercept and populate background director pulses
    case "director_pulse":
      console.log("AI Director | Handing execution to Pulse Narrative Engine.");
      systemDirective = "You are the AI Director. Create a subtle narrative twist or world event that suggests unseen forces are at play. Keep it atmospheric and under 150 words.";
      userPayload = rawInput || "The world feels quiet. What happens next?";
      break;

    case "npcchat":
    case "npc": // 🛠️ Handle both string variations seamlessly
      if (!activeActor) {
        console.warn("AI Director | NPC Chat mode triggered but no target non-player token or actor context is active.");
        console.log("AI Director | Diverting to standard narrative description fallback to avoid profile parsing failure.");
        
        const fallbackPayload = buildGMPrompt("description", rawInput, contextPackage);
        systemDirective = fallbackPayload.systemDirective;
        userPayload = fallbackPayload.userPayload;
        break;
      }
      
      console.log(`AI Director | Handing execution to Actor Factory pipeline for character: ${contextPackage.actorName} [Tracked via: ${routingSource.toUpperCase()}]`);
      
      // Resolve the profile and apply behavioral laws to the execution payload
      const profile = await getOrInitializeProfile(activeActor);
      if (profile) {
        contextPackage.behaviorDirectives = getBehaviorModifiers(profile.traits);
        contextPackage.relationshipDirectives = getRelationshipDirectives(profile.relationships?.party || { disposition: "Neutral", trust: 5 });
      }
      
      const actorPromptPayload = await buildActorPrompt(rawInput, contextPackage, { token: activeToken });
      systemDirective = actorPromptPayload.systemDirective;
      userPayload = actorPromptPayload.userPayload;
      break;

    case "observe":
      console.log("AI Director | Handing execution to Scene Prompt factory.");
      const scenePromptPayload = buildScenePrompt(rawInput, contextPackage);
      systemDirective = scenePromptPayload.systemDirective;
      userPayload = scenePromptPayload.userPayload;
      break;

    case "yesno":
    case "info":
    case "action":
    default:
      console.log(`AI Director | Handing execution to Game Master Core [Mode: ${operationalMode}].`);
      
      // If a mechanical roll is required from an auto-intent match, inject it
      if (intent.requiresRoll) {
        contextPackage.currentOutput += `\n\n[REQUIRED MECHANICAL ROLL EXECUTION DETECTED]:
- Check Type Constraints: ${intent.checkType}
- Target Check Skill: ${intent.skill} (${intent.stat})
- Difficulty Threshold: ${intent.suggestedDV || intent.suggestedDC || 14}
- Opposing Reaction Target: ${intent.opposingSkill || "None (Static Task)"}`;
      }

      const gmPromptPayload = buildGMPrompt(operationalMode, rawInput, contextPackage);
      systemDirective = gmPromptPayload.systemDirective;
      userPayload = gmPromptPayload.userPayload;
      break;
  }

  // 🛠️ FIX APPLIED: Nullish fallbacks protect the pipeline if sub-factories return undefined strings
  return {
    system: (systemDirective || "").trim(),
    user: (userPayload || "").trim(),
    intent: intent
  };
}