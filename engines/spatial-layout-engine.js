/*
 * CARTOGRAPHER ARCHITECTURE REBUILD BOUNDARY
 * Status: ACTIVE REBUILD: dimension preparation and conversion of approved packed geometry to pixels.
 * Frozen infrastructure must not be modified to compensate for this file.
 * Source of truth: AI-README-CARTOGRAPHER.md, Architecture Rebuild Freeze Boundary.
 */
/**
 * spatial-layout-engine.js
 * AI Director Cartographer Phase 5
 * Profile-aware architectural placement with calibrated building scales.
 */

import { LayoutProfileResolver }
  from "/modules/ai-director/scripts/cartographer/layout-profile-resolver.js";
import { ArchitecturalPacker }
  from "/modules/ai-director/scripts/cartographer/architectural-packer.js";
import { ArchitecturalGrammarRegistry }
  from "/modules/ai-director/scripts/cartographer/architecture/architectural-grammar-registry.js";

export class SpatialLayoutEngine {
  static CONFIG = Object.freeze({
    gridSize: 100,
    roomGap: 200,
    originX: 1000,
    originY: 1000,
    maxOverlapPasses: 40,
    compactRowWidth: null,
    preserveExplicitPositions: false,
    architecturalScale: "STANDARD",
    layoutSeed: null,
    corridorWidth: 200,
    partitionBuildings: true,
    stairWidth: 4,
    stairHeight: 5
  });

  static GRAPH_PRIORITY = Object.freeze({
    OBJECTIVE: 1,
    HUB: 2,
    ENTRY: 3,
    EXIT: 4,
    OPTIONAL: 5,
    DEAD_END: 6,
    SECRET: 7
  });

  static ARCHITECTURAL_SCALES = Object.freeze({
    SMALL: 0.75,
    STANDARD: 1,
    LARGE: 1.25,
    GRAND: 1.6
  });

  static PROFILE_DEFAULT_SCALES = Object.freeze({
    HOUSE: "STANDARD",
    MANOR: "LARGE",
    BAR: "STANDARD",
    CLUB: "LARGE",
    TAVERN: "STANDARD",
    HIDEOUT: "SMALL",
    SAFEHOUSE: "STANDARD",
    SECRET_BASE: "LARGE",
    CASTLE: "LARGE",
    FORT: "LARGE",
    FORTRESS: "GRAND",
    OUTPOST: "STANDARD",
    FACILITY: "LARGE",
    SPACESHIP: "LARGE",
    SPACE_STATION: "GRAND",
    MINE: "STANDARD",
    CAVE: "STANDARD"
  });

  static PROFILE_TARGET_WIDTHS = Object.freeze({
    HOUSE: 20,
    MANOR: 36,
    BAR: 18,
    CLUB: 30,
    TAVERN: 22,
    HIDEOUT: 16,
    SAFEHOUSE: 20,
    SECRET_BASE: 34,
    CASTLE: 38,
    FORT: 34,
    FORTRESS: 48,
    OUTPOST: 22,
    FACILITY: 36,
    SPACESHIP: 44,
    SPACE_STATION: 52,
    MINE: 40,
    CAVE: 40
  });

  static PURPOSE_SIZES = Object.freeze({
    CLOSET: { w: 4, h: 4 },
    STORAGE: { w: 8, h: 8 },
    OFFICE: { w: 8, h: 8 },
    SECURITY: { w: 10, h: 10 },
    BARRACKS: { w: 12, h: 10 },
    WORKSHOP: { w: 14, h: 12 },
    COMMAND: { w: 16, h: 14 },
    TEMPLE: { w: 18, h: 16 },
    THRONE_ROOM: { w: 20, h: 18 },
    HANGAR: { w: 30, h: 24 },
    REACTOR: { w: 24, h: 24 },
    COURTYARD: { w: 20, h: 18 },
    TOWER: { w: 10, h: 10 },
    UTILITY: { w: 10, h: 8 },
    MEDICAL: { w: 12, h: 10 },
    STAIR: { w: 4, h: 5 },
    STAIRWELL: { w: 4, h: 5 },
    ELEVATOR: { w: 3, h: 4 }
  });

