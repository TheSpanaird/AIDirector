// modules/ai-director/scripts/cartographer/architectural-packer.js
// AI Director Cartographer Phase 5
// Profile-specific architectural placement for prepared manifest sectors.

import { LayoutProfileLibrary }
  from "/modules/ai-director/scripts/cartographer/layout-profile-library.js";

import { LayoutProfileResolver }
  from "/modules/ai-director/scripts/cartographer/layout-profile-resolver.js";

import { FootprintDesignEngine }
  from "/modules/ai-director/scripts/cartographer/footprint-design-engine.js";

import { BuildingProgramPlanner }
  from "/modules/ai-director/scripts/cartographer/building-program-planner.js";

export class ArchitecturalPacker {
  static CONFIG = Object.freeze({
    gridSize: 100,
    architecturalScale: "STANDARD",
    preserveExplicitPositions: false,
    compactRowWidth: null,
    courtyardWidth: null,
    courtyardHeight: null,
    spineGap: 2,
    ringGap: 2,
    naturalSpread: 8,
    layoutSeed: null,
    corridorWidth: 200,
    partitionBuildings: true
  });

  static GRAPH_PRIORITY = Object.freeze({
    ENTRY: 1,
    HUB: 2,
    OBJECTIVE: 3,
    EXIT: 4,
    OPTIONAL: 5,
    DEAD_END: 6,
    SECRET: 7
  });

  static PURPOSE_PRIORITY = Object.freeze({
    ENTRY: 1,
    SECURITY: 2,
    COURTYARD: 3,
    HALL: 4,
    GREAT_HALL: 4,
    PUBLIC_ROOM: 4,
    COMMAND: 5,
    INNER_KEEP: 5,
    THRONE_ROOM: 5,
    STAGE: 5,
    REACTOR: 5,
    HANGAR: 5,
    BARRACKS: 6,
    LIVING: 6,
    KITCHEN: 7,
    STORAGE: 8,
    UTILITY: 9,
    SECRET: 10,
    HIDDEN_CHAMBER: 10
  });

  /**
   * Place already-sized sectors according to a resolved architectural profile.
   * The packer does not invent rooms and does not modify connections.
   */
  static pack(
    sectors = [],
    manifest = {},
    customConfig = {}
  ) {
    if (!Array.isArray(sectors)) {
      throw new Error("ArchitecturalPacker requires a sectors array.");
    }

    const config = this._normalizeConfig(customConfig);
    const profile = this._resolveProfile(manifest, config);
    const prepared = this._applySeededDimensionVariation(
      this._prepareSectors(sectors),
      profile,
      config
    );

    if (!prepared.length) {
      return {
        profile,
        sectors: [],
        zones: [],
        footprint: this._emptyBounds(),
        strategy: "EMPTY"
      };
    }

    const strategy = this._strategyFor(profile);
    const automatic = [];
    const explicit = [];

    for (const sector of this._sortSectors(prepared)) {
      if (
        config.preserveExplicitPositions &&
        this._hasExplicitPosition(sector)
      ) {
        explicit.push({
          ...sector,
          gridPosition: this._readGridPosition(sector),
          architecturalZone: "EXPLICIT"
        });
      } else {
        automatic.push(sector);
      }
    }

    const footprintDesign = FootprintDesignEngine.design(
      automatic,
      profile,
      config,
      manifest
    );

    const buildingProgram = BuildingProgramPlanner.plan(
      manifest,
      profile,
      automatic,
      config
    );

    const partitioned = this._usesPartitionedBuilding(
      profile,
      footprintDesign.contract,
      config
    )
      ? this._partitionBuilding(
          automatic,
          profile,
          config,
          buildingProgram
        )
      : null;

    const grammar = String(profile.layoutGrammar || "").toUpperCase();
    const grammarDriven = [
      "ADJOINING_ROOMS",
      "PUBLIC_ANCHOR",
      "COURTYARD_RANGES",
      "DECK_SPINE"
    ].includes(grammar);

    let packed = partitioned
      ? partitioned.sectors
      : grammarDriven || footprintDesign.contract.archetype === "NATURAL_BRANCHING"
        ? this._packByStrategy(automatic, profile, config, strategy)
        : footprintDesign.sectors;

    if (partitioned) {
      footprintDesign.envelope = partitioned.envelope;
      footprintDesign.skeleton = partitioned.skeleton;
      footprintDesign.partition = partitioned.partition;
    }

    packed = packed.map(sector => ({
      ...sector,
      footprintContract: footprintDesign.contract,
      footprintEnvelope: footprintDesign.envelope,
      footprintSkeletonGrid: footprintDesign.skeleton
    }));

    packed = this._avoidExplicitRooms(
      packed,
      explicit,
      profile,
      config
    );

    const arranged = [...explicit, ...packed]
      .sort((a, b) => a._layoutIndex - b._layoutIndex);

    const repaired = this._resolvePackedOverlaps(
      arranged,
      profile,
      config
    );

    const combined = repaired
      .map(sector => {
        const preparedSector = { ...sector };
        if (this._purpose(preparedSector).includes("TOWER") && !preparedSector.shapeType) {
          preparedSector.shapeType = profile.towerShape || "TOWER_SQUARE";
        }
        preparedSector.circulationReservation = {
          zone: preparedSector.architecturalZone || "GENERAL",
          accessRequired: true
        };
        preparedSector.routingPolicy = {
          connectionPolicy: profile.connectionPolicy || "PRESERVE_GRAPH",
          maximumRoomDegree: profile.maximumRoomDegree || 3,
          preferSharedWalls: profile.preferSharedWalls === true,
          allowCrossMapRoutes: profile.allowCrossMapRoutes !== false
        };
        return this._stripInternalFields(preparedSector);
      });

    return {
      profile,
      sectors: combined,
      zones: this._summarizeZones(combined),
      footprint: this.calculateGridBounds(combined),
      strategy,
      footprintDesign: {
        contract: footprintDesign.contract,
        envelope: footprintDesign.envelope,
        skeleton: footprintDesign.skeleton,
        partition: footprintDesign.partition || null,
        buildingProgram
      }
    };
  }

