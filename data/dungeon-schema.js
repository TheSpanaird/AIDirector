/*
 * CARTOGRAPHER ARCHITECTURE REBUILD BOUNDARY
 * Status: ACTIVE REBUILD: semantic manifest validation; Cartographer owns geometry.
 * Frozen infrastructure must not be modified to compensate for this file.
 */

import { SYSTEM_RULES_REGISTRY } from "../prompt-factory/system-rules.js";
import { MultiLevelContractValidator } from "../cartographer/architecture/multi-level-contract-validator.js";
import { REWARD_STATES } from "./reward-schema.js";

export const LAYOUT_PROFILES = [
  "MINE",
  "CAVE",
  "HOUSE",
  "MANOR",
  "BAR",
  "CLUB",
  "TAVERN",
  "HIDEOUT",
  "SAFEHOUSE",
  "SECRET_BASE",
  "CASTLE",
  "FORT",
  "FORTRESS",
  "OUTPOST",
  "FACILITY",
  "SPACESHIP",
  "SPACE_STATION"
];

export const REWARD_TYPES =
  Object.freeze([
    "ACCESS",
    "KNOWLEDGE",
    "ALLY",
    "FACTION",
    "REPUTATION",
    "LOCATION",
    "RESOURCE",
    "ITEM",
    "ABILITY"
  ]);

export const REWARD_VALUE_TIERS =
  Object.freeze([
    "MINOR",
    "STANDARD",
    "MAJOR"
  ]);

export const REWARD_SYSTEM_TYPES =
  Object.freeze([
    "ACCESS_UNLOCK",
    "DISCOVERY",
    "NPC_RELATIONSHIP",
    "FACTION_RELATIONSHIP",
    "REPUTATION_CHANGE",
    "LOCATION_UNLOCK",
    "RESOURCE_GRANT",
    "ITEM_GRANT",
    "ABILITY_UNLOCK",
    "NARRATIVE_ONLY"
  ]);

export const HAZARD_TYPES = Object.freeze([
  "SURVEILLANCE",
  "TRAP",
  "TOXIC",
  "COLLAPSE",
  "AUTOMATED_DEFENSE",
  "GENERAL_HAZARD"
]);

export const HAZARD_SEVERITY = Object.freeze([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL"
]);

export const HAZARD_VISIBILITY = Object.freeze([
  "VISIBLE",
  "HIDDEN",
  "CONCEALED"
]);

export const HAZARD_STATES = Object.freeze([
  "UNDISCOVERED",
  "DISCOVERED",
  "DISABLED",
  "TRIGGERED",
  "RESOLVED"
]);

export const CLUE_TYPES = Object.freeze([
  "INVESTIGATION",
  "EVIDENCE",
  "TESTIMONY",
  "DOCUMENT",
  "PHYSICAL_TRACE",
  "ENVIRONMENTAL",
  "GENERAL_CLUE"
]);

export const CLUE_VISIBILITY = Object.freeze([
  "VISIBLE",
  "HIDDEN",
  "GM_ONLY"
]);

export const CLUE_STATES = Object.freeze([
  "UNDISCOVERED",
  "DISCOVERED",
  "RESOLVED"
]);

export const SECRET_TYPES = Object.freeze([
  "HIDDEN_CLUE",
  "MYSTERY",
  "REVELATION",
  "EVIDENCE",
  "HIDDEN_ACCESS",
  "HIDDEN_LOCATION",
  "GENERAL_SECRET"
]);

export const SECRET_VISIBILITY = Object.freeze([
  "HIDDEN",
  "GM_ONLY",
  "REVEALED"
]);

export const SECRET_STATES = Object.freeze([
  "UNDISCOVERED",
  "DISCOVERED",
  "REVEALED",
  "RESOLVED"
]);

export const SECRET_SOURCE_TYPES = Object.freeze([
  "CLUE",
  "MYSTERY",
  "REVELATION",
  "EVIDENCE",
  "DISCOVERY"
]);

export const THREAT_TYPES = Object.freeze([
  "HOSTILE_FORCE",
  "PATROL",
  "AMBUSH",
  "CREATURE",
  "ELITE",
  "BOSS",
  "SURVEILLANCE",
  "GENERAL_THREAT"
]);

