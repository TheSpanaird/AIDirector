import { GrammarContract } from "./grammar-contract.js";

export class GunshipGrammar {
  static GRAMMAR_ID = "GUNSHIP_COMBAT_WEDGE_V1";

  static build(roomProgram = {}, options = {}) {
    const gridSize = Math.max(1, Number(options.gridSize) || 100);
    const originX = Number(options.originX) || 1200;
    const originY = Number(options.originY) || 1200;
    const seed = String(options.layoutSeed || "gunship-v1-001");
    const mirrored = GrammarContract.hash(seed) % 2 === 1;
    const cells = this._cells(mirrored);

    const suppliedSectors = Array.isArray(roomProgram.sectors)
      ? roomProgram.sectors
      : [];
    const byId = new Map(
      suppliedSectors.map(sector => [sector.sectorId, sector])
    );
    const byPurpose = new Map();
    for (const sector of suppliedSectors) {
      const purpose = String(sector.purpose || "").toUpperCase();
      if (!byPurpose.has(purpose)) byPurpose.set(purpose, []);
      byPurpose.get(purpose).push(sector);
    }

    const definitions = [
      ["cockpit", "Armored Cockpit", "COCKPIT", "OBJECTIVE"],
      ["weapons-control", "Weapons Control", "WEAPONS_CONTROL", "OBJECTIVE"],
      ["magazine", "Magazine", "MAGAZINE", "OPTIONAL"],
      ["crew-quarters", "Crew Quarters", "CREW_QUARTERS", "OPTIONAL"],
      ["central-passage", "Combat Passage", "CENTRAL_PASSAGE", "HUB"],
      ["airlock", "Side Airlock", "AIRLOCK", "ENTRY"],
      ["damage-control", "Damage Control", "DAMAGE_CONTROL", "OPTIONAL"],
      ["engineering", "Engineering", "ENGINEERING", "OBJECTIVE"]
    ];

    const sectors = definitions.map(([sectorId, name, purpose, graphRole]) => {
      const cell = cells[sectorId];
      if (!cell) throw new Error(`Missing Gunship placement: ${sectorId}`);
      const source = byId.get(sectorId) || byPurpose.get(purpose)?.shift() || null;
      const bounds = {
        x: originX + cell.col * gridSize,
        y: originY + cell.row * gridSize,
        width: cell.w * gridSize,
        height: cell.h * gridSize
      };
      return {
        ...(source || {}),
        sectorId,
        sourceSectorId: source?.sectorId || null,
        name: source?.name || name,
        purpose,
        graphRole: source?.graphRole || graphRole,
        connections: [],
        floor: 1,
        importance: source?.importance || (graphRole === "OBJECTIVE" ? 5 : 3),
        trafficLevel: source?.trafficLevel || (graphRole === "HUB" ? 5 : 2),
        gridPosition: { col: cell.col, row: cell.row },
        gridDimensions: { w: cell.w, h: cell.h },
        bounds: { ...bounds },
        pixelBounds: { ...bounds },
        center: {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2
        },
        architecturalZone: cell.zone,
        shapeType: "RECTANGLE",
        shapeTypeSource: "GUNSHIP_GRAMMAR"
      };
    });

    const bySectorId = new Map(sectors.map(sector => [sector.sectorId, sector]));
    const pairs = [
      ["cockpit", "weapons-control"],
      ["weapons-control", "magazine"],
      ["weapons-control", "crew-quarters"],
      ["crew-quarters", "central-passage"],
      ["central-passage", "airlock"],
      ["central-passage", "engineering"],
      ["damage-control", "engineering"]
    ];

    const openings = pairs.map(([sourceId, targetId], index) =>
      this._sharedOpening(
        bySectorId.get(sourceId),
        bySectorId.get(targetId),
        gridSize,
        index
      )
    );
    openings.push(this._exteriorAirlock(bySectorId.get("airlock"), mirrored, gridSize));

    const envelope = this._envelope(sectors);
    const result = {
      grammarId: this.GRAMMAR_ID,
      variantId: mirrored ? "GUNSHIP_MIRRORED" : "GUNSHIP_STANDARD",
      structureType: "SPACESHIP",
      sceneArchetype: "GUNSHIP",
      layoutSeed: seed,
      envelope,
      sectors,
      openings,
      routes: [],
      normalizedTopology: { gridSize, rectangles: [], junctions: [] },
      openingPlan: { openings },
      floors: { 1: { floor: 1, sectors } },
      architecture: {
        circulationType: "COMPACT_COMBAT_CORE",
        bowPurpose: "COCKPIT",
        dominantPurpose: "WEAPONS_CONTROL",
        sternPurpose: "ENGINEERING",
        exteriorAirlockId: "gunship-exterior-airlock",
        hullType: "GUNSHIP"
      }
    };

    const contract = GrammarContract.validate(result);
    if (!contract.valid) throw new Error(contract.problems.join(" "));
    return result;
  }