  static PROFILE_PURPOSE_SIZES = Object.freeze({
    HOUSE: {
      ENTRY: { w: 3, h: 4 },
      CLOSET: { w: 2, h: 2 },
      STORAGE: { w: 3, h: 4 },
      OFFICE: { w: 4, h: 4 },
      BEDROOM: { w: 4, h: 5 },
      KITCHEN: { w: 4, h: 5 },
      LIVING: { w: 6, h: 7 },
      DINING: { w: 5, h: 6 },
      BATHROOM: { w: 3, h: 3 },
      SECRET: { w: 3, h: 4 }
    },
    MANOR: {
      ENTRY: { w: 6, h: 6 },
      HALL: { w: 10, h: 8 },
      CLOSET: { w: 3, h: 3 },
      STORAGE: { w: 5, h: 5 },
      OFFICE: { w: 6, h: 6 },
      BEDROOM: { w: 6, h: 7 },
      KITCHEN: { w: 7, h: 7 },
      LIVING: { w: 9, h: 10 },
      DINING: { w: 8, h: 9 },
      BATHROOM: { w: 4, h: 4 }
    },
    BAR: {
      ENTRY: { w: 3, h: 4 },
      PUBLIC_ROOM: { w: 8, h: 9 },
      BAR: { w: 6, h: 3 },
      KITCHEN: { w: 4, h: 5 },
      STORAGE: { w: 3, h: 4 },
      OFFICE: { w: 3, h: 4 },
      RESTROOM: { w: 3, h: 3 }
    },
    CLUB: {
      ENTRY: { w: 5, h: 5 },
      PUBLIC_ROOM: { w: 12, h: 12 },
      STAGE: { w: 8, h: 5 },
      BAR: { w: 8, h: 3 },
      BACKSTAGE: { w: 5, h: 5 },
      VIP: { w: 6, h: 6 },
      SECURITY: { w: 4, h: 4 },
      STORAGE: { w: 4, h: 4 }
    },
    TAVERN: {
      ENTRY: { w: 3, h: 4 },
      PUBLIC_ROOM: { w: 9, h: 9 },
      KITCHEN: { w: 5, h: 5 },
      STORAGE: { w: 4, h: 4 },
      BEDROOM: { w: 4, h: 5 }
    },
    HIDEOUT: {
      ENTRY: { w: 2, h: 3 },
      LIVING: { w: 5, h: 6 },
      STORAGE: { w: 3, h: 4 },
      SECURITY: { w: 3, h: 3 },
      WORKSHOP: { w: 5, h: 5 },
      SECRET: { w: 3, h: 4 }
    },
    SAFEHOUSE: {
      ENTRY: { w: 3, h: 4 },
      LIVING: { w: 5, h: 6 },
      BEDROOM: { w: 4, h: 5 },
      STORAGE: { w: 3, h: 4 },
      MEDICAL: { w: 4, h: 5 },
      SECRET: { w: 3, h: 4 }
    },
    FACILITY: {
      ENTRY: { w: 8, h: 6 },
      PUBLIC_ROOM: { w: 10, h: 8 },
      OFFICE: { w: 6, h: 6 },
      STORAGE: { w: 5, h: 5 },
      SERVICE: { w: 6, h: 5 },
      RESTROOM: { w: 4, h: 4 },
      UTILITY: { w: 4, h: 5 },
      STAIR: { w: 4, h: 5 },
      STAIRWELL: { w: 4, h: 5 },
      ELEVATOR: { w: 3, h: 4 }
    }
  });

