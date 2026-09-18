// research-vessel-grammar.js
// Two-deck Research Vessel geometry grammar. Scene Manager owns room inventory.

import { GrammarContract } from "./grammar-contract.js";
import { SpaceshipHullPlanner } from "./spaceship-hull-planner.js";

export class ResearchVesselGrammar {
  static GRAMMAR_ID = "RESEARCH_VESSEL_TWO_DECK_V1";

  static build(roomProgram = {}, options = {}) {
    const floor = Number(options.floor);
    if (![1, 2].includes(floor)) {
      throw new Error("ResearchVesselGrammar requires floor 1 or floor 2.");
    }

    const supplied = Array.isArray(roomProgram.sectors)
      ? roomProgram.sectors
      : [];
    if (!supplied.length) {
      throw new Error(`Research Vessel floor ${floor} has no supplied sectors.`);
    }

    const gridSize = Math.max(1, Number(options.gridSize) || 100);
    const originX = Number(options.originX) || 0;
    const originY = Number(options.originY) || 0;
    const seed = String(options.layoutSeed || "research-vessel-v1");
    const mirrored = GrammarContract.hash(seed) % 2 === 1;
    const cells = this._cells(floor, mirrored);

    const sectorIds = new Set(supplied.map(sector => sector.sectorId));
    const missing = Object.keys(cells).filter(id => !sectorIds.has(id));
    if (missing.length) {
      throw new Error(
        `Research Vessel floor ${floor} is missing sectors: ${missing.join(", ")}.`
      );
    }

    const sectors = supplied.map(source => {
      const cell = cells[source.sectorId];
      if (!cell) {
        throw new Error(
          `Research Vessel floor ${floor} has no geometry slot for ${source.sectorId}.`
        );
      }
      const bounds = {
        x: originX + cell.col * gridSize,
        y: originY + cell.row * gridSize,
        width: cell.w * gridSize,
        height: cell.h * gridSize
      };
      return {
        ...source,
        floor,
        gridPosition: { col: cell.col, row: cell.row },
        gridDimensions: { w: cell.w, h: cell.h },
        bounds,
        pixelBounds: { ...bounds },
        center: {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2
        },
        architecturalZone: cell.zone,
        footprintContract: {
          ...(source.footprintContract || {}),
          archetype: "LINEAR_HULL"
        },
        shapeTypeSource: source.shapeType
          ? source.shapeTypeSource || "MANIFEST"
          : "RESEARCH_VESSEL_GRAMMAR"
      };
    });

    const byId = new Map(sectors.map(sector => [sector.sectorId, sector]));
    const openings = [];
    const seen = new Set();

    for (const source of sectors) {
      for (const connection of source.connections || []) {
        const target = byId.get(connection.to);
        if (!target) continue;
        const key = [source.sectorId, target.sectorId].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        openings.push(
          this._sharedOpening(source, target, openings.length, floor, gridSize)
        );
      }
    }

    if (floor === 1) {
      const airlock = byId.get("science-airlock");
      if (!airlock) throw new Error("Research Vessel requires science-airlock on floor 1.");
      openings.push(this._exteriorAirlock(airlock, mirrored, gridSize));
    }

    const roomEnvelope = this._envelope(sectors);

    const hullPlan = SpaceshipHullPlanner.plan(
      {
        sceneArchetype: "RESEARCH_VESSEL",
        layoutSeed: seed,
        sectors,
        openings,
        openingPlan: { openings },
        envelope: roomEnvelope
      },
      {
        gridSize,
        hullType: "RESEARCH_VESSEL",
        hullPadding: Number(options.hullPadding) || gridSize * 2,
        airlockWidth: Number(options.airlockWidth) || gridSize * 2,
        fillColor: options.hullFillColor || "#202733",
        fillAlpha: options.hullFillAlpha ?? 0.55,
        strokeColor: options.hullStrokeColor || "#38BDF8",
        strokeWidth: options.hullStrokeWidth ?? 4
      }
    );

    if (!hullPlan.containment.valid) {
      throw new Error(
        `Research Vessel floor ${floor} crosses its hull: ${JSON.stringify(hullPlan.containment.failures)}`
      );
    }

    const result = {
      grammarId: this.GRAMMAR_ID,
      variantId: mirrored ? `FLOOR_${floor}_MIRRORED` : `FLOOR_${floor}_STANDARD`,
      layoutSeed: seed,
      sceneArchetype: "RESEARCH_VESSEL",
      hullType: "RESEARCH_VESSEL",
      floor,
      sectors,
      openings,
      openingPlan: { openings },
      normalizedTopology: { gridSize, rectangles: [], junctions: [] },
      floors: { [floor]: { floor, sectors } },
      roomEnvelope,
      envelope: hullPlan.envelope,
      hullPlan,
      hullPolygon: hullPlan.polygon,
      hullWallPlan: {
        wallSegments: hullPlan.wallSegments,
        airlockSegments: hullPlan.airlockSegments,
        airlockConnectors: hullPlan.airlockConnectors
      },
      deckFloorPlan: {
        ownership: "ROOM_AND_CORRIDOR_DRAWINGS",
        fillHullInterstitialSpace: false,
        note: "Room floors remain walkable floor surfaces; hull-interstitial space remains non-walkable."
      },
      metrics: {
        sectors: sectors.length,
        openings: openings.length,
        mirrored,
        hullWallSegments: hullPlan.wallSegments.length,
        hullAirlocks: hullPlan.airlockSegments.filter(Boolean).length,
        hullContainmentValid: hullPlan.containment.valid
      }
    };

    GrammarContract.validate(result, {
      grammarId: this.GRAMMAR_ID,
      requiredSectorIds: Object.keys(cells)
    });
    return result;
  }

