// modules/ai-director/scripts/ai/prompt-scene.js

import { DUNGEON_MANIFEST_SCHEMA, DUNGEON_MANIFEST_TEMPLATE } from "../data/dungeon-schema.js";

/**
 * Structural Prompt Generation Engine for Cinematic Scenes & Multi-Sector Facilities.
 * Combines context parameters and forces predictable output formatting targets based on mode directives.
 * 
 * @param {string} journalText - World canon journal lore
 * @param {string} memoryText - Persistent state history and memory
 * @param {number} chaosFactor - Danger and predictability modifier vector
 * @param {string} [playerDirective=""] - GM/Player execution directive string
 * @returns {Object} `{ system, user }` prompt payload strings
 */
export function buildScenePrompt(journalText, memoryText, chaosFactor, playerDirective = "") {
  const activeScene = typeof game !== "undefined" ? game.scenes?.active : null;
  const sceneName = activeScene ? activeScene.name : "Unknown Environment";
  const sceneNavNotes = activeScene ? (activeScene.journal?.name || "No linked journal entries") : "None";

  // Scan world for known existing NPC entities to prevent character hallucination/contradictions
  let existingNpcContext = "None listed.";
  if (typeof game !== "undefined" && game.actors) {
    const knownNPCs = game.actors.contents
      .filter(a => a.type !== "character" && !a.folder?.name?.includes("Archive"))
      .map(a => {
        const publicRole = a.getFlag("ai-director", "publicRole") 
          || a.system?.details?.type?.value 
          || a.system?.details?.biography?.value?.replace(/<[^>]*>/g, "").substring(0, 100)
          || "Inhabitant";
        return `- ${a.name}: ${publicRole}`;
      })
      .slice(0, 10);

    if (knownNPCs.length > 0) {
      existingNpcContext = knownNPCs.join("\n");
    }
  }

  // Check if directive contains explicit multi-sector manifest instructions
  const isMultiRoomMode = playerDirective.includes("[FORCE MULTI-SECTOR DUNGEON MANIFEST]") || 
                          playerDirective.includes("[CONVERT SINGLE SCENE TO MULTI-SECTOR FACILITY]");

  // =========================================================================
  // MODE A: MULTI-SECTOR FACILITY MANIFEST (Strict Raw JSON Output)
  // =========================================================================
  if (isMultiRoomMode) {
    const systemDirective = `You are the AI Game Director. Your SOLE duty is to generate a multi-room facility layout as a single raw JSON object matching this exact shape:

{
  "dungeonTitle": "Title of the Facility",
  "overallGoal": "Primary mission objective for the party",
  "totalSectors": 3,
  "sectors": [
    {
      "sectorId": "sector_01",
      "name": "Entry Point / Current Location",
      "adjacentSectors": ["sector_02"],
      "sensoryDescription": "Vivid atmospheric description perceived upon entry.",
      "encounters": ["1x Patrol Guard"],
      "trapsAndSecrets": "Concealed keycard panel (Perception DC 14)",
      "mapPrompt": "Top-down bird-eye view tactical map of a room, gridless"
    }
  ]
}

CRITICAL COMPLIANCE RULES:
1. Do NOT output === PLAYER SCENE ===, === GM NOTES ===, or any prose headers.
2. Output ONLY the valid raw JSON object with keys: 'dungeonTitle', 'overallGoal', 'totalSectors', and 'sectors'.
3. 'sectors' must be an array of objects containing 'sectorId', 'name', 'adjacentSectors', 'sensoryDescription', 'encounters', 'trapsAndSecrets', and 'mapPrompt'.
4. Sector 1 (sector_01) MUST represent the current location or entry point of the facility.`;

    const userPayload = `## DIRECTIVE & INITIAL CONTEXT
${playerDirective}

## CURRENT LOCATION
Active Map: ${sceneName}
Reference Notes: ${sceneNavNotes}

## WORLD CANON & PERSISTENT MEMORY
Canon: ${journalText || "None"}
Memory: ${memoryText || "None"}
Chaos Factor: ${chaosFactor}`;

    return {
      system: systemDirective.trim(),
      user: userPayload.trim()
    };
  }

  // =========================================================================
  // MODE B: SINGLE AREA SCENE (Standard Narrative Prose Output)
  // =========================================================================
  const systemDirective = `You are the AI Game Director and Omni-Present Campaign Narrator.
Your goal is administrative campaign management and structured world narrative design.
Rely strictly on provided world context records and established NPC identities to construct realistic, sequential events.
Do not output side-commentary, greetings, or procedural notes.`;

  const userPayload = `## WORLD CONTEXT DATA (CRITICAL CANON - ALWAYS TRUE)
${journalText || "No core world journal records available for reference."}

## PERSISTENT STATE HISTORY
${memoryText || "No persistent story memory tracked."}

## KNOWN EXISTING NPCS IN WORLD
(If any of these entities appear in the scene, maintain their exact established identity and role. Do NOT invent new backstories for them):
${existingNpcContext}

## RUNTIME DIRECTIVE
${playerDirective ? `GM DIRECTIVE: ${playerDirective}` : "No specific directive; proceed with organic narrative flow."}

## RUNTIME CONSTANTS
- Current Active Map: ${sceneName}
- Reference Map Notes: ${sceneNavNotes}
- Chaos Factor Vector: ${chaosFactor} (Affects scene predictability and danger variance)

## CINEMATIC ADVANCEMENT CRITERIA
Advance the narrative timeline and generate an entirely NEW structural scene that follows sequentially after the most recent events described in your history blocks. Combat encounters, hidden dangers, changing environments, and custom NPCs can occur at ANY chaos factor level.

========================================================================
CRITICAL OUTPUT COMPLIANCE RULES:
YOU MUST FORMAT YOUR RESPONSE EXACTLY ACCORDING TO THE LAYOUT KEYWORDS BELOW.
DO NOT WRAP KEYWORDS IN MARKDOWN STRUCTURAL HASHES (#) OR EXTRA BOLDING (**).
LEAVE CUT LINES COMPLETELY CLEAN FOR STREAM INTERCEPTORS.

GM NOTES:
- Purpose and hidden mechanical developments of this scene
- Environmental tension triggers

NPC GENERATION LIST: [{"npcName": "Character Name", "npcRole": "Full narrative appearance text, style traits, gear and combat role details", "species": "Human"}]
(CRITICAL: If no NEW NPCs are introduced, or if only KNOWN EXISTING NPCS appear in this scene, you MUST output exactly: NPC GENERATION LIST: [])

PLAYER SCENE:
- Vivid sensory and atmospheric narrative detailing what players instantly experience.
========================================================================`;

  return {
    system: systemDirective.trim(),
    user: userPayload.trim()
  };
}