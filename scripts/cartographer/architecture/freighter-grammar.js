// freighter-grammar.js
// Standalone cargo-focused Freighter prototype. Not registered for production.
import {
  GrammarContract
} from "./grammar-contract.js";

export class FreighterGrammar {
  static GRAMMAR_ID =
    "FREIGHTER_CARGO_SPINE_V1_3";

  static build(
    roomProgram = {},
    options = {}
  ) {
    const gridSize = Math.max(
      1,
      Number(options.gridSize) || 100
    );

    const originX =
      Number(options.originX) || 1000;

    const originY =
      Number(options.originY) || 1000;

    const seed = String(
      options.layoutSeed ||
      "freighter-v1-001"
    );

    const mirrored =
      GrammarContract.hash(seed) % 2 === 1;

    const cells =
      this._cells(mirrored);

    const supplied = new Map(
      (
        Array.isArray(roomProgram.sectors)
          ? roomProgram.sectors
          : []
      ).map(
        sector => [
          sector.sectorId,
          sector
        ]
      )
    );

    const suppliedSectors = Array.isArray(roomProgram.sectors) ? roomProgram.sectors : [];
    const byPurpose = new Map();
    for (const sector of suppliedSectors) {
      const purpose = String(sector.purpose || "").toUpperCase();
      if (!byPurpose.has(purpose)) byPurpose.set(purpose, []);
      byPurpose.get(purpose).push(sector);
    }

    const definitions = [
      [
        "crew-quarters",
        "Crew Quarters",
        "CREW_QUARTERS",
        "OPTIONAL"
      ],
      [
        "bridge",
        "Bridge",
        "BRIDGE",
        "OBJECTIVE"
      ],
      [
        "galley",
        "Galley",
        "GALLEY",
        "OPTIONAL"
      ],
      [
        "central-passage",
        "Central Passage",
        "CENTRAL_PASSAGE",
        "HUB"
      ],
      [
        "stores",
        "Forward Stores",
        "STORAGE",
        "OPTIONAL"
      ],
      [
        "cargo-hold",
        "Main Cargo Hold",
        "CARGO",
        "OBJECTIVE"
      ],
      [
        "loading-airlock",
        "Loading Airlock",
        "AIRLOCK",
        "ENTRY"
      ],
      [
        "engineering",
        "Engineering",
        "ENGINEERING",
        "OBJECTIVE"
      ],
      [
        "utility",
        "Life Support",
        "UTILITY",
        "OPTIONAL"
      ]
    ];

    const sectors =
      definitions.map(
        ([
          sectorId,
          name,
          purpose,
          graphRole
        ]) => {
          const cell =
            cells[sectorId];

          if (!cell) {
            throw new Error(
              `Missing Freighter placement: ${sectorId}`
            );
          }

          const bounds = {
            x:
              originX +
              cell.col * gridSize,

            y:
              originY +
              cell.row * gridSize,

            width:
              cell.w * gridSize,

            height:
              cell.h * gridSize
          };

          const suppliedSector =
            supplied.get(sectorId) || byPurpose.get(purpose)?.shift() || null;

          return {
            ...(suppliedSector || {}),

            sectorId,
            sourceSectorId: suppliedSector?.sectorId || null,

            name:
              suppliedSector?.name ||
              name,

            purpose,

            graphRole:
              suppliedSector?.graphRole ||
              graphRole,

            connections: [],
            floor: 1,

            gridPosition: {
              col: cell.col,
              row: cell.row
            },

            gridDimensions: {
              w: cell.w,
              h: cell.h
            },

            bounds: {
              ...bounds
            },

            pixelBounds: {
              ...bounds
            },

            center: {
              x:
                bounds.x +
                bounds.width / 2,

              y:
                bounds.y +
                bounds.height / 2
            },

            architecturalZone:
              cell.zone,

            shapeType:
              "RECTANGLE",

            shapeTypeSource:
              "FREIGHTER_GRAMMAR"
          };
        }
      );

    const byId = new Map(
      sectors.map(
        sector => [
          sector.sectorId,
          sector
        ]
      )
    );

    const adjacencyPairs = [
      [
        "bridge",
        "central-passage"
      ],
      [
        "central-passage",
        "cargo-hold"
      ],
      [
        "crew-quarters",
        "central-passage"
      ],
      [
        "galley",
        "central-passage"
      ],
      [
        "central-passage",
        "stores"
      ],
      [
        "cargo-hold",
        "loading-airlock"
      ],
      [
        "cargo-hold",
        "engineering"
      ],
      [
        "engineering",
        "utility"
      ]
    ];

    const openings =
      adjacencyPairs.map(
        (
          [
            sourceId,
            targetId
          ],
          index
        ) =>
          this._sharedOpening(
            byId.get(sourceId),
            byId.get(targetId),
            gridSize,
            index
          )
      );

    openings.push(
      this._exteriorAirlock(
        byId.get("loading-airlock"),
        mirrored,
        gridSize
      )
    );

    const envelope =
      this._envelope(sectors);

    const result = {
      grammarId:
        this.GRAMMAR_ID,

      variantId:
        mirrored
          ? "FREIGHTER_MIRRORED"
          : "FREIGHTER_STANDARD",

      sceneArchetype:
        "FREIGHTER",

      layoutSeed:
        seed,

      envelope,
      sectors,
      openings,
      routes: [],

      normalizedTopology: {
        gridSize,
        rectangles: [],
        junctions: []
      },

      openingPlan: {
        openings
      },

      floors: {
        1: {
          floor: 1,
          sectors
        }
      },

      architecture: {
        circulationType:
          "CARGO_SPINE_DIRECT",

        bowPurpose:
          "BRIDGE",

        sternPurpose:
          "ENGINEERING",

        dominantPurpose:
          "CARGO",

        commandProjection:
          "FORWARD_BRIDGE_BLISTER",

        exteriorAirlockId:
          "freighter-loading-airlock",

        cargoAccessType:
          "SEALED_LOADING_VESTIBULE"
      }
    };

    const contract =
      GrammarContract.validate(
        result
      );

    if (!contract.valid) {
      throw new Error(
        contract.problems.join(" ")
      );
    }

    return result;
  }

