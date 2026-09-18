// modules/ai-director/scripts/prompt-factory/dungeon-prompts.js

import { SYSTEM_RULES_REGISTRY } from "./system-rules.js";

/**
 * Builds the Tier A Architect prompt to generate a multi-sector/multi-floor dungeon manifest
 * using the Universal Spatial Framing Envelope and Dungeon Draw Primitive System.
 *
 * Pass 2 Scene Record update:
 * - Keeps the existing tactical geometry contract intact.
 * - Adds enriched sector content requirements for player-view prompts, mundane rooms,
 *   structured inhabitants, monsters, traps, secrets, clues, loot, and interactables.
 * - Keeps legacy fields such as encounters, npcs, trapsAndSecrets, and mapPrompt for
 *   backward compatibility with existing render/export paths.
 *
 * @param {string} [playerDirective=""] - Intent or goals provided by the player/GM.
 * @param {Object} [context={}] - Environment and world context.
 * @param {string} [context.canonLore] - World canon lore or background details.
 * @returns {{ system: string, user: string }} Formatted system and user prompt strings.
 */
export function buildDungeonManifestPrompt(playerDirective = "", context = {}) {
  const activeSystem = typeof game !== "undefined" ? game.system?.id : "cpr";
  const systemRules = SYSTEM_RULES_REGISTRY[activeSystem] || SYSTEM_RULES_REGISTRY["cpr"];

  const directiveText = playerDirective?.trim()
    ? `PLAYER DIRECTIVE / SCENARIO INTENT: "${playerDirective}"`
    : "PLAYER DIRECTIVE: None provided. Generate a multi-level scenario appropriate for the campaign setting.";

  const sectorPolicy = context.sectorPolicy || null;

  const systemDirective = `You are the Master Dungeon Architect AI.
Your task is to design a multi-sector, multi-floor tactical scenario manifest for vector-based Dungeon Draw layout generation and player-facing scene presentation.

OWNERSHIP CONTRACT:
- Scene Manager owns semantic intent, sector selection, occupancy state, room or area content, sensory descriptions, inhabitants, monsters, traps, secrets, clues, loot, interactables, and player-facing POV prompts.
- Cartographer owns final geometry realization, placement, walls, doors, corridors, rooms, perimeters, and rendering metadata.
- The manifest may include high-level tactical layout hints required by the current map pipeline, but do not narrate exact pixel coordinates, final wall segments, or final Cartographer placement logic.

CRITICAL ARCHITECTURAL DIRECTIVES:
1. LAYOUT ENVELOPE: Classify the entire location's physical silhouette into one of four Macro Layout Envelopes:
   - AXIAL: Long central spine/axis with clear Fore/Aft or Front/Back gradient (Ships, Trains, Submarines, Longhouses, Bridges).
   - CONCENTRIC: Core hub surrounded by radiating or ringed layers (Towers, Vaults, Vaulted Arenas, Lighthouses, Cyberpunk Mega-Buildings).
   - PERIMETER: Enclosed outer boundary with open or varied interior space (Forts, Castles, Walled Compounds, Gang Hideouts).
   - CLUSTER: Non-uniform connected nodes (Caverns, Sewers, Ruined Castles, Treetop Villages, Underground Labs).
2. FUNCTIONAL HIERARCHY LEVELS: Every sector must declare a functional level:
   - Level 1 (Apex): Primary anchor/focal point (Bridge, Taproom, Throne Room, Central Reactor, Vault).
   - Level 2 (Body): Operational zones (Quarters, Security, Engine Room, Kitchen, Armory).
   - Level 3 (Connective): Transit and utilities (Corridors, Stairwells, Elevators, Maintenance Crawlspaces).
3. SHAPE PRIMITIVES: Assign explicit shape primitives matching real-world architectural design:
   - RECTANGLE: Standard rectangular rooms and simple straight corridors.
   - L_SHAPE: Corner rooms, wrap-around control centers, offset bars.
   - T_SHAPE: Junction hallways, splitting corridors, grand entrance halls.
   - OCTAGON: Command bridges, central vaults, tower chambers, ritual altars, rotundas.
   - CIRCLE_APPROX: Silos, lighthouse lamps, bio-domes, rounded towers.
4. CONNECTED GRAPH TOPOLOGY: You MUST design a fully connected spatial network across one or more floors. Floating or unreachable rooms are strictly forbidden. Every sector MUST declare at least one edge connection.

SCENE RECORD CONTENT DIRECTIVES:
1. Not every sector needs a fight, clue, trap, secret, loot, or NPC.
2. Mundane, empty, quiet, transitional, storage, service, ruined, abandoned, looted, atmospheric, or ordinary sectors are valid outputs when appropriate.
3. Empty arrays are valid and preferred over invented content.
4. Abandoned or ruined locations should mostly contain empty, damaged, dusty, looted, sealed, overgrown, or mundane sectors, with only selected sectors containing clues, hazards, monsters, or remnants explaining what happened.
5. Living or occupied locations should contain more inhabitants, guards, workers, residents, merchants, patrols, active stores, light sources, signs of use, and routine activity.
6. Haunted or contested locations may combine mundane abandoned spaces with selected supernatural traces, monsters, hazards, or clues.
7. Scale inhabitants, monsters, clues, traps, secrets, and loot to the player directive and premise. Do not fill every sector with content just because the fields exist.
8. Structured Scene Record data is canonical. Journal text, chat text, map prompts, panorama prompts, and NPC generation are downstream views of this structured data.

PROMPT SEPARATION RULES:
1. sensoryDescription is GM narration: what the characters perceive through sight, sound, smell, atmosphere, and immediate spatial context.
2. playerViewPrompt is for Panorama Forge: eye-level, cinematic, player-facing POV from inside the room or area. It must avoid top-down, blueprint, floorplan, map, grid, or diagram language.
3. tacticalMapPrompt is for tactical map/layout generation: direct-overhead, top-down, orthographic, gridless battlemap/floorplan language.
4. mapPrompt remains as a backward-compatible legacy alias and should usually match tacticalMapPrompt.
5. Do not put secrets, hidden DCs, or GM-only reveals into playerViewPrompt.

STRUCTURED ENTITY RULES:
1. inhabitants are non-hostile or routine occupants: staff, residents, workers, bystanders, merchants, prisoners, servants, commoners, guards on normal duty, or other living-site activity.
2. monsters are hostile, dangerous, supernatural, or creature threats.
3. npcs is a backward-compatible legacy array. If inhabitants or monsters are present, npcs may include the same entries needed by existing spawn logic, but inhabitants and monsters are the canonical structured fields.
4. Each inhabitant or monster entry should include stableId, name or archetype, role, count, disposition, currentActivity, visibility, generationNeeds, and optional spatialAnchor.
5. Use visibility values such as VISIBLE, HIDDEN, GM_ONLY, or CONDITIONAL.
6. Do not infer NPCs or monsters from prose only. If an entity should exist as an actor or token later, include it as structured data.

Rely on the campaign rules and context provided. Output ONLY raw valid JSON adhering strictly to the requested schema.`;

  const userPayload = `## CAMPAIGN SYSTEM RULES
${systemRules}

## INPUT DIRECTIVE
${directiveText}

## WORLD CANON CONTEXT
${context.canonLore || "Standard campaign environment."}

## CANONICAL NARRATIVE RECORD
${
  context.narrativeRecord
    ? JSON.stringify(
      context.narrativeRecord,
      null,
      2
    )
    : "None"
}

## PRIMARY NARRATIVE OPPORTUNITY
${
  context.narrativeRecord
    ?.opportunities
    ?.find(
      opportunity =>
        opportunity.isPrimary
    )
    ? JSON.stringify(
      context.narrativeRecord
        .opportunities
        .find(
          opportunity =>
            opportunity.isPrimary
        ),
      null,
      2
    )
    : "None"
}

========================================================================
## SECTOR DOCTRINE

${sectorPolicy ? JSON.stringify({
  layoutProfile: sectorPolicy.layoutProfile,
  requiredPurposes: sectorPolicy.requiredPurposes,
  targetSectorCount: sectorPolicy.targetSectorCount,
  sectorSpecs: sectorPolicy.sectorSpecs
}, null, 2) : "No sector doctrine supplied."}

Every required purpose listed above MUST appear
in the generated sectors array as the sector
"purpose" field.

OUTPUT FORMAT MANDATE:

CRITICAL FAILURE CONDITION:
If the root JSON object does not contain a "sectors" array, the response is invalid.

Never return:
- a single sector
- a sector record
- only sensoryDescription
- only playerViewPrompt
- only gmNotes

Return ONLY a COMPLETE architectural manifest.

Required root schema:

{
  "dungeonTitle": "string",
  "overallGoal": "string",
  "primaryOpportunityId": "string",
  "narrativeOpportunities": [],
  "layoutEnvelope": "AXIAL|CONCENTRIC|PERIMETER|CLUSTER",
  "sceneScale": "TINY|SMALL|MEDIUM|LARGE|HUGE",
  "occupancyState": "string",
  "totalSectors": 5,
  "sectorPlan": {},
  "sectors": [
    {
      "sectorId": "sector_01",
      "name": "string",
      "floor": 1,
      "connections": [],
      "areaState": "ABANDONED",
      "mundaneAllowed": true,
      "narrativeRole": "ATMOSPHERE|DISCOVERY|CLUE|OBSTACLE|REWARD|OBJECTIVE|OPTIONAL",
      "opportunityRefs": [],
      "narrativeOpportunities": [],
      "sensoryDescription": "string",
      "playerViewPrompt": "string",
      "tacticalMapPrompt": "string",
      "mapPrompt": "string",
      "inhabitants": [],
      "monsters": [],
      "traps": [],
      "secrets": [],
      "clues": [],
      "loot": [],
      "interactables": [],
      "gmNotes": "string"
    }
  ]
}

STRICT TOPOLOGICAL, TERRAIN, SPATIAL ANCHOR, AND SCENE RECORD CONSTRAINTS:
1. "layoutEnvelope" MUST be strictly one of: "AXIAL", "CONCENTRIC", "PERIMETER", "CLUSTER".
2. "sceneScale" SHOULD be one of: "TINY", "SMALL", "MEDIUM", "LARGE", "HUGE".
3. "occupancyState" SHOULD describe the premise, such as "LIVING", "OCCUPIED", "ABANDONED", "RUINED", "HAUNTED", "UNDER_SIEGE", "CONTESTED", or "MUNDANE".
4. "sectorPlan" SHOULD explain target sector count, required sectors, selected optional sectors, omitted sectors, and mundane sectors when known.
5. "focalPoint" MUST specify the primary anchor sector ID and its "positionBias" ("FORWARD_EXTREME", "CENTER_CORE", "TOP_ELEVATED", "DEEP_REAR").
6. "floor" MUST be an integer representing the floor level (1 for Ground Floor, 2 for Upper Floor, -1 for Basement, etc.).
7. "hierarchyLevel" MUST be an integer (1 = Apex/Anchor, 2 = Functional Body, 3 = Connective/Utilities).
8. "shapePrimitive" MUST be strictly one of: "RECTANGLE", "L_SHAPE", "T_SHAPE", "OCTAGON", "CIRCLE_APPROX".
9. Every sector MUST have a "gridPosition" ({ "col": X, "row": Y }) and "gridDimensions" ({ "w": widthInUnits, "h": heightInUnits }).
10. Every sector MUST have a non-empty "connections" array explicitly defining edges. Floating or unreachable rooms are strictly forbidden.
11. For horizontal connections on the same floor, "wallSide" MUST be strictly one of: "north", "south", "east", "west".
12. For vertical connections between floors (staircases, elevators, ladders, hatches), "wallSide" MUST be "up" or "down", and "doorType" MUST be one of: "staircase", "elevator", "ladder", "hatch".
13. Every connection MUST have a reciprocal reverse connection.
14. Outdoor or complex sectors SHOULD include "terrainZones" specifying "type", "bounds", and "modifier".
15. Every sector MUST include "sensoryDescription", "playerViewPrompt", "tacticalMapPrompt", "mapPrompt", "areaState", "mundaneAllowed", "inhabitants", "monsters", "traps", "secrets", "clues", "loot", "interactables", and "gmNotes".
16. The arrays "inhabitants", "monsters", "traps", "secrets", "clues", "loot", and "interactables" may be empty. Empty arrays are valid.
17. Do not invent encounters, NPCs, monsters, loot, traps, or clues for every sector. Match the premise.
18. If a sector is mundane, set "mundaneAllowed": true and use empty arrays unless the premise requires content.
19. "playerViewPrompt" MUST be eye-level and player-facing. It MUST NOT include top-down, overhead, floorplan, grid, blueprint, diagram, or map language.
20. "tacticalMapPrompt" and "mapPrompt" SHOULD be direct-overhead, top-down, orthographic, gridless tactical map language.
21. Every NPC definition inside "npcs" MUST declare a "spatialAnchor" object if interactable furniture or obstacles exist.
22. EVERY room on EVERY floor must be physically reachable starting from sector_01. No orphaned or isolated rooms allowed.
23. Preserve opportunityId and sourceRefs from the Narrative Record.
24. primaryOpportunityId must reference the primary Narrative Record opportunity.
25. The OBJECTIVE sector must reference primaryOpportunityId.
26. CLUE and DISCOVERY sectors should reference relevant clue opportunities.
27. OBSTACLE sectors should reference relevant obstacle opportunities.
28. Do not invent opportunity IDs or source references.
========================================================================`;

  return { system: systemDirective, user: userPayload };
}

