// house-grammar.js
// Standalone House grammar prototype with exterior entry, private hall, and windows.

import { GrammarContract } from "./grammar-contract.js";

export class HouseGrammar {
  static GRAMMAR_ID = "HOUSE_PARTITION_V2";

  static build(roomProgram = {}, options = {}) {
    const gridSize = Math.max(1, Number(options.gridSize) || 100);
    const originX = Number(options.originX) || 1000;
    const originY = Number(options.originY) || 1000;
    const seed = String(options.layoutSeed || "house-001");
    const variantIndex = GrammarContract.hash(seed) % 3;
    const variantId = ["SERVICE_EAST", "SERVICE_WEST", "ENTRY_SOUTH"][variantIndex];
    const cells = this._variant(variantId);
    const definitions = this._definitions(roomProgram);

    const sectors = definitions.map(definition => {
      const cell = cells[definition.sectorId];
      if (!cell) throw new Error(`House grammar has no placement for ${definition.sectorId}.`);
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
        shapeTypeSource: "HOUSE_GRAMMAR",
        windows: this._windowsFor(definition.sectorId, cell, variantId)
      };
    });

    const byId = new Map(sectors.map(sector => [sector.sectorId, sector]));
    const pairs = [
      ["entry", "living"],
      ["living", "dining"],
      ["living", "private-hall"],
      ["dining", "kitchen"],
      ["kitchen", "pantry"],
      ["private-hall", "study"],
      ["private-hall", "bedroom-a"],
      ["private-hall", "bathroom"],
      ["private-hall", "bedroom-b"]
    ];
    const openings = pairs.map(([sourceId, targetId], index) =>
      this._sharedOpening(byId.get(sourceId), byId.get(targetId), gridSize, index)
    );
    openings.push(this._exteriorEntry(byId.get("entry"), variantId, gridSize));

    const envelopeCells = this._envelope(cells);
    const envelope = {
      x: originX + envelopeCells.col * gridSize,
      y: originY + envelopeCells.row * gridSize,
      width: envelopeCells.w * gridSize,
      height: envelopeCells.h * gridSize
    };

    const result = {
      grammarId: this.GRAMMAR_ID,
      variantId,
      layoutSeed: seed,
      envelope,
      sectors,
      openings,
      routes: [],
      normalizedTopology: { gridSize, rectangles: [], junctions: [] },
      openingPlan: { openings },
      floors: { 1: { floor: 1, sectors } },
      architecture: {
        circulationType: "DIRECT_WITH_PRIVATE_HALL",
        corridorCount: 0,
        privateHallId: "private-hall",
        exteriorEntryId: "exterior-entry",
        zoneOrder: ["PUBLIC", "SERVICE", "PRIVATE"]
      }
    };