  static _usesPartitionedBuilding(profile, contract, config) {
    if (config.partitionBuildings === false) return false;
    const grammar = String(profile.layoutGrammar || "").toUpperCase();
    const id = String(profile.profileId || profile.id || "").toUpperCase();
    return grammar === "CENTRAL_HALL_BANDS" || id === "FACILITY";
  }

  static _partitionBuilding(sectors, profile, config, program) {
    if (!sectors.length) return null;
    const hallWidth = Math.max(
      1,
      Math.round((Number(config.corridorWidth) || config.gridSize * 2) / config.gridSize)
    );
    const seeded = this._seededOrder(sectors, program.seed);
    const entry = seeded.find(sector =>
      String(sector.graphRole || "").toUpperCase() === "ENTRY" ||
      /ENTRY|FOYER|RECEPTION/.test(this._purpose(sector))
    );
    const remaining = seeded.filter(sector => sector !== entry);
    const left = [];
    const right = [];
    let leftHeight = 0;
    let rightHeight = 0;

    const placeBand = (sector, preferred = null) => {
      const height = sector.gridDimensions.h;
      let target;
      if (preferred === "LEFT") target = left;
      else if (preferred === "RIGHT") target = right;
      else target = leftHeight <= rightHeight ? left : right;
      target.push(sector);
      if (target === left) leftHeight += height;
      else rightHeight += height;
    };

    for (const sector of remaining) {
      const purpose = this._purpose(sector);
      const preferred = /PUBLIC|CONFERENCE|RECORD|KITCHEN|STORAGE|SERVICE/.test(purpose)
        ? "LEFT"
        : /OFFICE|BED|BATH|RESTROOM|STAIR|ELEVATOR|UTILITY|SECURITY/.test(purpose)
          ? "RIGHT"
          : null;
      placeBand(sector, preferred);
    }
    if (entry) placeBand(entry, "LEFT");
    if (!left.length && right.length) left.push(right.shift());
    if (!right.length && left.length > 1) right.push(left.pop());

    const stairIndex = right.findIndex(sector => /STAIR|ELEVATOR/.test(this._purpose(sector)));
    const utilityIndex = right.findIndex(sector => /UTILITY|MECHANICAL/.test(this._purpose(sector)));
    let paired = null;
    if (stairIndex >= 0 && utilityIndex >= 0 && stairIndex !== utilityIndex) {
      const stair = right[stairIndex];
      const utility = right[utilityIndex];
      paired = { stair, utility };
      right.splice(Math.max(stairIndex, utilityIndex), 1);
      right.splice(Math.min(stairIndex, utilityIndex), 1);
      right.push(stair);
    }

    const leftWidth = Math.max(...left.map(sector => sector.gridDimensions.w), 4);
    const pairedWidth = paired
      ? paired.stair.gridDimensions.w + paired.utility.gridDimensions.w
      : 0;
    const rightWidth = Math.max(...right.map(sector => sector.gridDimensions.w), pairedWidth, 4);
    const hallLeft = leftWidth;
    const hallCenter = hallLeft + hallWidth / 2;
    const rightX = hallLeft + hallWidth;
    const output = [];

    let row = 0;
    for (const sector of left) {
      output.push({
        ...sector,
        gridPosition: { col: hallLeft - sector.gridDimensions.w, row },
        architecturalZone: "LEFT_BAND",
        hallwayAccessCandidate: true,
        hallwayHostId: "primary-hall",
        hallwayFace: "EAST",
        hallwayAccess: {
          hostId: "primary-hall",
          face: "EAST",
          offsetRatio: 0.5
        }
      });
      row += sector.gridDimensions.h;
    }
    leftHeight = row;

    row = 0;
    for (const sector of right) {
      const isPairedStair = paired?.stair === sector;
      output.push({
        ...sector,
        gridPosition: { col: rightX, row },
        architecturalZone: isPairedStair ? "VERTICAL_CORE" : "RIGHT_BAND",
        hallwayAccessCandidate: true,
        hallwayHostId: "primary-hall",
        hallwayFace: "WEST",
        hallwayAccess: {
          hostId: "primary-hall",
          face: "WEST",
          offsetRatio: 0.5
        }
      });
      if (isPairedStair) {
        output.push({
          ...paired.utility,
          gridPosition: {
            col: rightX + sector.gridDimensions.w,
            row
          },
          architecturalZone: "CORE_SUPPORT",
          hallwayAccessCandidate: false,
          hallwayHostId: null,
          hallwayFace: null,
          hallwayAccess: null,
          preferredAccessFrom: sector.sectorId
        });
        row += Math.max(sector.gridDimensions.h, paired.utility.gridDimensions.h);
      } else {
        row += sector.gridDimensions.h;
      }
    }
    rightHeight = row;

    const height = Math.max(leftHeight, rightHeight, 8);
    return {
      sectors: output,
      skeleton: [{ x1: hallCenter, y1: 0, x2: hallCenter, y2: height }],
      envelope: {
        left: 0,
        top: 0,
        right: rightX + rightWidth,
        bottom: height
      },
      partition: {
        type: "CENTRAL_HALL_PARTITION",
        seed: program.seed,
        hall: {
          left: hallLeft,
          right: rightX,
          center: hallCenter,
          top: 0,
          bottom: height,
          width: hallWidth
        },
        entranceCount: program.entranceCount,
        emergencyExitCount: program.emergencyExitCount,
        verticalCores: program.verticalCores
      }
    };
  }

