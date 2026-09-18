import { GrammarContract } from "./grammar-contract.js";

export class ProgrammaticBuildingGrammar {
  static ALLOWED_SHAPES = new Set(["RECTANGLE", "CIRCLE", "OCTAGON", "PLUS"]);

  static build(spec, roomProgram = {}, options = {}) {
    const gridSize = Math.max(1, Number(options.gridSize) || 100);
    const originX = Number(options.originX) || 1000;
    const originY = Number(options.originY) || 1000;
    const seed = String(options.layoutSeed || roomProgram.layoutSeed || `${spec.profileId.toLowerCase()}-001`);
    const variantIndex = GrammarContract.hash(seed) % (spec.variants?.length || 2);
    const variantId = spec.variants?.[variantIndex] || (variantIndex ? "MIRRORED" : "STANDARD");
    const floor = Number(options.floor || spec.floor || 1);
    const definitions = this._definitions(spec, roomProgram, floor);
    const baseCells = typeof spec.cells === "function" ? spec.cells({ floor, roomProgram, options }) : spec.cells;
    const cells = this._transformCells(baseCells, variantId, spec.width);

    const sectors = definitions.map(definition => {
      const cell = cells[definition.sectorId];
      if (!cell) throw new Error(`${spec.grammarId} has no cell for ${definition.sectorId}.`);
      const shapeType = String(cell.shapeType || "RECTANGLE").toUpperCase();
      if (!this.ALLOWED_SHAPES.has(shapeType)) throw new Error(`Forbidden room shape ${shapeType} for ${definition.sectorId}.`);
      const bounds = { x: originX + cell.col * gridSize, y: originY + cell.row * gridSize, width: cell.w * gridSize, height: cell.h * gridSize };
      const cellMetadata = {
        renderAsOpenArea: cell.renderAsOpenArea === true,
        suppressWalls: cell.suppressWalls === true,
        suppressExteriorDoor: cell.suppressExteriorDoor === true,
        placementRole: cell.placementRole || null,
        keepShape: cell.keepShape || null,
        minimumClearanceGrid: cell.minimumClearanceGrid || null,
        terrainType: cell.terrainType || null
      };
      return { ...definition, floor, connections: [], gridPosition: { col: cell.col, row: cell.row }, gridDimensions: { w: cell.w, h: cell.h }, bounds, pixelBounds: { ...bounds }, center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, architecturalZone: cell.zone || "GENERAL", shapeType, shapeTypeSource: spec.grammarId, ...cellMetadata };
    });

    const byId = new Map(sectors.map(sector => [sector.sectorId, sector]));
    const openings = (spec.pairs || []).filter(([a, b]) => byId.has(a) && byId.has(b)).map(([a, b, overrides], index) => this._sharedOpening(byId.get(a), byId.get(b), gridSize, index, spec.grammarId, overrides));
    const entryId = spec.entryId || definitions.find(item => item.graphRole === "ENTRY")?.sectorId;
    if (entryId && byId.has(entryId)) openings.push(this._exteriorOpening(byId.get(entryId), variantId, gridSize, spec));
    const envelope = this._envelope(sectors);
    const result = { grammarId: spec.grammarId, variantId, layoutSeed: seed, sceneArchetype: spec.sceneArchetype || spec.profileId, floor, envelope, sectors, openings, openingPlan: { openings }, routes: [], normalizedTopology: { gridSize, rectangles: [], junctions: [] }, floors: { [floor]: { floor, sectors } }, architecturalGrammar: { grammarId: spec.grammarId, profileId: spec.profileId, subtype: String(options.structureType || roomProgram.structureType || spec.profileId).toUpperCase(), zoneOrder: spec.zoneOrder || [] }, metrics: { sectors: sectors.length, openings: openings.length, variantIndex } };
    const contract = GrammarContract.validate(result);
    if (!contract.valid) throw new Error(contract.problems.join(" "));
    return result;
  }

  static exteriorOpening(room, face, gridSize, overrides = {}) {
    const b = room.bounds || room.pixelBounds;
    const location = { WEST: { x: b.x, y: b.y + b.height / 2 }, EAST: { x: b.x + b.width, y: b.y + b.height / 2 }, NORTH: { x: b.x + b.width / 2, y: b.y }, SOUTH: { x: b.x + b.width / 2, y: b.y + b.height } }[face];
    return this._opening(overrides.id || `${room.sectorId}-exterior`, room.sectorId, "__exterior__", location, face, Number(overrides.width) || gridSize, { ...overrides, exterior: true });
  }