  static processLayout(manifest = {}, customConfig = {}) {
    const layoutProfile = LayoutProfileResolver.resolve(
      manifest,
      customConfig
    );
    const validation = LayoutProfileResolver.validateResult(layoutProfile);
    if (!validation.valid) {
      throw new Error(
        `Invalid architectural layout profile: ${validation.problems.join(" ")}`
      );
    }

    const architecturalScale = this._resolveArchitecturalScale(
      manifest,
      customConfig,
      layoutProfile
    );
    const config = this._normalizeConfig({
      ...this.CONFIG,
      ...customConfig,
      roomGap: customConfig.roomGap ?? layoutProfile.roomGap,
      compactRowWidth: customConfig.compactRowWidth ??
        this._targetWidthForProfile(layoutProfile, architecturalScale),
      architecturalScale,
      layoutProfile
    });
    const structureType = String(
      manifest.structureType ||
      manifest.layoutProfile ||
      layoutProfile.profileId ||
      ""
    ).toUpperCase();
    const grammar = ArchitecturalGrammarRegistry.resolve(structureType);
    if (grammar) {
      const grammarResult = grammar.build(
        { sectors: manifest.sectors || [], roomProgram: manifest.roomProgram || null },
        {
          layoutSeed:
            config.layoutSeed ||
            manifest.layoutSeed ||
            manifest.manifestId ||
            manifest.dungeonTitle ||
            null,
          gridSize: config.gridSize,
          originX: config.originX,
          originY: config.originY
        }
      );
      return {
        ...grammarResult,
        title:
          manifest.dungeonTitle ||
          manifest.locationName ||
          manifest.title ||
          "Unnamed Location",
        architecturalGrammar: {
          grammarId: grammarResult.grammarId,
          variantId: grammarResult.variantId,
          structureType
        },
        layoutProfile: {
          ...LayoutProfileResolver.toMetadata(layoutProfile),
          architecturalScale
        }
      };
    }

    const envelope = manifest.layoutEnvelope ||
      this._envelopeForProfile(layoutProfile);
    const floors = this._groupSectorsByFloor(manifest.sectors || []);
    const processedFloors = {};

    for (const [floorNumber, floorSectors] of Object.entries(floors)) {
      const anchors = this._identifyAnchorRooms(floorSectors);
      const prepared = this._prepareSectors(
        floorSectors,
        layoutProfile,
        architecturalScale
      );
      let positioned = this._usesArchitecturalPacking(layoutProfile)
        ? this._packArchitectural(prepared, layoutProfile, config, manifest)
        : this._applyEnvelopeBiases(
            prepared,
            envelope,
            manifest.focalPoint,
            anchors,
            layoutProfile
          );
      positioned = this._sortSectorsByGraphRole(positioned);

      const layoutSectors = positioned.map(sector => {
        const gridPosition = sector.gridPosition || { col: 0, row: 0 };
        const gridDimensions = sector.gridDimensions ||
          this._deriveGridDimensions(
            sector,
            layoutProfile,
            architecturalScale
          );
        const pixelBounds = this._gridToPixels(
          gridPosition,
          gridDimensions,
          config
        );
        return {
          ...sector,
          gridPosition: { ...gridPosition },
          gridDimensions: { ...gridDimensions },
          bounds: { ...pixelBounds },
          pixelBounds: { ...pixelBounds },
          center: this._center(pixelBounds)
        };
      });

      const resolved = this._resolveOverlapPadding(layoutSectors, config);
      const normalized = this._normalizeFloorCoordinates(resolved, config);
      this._annotateConnectionRecommendations(
        normalized,
        layoutProfile,
        config
      );
      processedFloors[floorNumber] = {
        floor: Number(floorNumber),
        anchors,
        bounds: this._calculateFloorBounds(normalized),
        sectors: normalized,
        layoutProfile: {
          ...LayoutProfileResolver.toMetadata(layoutProfile),
          architecturalScale
        }
      };
    }

    return {
      title: manifest.dungeonTitle ||
        manifest.locationName ||
        manifest.title ||
        "Unnamed Location",
      envelope,
      layoutProfile: {
        ...LayoutProfileResolver.toMetadata(layoutProfile),
        architecturalScale
      },
      floors: processedFloors
    };
  }

  static _prepareSectors(sectors, profile, scale) {
    return sectors.map((sector, index) => {
      const preserveDimensions =
        sector.lockDimensions === true &&
        sector.gridDimensions &&
        Number(sector.gridDimensions.w) > 0 &&
        Number(sector.gridDimensions.h) > 0;

      const preparedSector = structuredClone(sector);
      const explicitShape = Boolean(preparedSector.shapeType);
      const natural = String(profile.layoutFamily || "").toUpperCase() === "NATURAL";
      const purpose = this._normalizePurpose(
        preparedSector.sectorPurpose ||
        preparedSector.purpose ||
        preparedSector.roomType ||
        preparedSector.name
      );

      if (!explicitShape && !natural) {
        preparedSector.shapeType = purpose.includes("TOWER")
          ? "TOWER_SQUARE"
          : "RECTANGLE";
        preparedSector.shapeTypeSource = "ARCHITECTURAL_DEFAULT";
      } else if (explicitShape) {
        preparedSector.shapeTypeSource = "EXPLICIT";
      }

      const purposeDimensionRule = this._purposeDimensionRule(
        preparedSector,
        profile
      );
      return {
        ...preparedSector,
        _layoutIndex: index,
        purposeDimensionRule: purposeDimensionRule
          ? structuredClone(purposeDimensionRule)
          : null,
        gridDimensions: preserveDimensions
          ? {
              w: Number(sector.gridDimensions.w),
              h: Number(sector.gridDimensions.h)
            }
          : this._deriveGridDimensions(
              sector,
              profile,
              scale
            )
      };
    });
  }