export const THREAT_SEVERITY = Object.freeze([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL"
]);

export const THREAT_VISIBILITY = Object.freeze([
  "VISIBLE",
  "HIDDEN",
  "CONCEALED",
  "UNKNOWN"
]);

export const THREAT_STATES = Object.freeze([
  "UNKNOWN",
  "IDENTIFIED",
  "ACTIVE",
  "DEFEATED",
  "ESCAPED",
  "RESOLVED"
]);

const NARRATIVE_REWARD_SCHEMA = {
  type: "object",

  required: [
    "rewardId",
    "rewardType",
    "title"
  ],

  properties: {
    rewardId: {
      type: "string",
      minLength: 1
    },

    rewardType: {
      type: "string",
      enum: [...REWARD_TYPES]
    },

    title: {
      type: "string",
      minLength: 1
    },

    description: {
      type: "string"
    },

    valueTier: {
      type: "string",
      enum: [...REWARD_VALUE_TIERS]
    },

    revealed: {
      type: "boolean"
    },

    claimed: {
      type: "boolean"
    },

    rewardState: {
      type: "string",
      enum: [
        "UNDISCOVERED",
        "DISCOVERED",
        "CLAIMED",
        "RESOLVED"
      ]
    },

    discoveredAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    claimedAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    resolvedAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    sourceOpportunityId: {
      type: [
        "string",
        "null"
      ]
    },

    placementType: {
      type: [
        "string",
        "null"
      ]
    },

    placementSectorId: {
      type: [
        "string",
        "null"
      ]
    },

    placementReason: {
      type: [
        "string",
        "null"
      ]
    }
  },

  additionalProperties: true
};

const RESOLVED_REWARD_SCHEMA = {
  type: "object",

  required: [
    "systemType",
    "reward",
    "revealed"
  ],

  properties: {
    systemType: {
      type: "string",
      enum: [...REWARD_SYSTEM_TYPES]
    },

    reward:
      NARRATIVE_REWARD_SCHEMA,

    revealed: {
      type: "boolean"
    },

    claimed: {
      type: "boolean"
    },

    rewardState: {
      type: "string",
      enum: [
        "UNDISCOVERED",
        "DISCOVERED",
        "CLAIMED",
        "RESOLVED"
      ]
    },

    discoveredAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    claimedAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    resolvedAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    sourceOpportunityId: {
      type: [
        "string",
        "null"
      ]
    },

    placementType: {
      type: [
        "string",
        "null"
      ]
    },

    placementSectorId: {
      type: [
        "string",
        "null"
      ]
    },

    placementReason: {
      type: [
        "string",
        "null"
      ]
    }
  },

  additionalProperties: true
};

const HAZARD_SCHEMA = {
  type: "object",
  required: [
    "trapId",
    "hazardType",
    "title",
    "hazardState"
  ],
  properties: {
    trapId: {
      type: "string"
    },

    hazardType: {
      type: "string",
      enum: [...HAZARD_TYPES]
    },

    title: {
      type: "string"
    },

    description: {
      type: "string"
    },

    severity: {
      type: "string",
      enum: [...HAZARD_SEVERITY]
    },

    visibility: {
      type: "string",
      enum: [...HAZARD_VISIBILITY]
    },

    hazardState: {
      type: "string",
      enum: [...HAZARD_STATES]
    },

    discoveredAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    disabledAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    triggeredAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    resolvedAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    sourceOpportunityId: {
      type: [
        "string",
        "null"
      ]
    }
  },
  additionalProperties: true
};

const CLUE_SCHEMA = {
  type: "object",
  required: [
    "clueId",
    "clueType",
    "title",
    "description",
    "visibility",
    "clueState"
  ],
  properties: {
    clueId: {
      type: "string",
      minLength: 1
    },

    clueType: {
      type: "string",
      enum: [...CLUE_TYPES]
    },

    title: {
      type: "string",
      minLength: 1
    },

    description: {
      type: "string",
      minLength: 1
    },

    text: {
      type: "string"
    },

    visibility: {
      type: "string",
      enum: [...CLUE_VISIBILITY]
    },

    clueState: {
      type: "string",
      enum: [...CLUE_STATES]
    },

    discoveredAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    resolvedAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    sourceOpportunityId: {
      type: [
        "string",
        "null"
      ]
    },

    sourceRefs: {
      type: "array",
      items: {
        type: "string"
      }
    }
  },
  additionalProperties: true
};

