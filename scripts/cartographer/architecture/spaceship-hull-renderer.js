// spaceship-hull-renderer.js
// Shared production renderer for spaceship hull Drawings, blocking hull walls,
// sealed airlock connector walls, and exterior hull airlock doors.
import { CartographerMetadata } from "../cartographer-metadata.js";

export class SpaceshipHullRenderer {
  static DOCUMENT_TYPES = Object.freeze({
    HULL: "spaceship-hull",
    HULL_WALL: "spaceship-hull-wall",
    AIRLOCK_CONNECTOR_WALL: "spaceship-airlock-connector-wall",
    HULL_AIRLOCK: "spaceship-hull-airlock"
  });

  static async renderFloor(result, scene, options = {}) {
    if (!scene) throw new Error("SpaceshipHullRenderer requires a scene.");
    if (!result?.hullPlan) {
      return {
        rendered: false,
        floor: Number(result?.floor) || null,
        drawings: [],
        walls: [],
        hullWalls: 0,
        connectorWalls: 0,
        hullAirlocks: 0
      };
    }

    const floor = Number(options.floor ?? result.floor);
    const structureId = String(options.structureId || options.manifestId || "spaceship");
    const manifestId = options.manifestId || structureId;
    const generationId = options.generationId || `spaceship-hull-${Date.now()}`;
    const floorPresentation = String(options.floorPresentation || "SINGLE_SCENE");
    const translation = options.translation || {};
    const dx = Number(translation.dx) || 0;
    const dy = Number(translation.dy) || 0;

    if (options.cleanupExisting !== false) {
      await this.cleanup(scene, { structureId, floor });
    }

    const hull = result.hullPlan;
    if (!hull.containment?.valid) {
      throw new Error(
        `Spaceship hull containment failed on floor ${floor}: ${JSON.stringify(hull.containment?.failures || [])}`
      );
    }

    const polygon = (hull.polygon || []).map(([x, y]) => [
      Number(x) + dx,
      Number(y) + dy
    ]);
    if (polygon.length < 3) {
      throw new Error(`Spaceship hull floor ${floor} requires a valid polygon.`);
    }

    const xs = polygon.map(point => point[0]);
    const ys = polygon.map(point => point[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const hullType = hull.hullType || result.hullType || result.sceneArchetype || "SPACESHIP";

    const drawingData = {
      x: minX,
      y: minY,
      sort: Number(options.sort ?? -100000),
      shape: {
        type: "p",
        points: polygon.flatMap(([x, y]) => [x - minX, y - minY]),
        width: Math.max(...xs) - minX,
        height: Math.max(...ys) - minY
      },
      fillType: 1,
      fillColor: options.fillColor || hull.renderData?.fillColor || "#202733",
      fillAlpha: Number(options.fillAlpha ?? 0.25),
      strokeColor: options.strokeColor || hull.renderData?.strokeColor || "#7fa3c7",
      strokeAlpha: Number(options.strokeAlpha ?? 0.8),
      strokeWidth: Number(options.strokeWidth ?? hull.renderData?.strokeWidth ?? 4),
      flags: CartographerMetadata.createFlags({
        documentType: this.DOCUMENT_TYPES.HULL,
        stableId: `hull:${structureId}:${floor}`,
        generationId,
        manifestId,
        floor,
        geometry: {
          polygon,
          envelope: hull.envelope ? structuredClone(hull.envelope) : null
        },
        properties: {
          structureId,
          floorPresentation,
          hullType,
          layoutSeed: result.layoutSeed || null,
          interstitialWalkable: false
        },
        legacy: {
          structureId,
          hullType,
          floorPresentation
        }
      })
    };

    const translateSegment = segment => ({
      ...segment,
      x1: Number(segment.x1) + dx,
      y1: Number(segment.y1) + dy,
      x2: Number(segment.x2) + dx,
      y2: Number(segment.y2) + dy
    });

    const wallData = [];
    const addWall = (segment, documentType, index, door = CONST.WALL_DOOR_TYPES.NONE) => {
      const translated = translateSegment(segment);
      wallData.push({
        c: [translated.x1, translated.y1, translated.x2, translated.y2],
        move: CONST.WALL_SENSE_TYPES.NORMAL,
        sight: CONST.WALL_SENSE_TYPES.NORMAL,
        sound: CONST.WALL_SENSE_TYPES.NORMAL,
        light: CONST.WALL_SENSE_TYPES.NORMAL,
        door,
        ds: CONST.WALL_DOOR_STATES.CLOSED,
        flags: CartographerMetadata.createFlags({
          documentType,
          stableId: `${documentType}:${structureId}:${floor}:${index}`,
          generationId,
          manifestId,
          floor,
          sourceId: segment.openingId || null,
          hostId: segment.hostId || null,
          geometry: { segment: translated },
          properties: {
            structureId,
            floorPresentation,
            hullType,
            openingId: segment.openingId || null,
            exteriorAccess: documentType === this.DOCUMENT_TYPES.HULL_AIRLOCK
          },
          legacy: {
            structureId,
            hullType,
            floorPresentation,
            openingId: segment.openingId || null
          }
        })
      });
    };

    (hull.wallSegments || []).forEach((segment, index) =>
      addWall(segment, this.DOCUMENT_TYPES.HULL_WALL, index)
    );

    let connectorIndex = 0;
    for (const connector of hull.airlockConnectors || []) {
      for (const segment of connector.wallSegments || []) {
        addWall(
          { ...segment, openingId: connector.openingId, hostId: connector.hostId },
          this.DOCUMENT_TYPES.AIRLOCK_CONNECTOR_WALL,
          connectorIndex++
        );
      }
    }

    (hull.airlockSegments || []).filter(Boolean).forEach((segment, index) =>
      addWall(
        segment,
        this.DOCUMENT_TYPES.HULL_AIRLOCK,
        index,
        CONST.WALL_DOOR_TYPES.DOOR
      )
    );

    const drawings = await scene.createEmbeddedDocuments("Drawing", [drawingData]);
    const walls = wallData.length
      ? await scene.createEmbeddedDocuments("Wall", wallData)
      : [];

    return {
      rendered: true,
      floor,
      drawings,
      walls,
      hullWalls: (hull.wallSegments || []).length,
      connectorWalls: connectorIndex,
      hullAirlocks: (hull.airlockSegments || []).filter(Boolean).length,
      containmentValid: hull.containment.valid,
      interstitialWalkableFloorCreated: false
    };
  }

  static async renderPresentation(presentation, scene, options = {}) {
    if (!presentation?.floors?.length) return [];
    const reports = [];
    for (const floorItem of presentation.floors) {
      reports.push(await this.renderFloor(floorItem.result, scene, {
        ...options,
        floor: floorItem.floor,
        translation: floorItem.translation,
        floorPresentation: "STACKED_CANVAS",
        cleanupExisting: true
      }));
    }
    return reports;
  }

  static async cleanup(scene, filters = {}) {
    if (!scene) return { drawings: 0, walls: 0 };
    const structureId = filters.structureId ? String(filters.structureId) : null;
    const floor = Number.isFinite(Number(filters.floor)) ? Number(filters.floor) : null;
    const types = new Set(Object.values(this.DOCUMENT_TYPES));

    const matches = document => {
      const metadata = CartographerMetadata.get(document);
      if (!metadata || !types.has(metadata.documentType)) return false;
      const properties = metadata.properties || {};
      const legacy = document.flags?.[CartographerMetadata.NAMESPACE] || {};
      const documentStructureId = properties.structureId || legacy.structureId || null;
      if (structureId && documentStructureId !== structureId) return false;
      if (floor !== null && Number(metadata.floor) !== floor) return false;
      return true;
    };

    const drawings = (scene.drawings?.contents || []).filter(matches);
    const walls = (scene.walls?.contents || []).filter(matches);

    if (drawings.length) {
      await scene.deleteEmbeddedDocuments("Drawing", drawings.map(document => document.id));
    }
    if (walls.length) {
      await scene.deleteEmbeddedDocuments("Wall", walls.map(document => document.id));
    }

    return { drawings: drawings.length, walls: walls.length };
  }
}