  static _cells(mirrored) {
    const standard = {
      cockpit:            { col: -2, row: 4, w: 4, h: 4, zone: "COMMAND" },
      "weapons-control": { col: 2,  row: 3, w: 4, h: 6, zone: "MISSION" },
      magazine:           { col: 6,  row: 0, w: 4, h: 4, zone: "MISSION" },
      "crew-quarters":   { col: 6,  row: 4, w: 4, h: 4, zone: "HABITATION" },
      "central-passage": { col: 10, row: 3, w: 4, h: 6, zone: "MISSION" },
      airlock:            { col: 10, row: 9, w: 4, h: 3, zone: "ACCESS" },
      "damage-control":  { col: 14, row: 0, w: 4, h: 6, zone: "ENGINEERING" },
      engineering:        { col: 14, row: 6, w: 6, h: 6, zone: "ENGINEERING" }
    };
    if (!mirrored) return standard;
    return Object.fromEntries(
      Object.entries(standard).map(([id, cell]) => [id, {
        ...cell,
        row: 12 - cell.row - cell.h
      }])
    );
  }

  static _sharedOpening(source, target, gridSize, index) {
    if (!source || !target) throw new Error("Gunship opening references a missing room.");
    const a = source.bounds;
    const b = target.bounds;
    const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    let face;
    let location;

    if (overlapY > 0 && Math.abs(a.x + a.width - b.x) < 0.01) {
      face = "EAST";
      location = { x: b.x, y: Math.max(a.y, b.y) + overlapY / 2 };
    } else if (overlapY > 0 && Math.abs(b.x + b.width - a.x) < 0.01) {
      face = "WEST";
      location = { x: a.x, y: Math.max(a.y, b.y) + overlapY / 2 };
    } else if (overlapX > 0 && Math.abs(a.y + a.height - b.y) < 0.01) {
      face = "SOUTH";
      location = { x: Math.max(a.x, b.x) + overlapX / 2, y: b.y };
    } else if (overlapX > 0 && Math.abs(b.y + b.height - a.y) < 0.01) {
      face = "NORTH";
      location = { x: Math.max(a.x, b.x) + overlapX / 2, y: a.y };
    } else {
      throw new Error(`No shared boundary for ${source.sectorId} and ${target.sectorId}.`);
    }

    return {
      openingId: `gunship-door-${index}`,
      hostType: "ROOM",
      hostId: source.sectorId,
      sourceId: source.sectorId,
      targetId: target.sectorId,
      connectedSources: [source.sectorId],
      connectedTargets: [target.sectorId],
      location,
      requestedLocation: { ...location },
      face,
      orientation: ["EAST", "WEST"].includes(face) ? "VERTICAL" : "HORIZONTAL",
      width: Math.min(200, gridSize * 2),
      doorType: "STANDARD",
      connectionType: "STANDARD_DOOR",
      exactFaceRequired: true,
      source: "GUNSHIP_GRAMMAR"
    };
  }

  static _exteriorAirlock(airlock, mirrored, gridSize) {
    const bounds = airlock.bounds;
    const face = mirrored ? "NORTH" : "SOUTH";
    const location = {
      x: bounds.x + bounds.width / 2,
      y: mirrored ? bounds.y : bounds.y + bounds.height
    };
    return {
      openingId: "gunship-exterior-airlock",
      hostType: "ROOM",
      hostId: airlock.sectorId,
      sourceId: airlock.sectorId,
      targetId: "__exterior__",
      connectedSources: [airlock.sectorId],
      connectedTargets: ["__exterior__"],
      location,
      requestedLocation: { ...location },
      face,
      orientation: "HORIZONTAL",
      width: Math.min(200, gridSize * 2),
      doorType: "STANDARD",
      connectionType: "AIRLOCK",
      exactFaceRequired: true,
      exterior: true,
      source: "GUNSHIP_GRAMMAR"
    };
  }

  static _envelope(sectors) {
    const bounds = sectors.map(sector => sector.bounds);
    const x = Math.min(...bounds.map(bound => bound.x));
    const y = Math.min(...bounds.map(bound => bound.y));
    const right = Math.max(...bounds.map(bound => bound.x + bound.width));
    const bottom = Math.max(...bounds.map(bound => bound.y + bound.height));
    return { x, y, width: right - x, height: bottom - y };
  }
}