const SECRET_SCHEMA = {
  type: "object",
  required: [
    "secretId",
    "secretType",
    "sourceType",
    "title",
    "description",
    "visibility",
    "secretState"
  ],
  properties: {
    secretId: {
      type: "string",
      minLength: 1
    },

    secretType: {
      type: "string",
      enum: [...SECRET_TYPES]
    },

    sourceType: {
      type: "string",
      enum: [...SECRET_SOURCE_TYPES]
    },

    title: {
      type: "string",
      minLength: 1
    },

    description: {
      type: "string",
      minLength: 1
    },

    visibility: {
      type: "string",
      enum: [...SECRET_VISIBILITY]
    },

    secretState: {
      type: "string",
      enum: [...SECRET_STATES]
    },

    discoveredAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    revealedAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    resolvedAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    sourceOpportunityId: {
      type: [
        "string",
        "null"
      ]
    },

    sourceRefs: {
      type: "array",
      items: {
        type: "string"
      }
    }
  },
  additionalProperties: true
};

const THREAT_SCHEMA = {
  type: "object",
  required: [
    "threatId",
    "threatType",
    "name",
    "description",
    "severity",
    "visibility",
    "threatState"
  ],
  properties: {
    threatId: {
      type: "string",
      minLength: 1
    },

    threatType: {
      type: "string",
      enum: [...THREAT_TYPES]
    },

    name: {
      type: "string",
      minLength: 1
    },

    description: {
      type: "string",
      minLength: 1
    },

    severity: {
      type: "string",
      enum: [...THREAT_SEVERITY]
    },

    visibility: {
      type: "string",
      enum: [...THREAT_VISIBILITY]
    },

    threatState: {
      type: "string",
      enum: [...THREAT_STATES]
    },

    identifiedAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    defeatedAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    resolvedAt: {
      type: [
        "string",
        "number",
        "null"
      ]
    },

    sourceOpportunityId: {
      type: [
        "string",
        "null"
      ]
    },

    sourceRefs: {
      type: "array",
      items: {
        type: "string"
      }
    },

    entityPlanningRequired: {
      type: "boolean"
    }
  },
  additionalProperties: true
};

