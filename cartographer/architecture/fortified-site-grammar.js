import { ProgrammaticBuildingGrammar } from "./programmatic-building-grammar.js";
import { FortificationPerimeterPlanner } from "./fortification-perimeter-planner.js";

export class FortifiedSiteGrammar {
  static GRAMMAR_ID = "FORTIFIED_KEEP_AND_BAILEY_V11";
  static CONFIGURATIONS = { CASTLE: ["KEEP_AND_BAILEY"] };
  static SCENE_SETTINGS = {
    width: 7100,
    height: 9100,
    padding: 0.2,
    grid: {
      size: 100,
      type: globalThis.CONST?.GRID_TYPES?.SQUARE ?? 1,
      distance: 5,
      units: "ft",
      style: globalThis.CONST?.GRID_STYLES?.SOLID_LINES ?? 0,
      thickness: 1,
      color: "#000000",
      alpha: 0.2
    },
    background: {
      offsetX: 1000,
      offsetY: 1500
    }
  };

  static sceneSettingsUpdateData(overrides = {}) {
    const settings = { ...this.SCENE_SETTINGS, ...overrides };
    const grid = { ...this.SCENE_SETTINGS.grid, ...(overrides.grid || {}) };
    const background = { ...this.SCENE_SETTINGS.background, ...(overrides.background || {}) };
    return {
      width: settings.width,
      height: settings.height,
      padding: settings.padding,
      "grid.size": grid.size,
      "grid.type": grid.type,
      "grid.distance": grid.distance,
      "grid.units": grid.units,
      "grid.style": grid.style,
      "grid.thickness": grid.thickness,
      "grid.color": grid.color,
      "grid.alpha": grid.alpha,
      "background.offsetX": background.offsetX,
      "background.offsetY": background.offsetY
    };
  }

  static async applySceneSettings(scene, overrides = {}) {
    if (!scene) throw new Error("FortifiedSiteGrammar.applySceneSettings requires a scene.");
    return scene.update(this.sceneSettingsUpdateData(overrides));
  }