  static _definitions(spec, roomProgram, floor) {
    const supplied = (roomProgram.sectors || []).filter(sector => Number(sector.floor || floor) === floor);
    const byId = new Map(supplied.map(sector => [sector.sectorId, sector]));
    const byPurpose = new Map();
    for (const sector of supplied) { const purpose = String(sector.purpose || "").toUpperCase(); if (!byPurpose.has(purpose)) byPurpose.set(purpose, []); byPurpose.get(purpose).push(sector); }
    return spec.definitions.map(([sectorId, name, purpose, graphRole]) => { const source = byId.get(sectorId) || byPurpose.get(purpose)?.shift() || {}; return { ...source, sectorId, sourceSectorId: source.sectorId || null, name: source.name || name, purpose, graphRole: source.graphRole || graphRole, importance: source.importance || (graphRole === "OBJECTIVE" ? 5 : 3), trafficLevel: source.trafficLevel || (graphRole === "HUB" ? 5 : 2) }; });
  }

  static _transformCells(cells, variantId, width) {
    if (variantId === "STANDARD" || variantId.endsWith("_STANDARD")) return structuredClone(cells);
    if (variantId === "ROTATED" || variantId.endsWith("_ROTATED")) return Object.fromEntries(Object.entries(cells).map(([id, cell]) => [id, { ...cell, col: cell.row, row: width - cell.col - cell.w, w: cell.h, h: cell.w }]));
    return Object.fromEntries(Object.entries(cells).map(([id, cell]) => [id, { ...cell, col: width - cell.col - cell.w }]));
  }

  static _sharedOpening(source, target, gridSize, index, grammarId, overrides = {}) {
    const a = source.bounds, b = target.bounds;
    const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    let face, location, maximumWidth;
    if (overlapY > 0 && Math.abs(a.x + a.width - b.x) < 0.01) { face = "EAST"; location = { x: b.x, y: Math.max(a.y, b.y) + overlapY / 2 }; maximumWidth = overlapY; }
    else if (overlapY > 0 && Math.abs(b.x + b.width - a.x) < 0.01) { face = "WEST"; location = { x: a.x, y: Math.max(a.y, b.y) + overlapY / 2 }; maximumWidth = overlapY; }
    else if (overlapX > 0 && Math.abs(a.y + a.height - b.y) < 0.01) { face = "SOUTH"; location = { x: Math.max(a.x, b.x) + overlapX / 2, y: b.y }; maximumWidth = overlapX; }
    else if (overlapX > 0 && Math.abs(b.y + b.height - a.y) < 0.01) { face = "NORTH"; location = { x: Math.max(a.x, b.x) + overlapX / 2, y: a.y }; maximumWidth = overlapX; }
    else throw new Error(`No shared boundary for ${source.sectorId} and ${target.sectorId}.`);
    return this._opening(`${grammarId.toLowerCase()}-door-${index}`, source.sectorId, target.sectorId, location, face, Math.min(Number(overrides.width) || gridSize * 2, maximumWidth), overrides);
  }

  static _exteriorOpening(room, variantId, gridSize, spec) {
    const baseFace = spec.entryFace || "WEST";
    const face = variantId.includes("MIRRORED") ? { WEST: "EAST", EAST: "WEST", NORTH: "NORTH", SOUTH: "SOUTH" }[baseFace] : baseFace;
    return this.exteriorOpening(room, face, gridSize, { id: `${spec.grammarId.toLowerCase()}-entry`, width: gridSize * 2 });
  }

  static _opening(id, sourceId, targetId, location, face, width, overrides = {}) {
    return { openingId: id, id, hostType: "ROOM", hostId: sourceId, sourceId, targetId, connectedSources: [sourceId], connectedTargets: [targetId], location, requestedLocation: { ...location }, face, orientation: ["EAST", "WEST"].includes(face) ? "VERTICAL" : "HORIZONTAL", width, doorType: overrides.doorType || "STANDARD", connectionType: overrides.connectionType || "STANDARD_DOOR", exactFaceRequired: true, exterior: overrides.exterior === true, source: "ARCHITECTURAL_GRAMMAR" };
  }

  static _envelope(sectors) {
    const x = Math.min(...sectors.map(s => s.bounds.x)), y = Math.min(...sectors.map(s => s.bounds.y));
    const right = Math.max(...sectors.map(s => s.bounds.x + s.bounds.width)), bottom = Math.max(...sectors.map(s => s.bounds.y + s.bounds.height));
    return { x, y, width: right - x, height: bottom - y };
  }
}
