// spaceship-grammar.js
// Standalone deck-spine prototype for scene-driven spaceship subtypes.

import { GrammarContract } from "./grammar-contract.js";
import { SpaceshipArchetypeLibrary } from "./spaceship-archetype-library.js";

export class SpaceshipGrammar {
  static GRAMMAR_ID = "SPACESHIP_DECK_SPINE_V1";

  static build(roomProgram = {}, options = {}) {
    const gridSize = Math.max(1, Number(options.gridSize) || 100);
    const originX = Number(options.originX) || 800;
    const originY = Number(options.originY) || 800;
    const seed = String(options.layoutSeed || "spaceship-001");
    const archetype = SpaceshipArchetypeLibrary.resolve(
      options.sceneArchetype || roomProgram.sceneArchetype || "FREIGHTER"
    );
    const supplied = Array.isArray(roomProgram.sectors) ? roomProgram.sectors : [];
    const definitions = supplied.length
      ? this._normalizeSupplied(supplied)
      : this._prototypeDefinitions(archetype);
    const mirror = GrammarContract.hash(seed) % 2 === 1;
    const dimensions = this._dimensions(archetype.scale, definitions.length);
    const cells = this._place(definitions, dimensions, mirror);

    const sectors = definitions.map(definition => {
      const cell = cells.get(definition.sectorId);
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
        shapeTypeSource: "SPACESHIP_GRAMMAR"
      };
    });

    const byId = new Map(sectors.map(sector => [sector.sectorId, sector]));
    const spine = byId.get("central-passage");
    const openings = [];
    let index = 0;
    for (const sector of sectors) {
      if (sector.sectorId === "central-passage") continue;
      openings.push(this._opening(spine, sector, gridSize, index++));
    }
    const airlock = sectors.find(sector => ["AIRLOCK", "ENTRY"].includes(sector.purpose));
    if (airlock) openings.push(this._exteriorOpening(airlock, gridSize, index));