  static _cells(floor, mirrored) {
    const standard = floor === 1
      ? {
          "science-airlock": { col: 0, row: 2, w: 3, h: 3, zone: "PORT_ACCESS" },
          "science-spine": { col: 3, row: 1, w: 6, h: 5, zone: "CENTRAL_SPINE" },
          bridge: { col: 9, row: 1, w: 4, h: 2, zone: "FORWARD_COMMAND" },
          laboratory: { col: 9, row: 3, w: 4, h: 3, zone: "SCIENCE" },
          "specimen-storage": { col: 3, row: 6, w: 3, h: 2, zone: "CONTAINMENT" },
          "science-lift": { col: 6, row: 6, w: 3, h: 2, zone: "VERTICAL_ACCESS" }
        }
      : {
          "crew-quarters": { col: 0, row: 2, w: 3, h: 3, zone: "HABITATION" },
          "service-spine": { col: 3, row: 1, w: 6, h: 5, zone: "CENTRAL_SPINE" },
          medical: { col: 9, row: 1, w: 4, h: 2, zone: "MEDICAL" },
          engineering: { col: 9, row: 3, w: 4, h: 3, zone: "ENGINEERING" },
          utility: { col: 3, row: 6, w: 3, h: 2, zone: "SERVICE" },
          "service-lift": { col: 6, row: 6, w: 3, h: 2, zone: "VERTICAL_ACCESS" }
        };

    if (!mirrored) return standard;
    const width = 13;
    return Object.fromEntries(
      Object.entries(standard).map(([id, cell]) => [
        id,
        { ...cell, col: width - cell.col - cell.w }
      ])
    );
  }

  static _sharedOpening(source, target, index, floor, gridSize) {
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
      throw new Error(
        `No shared boundary for ${source.sectorId} and ${target.sectorId}.`
      );
    }

    return {
      openingId: `research-vessel-floor-${floor}-door-${index}`,
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
      source: "RESEARCH_VESSEL_GRAMMAR"
    };
  }

  static _exteriorAirlock(airlock, mirrored, gridSize) {
    const bounds = airlock.bounds;
    const face = mirrored ? "EAST" : "WEST";
    const location = {
      x: mirrored ? bounds.x + bounds.width : bounds.x,
      y: bounds.y + bounds.height / 2
    };
    return {
      openingId: "research-vessel-exterior-airlock",
      hostType: "ROOM",
      hostId: airlock.sectorId,
      sourceId: airlock.sectorId,
      targetId: "__exterior__",
      connectedSources: [airlock.sectorId],
      connectedTargets: ["__exterior__"],
      location,
      requestedLocation: { ...location },
      face,
      orientation: "VERTICAL",
      width: Math.min(200, gridSize * 2),
      doorType: "STANDARD",
      connectionType: "AIRLOCK",
      exactFaceRequired: true,
      exterior: true,
      source: "RESEARCH_VESSEL_GRAMMAR"
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