/**
 * Synthesizes a player-facing eye-level POV prompt for a specific inhabitant, monster, or occupant within a sector.
 * Includes defensive type validation to prevent runtime errors when payload structures vary.
 *
 * @param {Object} [sector={}] - The sector object containing spatial and visual details.
 * @param {Object} [inhabitant={}] - The target inhabitant, NPC, or monster object.
 * @returns {string} Formatted POV prompt string for image generation engines.
 */
export function synthesizeInhabitantPOVPrompt(sector = {}, inhabitant = {}) {
  const safeSector = sector && typeof sector === "object" ? sector : {};
  const safeInhabitant = inhabitant && typeof inhabitant === "object" ? inhabitant : {};

  const baseView = String(
    safeSector.playerViewPrompt || safeSector.sensoryDescription || "a sector in the location"
  ).trim();

  const name = String(
    safeInhabitant.name || safeInhabitant.archetype || "an occupant"
  ).trim();

  const roleText = safeInhabitant.role ? `, acting as ${safeInhabitant.role}` : "";
  const activityText = safeInhabitant.currentActivity ? `, currently ${safeInhabitant.currentActivity}` : "";
  
  const anchor = safeInhabitant.spatialAnchor;
  const anchorText = anchor && typeof anchor === "object" && anchor.targetObject 
    ? ` positioned ${String(anchor.relationship || "near").toLowerCase()} the ${anchor.targetObject}` 
    : "";

  return `Eye-level cinematic portrait of ${name}${roleText}${activityText}${anchorText}. Spatial backdrop: ${baseView}. Professional lighting, detailed subject focus, atmospheric perspective.`;
}