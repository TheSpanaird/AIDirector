// shuttle-grammar.js
// Standalone Shuttle V2 prototype. Not registered for production.

import { GrammarContract } from "./grammar-contract.js";

export class ShuttleGrammar {
  static GRAMMAR_ID = "SHUTTLE_END_TO_END_V2";

  static build(roomProgram = {}, options = {}) {
    const gridSize = Math.max(1, Number(options.gridSize) || 100);
    const originX = Number(options.originX) || 1000;
    const originY = Number(options.originY) || 1000;
    const seed = String(options.layoutSeed || "shuttle-v2-001");
    const mirrored = GrammarContract.hash(seed) % 2 === 1;

    const definitions = this._definitions(roomProgram);
    const cells = this._cells(mirrored);
    const sectors = definitions.map(definition => {
      const cell = cells[definition.sectorId];
      if (!cell) throw new Error(`Missing shuttle placement for ${definition.sectorId}.`);
      const bounds = {
        x: originX + cell.col * gridSize,
        y: originY + cell.row * gridSize,
        width: cell.w * gridSize,
        height: cell.h * gridSize
      };
      return {
        ...definition,
        floor: 1,
        gridPosition: { col: cell.col, row: cell.row },
        gridDimensions: { w: cell.w, h: cell.h },
        bounds: { ...bounds },
        pixelBounds: { ...bounds },
        center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        architecturalZone: cell.zone,
        shapeType: "RECTANGLE",
        shapeTypeSource: "SHUTTLE_GRAMMAR"
      };
    });

    const byId = new Map(sectors.map(sector => [sector.sectorId, sector]));
    const pairs = [
      ["cockpit", "cabin"],
      ["cabin", "airlock"],
      ["cabin", "engineering"],
      ["airlock", "cargo"],
      ["engineering", "utility"]
    ];
    const openings = pairs.map(([sourceId, targetId], index) =>
      this._sharedOpening(byId.get(sourceId), byId.get(targetId), gridSize, index)
    );
    openings.push(this._exteriorAirlock(byId.get("airlock"), mirrored, gridSize));

    const envelope = this._envelope(sectors);
    const result = {
      grammarId: this.GRAMMAR_ID,
      variantId: mirrored ? "SHUTTLE_MIRRORED" : "SHUTTLE_STANDARD",
      sceneArchetype: "SHUTTLE",
      layoutSeed: seed,
      envelope,
      sectors,
      openings,
      routes: [],
      normalizedTopology: { gridSize, rectangles: [], junctions: [] },
      openingPlan: { openings },
      floors: { 1: { floor: 1, sectors } },
      architecture: {
        circulationType: "END_TO_END_DIRECT",
        bowPurpose: "COCKPIT",
        sternPurpose: "ENGINEERING",
        exteriorAirlockId: "shuttle-exterior-airlock"
      }
    };

    const contract = GrammarContract.validate(result);
    if (!contract.valid) throw new Error(contract.problems.join(" "));
    return result;
  }

  static _definitions(roomProgram) {
    const suppliedSectors = Array.isArray(roomProgram.sectors) ? roomProgram.sectors : [];
    const supplied = new Map(suppliedSectors.map(sector => [sector.sectorId, sector]));
    const byPurpose = new Map();
    for (const sector of suppliedSectors) {
      const purpose = String(sector.purpose || "").toUpperCase();
      if (!byPurpose.has(purpose)) byPurpose.set(purpose, []);
      byPurpose.get(purpose).push(sector);
    }
    const defaults = [
      ["cockpit", "Cockpit", "COCKPIT", "OBJECTIVE"],
      ["cabin", "Cabin", "CABIN", "HUB"],
      ["airlock", "Airlock", "AIRLOCK", "ENTRY"],
      ["engineering", "Engineering", "ENGINEERING", "OBJECTIVE"],
      ["cargo", "Cargo Locker", "CARGO", "OPTIONAL"],
      ["utility", "Utility", "UTILITY", "OPTIONAL"]
    ];
    return defaults.map(([sectorId, name, purpose, graphRole]) => {
      const source = supplied.get(sectorId) || byPurpose.get(purpose)?.shift() || null;
      return {
        ...(source || {}),
        sectorId,
        sourceSectorId: source?.sectorId || null,
        name: source?.name || name,
        purpose,
        graphRole: source?.graphRole || graphRole,
        connections: []
      };
    });
  }

  static _cells(mirrored) {
    // Compact 19x10 hull envelope with no exterior recesses.
    // Bow: cockpit. Center: cabin and support rooms. Stern: engineering.
    const standard = {
      cockpit:     { col: 0,  row: 0, w: 4, h: 10, zone: "COMMAND" },
      cabin:       { col: 4,  row: 0, w: 7, h: 7, zone: "HABITATION" },
      cargo:       { col: 4,  row: 7, w: 3, h: 3, zone: "MISSION" },
      airlock:     { col: 7,  row: 7, w: 4, h: 3, zone: "ACCESS" },
      engineering: { col: 11, row: 0, w: 8, h: 7, zone: "ENGINEERING" },
      utility:     { col: 11, row: 7, w: 8, h: 3, zone: "ENGINEERING" }
    };
    if (!mirrored) return standard;
    return Object.fromEntries(
      Object.entries(standard).map(([id, cell]) => [id, {
        ...cell,
        row: 10 - cell.row - cell.h
      }])
    );
  }

  static _sharedOpening(source, target, gridSize, index) {
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
      openingId: `shuttle-door-${index}`,
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
      source: "SHUTTLE_GRAMMAR"
    };
  }

  static _exteriorAirlock(airlock, mirrored, gridSize) {
    const b = airlock.bounds;
    const face = mirrored ? "NORTH" : "SOUTH";
    const location = {
      x: b.x + b.width / 2,
      y: mirrored ? b.y : b.y + b.height
    };
    return {
      openingId: "shuttle-exterior-airlock",
      hostType: "ROOM",
      hostId: "airlock",
      sourceId: "airlock",
      targetId: "__exterior__",
      connectedSources: ["airlock"],
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
      source: "SHUTTLE_GRAMMAR"
    };
  }

  static _envelope(sectors) {
    const bounds = sectors.map(sector => sector.bounds);
    const x = Math.min(...bounds.map(b => b.x));
    const y = Math.min(...bounds.map(b => b.y));
    const right = Math.max(...bounds.map(b => b.x + b.width));
    const bottom = Math.max(...bounds.map(b => b.y + b.height));
    return { x, y, width: right - x, height: bottom - y };
  }
}