  /**
   * Apply deterministic dimension variation only.
   * Dimensions remain clamped to each purpose rule. Room shape is never
   * selected randomly or by graph role in the architectural rebuild layer.
   */
  static _applySeededDimensionVariation(sectors, profile, config) {
    const variation = Math.max(
      0,
      Math.min(0.35, Number(profile.sizeVariation) || 0)
    );
    const seed =
      config.layoutSeed ||
      profile.profileId ||
      profile.id ||
      "layout";

    return sectors.map(sector => {
      const clone = structuredClone(sector);
      if (variation <= 0 || clone.lockDimensions === true) {
        return clone;
      }

      const key = `${seed}:${sector.sectorId || sector.name}`;
      const widthRoll =
        (this._seedHash(`${key}:width`) % 2001) / 1000 - 1;
      const heightRoll =
        (this._seedHash(`${key}:height`) % 2001) / 1000 - 1;
      const rule = clone.purposeDimensionRule;
      const currentWidth = Math.max(1, Number(clone.gridDimensions?.w) || 1);
      const currentHeight = Math.max(1, Number(clone.gridDimensions?.h) || 1);
      const minimumWidth = Math.max(1, Number(rule?.min?.w) || currentWidth);
      const minimumHeight = Math.max(1, Number(rule?.min?.h) || currentHeight);
      const maximumWidth = Math.max(
        minimumWidth,
        Number(rule?.max?.w) || currentWidth
      );
      const maximumHeight = Math.max(
        minimumHeight,
        Number(rule?.max?.h) || currentHeight
      );
      const clamp = (value, minimum, maximum) =>
        Math.max(minimum, Math.min(maximum, value));

      clone.gridDimensions = {
        w: clamp(
          Math.round(currentWidth * (1 + widthRoll * variation)),
          minimumWidth,
          maximumWidth
        ),
        h: clamp(
          Math.round(currentHeight * (1 + heightRoll * variation)),
          minimumHeight,
          maximumHeight
        )
      };
      clone.dimensionVariationSource = "PROFILE_SEEDED_BOUNDED";
      return clone;
    });
  }

  static _seededOrder(sectors, seed) {
    return [...sectors].sort((a, b) => {
      const first = this._seedHash(`${seed}:${a.sectorId || a.name}`);
      const second = this._seedHash(`${seed}:${b.sectorId || b.name}`);
      return first - second || (a._layoutIndex || 0) - (b._layoutIndex || 0);
    });
  }