export const DUNGEON_MANIFEST_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "DungeonManifest",
  type: "object",
  required: [
    "dungeonTitle",
    "overallGoal",
    "totalSectors",
    "structureType",
    "sceneArchetype",
    "floorCount",
    "floorPresentation",
    "floors",
    "verticalConnections",
    "roomProgram",
    "sectors"
  ],
  properties: {
    manifestId: { type: ["string", "null"] },
    dungeonTitle: { type: "string", minLength: 1 },
    overallGoal: { type: "string" },
    primaryOpportunityId: {
      type: ["string", "null"]
    },
    narrativeOpportunities: {
      type: "array",
      items: {
        type: "object",
        required: [
          "opportunityId",
          "objective",
          "sourceRefs"
        ],
        properties: {
          opportunityId: {
            type: "string",
            minLength: 1
          },
          title: {
            type: "string"
          },
          objective: {
            type: "string",
            minLength: 1
          },
          clues: {
            type: "array"
          },
          obstacles: {
            type: "array"
          },

          rewards: {
            type: "array",
            items:
              NARRATIVE_REWARD_SCHEMA
          },

          consequences: {
            type: "array"
          },
          sourceRefs: {
            type: "array"
          },
          priority: {
            type: "number"
          },
          priorityReasons: {
            type: "array"
          },
          isPrimary: {
            type: "boolean"
          }
        },
        additionalProperties: true
      }
    },
    totalSectors: { type: "integer", minimum: 1 },
    layoutProfile: { type: ["string", "null"], enum: [...LAYOUT_PROFILES, null] },
    layoutFamily: {
      type: ["string", "null"],
      enum: [
        "NATURAL",
        "RESIDENTIAL",
        "COMMERCIAL",
        "COVERT",
        "FORTIFIED",
        "TECHNICAL",
        null
      ]
    },
    genre: { type: ["string", "null"] },
    layoutSeed: { type: ["string", "number", "null"] },
    structureType: { type: "string", minLength: 1 },
    sceneArchetype: { type: "string", minLength: 1 },
    missionContext: { type: ["string", "null"] },
    occupancy: { type: ["string", "null"] },
    floorCount: { type: "integer", minimum: 1 },
    floorPresentation: {
      enum: ["STACKED_CANVAS", "SEPARATE_SCENES"]
    },
    floors: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["floor", "name", "role"],
        properties: {
          floor: { type: "integer" },
          name: { type: "string", minLength: 1 },
          role: { type: "string", minLength: 1 }
        },
        additionalProperties: true
      }
    },
    verticalConnections: {
      type: "array",
      items: {
        type: "object",
        required: ["connectionId", "connectionType", "from", "to"],
        properties: {
          connectionId: { type: "string", minLength: 1 },
          connectionType: {
            enum: ["STAIR", "ELEVATOR", "LADDER", "HATCH", "RAMP", "MAINTENANCE_SHAFT"]
          },
          accessPolicy: { type: "string" },
          from: {
            type: "object",
            required: ["sectorId", "floor", "anchorId"],
            properties: {
              sectorId: { type: "string" },
              floor: { type: "integer" },
              anchorId: { type: "string" }
            }
          },
          to: {
            type: "object",
            required: ["sectorId", "floor", "anchorId"],
            properties: {
              sectorId: { type: "string" },
              floor: { type: "integer" },
              anchorId: { type: "string" }
            }
          }
        },
        additionalProperties: true
      }
    },
    roomProgram: {
      type: "object",
      required: ["required", "preferred", "optional", "forbidden"],
      properties: {
        required: {
          type: "array",
          uniqueItems: true,
          items: { type: "string", minLength: 1 }
        },
        preferred: {
          type: "array",
          uniqueItems: true,
          items: { type: "string", minLength: 1 }
        },
        optional: {
          type: "array",
          uniqueItems: true,
          items: { type: "string", minLength: 1 }
        },
        forbidden: {
          type: "array",
          uniqueItems: true,
          items: { type: "string", minLength: 1 }
        }
      },
      additionalProperties: true
    },
    architecture: {
      type: ["object", "null"],
      properties: {
        sharedWallPreference: { type: "boolean" },
        corridorPattern: { type: "string" },
        footprintShape: { type: "string" },
        secondaryNetworks: {
          type: "array",
          items: { type: "string" }
        }
      },
      additionalProperties: true
    },
    ventilation: {
      type: ["object", "null"],
      properties: {
        enabled: { type: "boolean" },
        networkType: {
          enum: ["AIR_DUCT", "SERVICE_DUCT", "TECHNICAL_SHAFT"]
        },
        visibility: { enum: ["HIDDEN", "GM_ONLY", "VISIBLE"] },
        connections: {
          type: "array",
          items: {
            type: "object",
            required: ["from", "to", "accessType", "size"],
            properties: {
              from: { type: "string" },
              to: { type: "string" },
              accessType: {
                enum: ["VENT_GRATE", "ACCESS_PANEL", "MAINTENANCE_HATCH"]
              },
              size: { enum: ["SMALL", "MEDIUM", "LARGE"] }
            },
            additionalProperties: true
          }
        }
      },
      additionalProperties: true
    },
    sectors: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: [
          "sectorId",
          "name",
          "purpose",
          "graphRole",
          "floor",
          "connections",
          "sensoryDescription",
          "encounters",
          "npcs",
          "trapsAndSecrets",
          "mapPrompt"
        ],
        properties: {
          sectorId: {
            type: "string",
            minLength: 1,
            pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$"
          },
          name: { type: "string", minLength: 1 },
          purpose: { type: "string", minLength: 1 },
          graphRole: { type: "string", minLength: 1 },
          narrativeRole: {
            type: "string"
          },
          opportunityRefs: {
            type: "array",
            items: {
              type: "string"
            }
          },
          narrativeOpportunities: {
            type: "array"
          },

          rewards: {
            type: "array",
            items:
              RESOLVED_REWARD_SCHEMA
          },

          importance: { type: "integer", minimum: 1, maximum: 5 },
          trafficLevel: { type: "integer", minimum: 1, maximum: 5 },
          sizeClass: {
            enum: ["SMALL", "STANDARD", "LARGE", "GRAND"]
          },
          floor: { type: "integer", default: 1 },
          connections: {
            type: "array",
            items: {
              type: "object",
              required: ["to"],
              properties: {
                to: { type: "string", minLength: 1 },
                doorType: { type: "string" },
                connectionType: { type: "string" },
                required: { type: "boolean" }
              },
              additionalProperties: true
            }
          },
          sensoryDescription: { type: "string" },
          encounters: { type: "array" },
          npcs: { type: "array" },

          traps: {
            type: "array",
            items: HAZARD_SCHEMA
          },

          clues: {
            type: "array",
            items: CLUE_SCHEMA
          },

          secrets: {
            type: "array",
            items: SECRET_SCHEMA
          },

          threats: {
            type: "array",
            items: THREAT_SCHEMA
          },

          // LEGACY
          trapsAndSecrets: { type: "string" },
          mapPrompt: { type: "string" },

          playerViewPrompt: {
            type: "string"
          },

          tacticalMapPrompt: {
            type: "string"
          },

          inhabitants: {
            type: "array"
          },

          monsters: {
            type: "array"
          },

          loot: {
            type: "array"
          },

          interactables: {
            type: "array"
          },

          gmNotes: {
            type: "string"
          },

          promptMetadata: {
            type: "object",
            properties: {
              version: {
                type: "string"
              },
              playerViewPromptSource: {
                enum: [
                  "EN16_GENERATED",
                  "MANUAL"
                ]
              },
              tacticalMapPromptSource: {
                enum: [
                  "EN16_GENERATED",
                  "MANUAL"
                ]
              }
            },
            additionalProperties: true
          },

          // Legacy geometry hints remain readable but are never required or authoritative.
          gridPosition: { type: "object" },
          gridDimensions: { type: "object" },
          shapePrimitive: { type: "string" }
        },
        additionalProperties: true
      }
    }
  },
  additionalProperties: true
};

