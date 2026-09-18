/*
 * CARTOGRAPHER ARCHITECTURE REBUILD BOUNDARY
 * Status: ACTIVE REBUILD: Scene Manager owns room programs; Cartographer owns geometry.
 * Frozen infrastructure must not be modified to compensate for this file.
 */

import { SYSTEM_RULES_REGISTRY } from "../prompt-factory/system-rules.js";

const MANIFEST_EXAMPLE = {
  dungeonTitle: "Independent Freighter Meridian",
  overallGoal: "Board the vessel and secure the main cargo hold.",
  totalSectors: 9,
  layoutProfile: "SPACESHIP",
  layoutFamily: "TECHNICAL",
  genre: "science-fiction",
  layoutSeed: "freighter-meridian-001",
  structureType: "SPACESHIP",
  sceneArchetype: "FREIGHTER",
  missionContext: "BOARDING_ACTION",
  occupancy: "CIVILIAN_CREW",
  floorCount: 1,
  floorPresentation: "STACKED_CANVAS",
  floors: [{ floor: 1, name: "Main Deck", role: "GENERAL" }],
  verticalConnections: [],
  roomProgram: {
    required: [
      "AIRLOCK",
      "BRIDGE",
      "CENTRAL_PASSAGE",
      "CARGO",
      "ENGINEERING",
      "CREW_QUARTERS"
    ],
    preferred: ["GALLEY", "STORAGE", "UTILITY"],
    optional: ["MEDICAL", "WORKSHOP"],
    forbidden: ["MAGAZINE", "WEAPONS_CONTROL"]
  },
  architecture: {
    sharedWallPreference: true,
    corridorPattern: "CARGO_SPINE",
    footprintShape: "FREIGHTER_HULL",
    secondaryNetworks: ["VENTILATION"]
  },
  ventilation: {
    enabled: true,
    networkType: "SERVICE_DUCT",
    visibility: "HIDDEN",
    connections: [
      {
        from: "engineering",
        to: "cargo-hold",
        accessType: "MAINTENANCE_HATCH",
        size: "MEDIUM"
      }
    ]
  },
  sectors: [
    {
      sectorId: "bridge",
      name: "Forward Bridge",
      purpose: "BRIDGE",
      graphRole: "OBJECTIVE",
      floor: 1,
      importance: 5,
      trafficLevel: 3,
      sizeClass: "STANDARD",
      connections: [
        {
          to: "central-passage",
          doorType: "standard_door",
          connectionType: "DIRECT"
        }
      ],
      sensoryDescription: "A forward command compartment overlooking the bow.",
      encounters: [],
      npcs: [],
      trapsAndSecrets: "None",
      mapPrompt: "Forward command bridge with navigation consoles."
    },
    {
      sectorId: "central-passage",
      name: "Central Passage",
      purpose: "CENTRAL_PASSAGE",
      graphRole: "HUB",
      floor: 1,
      importance: 4,
      trafficLevel: 5,
      sizeClass: "STANDARD",
      connections: [
        {
          to: "bridge",
          doorType: "standard_door",
          connectionType: "DIRECT"
        },
        {
          to: "cargo-hold",
          doorType: "cargo_door",
          connectionType: "DIRECT"
        }
      ],
      sensoryDescription: "A reinforced passage linking command and cargo operations.",
      encounters: [],
      npcs: [],
      trapsAndSecrets: "None",
      mapPrompt: "Industrial central passage."
    },
    {
      sectorId: "cargo-hold",
      name: "Main Cargo Hold",
      purpose: "CARGO",
      graphRole: "OBJECTIVE",
      floor: 1,
      importance: 5,
      trafficLevel: 4,
      sizeClass: "GRAND",
      connections: [
        {
          to: "central-passage",
          doorType: "cargo_door",
          connectionType: "DIRECT"
        },
        {
          to: "loading-airlock",
          doorType: "airlock",
          connectionType: "DIRECT"
        }
      ],
      sensoryDescription: "A broad loading bay filled with secured freight pallets.",
      encounters: [],
      npcs: [],
      trapsAndSecrets: "A concealed customs compartment.",
      mapPrompt: "Large freighter cargo hold."
    }
  ]
};