  static build(roomProgram = {}, options = {}) {
    const configuration = String(
      options.fortifiedConfiguration ||
      roomProgram.fortifiedConfiguration ||
      "KEEP_AND_BAILEY"
    ).toUpperCase();

    if (configuration !== "KEEP_AND_BAILEY") {
      throw new Error("Fortified V11 currently supports KEEP_AND_BAILEY only.");
    }

    const floor = Math.max(1, Math.min(3, Number(options.floor || 1)));
    const gridSize = Math.max(1, Number(options.gridSize) || 100);
    const template = floor === 1 ? this._baileyGround() : this._keepFloor(floor, roomProgram, options);

    const result = ProgrammaticBuildingGrammar.build(
      {
        grammarId: this.GRAMMAR_ID,
        profileId: "CASTLE",
        width: template.width,
        height: template.height,
        variants: [
          `KEEP_AND_BAILEY_F${floor}_STANDARD`,
          `KEEP_AND_BAILEY_F${floor}_MIRRORED`
        ],
        entryId: floor === 1 ? "gatehouse" : null,
        entryFace: "SOUTH",
        zoneOrder: template.zoneOrder,
        definitions: template.definitions,
        cells: template.cells,
        pairs: template.pairs
      },
      roomProgram,
      {
        ...options,
        floor,
        structureType: "CASTLE",
        layoutSeed: `${options.layoutSeed || "keep-bailey"}-F${floor}`
      }
    );

    result.fortifiedSubtype = "CASTLE";
    result.fortifiedConfiguration = "KEEP_AND_BAILEY";
    result.fortificationStyle = "PALISADE_MOTTE_BAILEY_TWO_RING";
    result.floorRole = template.floorRole;
    result.totalLevels = 3;
    result.detachedBuildings = template.detachedBuildings || [];
    result.openAreas = template.openAreas || [];
    result.keepVariant = template.keepVariant || null;
    result.sceneSettings = this.sceneSettingsUpdateData();
    result.recommendedSceneSettings = this.SCENE_SETTINGS;

    result.verticalConnector = {
      connectionId: "keep-main-stair",
      connectionType: "STAIR",
      sectorId: floor === 1 ? "keep-internal-stair" : "stair",
      floor,
      anchorId: "keep-main-stair-anchor"
    };

    result.fortificationNetwork = {
      wallWalk: true,
      wallWalkMode: "METADATA_ONLY",
      hasDitch: true,
      ringLayout: "TWO_RING_MOTTE_AND_BAILEY",
      outerBaileyShape: "CIRCULAR",
      keepEnclosureShape: "CIRCULAR",
      connectorShape: "WALLED_OPEN_NECK",
      motteShape: "OVAL",
      mottePlacement: "NORTH_INTERNAL_SEPARATE_KEEP_RING",
      keepWallShape: "CIRCULAR",
      keepShape: "RECTANGULAR_MULTI_ROOM_FIRST_FLOOR",
      watchTowerRange: { min: 0, max: 2 },
      roadsDeferred: false
    };

    result.keepAccessRoute = {
      routeType: "WALLED_OPEN_KEEP_APPROACH",
      alignedAxis: "SOUTH_NORTH",
      from: "gatehouse",
      through: ["bailey", "well", "motte-approach"],
      to: "keep-entry",
      roadsDeferred: false
    };

    if (floor === 1) {
      const exteriorFaces = template.exteriorFaces || {};
      const baileyCenter = result.sectors.find(room => room.sectorId === "bailey")?.center || null;

      for (const room of result.sectors) {
        if (room.suppressExteriorDoor === true || room.suppressWalls === true || room.renderAsOpenArea === true || room.sectorId === "gatehouse") continue;

        const face = this._doorFaceForBaileyRoom(room, baileyCenter, exteriorFaces);
        result.openings.push(
          ProgrammaticBuildingGrammar.exteriorOpening(room, face, gridSize, {
            id: `${room.sectorId}-bailey-door`,
            doorType: room.sectorId === "armory" ? "LOCKED" : "STANDARD",
            connectionType: room.sectorId === "armory" ? "LOCKED_DOOR" : "EXTERIOR_DOOR",
            width: gridSize
          })
        );
      }

      const gatehouse = result.sectors.find(room => room.sectorId === "gatehouse");
      if (gatehouse) {
        result.openings.push(
          ProgrammaticBuildingGrammar.exteriorOpening(gatehouse, "NORTH", gridSize, {
            id: "gatehouse-bailey-gate",
            doorType: "GATE",
            connectionType: "GATE",
            width: gridSize * 3
          })
        );
      }

      result.openingPlan = { openings: result.openings };
      result.fortificationPlan = FortificationPerimeterPlanner.plan(result, {
        gridSize,
        perimeterStyle: "PALISADE_MOTTE_BAILEY",
        ringLayout: "TWO_RING_MOTTE_AND_BAILEY",
        outerWallShape: "CIRCULAR",
        keepWallShape: "CIRCULAR",
        connectorShape: "WALLED_OPEN_NECK",
        motteShape: "OVAL",
        mottePlacement: "NORTH_INTERNAL_SEPARATE_KEEP_RING",
        keepShape: "RECTANGULAR_MULTI_ROOM_FIRST_FLOOR",
        wallWalk: true,
        wallWalkMode: "METADATA_ONLY",
        hasDitch: true,
        towerRange: { min: 0, max: 2 },
        towerCount: options.towerCount
      });
    }

    return result;
  }

  static _doorFaceForBaileyRoom(room, baileyCenter, exteriorFaces = {}) {
    if (room.sectorId === "gatehouse") return exteriorFaces.gatehouse || "SOUTH";
    if (room.sectorId === "keep-entry") return exteriorFaces[room.sectorId] || "SOUTH";
    if (String(room.sectorId || "").startsWith("keep-")) return exteriorFaces[room.sectorId] || "SOUTH";
    if (!baileyCenter || !room.center) return exteriorFaces[room.sectorId] || "SOUTH";

    const dx = baileyCenter.x - room.center.x;
    const dy = baileyCenter.y - room.center.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx < 0 ? "WEST" : "EAST";
    }