  static _identifyAnchorRooms(sectors = []) {
    return {
      entry: sectors.find(sector => sector.graphRole === "ENTRY") || null,
      hub: sectors.find(sector => sector.graphRole === "HUB") || null,
      objective:
        sectors.find(sector => sector.graphRole === "OBJECTIVE") || null,
      exits: sectors.filter(sector => sector.graphRole === "EXIT")
    };
  }

  static _purposeDimensionRule(sector = {}, profile = {}) {
    const purpose = this._normalizePurpose(
      sector.sectorPurpose || sector.purpose || sector.roomType || sector.name
    );
    const rules = profile.purposeDimensions || {};
    const key = Object.keys(rules).find(candidate =>
      purpose === candidate || purpose.includes(candidate)
    );
    return key ? rules[key] : null;
  }

  static _deriveGridDimensions(sector = {}, profile = {}, scale = "STANDARD") {
    const purpose = this._normalizePurpose(
      sector.sectorPurpose ||
      sector.purpose ||
      sector.roomType ||
      sector.name
    );
    const profileId = String(profile.profileId || "").toUpperCase();
    const profileRule = this._purposeDimensionRule(sector, profile);
    const profileSizes = this.PROFILE_PURPOSE_SIZES[profileId] || {};
    const profileKey = this._matchPurposeKey(purpose, profileSizes);
    const globalKey = this._matchPurposeKey(purpose, this.PURPOSE_SIZES);
    const dimensions = profileRule?.preferred
      ? profileRule.preferred
      : profileKey
      ? profileSizes[profileKey]
      : globalKey
        ? this.PURPOSE_SIZES[globalKey]
        : this._deriveGenericDimensions(sector, profile);
    const factor = this.ARCHITECTURAL_SCALES[scale] || 1;
    return this._scaleDimensions(dimensions, factor);
  }

  static _deriveGenericDimensions(sector, profile) {
    const importance = Math.max(
      1,
      Math.min(5, Number(sector.importance ?? 3))
    );
    const traffic = Math.max(
      1,
      Math.min(5, Number(sector.trafficLevel ?? 2))
    );
    const family = String(
      profile.layoutFamily || ""
    ).toUpperCase();
    const sizeClass = String(
      sector.sizeClass || "STANDARD"
    ).toUpperCase();
    const sizeFactor = {
      SMALL: 0.75,
      STANDARD: 1,
      LARGE: 1.25,
      GRAND: 1.6
    }[sizeClass] || 1;

    let width;
    let height;

    if (
      ["RESIDENTIAL", "COMMERCIAL", "COVERT"]
        .includes(family)
    ) {
      const bases = {
        1: 3,
        2: 4,
        3: 5,
        4: 7,
        5: 9
      };
      const base = bases[importance] || 5;
      width = base + Math.max(1, Math.ceil(traffic / 2));
      height = Math.max(
        3,
        base - 1 + (importance % 2)
      );
    } else {
      const bases = {
        1: 6,
        2: 8,
        3: 10,
        4: 14,
        5: 18
      };
      const base = bases[importance] || 10;
      width = base + traffic;
      height = Math.max(
        5,
        base - 2 + Math.ceil(traffic / 2)
      );
    }

    if (width === height) {
      height = Math.max(2, height - 1);
    }

    return {
      w: Math.max(2, Math.round(width * sizeFactor)),
      h: Math.max(2, Math.round(height * sizeFactor))
    };
  }

