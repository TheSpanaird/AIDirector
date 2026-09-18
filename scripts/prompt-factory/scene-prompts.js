// modules/ai-director/scripts/prompt-factory/scene-prompts.js

import { DungeonLedgerManager } from "../data/dungeon-ledger-manager.js";
import { SectorTracker } from "../data/sector-tracker.js";

/**
 * ACTIVE HORIZON PROMPT BUILDER & SCENE PROMPT FACTORY
 * Generates bounded prompts focused strictly on the active sector and immediately connected exits
 * to eliminate LLM hallucination and ensure low-latency response times.
 */

/**
 * Compiles the Active Horizon spatial payload for narrative generation.
 * @param {string} [overrideSectorId] - Optional explicit sector ID.
 * @returns {Object} Context payload containing active sector and adjacent exit metadata.
 */
export function getActiveHorizonContext(overrideSectorId = null) {
  const manifest = DungeonLedgerManager.getActiveManifest();
  if (!manifest || !manifest.sectors || !manifest.sectors.length) {
    return {
      dungeonTitle: "Unknown Location",
      overallGoal: "Explore the area.",
      activeSector: null,
      adjacentSectors: [],
      rawHorizonText: "NO_ACTIVE_DUNGEON_MANIFEST"
    };
  }

  const activeSectorId = overrideSectorId || SectorTracker.getPartyActiveSector();
  
  // Find current sector slice (defaults to sector 1 if not matched)
  const activeSector = manifest.sectors.find(s => s.sectorId === activeSectorId) || manifest.sectors[0];

  // Find adjacent sectors
  const adjacentIds = Array.isArray(activeSector.adjacentSectors) 
    ? activeSector.adjacentSectors 
    : (activeSector.adjacentSectors || "").split(",").map(s => s.trim());

  const adjacentSectors = manifest.sectors.filter(s => 
    adjacentIds.includes(s.sectorId) || adjacentIds.includes(s.name)
  );

  // Format Horizon Text Block
  let horizonText = `=== ACTIVE HORIZON (CURRENT SPATIAL LOCATION) ===\n`;
  horizonText += `DUNGEON: ${manifest.dungeonTitle}\n`;
  horizonText += `GOAL: ${manifest.overallGoal}\n\n`;
  
  horizonText += `--- CURRENT SECTOR: ${activeSector.name} [ID: ${activeSector.sectorId}] ---\n`;
  horizonText += `Atmosphere/Sensory: ${activeSector.sensoryDescription}\n`;
  horizonText += `Encounters/Hazards: ${activeSector.encounters}\n`;
  horizonText += `Traps & Secrets: ${activeSector.trapsAndSecrets}\n\n`;

  horizonText += `--- VISIBLE EXITS & ADJACENT SECTORS ---\n`;
  if (adjacentSectors.length > 0) {
    adjacentSectors.forEach(adj => {
      const summary = adj.sensoryDescription ? adj.sensoryDescription.substring(0, 100) : "Passageway onwards";
      horizonText += `- Exit leading to [${adj.name} (${adj.sectorId})]: ${summary}...\n`;
    });
  } else {
    horizonText += `- No immediate exits detected or end of path.\n`;
  }

  return {
    dungeonTitle: manifest.dungeonTitle,
    overallGoal: manifest.overallGoal,
    activeSector,
    adjacentSectors,
    rawHorizonText: horizonText
  };
}

/**
 * Builds the complete system and user scene prompt context using Active Horizon spatial bounds.
 * @param {string} request - User prompt or interaction intent.
 * @param {Object} ctx - Narrative execution context object.
 * @returns {{systemDirective: string, userPayload: string}} Structured prompt object for LLM dispatch.
 */
export function buildScenePrompt(request, ctx) {
  const activeScene = typeof game !== "undefined" ? game.scenes?.active : null;
  const sceneName = activeScene ? activeScene.name : "Unknown Environment";
  const sceneNavNotes = activeScene ? (activeScene.journal?.name || "No linked journal entries") : "None";

  // Fetch Phase 3 Active Horizon Context Slice
  const horizon = getActiveHorizonContext();
  const hasActiveHorizon = horizon.rawHorizonText !== "NO_ACTIVE_DUNGEON_MANIFEST";

  const systemDirective = `You are the AI Game Director and Omni-Present Narrator. Your objective is to describe environmental scenes vividly.
CRITICAL CONSTRAINT PRINCIPLES:
- Speak strictly as a sensory, atmospheric narrator. Do NOT write dialogue for specific actors unless requested.
- Maintain tactical sci-fi and tabletop immersion. Focus on lighting, sound, structural layout, and environmental tension.
- STRICT SPATIAL HORIZON RULE: Describe ONLY the Current Sector and sensory hints from visible adjacent exits. Do NOT introduce rooms, secrets, or encounters from non-adjacent sectors.
- Do NOT output side-commentary, introductory meta-notes, or procedural clarifying questions.
- Provide a complete, atmospheric description that flows directly into immediate gameplay.`;

  const spatialContextBlock = hasActiveHorizon
    ? horizon.rawHorizonText
    : `## THE TARGET ENVIRONMENT
- Active Map Scene Location: ${sceneName}
- Linked Reference Notes: ${sceneNavNotes}`;

  const userPayload = `## WORLD CONTEXT
${ctx.systemFlavorDirective || ""}
${ctx.journalText && ctx.journalText !== "NO_MATCHING_CANON_DATA_FOUND" ? ctx.journalText : "No core world journal records available for reference."}

${spatialContextBlock}

- Short-Term Session Summary Trackers:
${ctx.state?.recentEvents?.join("\n") || "No immediate scene shifts logged."}

## PROMPT INTERACTION ACTION
The player (${ctx.userCharacterName || "The Player"}) performs a sensory investigation or asks for context: "${request}"

## EXECUTION ORDER
Output ONLY the rich narrative depiction of the environment. Do NOT add structural markdown titles, conversational greeting frames, or procedural headers.`;

  return { systemDirective, userPayload };
}

/**
 * Legacy/Direct Active Horizon helper for raw string generation pipelines.
 * @param {string} userPrompt - Direct user string.
 * @returns {string} Sliced prompt string ready for direct inference.
 */
export function buildActiveHorizonScenePrompt(userPrompt) {
  const horizon = getActiveHorizonContext();

  return `
You are the Game Master AI Director running a scene.
STRICT CONSTRAINT: Describe ONLY the Current Sector and sensory hints from visible adjacent exits.
DO NOT introduce rooms, secrets, or encounters from non-adjacent sectors.

${horizon.rawHorizonText}

USER DIRECTIVE / ACTION: "${userPrompt}"

Provide a vivid, sensory description focused exclusively on the current sector environment and choices for adjacent exits.
`.trim();
}