  static _cells(mirrored) {
    /*
     * Main interior spans rows 0–14.
     *
     * The Bridge projects two grid cells
     * beyond the primary bow line:
     *
     *       Crew Quarters
     *  Bridge Projection | Central Passage
     *       Galley
     *
     * Cargo dominates the center.
     * Engineering and Utility form the stern.
     */

    const standard = {
      "crew-quarters": {
        col: 0,
        row: 0,
        w: 4,
        h: 5,
        zone: "HABITATION"
      },

      bridge: {
        col: -2,
        row: 5,
        w: 6,
        h: 4,
        zone: "COMMAND"
      },

      galley: {
        col: 0,
        row: 9,
        w: 4,
        h: 5,
        zone: "HABITATION"
      },

      "central-passage": {
        col: 4,
        row: 3,
        w: 4,
        h: 8,
        zone: "MISSION"
      },

      stores: {
        col: 4,
        row: 11,
        w: 4,
        h: 3,
        zone: "SERVICE"
      },

      "cargo-hold": {
        col: 8,
        row: 0,
        w: 10,
        h: 10,
        zone: "MISSION"
      },

      "loading-airlock": {
        col: 8,
        row: 10,
        w: 10,
        h: 4,
        zone: "ACCESS"
      },

      engineering: {
        col: 18,
        row: 0,
        w: 10,
        h: 8,
        zone: "ENGINEERING"
      },

      utility: {
        col: 18,
        row: 8,
        w: 10,
        h: 6,
        zone: "ENGINEERING"
      }
    };

    if (!mirrored) {
      return standard;
    }

    return Object.fromEntries(
      Object.entries(
        standard
      ).map(
        ([
          id,
          cell
        ]) => [
          id,
          {
            ...cell,

            row:
              14 -
              cell.row -
              cell.h
          }
        ]
      )
    );
  }