/**
 * Builds the Scene Manager manifest prompt.
 * Scene Manager chooses semantic spaces. Cartographer creates all final geometry.
 */
export function buildDungeonManifestPrompt(playerDirective = "", context = {}) {
  const activeSystem = typeof game !== "undefined" ? game.system?.id : "cpr";
  const systemRules =
    SYSTEM_RULES_REGISTRY[activeSystem] || SYSTEM_RULES_REGISTRY.cpr;

  const directiveText = playerDirective?.trim()
    ? `PLAYER DIRECTIVE / SCENARIO INTENT: "${playerDirective}"`
    : "PLAYER DIRECTIVE: None provided. Generate an appropriate connected scenario.";

  const system = `You are the Master Scene Program Architect for a TTRPG map generator.
Return only raw valid JSON.

OWNERSHIP CONTRACT:
- Scene Manager owns structureType, sceneArchetype, missionContext, occupancy, roomProgram, sector purposes, narrative content, encounters, NPCs, secrets, and desired semantic connections.
- Cartographer owns the envelope, hull, zoning, floor-plan grammar, room placement, coordinates, dimensions, proportions, shapes, shared-wall assignment, corridors, doors, windows, ventilation routes, and final geometry.
- Never prescribe gridPosition, gridDimensions, bounds, pixel coordinates, wallSide, shapePrimitive, or final room shape.
- Connections express desired semantic access only. Cartographer may realize them as shared doors, halls, stairs, airlocks, or validated circulation.

ROOM-PROGRAM RULES:
- Select a specific structureType and sceneArchetype from the narrative context.
- Include missionContext and occupancy.
- Include floorCount, floorPresentation, floors, and verticalConnections.
- Use STACKED_CANVAS or SEPARATE_SCENES for floorPresentation.
- Every vertical connection requires one stable connectionId and matching anchorId values on both endpoints.
- Include required, preferred, optional, and forbidden room-purpose lists.
- Every required purpose must appear in sectors.
- A forbidden purpose must not appear in sectors.
- Distinguish subtypes. A FREIGHTER, SHUTTLE, GUNSHIP, WARSHIP, CAPITAL_SHIP, RESEARCH_VESSEL, and PASSENGER_VESSEL require different programs.
- Distinguish scene-driven variants. A military castle and a noble residence use different room programs even when both use a fortified grammar.
- Preserve a connected semantic access graph and reciprocal connections where practical.
- Ventilation is a separate secondary network and never substitutes for normal required access.

OUTPUT only JSON matching the supplied example contract.`;

  const user = `## CAMPAIGN SYSTEM RULES
${systemRules}

## INPUT DIRECTIVE
${directiveText}

## WORLD CANON CONTEXT
${context.canonLore || "Standard campaign environment."}

## OUTPUT CONTRACT EXAMPLE
${JSON.stringify(MANIFEST_EXAMPLE, null, 2)}

FINAL RULES:
- totalSectors must equal sectors.length.
- Each sector needs sectorId, name, purpose, graphRole, floor, connections, sensoryDescription, encounters, npcs, trapsAndSecrets, and mapPrompt.
- floorCount must equal floors.length and every sector floor must be declared.
- verticalConnections describe semantic cross-floor access only; Cartographer places final anchors and geometry.
- Sector IDs must be stable, lowercase, and descriptive.
- Connections require only a target sector ID plus optional doorType and connectionType.
- Do not output geometry fields.
- Output only raw valid JSON.`;

  return { system, user };
}

export function buildMapPromptExtraction(sceneText = "") {
  return {
    system:
      "Extract a concise gridless 2D orthographic direct-overhead battlemap prompt. Return only the prompt.",
    user: `Scene Description:\n"${sceneText}"`
  };
}