  static _normalizePurpose(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  static _matchPurposeKey(purpose, table) {
    if (table[purpose]) return purpose;
    return Object.keys(table).find(key => purpose.includes(key)) || null;
  }

  static _scaleDimensions(dimensions, factor) {
    return {
      w: Math.max(2, Math.round(Number(dimensions.w || 1) * factor)),
      h: Math.max(2, Math.round(Number(dimensions.h || 1) * factor))
    };
  }

  static _gridToPixels(position, dimensions, config) {
    const gridSize = config.gridSize;
    return {
      x: config.originX + (Number(position.col) || 0) * gridSize,
      y: config.originY + (Number(position.row) || 0) * gridSize,
      width: Math.max(1, Number(dimensions.w) || 1) * gridSize,
      height: Math.max(1, Number(dimensions.h) || 1) * gridSize
    };
  }

  static _usesArchitecturalPacking(profile) {
    return profile.packingDensity === "HIGH" ||
      profile.sharedWallPreference === true ||
      [
        "RECTANGULAR",
        "COMPACT",
        "COURTYARD",
        "PERIMETER",
        "LINEAR",
        "MODULAR"
      ].includes(profile.footprintShape);
  }

  static _packArchitectural(
    sectors,
    profile,
    config,
    manifest = {}
  ) {
    const result = ArchitecturalPacker.pack(
      sectors,
      manifest,
      {
        ...config,
        layoutProfileResult: profile,
        preserveExplicitPositions:
          config.preserveExplicitPositions === true,
        layoutSeed:
          config.layoutSeed ||
          manifest.layoutSeed ||
          manifest.manifestId ||
          manifest.dungeonTitle ||
          null,
        corridorWidth: config.corridorWidth,
        partitionBuildings:
          config.partitionBuildings !== false,
        stairWidth: config.stairWidth,
        stairHeight: config.stairHeight
      }
    );
    const validation = ArchitecturalPacker.validateResult(result);

    if (!validation.valid) {
      throw new Error(
        `Architectural packing failed: ${validation.problems.join(" ")}`
      );
    }

    return result.sectors;
  }

  static _packRows(sectors, profile, config) {
    const gap = this._gapCells(profile.roomGap, config.gridSize);
    const targetWidth = Math.max(12, Number(config.compactRowWidth) || 28);
    const output = [];
    let col = 0;
    let row = 0;
    let rowHeight = 0;
    for (const sector of sectors) {
      const dimensions = sector.gridDimensions;
      if (col > 0 && col + dimensions.w > targetWidth) {
        col = 0;
        row += rowHeight + gap;
        rowHeight = 0;
      }
      output.push({ ...sector, gridPosition: { col, row } });
      col += dimensions.w + gap;
      rowHeight = Math.max(rowHeight, dimensions.h);
    }
    return output;
  }

  static _packLinear(sectors) {
    const output = [];
    let col = 0;
    const centerLine = Math.max(
      0,
      Math.round(Math.max(...sectors.map(s => s.gridDimensions.h), 1) / 2)
    );
    sectors.forEach((sector, index) => {
      const row = index % 2 === 0
        ? Math.max(0, centerLine - sector.gridDimensions.h)
        : centerLine + 2;
      output.push({ ...sector, gridPosition: { col, row } });
      col += Math.max(4, Math.round(sector.gridDimensions.w / 2));
    });
    return output;
  }

  static _packPerimeter(sectors, profile, config) {
    if (sectors.length < 4) return this._packRows(sectors, profile, config);
    const gap = this._gapCells(profile.roomGap, config.gridSize);
    const perSide = Math.ceil(sectors.length / 4);
    const cellWidth = Math.max(...sectors.map(s => s.gridDimensions.w), 8) + gap;
    const cellHeight = Math.max(...sectors.map(s => s.gridDimensions.h), 8) + gap;
    const width = Math.max(2, perSide) * cellWidth;
    const height = Math.max(2, perSide) * cellHeight;

    return sectors.map((sector, index) => {
      const side = Math.floor(index / perSide) % 4;
      const offset = index % perSide;
      let col = 0;
      let row = 0;
      if (side === 0) col = offset * cellWidth;
      else if (side === 1) {
        col = width - sector.gridDimensions.w;
        row = offset * cellHeight;
      } else if (side === 2) {
        col = width - offset * cellWidth - sector.gridDimensions.w;
        row = height - sector.gridDimensions.h;
      } else {
        row = height - offset * cellHeight - sector.gridDimensions.h;
      }
      return { ...sector, gridPosition: { col, row } };
    });
  }

  static _applyEnvelopeBiases(
    sectors,
    envelope = "CLUSTER",
    focalPoint = null,
    anchors = {},
    profile = {}
  ) {
    const spread = profile.packingDensity === "LOW" ? 8 : 5;
    const mode = String(envelope || "CLUSTER").toUpperCase();
    return sectors.map((sector, index) => {
      if (this._hasExplicitPosition(sector)) {
        return { ...sector, gridPosition: this._readGridPosition(sector) };
      }
      const angle = index * 2.399963229728653;
      let col;
      let row;
      if (mode === "LINEAR") {
        col = index * spread;
        row = 0;
      } else {
        const radius = mode === "CLUSTER"
          ? Math.max(1, Math.ceil(Math.sqrt(index + 1))) * spread
          : spread;
        col = Math.round(Math.cos(angle) * radius);
        row = Math.round(Math.sin(angle) * radius);
      }
      return { ...sector, gridPosition: { col, row } };
    });
  }

  static _annotateConnectionRecommendations(sectors, profile, config) {
    const byId = new Map(
      sectors.map(sector => [sector.sectorId, sector])
    );
    const dense = profile.sharedWallPreference === true ||
      profile.packingDensity === "HIGH";

    for (const sector of sectors) {
      if (!Array.isArray(sector.connections)) continue;
      sector.connections = sector.connections.map(connection => {
        const targetId = connection.to ||
          connection.targetId ||
          connection.targetSectorId;
        const target = byId.get(targetId);
        if (!target) return connection;
        const shared = this._sharedBoundsWall(
          sector.pixelBounds,
          target.pixelBounds,
          config.gridSize
        );
        if (dense && shared) {
          return {
            ...connection,
            recommendedConnectionType: "SHARED_WALL"
          };
        }
        return {
          ...connection,
          recommendedConnectionType: dense
            ? "SHORT_HALL"
            : "CORRIDOR"
        };
      });
    }
  }

  static _sharedBoundsWall(a, b, minimumOverlap = 100) {
    if (!a || !b) return null;
    const epsilon = 0.001;
    const verticalTouch =
      Math.abs(a.x + a.width - b.x) <= epsilon ||
      Math.abs(b.x + b.width - a.x) <= epsilon;
    const horizontalTouch =
      Math.abs(a.y + a.height - b.y) <= epsilon ||
      Math.abs(b.y + b.height - a.y) <= epsilon;
    const yOverlap = Math.min(a.y + a.height, b.y + b.height) -
      Math.max(a.y, b.y);
    const xOverlap = Math.min(a.x + a.width, b.x + b.width) -
      Math.max(a.x, b.x);
    return (verticalTouch && yOverlap >= minimumOverlap) ||
      (horizontalTouch && xOverlap >= minimumOverlap);
  }

  static _sortSectorsByGraphRole(sectors) {
    return [...sectors].sort((a, b) => {
      const pa = this.GRAPH_PRIORITY[a.graphRole] ?? 999;
      const pb = this.GRAPH_PRIORITY[b.graphRole] ?? 999;
      return pa - pb || (a._layoutIndex ?? 0) - (b._layoutIndex ?? 0);
    });
  }

  static _resolveOverlapPadding(sectors, config) {
    const step = Math.max(config.gridSize, config.roomGap);
    let changed = true;
    let pass = 0;
    while (changed && pass < config.maxOverlapPasses) {
      changed = false;
      pass++;
      for (let i = 0; i < sectors.length; i++) {
        for (let j = i + 1; j < sectors.length; j++) {
          const a = sectors[i].pixelBounds;
          const b = sectors[j].pixelBounds;
          if (!this._intersects(a, b)) continue;
          const moveX = (a.x + a.width + step) - b.x;
          const moveY = (a.y + a.height + step) - b.y;
          if (moveX <= moveY) b.x += Math.max(step, moveX);
          else b.y += Math.max(step, moveY);
          this._syncSectorBounds(sectors[j]);
          changed = true;
        }
      }
    }
    sectors.forEach(sector => this._syncSectorBounds(sector));
    return sectors;
  }

  static _intersects(a, b) {
    return !(
      a.x + a.width <= b.x ||
      b.x + b.width <= a.x ||
      a.y + a.height <= b.y ||
      b.y + b.height <= a.y
    );
  }

  static _normalizeFloorCoordinates(sectors, config) {
    if (!sectors.length) return sectors;
    const minX = Math.min(...sectors.map(s => s.pixelBounds.x));
    const minY = Math.min(...sectors.map(s => s.pixelBounds.y));
    const offsetX = minX < config.originX ? config.originX - minX : 0;
    const offsetY = minY < config.originY ? config.originY - minY : 0;
    sectors.forEach(sector => {
      sector.pixelBounds.x += offsetX;
      sector.pixelBounds.y += offsetY;
      this._syncSectorBounds(sector);
    });
    return sectors;
  }

  static _groupSectorsByFloor(sectors) {
    return sectors.reduce((floors, sector) => {
      const floor = Number(sector.floor ?? 1) || 1;
      if (!floors[floor]) floors[floor] = [];
      floors[floor].push(structuredClone(sector));
      return floors;
    }, {});
  }

  static _calculateFloorBounds(sectors) {
    if (!sectors.length) return { x: 0, y: 0, width: 0, height: 0 };
    const left = Math.min(...sectors.map(s => s.pixelBounds.x));
    const top = Math.min(...sectors.map(s => s.pixelBounds.y));
    const right = Math.max(...sectors.map(
      s => s.pixelBounds.x + s.pixelBounds.width
    ));
    const bottom = Math.max(...sectors.map(
      s => s.pixelBounds.y + s.pixelBounds.height
    ));
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  static _resolveArchitecturalScale(manifest, customConfig, profile) {
    const requested =
      customConfig.architecturalScale ||
      customConfig.buildingScale ||
      manifest.architecturalScale ||
      manifest.buildingScale ||
      manifest.architecture?.scale ||
      this.PROFILE_DEFAULT_SCALES[profile.profileId] ||
      "STANDARD";
    const normalized = String(requested).trim().toUpperCase();
    return this.ARCHITECTURAL_SCALES[normalized]
      ? normalized
      : "STANDARD";
  }

  static _targetWidthForProfile(profile, scale) {
    const base = this.PROFILE_TARGET_WIDTHS[profile.profileId] || 28;
    return Math.max(
      12,
      Math.round(base * (this.ARCHITECTURAL_SCALES[scale] || 1))
    );
  }

  static _normalizeConfig(config) {
    return {
      ...config,
      gridSize: Math.max(1, Number(config.gridSize) || 100),
      roomGap: Math.max(0, Number(config.roomGap) || 0),
      originX: Math.max(0, Number(config.originX) || 1000),
      originY: Math.max(0, Number(config.originY) || 1000),
      maxOverlapPasses: Math.max(1, Number(config.maxOverlapPasses) || 40),
      preserveExplicitPositions:
        config.preserveExplicitPositions === true,
      layoutSeed:
        config.layoutSeed || null,
      corridorWidth: Math.max(
        Math.max(1, Number(config.gridSize) || 100),
        Number(config.corridorWidth) ||
          (Math.max(1, Number(config.gridSize) || 100) * 2)
      ),
      partitionBuildings:
        config.partitionBuildings !== false,
      stairWidth: Math.max(
        3,
        Number(config.stairWidth) || 4
      ),
      stairHeight: Math.max(
        4,
        Number(config.stairHeight) || 5
      )
    };
  }

  static _hasExplicitPosition(sector) {
    return Boolean(
      sector.gridPosition &&
      Number.isFinite(Number(sector.gridPosition.col)) &&
      Number.isFinite(Number(sector.gridPosition.row))
    );
  }

  static _readGridPosition(sector) {
    return {
      col: Number(sector.gridPosition?.col ?? sector.col ?? sector.x ?? 0),
      row: Number(sector.gridPosition?.row ?? sector.row ?? sector.y ?? 0)
    };
  }

  static _gapCells(roomGap, gridSize) {
    return Math.max(0, Math.round(roomGap / Math.max(1, gridSize)));
  }

  static _envelopeForProfile(profile) {
    if (profile.footprintShape === "LINEAR") return "LINEAR";
    if (profile.footprintShape === "IRREGULAR") return "RADIAL";
    return "CLUSTER";
  }

  static _syncSectorBounds(sector) {
    sector.bounds = { ...sector.pixelBounds };
    sector.center = this._center(sector.pixelBounds);
  }

  static _center(bounds) {
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    };
  }
}