  static _seedHash(value) {
    let hash = 2166136261;
    for (const character of String(value || "")) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  static _packByStrategy(
    sectors,
    profile,
    config,
    strategy
  ) {
    switch (strategy) {
      case "NATURAL_BRANCHING":
        return this._packNatural(sectors, profile, config);

      case "COURTYARD":
        return this._packCourtyard(sectors, profile, config);

      case "DEFENSIVE_PERIMETER":
        return this._packPerimeter(sectors, profile, config);

      case "LAYERED_FORTRESS":
        return this._packLayered(sectors, profile, config);

      case "PUBLIC_SPINE":
        return this._packSpine(sectors, profile, config, "PUBLIC");

      case "SERVICE_SPINE":
        return this._packSpine(sectors, profile, config, "SERVICE");

      case "DECK_SPINE":
        return this._packSpine(sectors, profile, config, "DECK");

      case "MODULAR_GRID":
        return this._packModular(sectors, profile, config);

      case "COMPACT_ROOMS":
      default:
        return this._packCompact(sectors, profile, config);
    }
  }

  static _packCompact(sectors, profile, config) {
    const gap = this._gapCells(profile, config);
    const targetWidth = this._targetWidth(profile, config);
    const output = [];
    let col = 0;
    let row = 0;
    let rowHeight = 0;

    for (const sector of sectors) {
      const { w, h } = sector.gridDimensions;

      if (col > 0 && col + w > targetWidth) {
        col = 0;
        row += rowHeight + gap;
        rowHeight = 0;
      }

      output.push({
        ...sector,
        gridPosition: { col, row },
        architecturalZone: this._compactZone(sector)
      });

      col += w + gap;
      rowHeight = Math.max(rowHeight, h);
    }

    return output;
  }

  /** Castle and Manor plans wrap rooms around a real courtyard sector or void. */
  static _packCourtyard(sectors, profile, config) {
    if (sectors.length < 4) return this._packCompact(sectors, profile, config);

    const gap = Math.max(1, this._gapCells(profile, config));
    const courtyard = sectors.find(sector => this._purpose(sector).includes("COURTYARD")) || null;
    const towers = sectors.filter(sector => this._purpose(sector).includes("TOWER"));
    const remaining = sectors.filter(sector => sector !== courtyard && !towers.includes(sector));
    const allRooms = [...remaining, ...towers];
    const maxRoomW = Math.max(...allRooms.map(s => s.gridDimensions.w), 6);
    const maxRoomH = Math.max(...allRooms.map(s => s.gridDimensions.h), 6);
    const innerW = courtyard?.gridDimensions.w || Number(config.courtyardWidth) || Math.max(10, maxRoomW * 2);
    const innerH = courtyard?.gridDimensions.h || Number(config.courtyardHeight) || Math.max(8, maxRoomH * 2);
    const left = maxRoomW + gap;
    const top = maxRoomH + gap;
    const right = left + innerW + gap;
    const bottom = top + innerH + gap;
    const output = [];

    if (courtyard) {
      output.push({ ...courtyard, gridPosition: { col: left, row: top }, architecturalZone: "COURTYARD" });
    }

    const cornerFor = sector => {
      const text = `${sector.sectorId || ""} ${sector.name || ""}`.toUpperCase();
      if (/NORTHWEST|NORTH WEST|NW|TOWER-NW/.test(text)) return "NW";
      if (/NORTHEAST|NORTH EAST|NE|TOWER-NE/.test(text)) return "NE";
      if (/SOUTHWEST|SOUTH WEST|SW|TOWER-SW/.test(text)) return "SW";
      if (/SOUTHEAST|SOUTH EAST|SE|TOWER-SE/.test(text)) return "SE";
      return null;
    };
    const unusedCorners = ["NW", "NE", "SW", "SE"];
    for (const tower of towers) {
      let corner = cornerFor(tower);
      if (!corner || !unusedCorners.includes(corner)) corner = unusedCorners[0];
      unusedCorners.splice(unusedCorners.indexOf(corner), 1);
      const positions = {
        NW: { col: 0, row: 0 },
        NE: { col: right, row: 0 },
        SW: { col: 0, row: bottom },
        SE: { col: right, row: bottom }
      };
      output.push({
        ...tower,
        gridPosition: positions[corner],
        architecturalZone: `TOWER_${corner}`,
        compassPosition: corner
      });
    }

    const sides = ["NORTH", "EAST", "SOUTH", "WEST"];
    const offsets = { NORTH: 0, EAST: 0, SOUTH: 0, WEST: 0 };
    for (const sector of remaining) {
      const purpose = this._purpose(sector);
      let side;
      if (purpose.includes("GATE") || purpose.includes("ENTRY")) side = "SOUTH";
      else if (purpose.includes("KEEP") || purpose.includes("COMMAND") || purpose.includes("HALL")) side = "NORTH";
      else side = sides[remaining.indexOf(sector) % sides.length];
      const offset = offsets[side];
      const { w, h } = sector.gridDimensions;
      let col;
      let row;
      if (side === "NORTH") {
        col = left + offset;
        row = Math.max(0, top - h - gap);
        offsets.NORTH += w + gap;
      } else if (side === "SOUTH") {
        col = left + offset;
        row = bottom;
        offsets.SOUTH += w + gap;
      } else if (side === "EAST") {
        col = right;
        row = top + offset;
        offsets.EAST += h + gap;
      } else {
        col = Math.max(0, left - w - gap);
        row = top + offset;
        offsets.WEST += h + gap;
      }
      output.push({
        ...sector,
        gridPosition: { col, row },
        architecturalZone: this._courtyardZone(sector, side),
        compassPosition: side
      });
    }

    return output;
  }

  /** Fort plans place rooms around the outer defensive ring and central yard. */
  static _packPerimeter(sectors, profile, config) {
    if (sectors.length < 4) {
      return this._packCompact(sectors, profile, config);
    }

    const gap = Math.max(1, Number(config.ringGap) || 2);
    const maxW = Math.max(...sectors.map(s => s.gridDimensions.w), 6);
    const maxH = Math.max(...sectors.map(s => s.gridDimensions.h), 6);
    const sideCount = Math.max(2, Math.ceil(sectors.length / 4));
    const ringW = sideCount * (maxW + gap);
    const ringH = sideCount * (maxH + gap);
    const positions = this._ringPositions(ringW, ringH, maxW, maxH, gap);

    return sectors.map((sector, index) => {
      const anchor = positions[index % positions.length];
      return {
        ...sector,
        gridPosition: {
          col: anchor.col,
          row: anchor.row
        },
        architecturalZone:
          this._purpose(sector).includes("COURTYARD")
            ? "CENTRAL_YARD"
            : "DEFENSIVE_PERIMETER"
      };
    });
  }

  /** Fortress and Secret Base profiles use security, core, and support layers. */
  static _packLayered(sectors, profile, config) {
    const groups = {
      OUTER: [],
      MIDDLE: [],
      INNER: [],
      SECRET: []
    };

    for (const sector of sectors) {
      groups[this._layerFor(sector)].push(sector);
    }

    const gap = Math.max(1, this._gapCells(profile, config));
    const output = [];
    let row = 0;

    for (const layer of ["OUTER", "MIDDLE", "INNER", "SECRET"]) {
      const rooms = groups[layer];
      if (!rooms.length) continue;

      let col = layer === "OUTER" ? 0 :
        layer === "MIDDLE" ? 4 :
        layer === "INNER" ? 8 : 12;
      let height = 0;

      for (const sector of rooms) {
        output.push({
          ...sector,
          gridPosition: { col, row },
          architecturalZone: `${layer}_LAYER`
        });
        col += sector.gridDimensions.w + gap;
        height = Math.max(height, sector.gridDimensions.h);
      }

      row += height + gap * 2;
    }

    return output;
  }

  /** Public, service, and ship layouts alternate rooms along a central spine. */
  static _packSpine(sectors, profile, config, spineType) {
    if (!sectors.length) return [];

    const gap = Math.max(1, Number(config.spineGap) || 2);
    const maxH = Math.max(...sectors.map(s => s.gridDimensions.h), 4);
    const spineRow = maxH + gap;
    const output = [];
    let col = 0;

    sectors.forEach((sector, index) => {
      const purpose = this._purpose(sector);
      const restricted = this._isRestrictedPurpose(purpose);
      const above = restricted ? false : index % 2 === 0;
      const row = above
        ? Math.max(0, spineRow - sector.gridDimensions.h - gap)
        : spineRow + gap;

      output.push({
        ...sector,
        gridPosition: { col, row },
        architecturalZone: restricted
          ? `${spineType}_RESTRICTED`
          : `${spineType}_SPINE`
      });

      col += Math.max(
        3,
        Math.ceil(sector.gridDimensions.w * 0.75)
      ) + gap;
    });

    return output;
  }

  static _packModular(sectors, profile, config) {
    const gap = Math.max(1, this._gapCells(profile, config));
    const columns = Math.max(2, Math.ceil(Math.sqrt(sectors.length)));
    const cellW = Math.max(...sectors.map(s => s.gridDimensions.w), 6) + gap;
    const cellH = Math.max(...sectors.map(s => s.gridDimensions.h), 6) + gap;

    return sectors.map((sector, index) => ({
      ...sector,
      gridPosition: {
        col: (index % columns) * cellW,
        row: Math.floor(index / columns) * cellH
      },
      architecturalZone: "MODULAR_BAY"
    }));
  }

  /** Mine and Cave layouts use deterministic branching, not random placement. */
  static _packNatural(sectors, profile, config) {
    if (!sectors.length) return [];

    const gap = Math.max(
      1,
      this._gapCells(profile, config)
    );
    const spread = Math.max(
      gap,
      Number(config.naturalSpread) || 8
    );
    const goldenAngle = 2.399963229728653;
    const output = [];
    const occupied = [];

    for (let index = 0; index < sectors.length; index++) {
      const sector = sectors[index];
      const candidate = {
        ...sector,
        gridPosition: { col: 0, row: 0 },
        architecturalZone: index === 0
          ? "NATURAL_ENTRY"
          : this._isSecret(sector)
            ? "NATURAL_HIDDEN_BRANCH"
            : "NATURAL_BRANCH"
      };

      if (index > 0) {
        const dimensions = sector.gridDimensions;
        const minimumRadius = Math.max(
          dimensions.w,
          dimensions.h,
          ...sectors.slice(0, index).map(placed =>
            Math.max(placed.gridDimensions.w, placed.gridDimensions.h)
          )
        ) + gap;

        let radius = minimumRadius +
          Math.floor((index - 1) / 6) * spread;
        let angle = index * goldenAngle;
        let attempts = 0;

        do {
          candidate.gridPosition = {
            col: Math.round(Math.cos(angle) * radius),
            row: Math.round(Math.sin(angle) * radius)
          };
          angle += goldenAngle;
          if ((attempts + 1) % 8 === 0) radius += spread;
          attempts++;
        } while (
          occupied.some(rect =>
            this._gridIntersects(this._gridRect(candidate), rect)
          ) && attempts < 256
        );
      }

      occupied.push(this._gridRect(candidate));
      output.push(candidate);
    }

    return output;
  }

  static _avoidExplicitRooms(packed, explicit, profile, config) {
    if (!explicit.length || !packed.length) return packed;

    const gap = Math.max(1, this._gapCells(profile, config));
    const occupied = explicit.map(sector => this._gridRect(sector));

    return packed.map(sector => {
      const candidate = { ...sector, gridPosition: { ...sector.gridPosition } };
      let guard = 0;

      while (
        occupied.some(rect => this._gridIntersects(this._gridRect(candidate), rect)) &&
        guard < 100
      ) {
        candidate.gridPosition.col += candidate.gridDimensions.w + gap;
        guard++;
      }

      occupied.push(this._gridRect(candidate));
      return candidate;
    });
  }


  /**
   * Deterministically repair collisions left by any packing strategy.
   * Explicit rooms stay fixed. Automatic rooms move outward until clear.
   */
  static _resolvePackedOverlaps(sectors, profile, config) {
    if (!Array.isArray(sectors) || sectors.length < 2) return sectors;

    const gap = Math.max(1, this._gapCells(profile, config));
    const occupied = [];

    return sectors.map((sector, index) => {
      const candidate = {
        ...sector,
        gridPosition: { ...this._readGridPosition(sector) }
      };
      const fixed = candidate.architecturalZone === "EXPLICIT";
      let attempts = 0;

      while (
        !fixed &&
        occupied.some(rect =>
          this._gridIntersects(this._gridRect(candidate), rect)
        ) &&
        attempts < 256
      ) {
        const ring = Math.floor(attempts / 4) + 1;
        const distance = ring * (
          Math.max(
            candidate.gridDimensions.w,
            candidate.gridDimensions.h
          ) + gap
        );
        const direction = attempts % 4;
        const origin = this._readGridPosition(sector);

        if (direction === 0) {
          candidate.gridPosition = {
            col: origin.col + distance,
            row: origin.row
          };
        } else if (direction === 1) {
          candidate.gridPosition = {
            col: origin.col,
            row: origin.row + distance
          };
        } else if (direction === 2) {
          candidate.gridPosition = {
            col: origin.col - distance,
            row: origin.row
          };
        } else {
          candidate.gridPosition = {
            col: origin.col,
            row: origin.row - distance
          };
        }
        attempts++;
      }

      occupied.push(this._gridRect(candidate));
      return candidate;
    });
  }

  static calculateGridBounds(sectors = []) {
    if (!sectors.length) return this._emptyBounds();

    const rectangles = sectors.map(sector => this._gridRect(sector));
    const minCol = Math.min(...rectangles.map(rect => rect.left));
    const minRow = Math.min(...rectangles.map(rect => rect.top));
    const maxCol = Math.max(...rectangles.map(rect => rect.right));
    const maxRow = Math.max(...rectangles.map(rect => rect.bottom));

    return {
      col: minCol,
      row: minRow,
      width: maxCol - minCol,
      height: maxRow - minRow,
      right: maxCol,
      bottom: maxRow
    };
  }

  static validateResult(result) {
    const problems = [];

    if (!result || typeof result !== "object") {
      return {
        valid: false,
        problems: ["Missing architectural packing result."]
      };
    }

    if (!Array.isArray(result.sectors)) {
      problems.push("Packed sectors must be an array.");
    }

    for (const sector of result.sectors || []) {
      if (!sector.sectorId) problems.push("Packed sector is missing sectorId.");
      if (!this._hasExplicitPosition(sector)) {
        problems.push(`Packed sector ${sector.sectorId || "unknown"} is missing gridPosition.`);
      }
      if (!this._hasDimensions(sector)) {
        problems.push(`Packed sector ${sector.sectorId || "unknown"} is missing gridDimensions.`);
      }
    }

    for (let i = 0; i < (result.sectors || []).length; i++) {
      for (let j = i + 1; j < result.sectors.length; j++) {
        const a = result.sectors[i];
        const b = result.sectors[j];
        if (this._gridIntersects(this._gridRect(a), this._gridRect(b))) {
          problems.push(`Packed sectors overlap: ${a.sectorId} and ${b.sectorId}.`);
        }
      }
    }

    return {
      valid: problems.length === 0,
      problems
    };
  }

  static _resolveProfile(manifest, config) {
    const profile = config.layoutProfileResult ||
      LayoutProfileResolver.resolve(manifest, config);

    const validation = LayoutProfileResolver.validateResult(profile);
    if (!validation.valid) {
      throw new Error(
        `ArchitecturalPacker received an invalid profile: ${validation.problems.join(" ")}`
      );
    }

    return profile;
  }

  static _normalizeConfig(customConfig) {
    const config = {
      ...this.CONFIG,
      ...customConfig
    };

    config.gridSize = Math.max(1, Number(config.gridSize) || 100);
    config.preserveExplicitPositions = config.preserveExplicitPositions === true;
    config.partitionBuildings = config.partitionBuildings !== false;
    config.layoutSeed = config.layoutSeed || null;
    config.corridorWidth = Math.max(config.gridSize, Number(config.corridorWidth) || config.gridSize * 2);
    config.layoutProfile = config.layoutProfile
      ? String(config.layoutProfile).trim().toUpperCase()
      : null;
    config.layoutFamily = config.layoutFamily
      ? String(config.layoutFamily).trim().toUpperCase()
      : null;
    config.architecturalScale = config.architecturalScale
      ? String(config.architecturalScale).trim().toUpperCase()
      : "STANDARD";

    return config;
  }

  static _prepareSectors(sectors) {
    return sectors.map((sector, index) => {
      const clone = structuredClone(sector);
      const dimensions = clone.gridDimensions || clone.dimensions;

      if (!dimensions) {
        throw new Error(
          `ArchitecturalPacker requires gridDimensions for sector ${clone.sectorId || index}.`
        );
      }

      return {
        ...clone,
        _layoutIndex: index,
        gridDimensions: {
          w: Math.max(1, Number(dimensions.w ?? dimensions.width) || 1),
          h: Math.max(1, Number(dimensions.h ?? dimensions.height) || 1)
        }
      };
    });
  }

  static _strategyFor(profile) {
    const grammar = String(profile.layoutGrammar || "").toUpperCase();
    if (grammar === "ADJOINING_ROOMS") return "COMPACT_ROOMS";
    if (grammar === "PUBLIC_ANCHOR") return "SERVICE_SPINE";
    if (grammar === "COURTYARD_RANGES") return "COURTYARD";
    if (grammar === "DECK_SPINE") return "DECK_SPINE";
    if (grammar === "CENTRAL_HALL_BANDS") return "MODULAR_GRID";

    const id = String(profile.profileId || profile.id || "").toUpperCase();
    const pattern = String(profile.corridorPattern || "").toUpperCase();
    const footprint = String(profile.footprintShape || "").toUpperCase();

    if (["MINE", "CAVE"].includes(id)) return "NATURAL_BRANCHING";
    if (["CASTLE", "MANOR"].includes(id) || footprint === "COURTYARD") return "COURTYARD";
    if (id === "FORT" || pattern === "DEFENSIVE_RING" || footprint === "PERIMETER") return "DEFENSIVE_PERIMETER";
    if (["FORTRESS", "SECRET_BASE"].includes(id) || footprint === "LAYERED") return "LAYERED_FORTRESS";
    if (pattern === "PUBLIC_SPINE") return "PUBLIC_SPINE";
    if (pattern === "SERVICE_SPINE") return "SERVICE_SPINE";
    if (pattern === "DECK_SPINE") return "DECK_SPINE";
    if (pattern === "MODULAR_GRID" || footprint === "MODULAR") return "MODULAR_GRID";
    return "COMPACT_ROOMS";
  }

  static _targetWidth(profile, config) {
    if (Number.isFinite(Number(config.compactRowWidth))) {
      return Math.max(8, Number(config.compactRowWidth));
    }

    const widths = {
      HOUSE: 20,
      MANOR: 36,
      BAR: 18,
      CLUB: 30,
      TAVERN: 22,
      HIDEOUT: 16,
      SAFEHOUSE: 20,
      OUTPOST: 22,
      FACILITY: 36,
      SPACESHIP: 44,
      SPACE_STATION: 52
    };

    return widths[profile.profileId] || 28;
  }

  static _gapCells(profile, config) {
    const pixels = Number(profile.roomGap) || 0;
    return Math.max(0, Math.round(pixels / config.gridSize));
  }

  static _sortSectors(sectors) {
    return [...sectors].sort((a, b) => {
      const purposeA = this.PURPOSE_PRIORITY[this._purpose(a)] ?? 999;
      const purposeB = this.PURPOSE_PRIORITY[this._purpose(b)] ?? 999;
      const graphA = this.GRAPH_PRIORITY[String(a.graphRole || "").toUpperCase()] ?? 999;
      const graphB = this.GRAPH_PRIORITY[String(b.graphRole || "").toUpperCase()] ?? 999;
      return purposeA - purposeB || graphA - graphB || a._layoutIndex - b._layoutIndex;
    });
  }

  static _purpose(sector) {
    return String(
      sector.sectorPurpose ||
      sector.purpose ||
      sector.roomType ||
      sector.name ||
      "ROOM"
    )
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  static _layerFor(sector) {
    const purpose = this._purpose(sector);
    const role = String(sector.graphRole || "").toUpperCase();

    if (role === "SECRET" || purpose.includes("SECRET") || purpose.includes("HIDDEN")) return "SECRET";
    if (["COMMAND", "INNER_KEEP", "THRONE_ROOM", "OBJECTIVE", "REACTOR"].some(value => purpose.includes(value)) || role === "OBJECTIVE") return "INNER";
    if (["BARRACKS", "WORKSHOP", "STORAGE", "UTILITY", "MEDICAL"].some(value => purpose.includes(value))) return "MIDDLE";
    return "OUTER";
  }

  static _compactZone(sector) {
    const purpose = this._purpose(sector);
    if (this._isRestrictedPurpose(purpose)) return "RESTRICTED_INTERIOR";
    if (purpose.includes("ENTRY") || purpose.includes("PUBLIC")) return "PUBLIC_INTERIOR";
    return "PRIVATE_INTERIOR";
  }

  static _courtyardZone(sector, side) {
    const purpose = this._purpose(sector);
    if (purpose.includes("TOWER")) return `TOWER_${side}`;
    if (this._isRestrictedPurpose(purpose)) return `PRIVATE_${side}`;
    return `COURTYARD_${side}`;
  }

  static _isRestrictedPurpose(purpose) {
    return [
      "SECURITY",
      "COMMAND",
      "BACKSTAGE",
      "VIP",
      "STORAGE",
      "UTILITY",
      "REACTOR",
      "SECRET",
      "HIDDEN"
    ].some(value => purpose.includes(value));
  }

  static _isSecret(sector) {
    const purpose = this._purpose(sector);
    return String(sector.graphRole || "").toUpperCase() === "SECRET" ||
      purpose.includes("SECRET") ||
      purpose.includes("HIDDEN");
  }

  static _ringPositions(width, height, cellW, cellH, gap) {
    const positions = [];

    for (let col = 0; col < width; col += cellW + gap) {
      positions.push({ col, row: 0 });
    }
    for (let row = cellH + gap; row < height; row += cellH + gap) {
      positions.push({ col: width, row });
    }
    for (let col = width - cellW - gap; col >= 0; col -= cellW + gap) {
      positions.push({ col, row: height });
    }
    for (let row = height - cellH - gap; row > 0; row -= cellH + gap) {
      positions.push({ col: 0, row });
    }

    return positions;
  }

  static _summarizeZones(sectors) {
    const counts = new Map();

    for (const sector of sectors) {
      const zone = sector.architecturalZone || "UNASSIGNED";
      counts.set(zone, (counts.get(zone) || 0) + 1);
    }

    return [...counts.entries()].map(([zone, count]) => ({ zone, count }));
  }

  static _gridRect(sector) {
    const position = this._readGridPosition(sector);
    const dimensions = sector.gridDimensions || { w: 1, h: 1 };

    return {
      left: position.col,
      top: position.row,
      right: position.col + Number(dimensions.w || 1),
      bottom: position.row + Number(dimensions.h || 1)
    };
  }

  static _gridIntersects(a, b) {
    return !(
      a.right <= b.left ||
      b.right <= a.left ||
      a.bottom <= b.top ||
      b.bottom <= a.top
    );
  }

  static _hasExplicitPosition(sector) {
    const position = sector?.gridPosition;
    return Boolean(
      position &&
      Number.isFinite(Number(position.col ?? position.x)) &&
      Number.isFinite(Number(position.row ?? position.y))
    );
  }

  static _hasDimensions(sector) {
    return Boolean(
      sector?.gridDimensions &&
      Number(sector.gridDimensions.w) > 0 &&
      Number(sector.gridDimensions.h) > 0
    );
  }

  static _readGridPosition(sector) {
    return {
      col: Number(sector?.gridPosition?.col ?? sector?.gridPosition?.x) || 0,
      row: Number(sector?.gridPosition?.row ?? sector?.gridPosition?.y) || 0
    };
  }

  static _stripInternalFields(sector) {
    const clone = { ...sector };
    delete clone._layoutIndex;
    return clone;
  }

  static _emptyBounds() {
    return {
      col: 0,
      row: 0,
      width: 0,
      height: 0,
      right: 0,
      bottom: 0
    };
  }
}