export const DUNGEON_MANIFEST_TEMPLATE = {
  dungeonTitle: "Independent Freighter Meridian",
  overallGoal: "Board the vessel and secure the cargo manifest.",
  totalSectors: 6,
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
    enabled: false,
    networkType: "SERVICE_DUCT",
    visibility: "HIDDEN",
    connections: []
  },
  sectors: [
    {
      sectorId: "bridge",
      name: "Forward Bridge",
      purpose: "BRIDGE",
      graphRole: "OBJECTIVE",
      importance: 5,
      trafficLevel: 3,
      sizeClass: "STANDARD",
      floor: 1,
      connections: [{ to: "central-passage", connectionType: "DIRECT" }],
      sensoryDescription: "A forward command compartment.",
      encounters: [],
      npcs: [],
      trapsAndSecrets: "None",
      mapPrompt: "Forward freighter bridge."
    },
    {
      sectorId: "central-passage",
      name: "Central Passage",
      purpose: "CENTRAL_PASSAGE",
      graphRole: "HUB",
      importance: 4,
      trafficLevel: 5,
      sizeClass: "STANDARD",
      floor: 1,
      connections: [
        { to: "bridge", connectionType: "DIRECT" },
        { to: "cargo-hold", connectionType: "DIRECT" },
        { to: "crew-quarters", connectionType: "DIRECT" }
      ],
      sensoryDescription: "A reinforced central access spine.",
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
      importance: 5,
      trafficLevel: 4,
      sizeClass: "GRAND",
      floor: 1,
      connections: [
        { to: "central-passage", connectionType: "DIRECT" },
        { to: "loading-airlock", connectionType: "DIRECT" },
        { to: "engineering", connectionType: "DIRECT" }
      ],
      sensoryDescription: "A broad freight bay.",
      encounters: [],
      npcs: [],
      trapsAndSecrets: "A concealed customs compartment.",
      mapPrompt: "Large freighter cargo hold."
    },
    {
      sectorId: "loading-airlock",
      name: "Loading Airlock",
      purpose: "AIRLOCK",
      graphRole: "ENTRY",
      importance: 4,
      trafficLevel: 4,
      sizeClass: "STANDARD",
      floor: 1,
      connections: [{ to: "cargo-hold", connectionType: "AIRLOCK" }],
      sensoryDescription: "A sealed freight-loading vestibule.",
      encounters: [],
      npcs: [],
      trapsAndSecrets: "None",
      mapPrompt: "Industrial loading airlock."
    },
    {
      sectorId: "engineering",
      name: "Engineering",
      purpose: "ENGINEERING",
      graphRole: "OBJECTIVE",
      importance: 5,
      trafficLevel: 3,
      sizeClass: "LARGE",
      floor: 1,
      connections: [{ to: "cargo-hold", connectionType: "DIRECT" }],
      sensoryDescription: "A stern machinery compartment.",
      encounters: [],
      npcs: [],
      trapsAndSecrets: "None",
      mapPrompt: "Freighter engineering room."
    },
    {
      sectorId: "crew-quarters",
      name: "Crew Quarters",
      purpose: "CREW_QUARTERS",
      graphRole: "OPTIONAL",
      importance: 3,
      trafficLevel: 2,
      sizeClass: "STANDARD",
      floor: 1,
      connections: [{ to: "central-passage", connectionType: "DIRECT" }],
      sensoryDescription: "Compact crew bunks and lockers.",
      encounters: [],
      npcs: [],
      trapsAndSecrets: "None",
      mapPrompt: "Compact freighter crew quarters."
    }
  ]
};