    return dy < 0 ? "NORTH" : "SOUTH";
  }

  static _baileyGround() {
    const definitions = [
      ["gatehouse", "Palisade Gatehouse", "ENTRY", "ENTRY"],
      ["bailey", "Open Bailey Green", "COURTYARD", "HUB"],
      ["well", "Central Well", "WELL", "HUB"],
      ["market", "Open Market District", "MARKET", "HUB"],
      ["market-shops", "Market Stalls and Shops", "SHOPS", "OPTIONAL"],
      ["temple", "Bailey Temple", "TEMPLE", "OPTIONAL"],
      ["barracks", "Bailey Barracks", "BARRACKS", "OPTIONAL"],
      ["armory", "Bailey Armory", "ARMORY", "OBJECTIVE"],
      ["blacksmith", "Blacksmith and Forge", "BLACKSMITH", "OPTIONAL"],
      ["stable", "Stable", "STABLE", "OPTIONAL"],
      ["storehouse", "Granary and Storehouse", "STORAGE", "OPTIONAL"],
      ["tavern", "Bailey Tavern", "TAVERN", "OPTIONAL"],
      ["cottages-west", "Commoner Cottages West", "HOUSING", "OPTIONAL"],
      ["cottages-east", "Commoner Cottages East", "HOUSING", "OPTIONAL"],
      ["great-hall", "Bailey Great Hall", "HALL", "OBJECTIVE"],
      ["kitchen", "Bakehouse and Kitchen", "KITCHEN", "OPTIONAL"],
      ["motte-approach", "Walled Keep Approach", "PATH", "CONNECTOR"],
      ["keep-entry", "Keep Entry Hall", "ENTRY_HALL", "OBJECTIVE"],
      ["keep-guardroom", "Keep Guardroom", "SECURITY", "OPTIONAL"],
      ["keep-storage", "Keep Storage", "STORAGE", "OPTIONAL"],
      ["keep-internal-stair", "Keep Internal Stair", "VERTICAL_ACCESS", "CONNECTOR"]
    ];

    const openArea = { renderAsOpenArea: true, suppressWalls: true, suppressExteriorDoor: true };
    const keepInternal = { suppressExteriorDoor: true, placementRole: "KEEP_FIRST_FLOOR_ROOM" };

    const cells = {
      "keep-storage": { col: 22, row: 2, w: 6, h: 3, zone: "KEEP", ...keepInternal },
      "keep-internal-stair": { col: 28, row: 2, w: 6, h: 3, zone: "KEEP", ...keepInternal },
      "keep-entry": { col: 22, row: 5, w: 6, h: 3, zone: "KEEP", placementRole: "KEEP_FIRST_FLOOR_ENTRY_HALL" },
      "keep-guardroom": { col: 28, row: 5, w: 6, h: 3, zone: "KEEP", ...keepInternal },

      "motte-approach": {
        col: 26,
        row: 12,
        w: 4,
        h: 11,
        zone: "PATH",
        shapeType: "RECTANGLE",
        placementRole: "WALLED_OPEN_NECK_TO_KEEP",
        terrainType: "ROAD",
        ...openArea
      },

      bailey: {
        col: 17,
        row: 30,
        w: 22,
        h: 18,
        zone: "OPEN",
        shapeType: "RECTANGLE",
        placementRole: "OPEN_BAILEY_GREEN",
        terrainType: "GRASS",
        ...openArea
      },
      well: {
        col: 27,
        row: 39,
        w: 2,
        h: 2,
        zone: "OPEN",
        shapeType: "OCTAGON",
        placementRole: "CENTRAL_WELL",
        minimumClearanceGrid: 2,
        ...openArea
      },
      market: {
        col: 18,
        row: 36,
        w: 7,
        h: 5,
        zone: "COMMERCIAL",
        shapeType: "RECTANGLE",
        placementRole: "OPEN_MARKET_DISTRICT",
        terrainType: "PACKED_EARTH",
        ...openArea
      },
      "market-shops": {
        col: 31,
        row: 37,
        w: 7,
        h: 4,
        zone: "COMMERCIAL",
        shapeType: "RECTANGLE",
        placementRole: "OPEN_MARKET_STALLS_AND_BOOTHS",
        terrainType: "PACKED_EARTH",
        ...openArea
      },

      blacksmith: { col: 14, row: 26, w: 5, h: 4, zone: "CRAFT" },
      stable: { col: 37, row: 26, w: 6, h: 4, zone: "SERVICE" },
      temple: { col: 8, row: 34, w: 5, h: 5, zone: "CIVILIAN" },
      "great-hall": { col: 43, row: 34, w: 7, h: 5, zone: "ADMIN" },
      armory: { col: 7, row: 44, w: 5, h: 5, zone: "MILITARY" },
      barracks: { col: 46, row: 44, w: 6, h: 6, zone: "MILITARY" },
      tavern: { col: 13, row: 54, w: 6, h: 5, zone: "COMMERCIAL" },
      storehouse: { col: 39, row: 54, w: 6, h: 5, zone: "SERVICE" },
      kitchen: { col: 7, row: 59, w: 5, h: 4, zone: "SERVICE" },
      "cottages-west": { col: 22, row: 63, w: 7, h: 4, zone: "CIVILIAN" },
      "cottages-east": { col: 32, row: 63, w: 7, h: 4, zone: "CIVILIAN" },
      gatehouse: { col: 25, row: 68, w: 6, h: 3, zone: "DEFENSE" }
    };

    return {
      floorRole: "BAILEY_SETTLEMENT_AND_KEEP_ENTRY_TWO_RING",
      width: 58,
      height: 74,
      zoneOrder: ["DEFENSE", "OPEN", "MILITARY", "CRAFT", "SERVICE", "COMMERCIAL", "CIVILIAN", "ADMIN", "PATH", "KEEP", "VERTICAL"],
      definitions,
      cells,
      pairs: [
        ["keep-entry", "keep-guardroom"],
        ["keep-entry", "keep-storage"],
        ["keep-guardroom", "keep-internal-stair"],
        ["keep-storage", "keep-internal-stair"]
      ],
      detachedBuildings: definitions
        .filter(d => !["bailey", "well", "market", "market-shops", "motte-approach"].includes(d[0]))
        .map(d => ({
          buildingId: d[0],
          name: d[1],
          floorCount: d[0].startsWith("keep") ? 3 : 1,
          placementZone: d[0].startsWith("keep") ? "MOTTE" : "BAILEY"
        })),
      openAreas: [
        { areaId: "bailey", areaType: "OPEN_BAILEY_GREEN", role: "PRIMARY_CIRCULATION", terrainType: "GRASS", roadsDeferred: false },
        { areaId: "well", areaType: "CENTRAL_WELL", required: true, minimumClearanceGrid: 2 },
        { areaId: "market", areaType: "OPEN_MARKET_DISTRICT", terrainType: "PACKED_EARTH", shops: ["BAKER", "BUTCHER", "FLETCHER", "GENERAL_MERCHANT", "CLOTHIER", "TRADER_STALLS"] },
        { areaId: "market-shops", areaType: "OPEN_MARKET_STALLS", terrainType: "PACKED_EARTH", roadsDeferred: false },
        { areaId: "motte-approach", areaType: "WALLED_OPEN_KEEP_NECK_PATH", guarded: true, terrainType: "ROAD", roadsDeferred: false }
      ],
      exteriorFaces: {
        gatehouse: "SOUTH",
        blacksmith: "SOUTH",
        stable: "WEST",
        temple: "EAST",
        "great-hall": "WEST",
        armory: "EAST",
        barracks: "WEST",
        tavern: "EAST",
        storehouse: "WEST",
        kitchen: "EAST",
        "cottages-west": "NORTH",
        "cottages-east": "WEST",
        "keep-entry": "SOUTH"
      }
    };
  }

  static _keepFloor(floor, roomProgram = {}, options = {}) {
    const f2 = floor === 2;
    const definitions = f2
      ? [
          ["stair", "Keep Main Stair", "VERTICAL_ACCESS", "CONNECTOR"],
          ["hall", "Keep Entrance Hall", "HALL", "HUB"],
          ["guardroom", "Keep Guardroom", "SECURITY", "OPTIONAL"],
          ["great-chamber", "Great Chamber", "HALL", "OBJECTIVE"],
          ["service", "Keep Service Room", "SERVICE", "OPTIONAL"],
          ["store", "Secure Store", "STORAGE", "OPTIONAL"]
        ]
      : [
          ["stair", "Keep Main Stair", "VERTICAL_ACCESS", "CONNECTOR"],
          ["hall", "Upper Keep Hall", "HALL", "HUB"],
          ["council", "Council Chamber", "COMMAND", "OBJECTIVE"],
          ["quarters", "Private Quarters", "NOBLE_QUARTERS", "OBJECTIVE"],
          ["treasury", "Treasury", "TREASURY", "OBJECTIVE"],
          ["chapel", "Private Chapel", "CHAPEL", "OPTIONAL"]
        ];

    const ids = definitions.map(d => d[0]);
    const cells = {
      stair: { col: 6, row: 10, w: 4, h: 4, zone: "VERTICAL" },
      hall: { col: 4, row: 4, w: 8, h: 6, zone: "HALL", shapeType: "PLUS" },
      [ids[2]]: { col: 0, row: 4, w: 4, h: 6, zone: "SECURE" },
      [ids[3]]: { col: 4, row: 0, w: 8, h: 4, zone: "STATE" },
      [ids[4]]: { col: 12, row: 4, w: 4, h: 6, zone: "SERVICE" },
      [ids[5]]: { col: 12, row: 0, w: 4, h: 4, zone: "PRIVATE" }
    };

    return {
      floorRole: f2 ? "KEEP_LOWER_LEVEL" : "KEEP_UPPER_LEVEL",
      width: 16,
      height: 14,
      zoneOrder: ["VERTICAL", "HALL", "SECURE", "STATE", "SERVICE", "PRIVATE"],
      definitions,
      cells,
      pairs: [
        ["stair", "hall"],
        ["hall", ids[2]],
        ["hall", ids[3]],
        ["hall", ids[4]],
        ["hall", ids[5]]
      ]
    };
  }
}
