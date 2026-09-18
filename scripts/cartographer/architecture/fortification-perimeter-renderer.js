// fortification-perimeter-renderer.js
import { CartographerMetadata } from "../cartographer-metadata.js";

export class FortificationPerimeterRenderer {
  static async render(result, scene, options = {}) {
    if (!scene) throw new Error("FortificationPerimeterRenderer requires a scene.");
    const plan = result?.fortificationPlan;
    if (!plan) return { rendered: false, drawings: [], walls: [] };

    const manifestId = options.manifestId || "fortification";
    const generationId = options.generationId || `fortification-${Date.now()}`;
    const floor = Number(options.floor ?? result.floor ?? 1);
    const drawings = [];

    const polygonDrawing = (polygon, type, fillAlpha, strokeWidth = plan.renderData.strokeWidth, extraProperties = {}) => {
      const xs = polygon.map(p => p[0]);
      const ys = polygon.map(p => p[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return {
        x,
        y,
        sort: -100000,
        shape: { type: "p", points: polygon.flatMap(p => [p[0] - x, p[1] - y]), width: Math.max(...xs) - x, height: Math.max(...ys) - y },
        fillType: 1,
        fillColor: plan.renderData.fillColor,
        fillAlpha,
        strokeColor: plan.renderData.strokeColor,
        strokeAlpha: 1,
        strokeWidth,
        flags: CartographerMetadata.createFlags({
          documentType: type,
          stableId: `${type}:${manifestId}:${floor}:${drawings.length}`,
          generationId,
          manifestId,
          floor,
          geometry: { polygon },
          properties: {
            style: plan.style,
            ringLayout: plan.fortificationNetwork?.ringLayout || null,
            wallWalk: plan.fortificationNetwork?.wallWalk === true,
            wallWalkMode: plan.fortificationNetwork?.wallWalkMode || null,
            hasDitch: plan.fortificationNetwork?.hasDitch === true,
            towerCount: Number(plan.towerCount || 0),
            ...extraProperties
          }
        })
      };
    };

    const ditchPolygons = Array.isArray(plan.ditchPolygons) && plan.ditchPolygons.length
      ? plan.ditchPolygons
      : (plan.ditchPolygon?.length ? [plan.ditchPolygon] : []);

    for (let index = 0; index < ditchPolygons.length; index++) {
      drawings.push({
        ...polygonDrawing(ditchPolygons[index], "fortification-ditch", plan.renderData.ditchFillAlpha ?? 0.10, 3, { featureType: "DITCH", ditchIndex: index }),
        fillColor: plan.renderData.ditchFillColor || "#3f5f69",
        strokeColor: "#3f5f69"
      });
    }

    if (plan.connectorPolygon?.length) {
      drawings.push({
        ...polygonDrawing(plan.connectorPolygon, "fortification-connector-path", plan.renderData.connectorFillAlpha ?? 0.22, 2, { featureType: "WALLED_KEEP_BAILEY_CONNECTOR", terrainType: "ROAD" }),
        fillColor: plan.renderData.connectorFillColor || "#6f6047",
        strokeColor: plan.renderData.connectorFillColor || "#6f6047"
      });
    }

    drawings.push(polygonDrawing(plan.polygon, "fortification-palisade", plan.renderData.fillAlpha));

    if (plan.motte) {
      const rx = Number(plan.motte.radiusX || plan.motte.radius || 0);
      const ry = Number(plan.motte.radiusY || plan.motte.radius || 0);
      drawings.push({
        x: plan.motte.center.x - rx,
        y: plan.motte.center.y - ry,
        sort: -99995,
        shape: { type: "e", width: rx * 2, height: ry * 2 },
        fillType: 1,
        fillColor: "#6b563c",
        fillAlpha: 0.22,
        strokeColor: "#806746",
        strokeAlpha: 0.8,
        strokeWidth: 4,
        flags: CartographerMetadata.createFlags({
          documentType: "fortification-motte",
          stableId: `motte:${manifestId}:${floor}`,
          generationId,
          manifestId,
          floor,
          geometry: { center: plan.motte.center, radiusX: rx, radiusY: ry },
          properties: { shape: "OVAL", placement: plan.motte.placement || "NORTH_INTERNAL", elevationRole: plan.motte.elevationRole || "RAISED_MOTTE" }
        })
      });
    }

    if (plan.innerPolygon?.length) {
      drawings.push(polygonDrawing(plan.innerPolygon, "fortification-keep-perimeter", 0.08, 6, { keepWallShape: "CIRCULAR" }));
    }

    if (Array.isArray(plan.towers)) {
      for (const tower of plan.towers) {
        const radius = Number(tower.radius || 75);
        drawings.push({
          x: tower.location.x - radius,
          y: tower.location.y - radius,
          sort: -99990,
          shape: { type: "e", width: radius * 2, height: radius * 2 },
          fillType: 1,
          fillColor: "#5a4a32",
          fillAlpha: 0.28,
          strokeColor: "#9b7a42",
          strokeAlpha: 1,
          strokeWidth: 4,
          flags: CartographerMetadata.createFlags({
            documentType: "fortification-watch-tower",
            stableId: `watch-tower:${manifestId}:${floor}:${tower.towerId}`,
            generationId,
            manifestId,
            floor,
            geometry: { location: tower.location, radius },
            properties: { towerId: tower.towerId, towerType: tower.type, role: tower.role, position: tower.position, floorCount: tower.floorCount, wallWalkAccess: tower.wallWalkAccess === true }
          })
        });
      }
    }

    const wallData = [];
    const add = (s, type, door = CONST.WALL_DOOR_TYPES.NONE, properties = {}, doorState = CONST.WALL_DOOR_STATES.CLOSED) => wallData.push({
      c: [s.x1, s.y1, s.x2, s.y2],
      move: CONST.WALL_SENSE_TYPES.NORMAL,
      sight: CONST.WALL_SENSE_TYPES.NORMAL,
      sound: CONST.WALL_SENSE_TYPES.NORMAL,
      light: CONST.WALL_SENSE_TYPES.NORMAL,
      door,
      ds: doorState,
      flags: CartographerMetadata.createFlags({
        documentType: type,
        stableId: `${type}:${manifestId}:${floor}:${wallData.length}`,
        generationId,
        manifestId,
        floor,
        geometry: { segment: s },
        properties: {
          wallWalk: plan.fortificationNetwork?.wallWalk === true,
          wallWalkMode: plan.fortificationNetwork?.wallWalkMode || null,
          hasDitch: plan.fortificationNetwork?.hasDitch === true,
          ...properties
        }
      })
    });

    const addOpenDoor = (s, type, properties = {}) => add(
      s,
      type,
      CONST.WALL_DOOR_TYPES.DOOR,
      { openByDefault: true, ...properties },
      CONST.WALL_DOOR_STATES.OPEN
    );

    (plan.wallSegments || []).forEach(s => add(s, "fortification-palisade-wall"));
    (plan.connectorWallSegments || []).forEach(s => add(s, "fortification-connector-wall", CONST.WALL_DOOR_TYPES.NONE, { wallSystem: "WALLED_KEEP_APPROACH" }));
    (plan.connectorWingWallSegments || []).forEach(s => add(s, "fortification-connector-wing-wall", CONST.WALL_DOOR_TYPES.NONE, { wallSystem: "CONNECTOR_TO_RING_JOIN" }));
    (plan.entryThroatWallSegments || []).forEach(s => add(s, "fortification-entry-throat-wall", CONST.WALL_DOOR_TYPES.NONE, { wallSystem: "GATEHOUSE_ENTRY_THROAT" }));
    (plan.entryThroatWingWallSegments || []).forEach(s => add(s, "fortification-entry-throat-wing-wall", CONST.WALL_DOOR_TYPES.NONE, { wallSystem: "ENTRY_THROAT_TO_RING_JOIN" }));
    (plan.innerWallSegments || []).forEach(s => add(s, "fortification-keep-wall", CONST.WALL_DOOR_TYPES.NONE, { wallSystem: "KEEP_WALL" }));

    // The bridge junctions are rendered as open doors, not solid wall segments.
    // This replaces the circled blocking wall pieces while preserving visible gate controls.
    if (plan.baileyConnectorGateSegment) addOpenDoor(plan.baileyConnectorGateSegment, "fortification-bailey-connector-gate", { gateType: "BAILEY_TO_KEEP_CONNECTOR_GATE" });
    if (plan.keepGateSegment) addOpenDoor(plan.keepGateSegment, "fortification-keep-gate", { gateType: "KEEP_GATE" });
    if (plan.gateSegment) addOpenDoor(plan.gateSegment, "fortification-gate", { gateType: "OUTER_GATE" });

    const drawingsCreated = await scene.createEmbeddedDocuments("Drawing", drawings);
    const wallsCreated = wallData.length ? await scene.createEmbeddedDocuments("Wall", wallData) : [];

    return {
      rendered: true,
      drawings: drawingsCreated,
      walls: wallsCreated,
      palisadeWalls: (plan.wallSegments || []).length,
      keepWalls: (plan.innerWallSegments || []).length,
      connectorWalls: (plan.connectorWallSegments || []).length,
      connectorWingWalls: (plan.connectorWingWallSegments || []).length,
      entryThroatWalls: (plan.entryThroatWallSegments || []).length,
      entryThroatWingWalls: (plan.entryThroatWingWallSegments || []).length,
      gates: (plan.gateSegment ? 1 : 0) + (plan.baileyConnectorGateSegment ? 1 : 0) + (plan.keepGateSegment ? 1 : 0),
      openDoorGates: true,
      towers: plan.towerCount || 0,
      hasDitch: plan.fortificationNetwork?.hasDitch === true,
      wallWalk: plan.fortificationNetwork?.wallWalk === true,
      ringLayout: plan.fortificationNetwork?.ringLayout || null
    };
  }

  static async clear(scene = canvas.scene) {
    if (!scene) return;
    const isFortification = document => {
      if (!CartographerMetadata.isCartographerDocument?.(document)) return false;
      const metadata = CartographerMetadata.get?.(document) || document.flags?.["ai-director"]?.cartographer || {};
      const type = String(metadata.documentType || document.flags?.["ai-director"]?.cartographerType || "").toLowerCase();
      return type.startsWith("fortification-");
    };
    const drawingIds = (scene.drawings?.contents || [])
      .filter(isFortification)
      .map(drawing => drawing.id);
    const wallIds = (scene.walls?.contents || [])
      .filter(isFortification)
      .map(wall => wall.id);
    if (drawingIds.length) await scene.deleteEmbeddedDocuments("Drawing", drawingIds);
    if (wallIds.length) await scene.deleteEmbeddedDocuments("Wall", wallIds);
  }
}