const normalize = value => String(value || "").trim().toUpperCase();

export function validateVentilationContract(ventilation, sectors = []) {
  if (ventilation === undefined || ventilation === null) return true;
  if (!ventilation || typeof ventilation !== "object") return false;
  if (typeof ventilation.enabled !== "boolean") return false;
  if (!Array.isArray(ventilation.connections)) return false;
  if (!ventilation.enabled && ventilation.connections.length === 0) return true;

  const sectorIds = new Set(sectors.map(sector => sector.sectorId));
  const networkTypes = new Set([
    "AIR_DUCT",
    "SERVICE_DUCT",
    "TECHNICAL_SHAFT"
  ]);
  const visibilities = new Set(["HIDDEN", "GM_ONLY", "VISIBLE"]);
  const accessTypes = new Set([
    "VENT_GRATE",
    "ACCESS_PANEL",
    "MAINTENANCE_HATCH"
  ]);
  const sizes = new Set(["SMALL", "MEDIUM", "LARGE"]);

  if (!networkTypes.has(normalize(ventilation.networkType))) return false;
  if (!visibilities.has(normalize(ventilation.visibility))) return false;

  return ventilation.connections.every(connection =>
    connection &&
    sectorIds.has(connection.from) &&
    sectorIds.has(connection.to) &&
    connection.from !== connection.to &&
    accessTypes.has(normalize(connection.accessType)) &&
    sizes.has(normalize(connection.size))
  );
}

export function validateRoomProgramContract(data, sectors = []) {
  if (!data || typeof data !== "object") return false;
  if (!normalize(data.structureType)) return false;
  if (!normalize(data.sceneArchetype)) return false;
  if (!data.roomProgram || typeof data.roomProgram !== "object") return false;

  const keys = ["required", "preferred", "optional", "forbidden"];
  if (!keys.every(key => Array.isArray(data.roomProgram[key]))) return false;

  const purposes = sectors.map(sector => normalize(sector.purpose));
  const forbidden = new Set(data.roomProgram.forbidden.map(normalize));

  if (purposes.some(purpose => forbidden.has(purpose))) return false;

  return data.roomProgram.required.every(requiredPurpose =>
    purposes.includes(normalize(requiredPurpose))
  );
}

export function validateSemanticConnections(sectors = []) {
  const ids = new Set(sectors.map(sector => sector.sectorId));

  return sectors.every(sector =>
    Array.isArray(sector.connections) &&
    sector.connections.every(connection =>
      connection &&
      typeof connection.to === "string" &&
      ids.has(connection.to) &&
      connection.to !== sector.sectorId
    )
  );
}