    const contract = GrammarContract.validate(result);
    if (!contract.valid) throw new Error(contract.problems.join(" "));
    return result;
  }

  static _definitions(roomProgram) {
    const supplied = Array.isArray(roomProgram.sectors) ? roomProgram.sectors : [];
    const byId = new Map(supplied.map(sector => [sector.sectorId, sector]));
    const byPurpose = new Map();
    for (const sector of supplied) {
      const purpose = String(sector.purpose || "").toUpperCase();
      if (!byPurpose.has(purpose)) byPurpose.set(purpose, []);
      byPurpose.get(purpose).push(sector);
    }
    const takeSupplied = (sectorId, purpose) =>
      byId.get(sectorId) || byPurpose.get(purpose)?.shift() || null;
    const defaults = [
      ["entry", "Front Entry", "ENTRY", "ENTRY"],
      ["living", "Living Room", "LIVING", "HUB"],
      ["dining", "Dining Room", "DINING", "OPTIONAL"],
      ["kitchen", "Kitchen", "KITCHEN", "OPTIONAL"],
      ["pantry", "Pantry", "STORAGE", "OPTIONAL"],
      ["private-hall", "Private Hall", "HALL", "OPTIONAL"],
      ["study", "Study", "OFFICE", "OPTIONAL"],
      ["bedroom-a", "Bedroom A", "BEDROOM", "OBJECTIVE"],
      ["bathroom", "Bathroom", "BATHROOM", "OPTIONAL"],
      ["bedroom-b", "Bedroom B", "BEDROOM", "OPTIONAL"]
    ];
    return defaults.map(([sectorId, name, purpose, graphRole]) => {
      const source = takeSupplied(sectorId, purpose);
      return {
        ...(source || {}),
        sectorId,
        sourceSectorId: source?.sectorId || null,
        name: source?.name || name,
        purpose,
        graphRole: source?.graphRole || graphRole,
        importance: source?.importance || (graphRole === "OBJECTIVE" ? 5 : 3),
        trafficLevel: source?.trafficLevel || (graphRole === "HUB" ? 5 : 2),
        connections: []
      };
    });
  }

  static _baseCells() {
    return {
      entry:        { col: 0,  row: 0,  w: 4, h: 5, zone: "PUBLIC" },
      living:       { col: 4,  row: 0,  w: 7, h: 5, zone: "PUBLIC" },
      dining:       { col: 11, row: 0,  w: 5, h: 5, zone: "PUBLIC" },
      study:        { col: 0,  row: 5,  w: 5, h: 3, zone: "PRIVATE" },
      "bedroom-a": { col: 0,  row: 8,  w: 5, h: 6, zone: "PRIVATE" },
      "private-hall": { col: 5, row: 5, w: 2, h: 9, zone: "PRIVATE" },
      bathroom:     { col: 7,  row: 5,  w: 4, h: 3, zone: "PRIVATE" },
      "bedroom-b": { col: 7,  row: 8,  w: 4, h: 6, zone: "PRIVATE" },
      kitchen:      { col: 11, row: 5,  w: 5, h: 7, zone: "SERVICE" },
      pantry:       { col: 11, row: 12, w: 5, h: 2, zone: "SERVICE" }
    };
  }

  static _variant(variantId) {
    const base = this._baseCells();
    if (variantId === "SERVICE_EAST") return base;
    if (variantId === "SERVICE_WEST") {
      return Object.fromEntries(Object.entries(base).map(([id, cell]) => [id, {
        ...cell,
        col: 16 - cell.col - cell.w
      }]));
    }
    return Object.fromEntries(Object.entries(base).map(([id, cell]) => [id, {
      ...cell,
      col: cell.row,
      row: 16 - cell.col - cell.w,
      w: cell.h,
      h: cell.w
    }]));
  }

  static _windowsFor(id, cell, variantId) {
    const baseFaces = {
      entry: ["NORTH"],
      living: ["NORTH"],
      dining: ["NORTH", "EAST"],
      kitchen: ["EAST"],
      pantry: ["SOUTH"],
      study: ["WEST"],
      "bedroom-a": ["WEST", "SOUTH"],
      "bedroom-b": ["SOUTH"],
      bathroom: [],
      "private-hall": []
    };
    return (baseFaces[id] || []).map((face, index) => ({
      id: `${id}:window:${index}`,
      featureType: "WINDOW_WALL",
      face: this._transformFace(face, variantId),
      width: id === "bathroom" ? 100 : 200,
      metadata: { privacy: id === "bathroom" ? "HIGH" : "STANDARD" }
    }));
  }

  static _transformFace(face, variantId) {
    if (variantId === "SERVICE_EAST") return face;
    if (variantId === "SERVICE_WEST") {
      return { EAST: "WEST", WEST: "EAST", NORTH: "NORTH", SOUTH: "SOUTH" }[face];
    }
    return { NORTH: "WEST", EAST: "NORTH", SOUTH: "EAST", WEST: "SOUTH" }[face];
  }

  static _exteriorEntry(entry, variantId, gridSize) {
    const face = this._transformFace("NORTH", variantId);
    const b = entry.bounds;
    const location = {
      NORTH: { x: b.x + b.width / 2, y: b.y },
      SOUTH: { x: b.x + b.width / 2, y: b.y + b.height },
      WEST: { x: b.x, y: b.y + b.height / 2 },
      EAST: { x: b.x + b.width, y: b.y + b.height / 2 }
    }[face];
    return {
      openingId: "exterior-entry",
      hostType: "ROOM",
      hostId: "entry",
      sourceId: "entry",
      targetId: "__exterior__",
      connectedSources: ["entry"],
      connectedTargets: ["__exterior__"],
      location,
      requestedLocation: { ...location },
      face,
      orientation: ["EAST", "WEST"].includes(face) ? "VERTICAL" : "HORIZONTAL",
      width: Math.min(200, gridSize * 2),
      doorType: "STANDARD",
      connectionType: "STANDARD_DOOR",
      exactFaceRequired: true,
      exterior: true,
      source: "HOUSE_GRAMMAR"
    };
  }

  static _envelope(cells) {
    const values = Object.values(cells);
    const col = Math.min(...values.map(cell => cell.col));
    const row = Math.min(...values.map(cell => cell.row));
    const right = Math.max(...values.map(cell => cell.col + cell.w));
    const bottom = Math.max(...values.map(cell => cell.row + cell.h));
    return { col, row, w: right - col, h: bottom - row };
  }

  static _sharedOpening(source, target, gridSize, index) {
    const a = source.bounds;
    const b = target.bounds;
    const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    let face;
    let location;
    if (overlapY > 0 && Math.abs(a.x + a.width - b.x) < 0.01) {
      face = "EAST"; location = { x: b.x, y: Math.max(a.y, b.y) + overlapY / 2 };
    } else if (overlapY > 0 && Math.abs(b.x + b.width - a.x) < 0.01) {
      face = "WEST"; location = { x: a.x, y: Math.max(a.y, b.y) + overlapY / 2 };
    } else if (overlapX > 0 && Math.abs(a.y + a.height - b.y) < 0.01) {
      face = "SOUTH"; location = { x: Math.max(a.x, b.x) + overlapX / 2, y: b.y };
    } else if (overlapX > 0 && Math.abs(b.y + b.height - a.y) < 0.01) {
      face = "NORTH"; location = { x: Math.max(a.x, b.x) + overlapX / 2, y: a.y };
    } else {
      throw new Error(`No shared boundary for ${source.sectorId} and ${target.sectorId}.`);
    }
    return {
      openingId: `house-door-${index}`,
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
      source: "HOUSE_GRAMMAR"
    };
  }
}