    const envelope = this._envelope(sectors);
    const result = {
      grammarId: this.GRAMMAR_ID,
      variantId: `${archetype.id}_${mirror ? "MIRRORED" : "STANDARD"}`,
      layoutSeed: seed,
      sceneArchetype: archetype.id,
      roomProgram: archetype,
      envelope,
      sectors,
      openings,
      routes: [],
      normalizedTopology: { gridSize, rectangles: [], junctions: [] },
      openingPlan: { openings },
      floors: { 1: { floor: 1, sectors } },
      architecture: {
        circulationType: "ENCLOSED_DECK_SPINE",
        centralPassageId: "central-passage",
        hullType: archetype.scale
      }
    };
    const contract = GrammarContract.validate(result);
    if (!contract.valid) throw new Error(contract.problems.join(" "));
    return result;
  }

  static _normalizeSupplied(sectors) {
    const normalized = sectors.map((sector, index) => ({
      ...structuredClone(sector),
      sectorId: sector.sectorId || `room-${index}`,
      name: sector.name || sector.purpose || `Room ${index + 1}`,
      purpose: String(sector.purpose || sector.roomType || "UTILITY").toUpperCase(),
      graphRole: sector.graphRole || "OPTIONAL",
      connections: []
    }));
    if (!normalized.some(sector => sector.sectorId === "central-passage")) {
      normalized.unshift({
        sectorId: "central-passage",
        name: "Central Passage",
        purpose: "HALL",
        graphRole: "HUB",
        connections: []
      });
    }
    return normalized;
  }

  static _prototypeDefinitions(archetype) {
    const purposes = [...archetype.required, ...archetype.preferred.slice(0, 4)];
    const counts = new Map();
    const rooms = purposes.map((purpose, index) => {
      const count = (counts.get(purpose) || 0) + 1;
      counts.set(purpose, count);
      const id = `${purpose.toLowerCase().replaceAll("_", "-")}${count > 1 ? `-${count}` : ""}`;
      return {
        sectorId: id,
        name: purpose.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()),
        purpose,
        graphRole: index === 0 ? "ENTRY" : index === 1 ? "OBJECTIVE" : "OPTIONAL",
        connections: []
      };
    });
    rooms.unshift({
      sectorId: "central-passage",
      name: "Central Passage",
      purpose: "HALL",
      graphRole: "HUB",
      connections: []
    });
    return rooms;
  }

  static _dimensions(scale, count) {
    const width = { SMALL: 22, MEDIUM: 30, LARGE: 38, CAPITAL: 46 }[scale] || 30;
    const height = Math.max(14, Math.ceil((count - 1) / 2) * 5 + 4);
    return { width, height };
  }

  static _place(definitions, dimensions, mirror) {
    const rooms = definitions.filter(item => item.sectorId !== "central-passage");
    const cells = new Map();
    const passageCol = Math.floor(dimensions.width / 2) - 1;
    cells.set("central-passage", { col: passageCol, row: 0, w: 2, h: dimensions.height, zone: "DECK_SPINE" });
    const leftWidth = passageCol;
    const rightStart = passageCol + 2;
    const rightWidth = dimensions.width - rightStart;
    const bandHeight = Math.floor(dimensions.height / Math.ceil(rooms.length / 2));
    rooms.forEach((room, index) => {
      const logicalLeft = index % 2 === 0;
      const placeLeft = mirror ? !logicalLeft : logicalLeft;
      const band = Math.floor(index / 2);
      cells.set(room.sectorId, {
        col: placeLeft ? 0 : rightStart,
        row: band * bandHeight,
        w: placeLeft ? leftWidth : rightWidth,
        h: band === Math.ceil(rooms.length / 2) - 1
          ? dimensions.height - band * bandHeight
          : bandHeight,
        zone: this._zone(room.purpose)
      });
    });
    return cells;
  }

  static _zone(purpose) {
    if (["BRIDGE", "COCKPIT", "COMMAND", "WEAPONS_CONTROL", "SECURITY"].includes(purpose)) return "COMMAND";
    if (["ENGINEERING", "REACTOR", "UTILITY", "DAMAGE_CONTROL", "WORKSHOP"].includes(purpose)) return "ENGINEERING";
    if (["CARGO", "HANGAR", "MAGAZINE", "SPECIMEN_STORAGE"].includes(purpose)) return "MISSION";
    return "HABITATION";
  }

  static _opening(spine, room, gridSize, index) {
    const a = spine.bounds;
    const b = room.bounds;
    const roomOnLeft = b.x + b.width <= a.x;
    const face = roomOnLeft ? "WEST" : "EAST";
    const location = {
      x: roomOnLeft ? a.x : a.x + a.width,
      y: Math.max(a.y, b.y) + Math.min(a.y + a.height, b.y + b.height) / 2 - Math.max(a.y, b.y) / 2
    };
    return {
      openingId: `ship-door-${index}`,
      hostType: "ROOM",
      hostId: "central-passage",
      sourceId: "central-passage",
      targetId: room.sectorId,
      connectedSources: ["central-passage"],
      connectedTargets: [room.sectorId],
      location,
      requestedLocation: { ...location },
      face,
      orientation: "VERTICAL",
      width: Math.min(200, gridSize * 2),
      doorType: "STANDARD",
      connectionType: "STANDARD_DOOR",
      exactFaceRequired: true,
      source: "SPACESHIP_GRAMMAR"
    };
  }

  static _exteriorOpening(room, gridSize, index) {
    const b = room.bounds;
    const location = { x: b.x, y: b.y + b.height / 2 };
    return {
      openingId: `ship-airlock-${index}`,
      hostType: "ROOM",
      hostId: room.sectorId,
      sourceId: room.sectorId,
      targetId: "__exterior__",
      connectedSources: [room.sectorId],
      connectedTargets: ["__exterior__"],
      location,
      requestedLocation: { ...location },
      face: "WEST",
      orientation: "VERTICAL",
      width: Math.min(200, gridSize * 2),
      doorType: "STANDARD",
      connectionType: "AIRLOCK",
      exactFaceRequired: true,
      exterior: true,
      source: "SPACESHIP_GRAMMAR"
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