export function validateDungeonManifest(rawJson) {
  try {
    const errors = [];
    const data = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
    if (!data || typeof data !== "object") return false;
    if (typeof data.dungeonTitle !== "string" || !data.dungeonTitle.trim()) {
      return false;
    }
    if (!Array.isArray(data.sectors) || data.sectors.length === 0) return false;
    if (Number(data.totalSectors) !== data.sectors.length) return false;

    const ids = new Set();
    const sectorsValid = data.sectors.every(sector => {
      if (!sector || typeof sector !== "object") return false;
      if (typeof sector.sectorId !== "string" || !sector.sectorId.trim()) {
        return false;
      }
      if (ids.has(sector.sectorId)) return false;
      ids.add(sector.sectorId);

      if (Array.isArray(sector.rewards)) {
        for (const rewardEntry of sector.rewards) {
          const reward = rewardEntry?.reward || rewardEntry;
          if (
            reward &&
            reward.rewardState &&
            !REWARD_STATES.includes(reward.rewardState)
          ) {
            errors.push(`Invalid reward state: ${reward.rewardState}`);
            return false;
          }
        }
      }

      return (
        typeof sector.name === "string" &&
        typeof sector.purpose === "string" &&
        typeof sector.graphRole === "string" &&
        Number.isFinite(Number(sector.floor ?? 1)) &&
        Array.isArray(sector.connections) &&
        typeof sector.sensoryDescription === "string" &&
        Array.isArray(
          sector.encounters
        ) &&
        Array.isArray(
          sector.npcs
        ) &&
        (
          sector.rewards === undefined ||
          Array.isArray(
            sector.rewards
          )
        ) &&
        typeof sector.trapsAndSecrets ===
          "string" &&
        typeof sector.playerViewPrompt ===
          "string" &&
        typeof sector.tacticalMapPrompt ===
          "string" &&
        typeof sector.mapPrompt ===
          "string"
      );
    });

    return Boolean(
      errors.length === 0 &&
      sectorsValid &&
      validateSemanticConnections(data.sectors) &&
      validateVentilationContract(data.ventilation, data.sectors) &&
      validateRoomProgramContract(data, data.sectors) &&
      MultiLevelContractValidator.validate(data).valid
    );
  } catch (_error) {
    return false;
  }
}

export function buildDungeonManifestPrompt(playerDirective = "", context = {}) {
  const activeSystem = typeof game !== "undefined" ? game.system?.id : "cpr";
  const systemRules =
    SYSTEM_RULES_REGISTRY[activeSystem] || SYSTEM_RULES_REGISTRY.cpr;
  const directiveText = playerDirective?.trim()
    ? `PLAYER DIRECTIVE / SCENARIO INTENT: "${playerDirective}"`
    : "PLAYER DIRECTIVE: None provided. Generate an appropriate connected scenario.";

  const system =
    "You are the Master Scene Program Architect. Output only raw JSON. Scene Manager owns semantic rooms and narrative content. Cartographer owns all final geometry.";

  const user = `## CAMPAIGN SYSTEM RULES
${systemRules}

## INPUT DIRECTIVE
${directiveText}

## WORLD CANON CONTEXT
${context.canonLore || "Standard campaign environment."}

## OUTPUT CONTRACT
${JSON.stringify(DUNGEON_MANIFEST_TEMPLATE, null, 2)}

RULES:
- Include structureType, sceneArchetype, missionContext, occupancy, and roomProgram.
- Every required purpose must appear in sectors. Forbidden purposes must not appear.
- Include semantic reciprocal connections where practical.
- Do not output grid positions, dimensions, bounds, wall sides, shape primitives, or final geometry.
- Ventilation is optional and separate from required normal access.
- Output only valid JSON.`;

  return { system, user };
}

export function buildMapPromptExtraction(sceneText = "") {
  return {
    system:
      "Extract a concise gridless 2D orthographic direct-overhead battlemap prompt. Return only the prompt.",
    user: `Scene Description:\n"${sceneText}"`
  };
}