  static _sharedOpening(
    source,
    target,
    gridSize,
    index
  ) {
    if (!source || !target) {
      throw new Error(
        "Freighter opening references a missing room."
      );
    }

    const sourceBounds =
      source.bounds;

    const targetBounds =
      target.bounds;

    const overlapY =
      Math.min(
        sourceBounds.y +
          sourceBounds.height,

        targetBounds.y +
          targetBounds.height
      ) -
      Math.max(
        sourceBounds.y,
        targetBounds.y
      );

    const overlapX =
      Math.min(
        sourceBounds.x +
          sourceBounds.width,

        targetBounds.x +
          targetBounds.width
      ) -
      Math.max(
        sourceBounds.x,
        targetBounds.x
      );

    let face;
    let location;

    if (
      overlapY > 0 &&
      Math.abs(
        sourceBounds.x +
          sourceBounds.width -
          targetBounds.x
      ) < 0.01
    ) {
      face = "EAST";

      location = {
        x:
          targetBounds.x,

        y:
          Math.max(
            sourceBounds.y,
            targetBounds.y
          ) +
          overlapY / 2
      };
    } else if (
      overlapY > 0 &&
      Math.abs(
        targetBounds.x +
          targetBounds.width -
          sourceBounds.x
      ) < 0.01
    ) {
      face = "WEST";

      location = {
        x:
          sourceBounds.x,

        y:
          Math.max(
            sourceBounds.y,
            targetBounds.y
          ) +
          overlapY / 2
      };
    } else if (
      overlapX > 0 &&
      Math.abs(
        sourceBounds.y +
          sourceBounds.height -
          targetBounds.y
      ) < 0.01
    ) {
      face = "SOUTH";

      location = {
        x:
          Math.max(
            sourceBounds.x,
            targetBounds.x
          ) +
          overlapX / 2,

        y:
          targetBounds.y
      };
    } else if (
      overlapX > 0 &&
      Math.abs(
        targetBounds.y +
          targetBounds.height -
          sourceBounds.y
      ) < 0.01
    ) {
      face = "NORTH";

      location = {
        x:
          Math.max(
            sourceBounds.x,
            targetBounds.x
          ) +
          overlapX / 2,

        y:
          sourceBounds.y
      };
    } else {
      throw new Error(
        `No shared boundary for ${source.sectorId} and ${target.sectorId}.`
      );
    }

    return {
      openingId:
        `freighter-door-${index}`,

      hostType:
        "ROOM",

      hostId:
        source.sectorId,

      sourceId:
        source.sectorId,

      targetId:
        target.sectorId,

      connectedSources: [
        source.sectorId
      ],

      connectedTargets: [
        target.sectorId
      ],

      location,

      requestedLocation: {
        ...location
      },

      face,

      orientation:
        [
          "EAST",
          "WEST"
        ].includes(face)
          ? "VERTICAL"
          : "HORIZONTAL",

      width:
        Math.min(
          200,
          gridSize * 2
        ),

      doorType:
        "STANDARD",

      connectionType:
        "STANDARD_DOOR",

      exactFaceRequired:
        true,

      source:
        "FREIGHTER_GRAMMAR"
    };
  }

  static _exteriorAirlock(
    airlock,
    mirrored,
    gridSize
  ) {
    if (!airlock) {
      throw new Error(
        "Freighter loading airlock is missing."
      );
    }

    const bounds =
      airlock.bounds;

    const face =
      mirrored
        ? "NORTH"
        : "SOUTH";

    const location = {
      x:
        bounds.x +
        bounds.width / 2,

      y:
        mirrored
          ? bounds.y
          : bounds.y +
            bounds.height
    };

    return {
      openingId:
        "freighter-loading-airlock",

      hostType:
        "ROOM",

      hostId:
        airlock.sectorId,

      sourceId:
        airlock.sectorId,

      targetId:
        "__exterior__",

      connectedSources: [
        airlock.sectorId
      ],

      connectedTargets: [
        "__exterior__"
      ],

      location,

      requestedLocation: {
        ...location
      },

      face,

      orientation:
        "HORIZONTAL",

      width:
        Math.min(
          300,
          gridSize * 3
        ),

      doorType:
        "STANDARD",

      connectionType:
        "AIRLOCK",

      exactFaceRequired:
        true,

      exterior:
        true,

      source:
        "FREIGHTER_GRAMMAR"
    };
  }

  static _envelope(
    sectors
  ) {
    const bounds =
      sectors.map(
        sector =>
          sector.bounds
      );

    const x =
      Math.min(
        ...bounds.map(
          bound =>
            bound.x
        )
      );

    const y =
      Math.min(
        ...bounds.map(
          bound =>
            bound.y
        )
      );

    const right =
      Math.max(
        ...bounds.map(
          bound =>
            bound.x +
            bound.width
        )
      );

    const bottom =
      Math.max(
        ...bounds.map(
          bound =>
            bound.y +
            bound.height
        )
      );

    return {
      x,
      y,

      width:
        right - x,

      height:
        bottom - y
    };
  }
}