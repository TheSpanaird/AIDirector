// wall-renderer.js
// AI Director Cartographer Alpha 0.1
// FILE: /modules/ai-director/scripts/cartographer/wall-renderer.js
// Generates one exterior wall system from room polygons and normalized corridors.

import { ShapePrimitiveGenerator }
  from "/modules/ai-director/scripts/cartographer/shape-primitive-generator.js";

import { CartographerRoomRenderer }
  from "/modules/ai-director/scripts/cartographer/room-renderer.js";

import { CartographerMetadata }
  from "/modules/ai-director/scripts/cartographer/cartographer-metadata.js";

export class CartographerWallRenderer {

  static CONFIG = {
    epsilon: 0.001,
    move: 20,
    sight: 20,
    sound: 20,
    light: 20,
    windowThreshold: 10,
    windowAttenuation: true,
    generationId: null,
    manifestId: null,
    wallHeightBottom: null,
    wallHeightTop: null,
    applyWallHeight: false
  };

  static async render(
    layoutResult,
    normalizedTopology = {},
    openingPlan = {},
    boundaryFeaturePlan = {},
    scene = canvas.scene,
    customConfig = {}
  ) {
    if (!scene) {
      ui.notifications.error("No active scene available.");
      return [];
    }

    const config = {
      ...this.CONFIG,
      ...customConfig
    };

    if (customConfig.replaceExisting !== false) {
      await this.clear(scene);
    }

    const sectors = this._getSectors(layoutResult);
    const corridorRectangles = Array.isArray(normalizedTopology.rectangles)
      ? normalizedTopology.rectangles.filter(this._isValidRectangle)
      : [];

    const rooms = sectors
      .map(sector => this._buildRoomGeometry(sector, normalizedTopology))
      .filter(Boolean);

    const roomPolygons = rooms.map(room => room.polygon);
    const corridorBoundary = this._buildRectangleUnionBoundary(
      corridorRectangles,
      config.epsilon
    );

    const roomBoundary = [];

    for (const room of rooms) {
      const polygonEdges = this._polygonToSegments(room.polygon);

      for (const edge of polygonEdges) {
        const pieces = this._splitSegmentByRectangles(
          edge,
          corridorRectangles,
          config.epsilon
        );

        for (const piece of pieces) {
          const midpoint = this._segmentMidpoint(piece);

          if (
            this._pointInAnyRectangle(
              midpoint,
              corridorRectangles,
              true,
              config.epsilon
            )
          ) {
            continue;
          }

          roomBoundary.push({
            ...piece,
            source: "ROOM",
            sectorId: room.sectorId
          });
        }
      }
    }

    const visibleCorridorBoundary = [];

    for (const edge of corridorBoundary) {
      const pieces = this._splitSegmentByPolygons(
        edge,
        roomPolygons,
        config.epsilon
      );

      for (const piece of pieces) {
        const midpoint = this._segmentMidpoint(piece);

        if (
          this._pointInAnyPolygon(
            midpoint,
            roomPolygons,
            true,
            config.epsilon
          )
        ) {
          continue;
        }

        visibleCorridorBoundary.push({
          ...piece,
          source: "CORRIDOR"
        });
      }
    }

    const normalizedRoomBoundary =
      this._normalizeCollinearSegments(
        roomBoundary,
        config.epsilon
      );
    const exteriorSegments = this._deduplicateSegments(
      [
        ...normalizedRoomBoundary,
        ...visibleCorridorBoundary
      ],
      config.epsilon
    );

    const openings = Array.isArray(openingPlan?.openings)
      ? openingPlan.openings
      : Array.isArray(openingPlan)
        ? openingPlan
        : [];

    const openingResult = this._applyOpenings(
      exteriorSegments,
      openings,
      config.epsilon
    );

    const boundaryFeatures = Array.isArray(boundaryFeaturePlan?.features)
      ? boundaryFeaturePlan.features
      : Array.isArray(boundaryFeaturePlan)
        ? boundaryFeaturePlan
        : [];

    const featureResult = this._applyBoundaryFeatures(
      openingResult.wallSegments,
      boundaryFeatures,
      config.epsilon
    );

    const walls = featureResult.wallSegments
      .filter(segment => this._segmentLength(segment) > config.epsilon)
      .map((segment, index) =>
        this._createWallData(segment, config, index)
      );

    const featureWalls = featureResult.featureSegments
      .filter(segment => this._segmentLength(segment) > config.epsilon)
      .map((segment, index) =>
        this._createBoundaryFeatureData(segment, config, index)
      );

    const doorWalls = openingResult.doorSegments
      .filter(segment => this._segmentLength(segment) > config.epsilon)
      .map((segment, index) =>
        this._createDoorData(segment, config, index)
      );

    walls.push(...featureWalls, ...doorWalls);

    if (!walls.length) {
      ui.notifications.warn("No exterior walls generated.");
      return [];
    }

    const created = await scene.createEmbeddedDocuments(
      "Wall",
      walls
    );

    console.log(
      "Cartographer Unified Exterior Walls",
      {
        rooms: rooms.length,
        corridorRectangles: corridorRectangles.length,
        roomBoundarySegments: normalizedRoomBoundary.length,
        corridorBoundarySegments: visibleCorridorBoundary.length,
        openings: openings.length,
        boundaryFeatures: boundaryFeatures.length,
        featureWalls: featureWalls.length,
        doorWalls: doorWalls.length,
        created
      }
    );

    ui.notifications.info(
      `Cartographer created ${created.length} walls and doors.`
    );

    return created;
  }

  static _applyBoundaryFeatures(segments, features, epsilon) {
    let wallSegments = segments.map(segment => ({ ...segment }));
    const featureSegments = [];

    for (const feature of features) {
      const featureSegment = this._boundaryFeatureToSegment(feature);
      if (!featureSegment) continue;

      const nextWalls = [];

      for (const wall of wallSegments) {
        if (!this._segmentsAreCollinear(wall, featureSegment, epsilon)) {
          nextWalls.push(wall);
          continue;
        }

        const overlap = this._collinearOverlap(wall, featureSegment, epsilon);
        if (!overlap) {
          nextWalls.push(wall);
          continue;
        }

        nextWalls.push(...this._subtractSegment(wall, overlap, epsilon));
        featureSegments.push({
          ...overlap,
          feature
        });
      }

      wallSegments = nextWalls;
    }

    return {
      wallSegments: this._deduplicateSegments(wallSegments, epsilon),
      featureSegments: this._deduplicateFeatureSegments(featureSegments, epsilon)
    };
  }

  static _boundaryFeatureToSegment(feature) {
    if (!feature?.location) return null;

    const width = Math.max(1, Number(feature.width) || 100);
    const halfWidth = width / 2;
    const orientation = feature.orientation ||
      ((feature.face === "EAST" || feature.face === "WEST")
        ? "VERTICAL"
        : "HORIZONTAL");

    if (orientation === "VERTICAL") {
      return {
        x1: feature.location.x,
        y1: feature.location.y - halfWidth,
        x2: feature.location.x,
        y2: feature.location.y + halfWidth,
        feature
      };
    }

    return {
      x1: feature.location.x - halfWidth,
      y1: feature.location.y,
      x2: feature.location.x + halfWidth,
      y2: feature.location.y,
      feature
    };
  }

  static _createBoundaryFeatureData(segment, config, index = 0) {
    const feature = segment.feature || {};
    const behavior = this._getBoundaryFeatureBehavior(
      feature.featureType,
      {
        ...config,
        currentBoundaryFeature: feature
      }
    );

    return {
      c: [segment.x1, segment.y1, segment.x2, segment.y2],
      move: behavior.move,
      sight: behavior.sight,
      sound: behavior.sound,
      light: behavior.light,
      threshold: behavior.threshold || {
        light: null,
        sight: null,
        sound: null,
        attenuation: false
      },
      dir: this._getWallDirection(feature.direction),
      door: 0,
      ds: 0,
      flags: this._withWallHeightFlags(
        CartographerMetadata.createBoundaryFeatureFlags({
        feature,
        segment,
        generationId: config.generationId,
        manifestId: config.manifestId,
        index
      }),
        config
      )
    };
  }

  static _getBoundaryFeatureBehavior(featureType, config) {
    const type = String(featureType || "STANDARD_WALL").toUpperCase();
    const normal = {
      move: config.move,
      sight: config.sight,
      sound: config.sound,
      light: config.light
    };

    if (type === "TERRAIN_WALL") {
      return {
        move: config.move,
        sight: this._proximityRestriction(),
        sound: this._proximityRestriction(),
        light: this._proximityRestriction()
      };
    }

    if (type === "INVISIBLE_WALL") {
      return {
        move: config.move,
        sight: this._unrestricted(),
        sound: this._unrestricted(),
        light: this._unrestricted()
      };
    }

    if (type === "ETHEREAL_WALL") {
      return {
        move: this._unrestricted(),
        sight: config.sight,
        sound: this._unrestricted(),
        light: config.light
      };
    }

    if (type === "WINDOW_WALL") {
      const metadata = config.currentBoundaryFeature?.metadata || {};
      const threshold = Math.max(
        0,
        Number(
          metadata.threshold ??
          metadata.proximityThreshold ??
          config.windowThreshold
        ) || 10
      );
      return {
        move: config.move,
        sight: this._proximityRestriction(),
        sound: this._unrestricted(),
        light: this._proximityRestriction(),
        threshold: {
          light: threshold,
          sight: threshold,
          sound: null,
          attenuation:
            metadata.attenuation ??
            config.windowAttenuation ??
            true
        }
      };
    }

    return normal;
  }

  static _unrestricted() {
    return globalThis.CONST?.WALL_SENSE_TYPES?.NONE ?? 0;
  }

  static _proximityRestriction() {
    return globalThis.CONST?.WALL_SENSE_TYPES?.PROXIMITY ?? 30;
  }

  static _getWallDirection(direction) {
    const value = String(direction || "BOTH").toUpperCase();
    const directions = globalThis.CONST?.WALL_DIRECTIONS || {};

    if (value === "IN") {
      return directions.LEFT ?? 1;
    }

    if (value === "OUT") {
      return directions.RIGHT ?? 2;
    }

    return directions.BOTH ?? 0;
  }

  static _deduplicateFeatureSegments(segments, epsilon) {
    const unique = new Map();

    for (const segment of segments) {
      const key = this._segmentKey(segment, epsilon);
      if (!unique.has(key)) {
        unique.set(key, segment);
      }
    }

    return [...unique.values()];
  }

  static _applyOpenings(segments, openings, epsilon) {
    let wallSegments = segments.map(segment => ({ ...segment }));
    const doorSegments = [];
    const physicalOpenings = this._deduplicateOpenings(openings, epsilon);

    for (const opening of physicalOpenings) {
      let openingSegment = this._openingToSegment(opening);
      if (!openingSegment) continue;
      openingSegment = this._projectOpeningToBoundary(
        openingSegment,
        wallSegments,
        opening,
        epsilon
      );

      const nextWalls = [];

      for (const wall of wallSegments) {
        if (!this._segmentsAreCollinear(wall, openingSegment, epsilon)) {
          nextWalls.push(wall);
          continue;
        }

        const overlap = this._collinearOverlap(wall, openingSegment, epsilon);
        if (!overlap) {
          nextWalls.push(wall);
          continue;
        }

        nextWalls.push(...this._subtractSegment(wall, overlap, epsilon));
      }

      wallSegments = nextWalls;

      if (!this._isOpenPassage(opening)) {
        doorSegments.push({
          ...openingSegment,
          opening
        });
      }
    }

    return {
      wallSegments: this._deduplicateSegments(wallSegments, epsilon),
      doorSegments: this._deduplicateDoorSegments(doorSegments, epsilon)
    };
  }

  static _projectOpeningToBoundary(segment, walls, opening, epsilon) {
    // Declared hallway openings already use the exact finalized room edge.
    // Do not re-project them onto another nearby wall segment.
    if (opening?.exactFaceRequired === true) {
      return segment;
    }

    const orientation = opening.orientation ||
      ((opening.face === "EAST" || opening.face === "WEST") ? "VERTICAL" : "HORIZONTAL");
    const hostCandidates = opening.hostId
      ? walls.filter(wall => wall.sectorId === opening.hostId)
      : [];
    const candidates = hostCandidates.length ? hostCandidates : walls;
    let best = null;

    for (const wall of candidates) {
      const wallOrientation = Math.abs(wall.x2 - wall.x1) <= epsilon
        ? "VERTICAL"
        : "HORIZONTAL";
      if (wallOrientation !== orientation) continue;
      const projected = wallOrientation === "VERTICAL"
        ? {
            x: wall.x1,
            y: Math.max(Math.min(wall.y1, wall.y2), Math.min(Math.max(wall.y1, wall.y2), opening.location.y))
          }
        : {
            x: Math.max(Math.min(wall.x1, wall.x2), Math.min(Math.max(wall.x1, wall.x2), opening.location.x)),
            y: wall.y1
          };
      const distance = Math.hypot(
        projected.x - opening.location.x,
        projected.y - opening.location.y
      );
      if (!best || distance < best.distance) best = { wall, projected, distance };
    }
    if (!best) return segment;

    const wallLength = this._segmentLength(best.wall);
    const width = Math.min(Math.max(1, Number(opening.width) || 200), wallLength);
    const half = width / 2;

    if (orientation === "VERTICAL") {
      const minimum = Math.min(best.wall.y1, best.wall.y2);
      const maximum = Math.max(best.wall.y1, best.wall.y2);
      const center = minimum + half <= maximum - half
        ? Math.max(minimum + half, Math.min(maximum - half, best.projected.y))
        : (minimum + maximum) / 2;
      opening.location = { x: best.wall.x1, y: center };
      return { x1: best.wall.x1, y1: center - half, x2: best.wall.x1, y2: center + half };
    }

    const minimum = Math.min(best.wall.x1, best.wall.x2);
    const maximum = Math.max(best.wall.x1, best.wall.x2);
    const center = minimum + half <= maximum - half
      ? Math.max(minimum + half, Math.min(maximum - half, best.projected.x))
      : (minimum + maximum) / 2;
    opening.location = { x: center, y: best.wall.y1 };
    return { x1: center - half, y1: best.wall.y1, x2: center + half, y2: best.wall.y1 };
  }

  static _openingToSegment(opening) {
    if (!opening?.location) return null;

    const width = Math.max(1, Number(opening.width) || 200);
    const halfWidth = width / 2;
    const orientation = opening.orientation ||
      ((opening.face === "EAST" || opening.face === "WEST")
        ? "VERTICAL"
        : "HORIZONTAL");

    if (orientation === "VERTICAL") {
      return {
        x1: opening.location.x,
        y1: opening.location.y - halfWidth,
        x2: opening.location.x,
        y2: opening.location.y + halfWidth
      };
    }

    return {
      x1: opening.location.x - halfWidth,
      y1: opening.location.y,
      x2: opening.location.x + halfWidth,
      y2: opening.location.y
    };
  }

  static _collinearOverlap(first, second, epsilon) {
    if (!this._segmentsAreCollinear(first, second, epsilon)) return null;

    const horizontal = Math.abs(first.y2 - first.y1) <= epsilon;

    if (horizontal) {
      const start = Math.max(
        Math.min(first.x1, first.x2),
        Math.min(second.x1, second.x2)
      );
      const end = Math.min(
        Math.max(first.x1, first.x2),
        Math.max(second.x1, second.x2)
      );

      if (end - start <= epsilon) return null;

      return {
        x1: start,
        y1: first.y1,
        x2: end,
        y2: first.y1
      };
    }

    const start = Math.max(
      Math.min(first.y1, first.y2),
      Math.min(second.y1, second.y2)
    );
    const end = Math.min(
      Math.max(first.y1, first.y2),
      Math.max(second.y1, second.y2)
    );

    if (end - start <= epsilon) return null;

    return {
      x1: first.x1,
      y1: start,
      x2: first.x1,
      y2: end
    };
  }

  static _subtractSegment(segment, overlap, epsilon) {
    const firstParameter = this._parameterOnSegment(
      segment,
      { x: overlap.x1, y: overlap.y1 },
      epsilon
    );
    const secondParameter = this._parameterOnSegment(
      segment,
      { x: overlap.x2, y: overlap.y2 },
      epsilon
    );
    const minimum = Math.max(0, Math.min(firstParameter, secondParameter));
    const maximum = Math.min(1, Math.max(firstParameter, secondParameter));
    const output = [];

    if (minimum > epsilon) {
      output.push(this._segmentBetweenParameters(segment, 0, minimum));
    }

    if (maximum < 1 - epsilon) {
      output.push(this._segmentBetweenParameters(segment, maximum, 1));
    }

    return output;
  }

  static _createWallData(segment, config, index = 0) {
    return {
      c: [segment.x1, segment.y1, segment.x2, segment.y2],
      move: config.move,
      sight: config.sight,
      sound: config.sound,
      light: config.light,
      door: 0,
      ds: 0,
      flags: this._withWallHeightFlags(
        CartographerMetadata.createExteriorWallFlags({
        segment,
        index,
        generationId: config.generationId,
        manifestId: config.manifestId
      }),
        config
      )
    };
  }
  static _createDoorData(segment, config, index = 0) {
    const opening = segment.opening || {};
    const secret = this._isSecretDoor(opening);
    const locked = this._isLockedDoor(opening);

    return {
      c: [segment.x1, segment.y1, segment.x2, segment.y2],
      move: config.move,
      sight: config.sight,
      sound: config.sound,
      light: config.light,
      door: secret ? this._secretDoorType() : this._normalDoorType(),
      ds: locked ? this._lockedDoorState() : this._closedDoorState(),
      flags: this._withWallHeightFlags(
        CartographerMetadata.createDoorFlags({
        opening,
        segment,
        generationId: config.generationId,
        manifestId: config.manifestId,
        index
      }),
        config
      )
    };
  }
  static _withWallHeightFlags(flags, config = {}) {
    const shouldApply = config.applyWallHeight === true ||
      config.wallHeightBottom !== null ||
      config.wallHeightTop !== null;
    if (!shouldApply) return flags;
    return {
      ...flags,
      "wall-height": {
        bottom: Number(config.wallHeightBottom ?? 0),
        top: Number(config.wallHeightTop ?? 10)
      }
    };
  }

  static _isOpenPassage(opening) {
    const connectionType = String(opening.connectionType || "").toUpperCase();
    const doorType = String(opening.doorType || "").toUpperCase();

    return [
      "ARCHWAY",
      "ROOM_TO_ROOM",
      "OPENING",
      "COLLAPSED_OPENING",
      "NONE"
    ].includes(connectionType) || [
      "ARCHWAY",
      "OPEN",
      "NONE"
    ].includes(doorType);
  }

  static _isSecretDoor(opening) {
    return (
      String(opening.connectionType || "").toUpperCase() === "SECRET_DOOR" ||
      String(opening.doorType || "").toUpperCase() === "SECRET"
    );
  }

  static _isLockedDoor(opening) {
    return (
      String(opening.connectionType || "").toUpperCase() === "LOCKED_DOOR" ||
      String(opening.doorType || "").toUpperCase() === "LOCKED"
    );
  }

  static _normalDoorType() {
    return globalThis.CONST?.WALL_DOOR_TYPES?.DOOR ?? 1;
  }

  static _secretDoorType() {
    return globalThis.CONST?.WALL_DOOR_TYPES?.SECRET ?? 2;
  }

  static _closedDoorState() {
    return globalThis.CONST?.WALL_DOOR_STATES?.CLOSED ?? 0;
  }

  static _lockedDoorState() {
    return globalThis.CONST?.WALL_DOOR_STATES?.LOCKED ?? 2;
  }

  static _deduplicateOpenings(openings, epsilon) {
    const unique = new Map();

    for (const opening of openings) {
      const segment = this._openingToSegment(opening);
      if (!segment) continue;
      const key = this._segmentKey(segment, epsilon);

      if (!unique.has(key)) {
        unique.set(key, opening);
        continue;
      }

      const existing = unique.get(key);
      if (this._doorPriority(opening) > this._doorPriority(existing)) {
        unique.set(key, opening);
      }
    }

    return [...unique.values()];
  }

  static _deduplicateDoorSegments(segments, epsilon) {
    const unique = new Map();

    for (const segment of segments) {
      const key = this._segmentKey(segment, epsilon);
      if (!unique.has(key)) {
        unique.set(key, segment);
        continue;
      }

      const existing = unique.get(key);
      if (
        this._doorPriority(segment.opening) >
        this._doorPriority(existing.opening)
      ) {
        unique.set(key, segment);
      }
    }

    return [...unique.values()];
  }

  static _doorPriority(opening = {}) {
    if (this._isSecretDoor(opening)) return 3;
    if (this._isLockedDoor(opening)) return 2;
    if (this._isOpenPassage(opening)) return 0;
    return 1;
  }

  static async clear(
    scene = canvas.scene,
    options = {}
  ) {
    if (!scene) return;

    const requestedTypes = Array.isArray(options.documentTypes)
      ? new Set(options.documentTypes)
      : null;

    const ids = scene.walls.contents
      .filter(wall => {
        if (!CartographerMetadata.isCartographerDocument(wall)) {
          return false;
        }

        if (!requestedTypes) {
          return true;
        }

        const type =
          CartographerMetadata.get(wall)?.documentType ||
          wall.flags?.["ai-director"]?.cartographerType;

        return requestedTypes.has(type);
      })
      .map(wall => wall.id);

    if (!ids.length) return;

    await scene.deleteEmbeddedDocuments(
      "Wall",
      ids
    );

    ui.notifications.info(
      "Cartographer walls cleared."
    );
  }
  static _isValidRectangle(rectangle) {
    return Boolean(
      rectangle &&
      Number.isFinite(rectangle.x) &&
      Number.isFinite(rectangle.y) &&
      Number.isFinite(rectangle.width) &&
      Number.isFinite(rectangle.height) &&
      rectangle.width > 0 &&
      rectangle.height > 0
    );
  }

  static _getSectors(layoutResult) {
    const sectors = [];

    for (const floor of Object.values(layoutResult?.floors || {})) {
      if (!Array.isArray(floor?.sectors)) continue;
      sectors.push(...floor.sectors);
    }

    return sectors;
  }

  static _buildRoomGeometry(sector, normalizedTopology) {
    if (sector?.suppressWalls === true || sector?.renderAsOpenArea === true) return null;
    const bounds = sector.bounds || sector.pixelBounds;
    if (!bounds) return null;

    const shapeType = CartographerRoomRenderer.getShapeType
      ? CartographerRoomRenderer.getShapeType(sector)
      : this._getShapeType(sector);

    const gridSize = normalizedTopology.gridSize || 100;

    const polygon = ShapePrimitiveGenerator.generatePolygon(
      bounds,
      shapeType,
      gridSize
    );

    if (!Array.isArray(polygon) || polygon.length < 3) {
      return null;
    }

    return {
      sectorId: sector.sectorId,
      polygon
    };
  }

  static _getShapeType(sector) {
    if (sector.shapeType) {
      return String(sector.shapeType).toUpperCase();
    }

    switch (String(sector.graphRole || "").toUpperCase()) {
      case "OBJECTIVE":
        return "OCTAGON";
      case "HUB":
        return "CROSS";
      case "OPTIONAL":
        return "L_SHAPE";
      case "SECRET":
        return "T_SHAPE";
      default:
        return "RECTANGLE";
    }
  }

  static _polygonToSegments(polygon) {
    const segments = [];

    for (let index = 0; index < polygon.length; index++) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];

      segments.push({
        x1: start[0],
        y1: start[1],
        x2: end[0],
        y2: end[1]
      });
    }

    return segments;
  }

  static _buildRectangleUnionBoundary(rectangles, epsilon) {
    const rawEdges = [];

    for (const rectangle of rectangles) {
      const left = rectangle.x;
      const right = rectangle.x + rectangle.width;
      const top = rectangle.y;
      const bottom = rectangle.y + rectangle.height;

      rawEdges.push(
        { x1: left, y1: top, x2: right, y2: top },
        { x1: right, y1: top, x2: right, y2: bottom },
        { x1: right, y1: bottom, x2: left, y2: bottom },
        { x1: left, y1: bottom, x2: left, y2: top }
      );
    }

    const atomicEdges = [];

    for (const edge of rawEdges) {
      const splitValues = new Set([0, 1]);

      for (const other of rawEdges) {
        if (!this._segmentsAreCollinear(edge, other, epsilon)) continue;

        for (const point of [
          { x: other.x1, y: other.y1 },
          { x: other.x2, y: other.y2 }
        ]) {
          const parameter = this._parameterOnSegment(edge, point, epsilon);
          if (parameter > epsilon && parameter < 1 - epsilon) {
            splitValues.add(parameter);
          }
        }
      }

      const values = [...splitValues].sort((first, second) => first - second);

      for (let index = 0; index < values.length - 1; index++) {
        atomicEdges.push(
          this._segmentBetweenParameters(
            edge,
            values[index],
            values[index + 1]
          )
        );
      }
    }

    const counts = new Map();
    const representatives = new Map();

    for (const edge of atomicEdges) {
      const key = this._segmentKey(edge, epsilon);
      counts.set(key, (counts.get(key) || 0) + 1);
      representatives.set(key, edge);
    }

    return [...counts.entries()]
      .filter(([, count]) => count % 2 === 1)
      .map(([key]) => representatives.get(key));
  }

  static _splitSegmentByRectangles(segment, rectangles, epsilon) {
    const values = new Set([0, 1]);

    for (const rectangle of rectangles) {
      const edges = this._rectangleEdges(rectangle);

      for (const edge of edges) {
        const intersections = this._segmentIntersections(segment, edge, epsilon);
        for (const point of intersections) {
          const parameter = this._parameterOnSegment(segment, point, epsilon);
          if (parameter > epsilon && parameter < 1 - epsilon) {
            values.add(parameter);
          }
        }
      }
    }

    return this._splitSegmentAtParameters(segment, values);
  }

  static _splitSegmentByPolygons(segment, polygons, epsilon) {
    const values = new Set([0, 1]);

    for (const polygon of polygons) {
      for (const edge of this._polygonToSegments(polygon)) {
        const intersections = this._segmentIntersections(segment, edge, epsilon);
        for (const point of intersections) {
          const parameter = this._parameterOnSegment(segment, point, epsilon);
          if (parameter > epsilon && parameter < 1 - epsilon) {
            values.add(parameter);
          }
        }
      }
    }

    return this._splitSegmentAtParameters(segment, values);
  }

  static _splitSegmentAtParameters(segment, values) {
    const sorted = [...values].sort((first, second) => first - second);
    const pieces = [];

    for (let index = 0; index < sorted.length - 1; index++) {
      pieces.push(
        this._segmentBetweenParameters(
          segment,
          sorted[index],
          sorted[index + 1]
        )
      );
    }

    return pieces;
  }

  static _segmentBetweenParameters(segment, first, second) {
    return {
      x1: segment.x1 + (segment.x2 - segment.x1) * first,
      y1: segment.y1 + (segment.y2 - segment.y1) * first,
      x2: segment.x1 + (segment.x2 - segment.x1) * second,
      y2: segment.y1 + (segment.y2 - segment.y1) * second
    };
  }

  static _rectangleEdges(rectangle) {
    const left = rectangle.x;
    const right = rectangle.x + rectangle.width;
    const top = rectangle.y;
    const bottom = rectangle.y + rectangle.height;

    return [
      { x1: left, y1: top, x2: right, y2: top },
      { x1: right, y1: top, x2: right, y2: bottom },
      { x1: right, y1: bottom, x2: left, y2: bottom },
      { x1: left, y1: bottom, x2: left, y2: top }
    ];
  }

  static _segmentIntersections(first, second, epsilon) {
    const p = { x: first.x1, y: first.y1 };
    const r = { x: first.x2 - first.x1, y: first.y2 - first.y1 };
    const q = { x: second.x1, y: second.y1 };
    const s = { x: second.x2 - second.x1, y: second.y2 - second.y1 };
    const crossRS = this._cross(r, s);
    const qMinusP = { x: q.x - p.x, y: q.y - p.y };
    const crossQPR = this._cross(qMinusP, r);

    if (Math.abs(crossRS) <= epsilon && Math.abs(crossQPR) <= epsilon) {
      const points = [];
      for (const point of [
        { x: second.x1, y: second.y1 },
        { x: second.x2, y: second.y2 },
        { x: first.x1, y: first.y1 },
        { x: first.x2, y: first.y2 }
      ]) {
        if (
          this._pointOnSegment(point, first, epsilon) &&
          this._pointOnSegment(point, second, epsilon)
        ) {
          points.push(point);
        }
      }
      return this._uniquePoints(points, epsilon);
    }

    if (Math.abs(crossRS) <= epsilon) return [];

    const t = this._cross(qMinusP, s) / crossRS;
    const u = this._cross(qMinusP, r) / crossRS;

    if (
      t < -epsilon ||
      t > 1 + epsilon ||
      u < -epsilon ||
      u > 1 + epsilon
    ) {
      return [];
    }

    return [{
      x: p.x + t * r.x,
      y: p.y + t * r.y
    }];
  }

  static _segmentsAreCollinear(first, second, epsilon) {
    const firstVector = {
      x: first.x2 - first.x1,
      y: first.y2 - first.y1
    };
    const pointVector = {
      x: second.x1 - first.x1,
      y: second.y1 - first.y1
    };

    return (
      Math.abs(this._cross(firstVector, {
        x: second.x2 - second.x1,
        y: second.y2 - second.y1
      })) <= epsilon &&
      Math.abs(this._cross(firstVector, pointVector)) <= epsilon
    );
  }

  static _parameterOnSegment(segment, point, epsilon) {
    const deltaX = segment.x2 - segment.x1;
    const deltaY = segment.y2 - segment.y1;

    if (Math.abs(deltaX) >= Math.abs(deltaY) && Math.abs(deltaX) > epsilon) {
      return (point.x - segment.x1) / deltaX;
    }

    if (Math.abs(deltaY) > epsilon) {
      return (point.y - segment.y1) / deltaY;
    }

    return 0;
  }

  static _pointOnSegment(point, segment, epsilon) {
    const cross = this._cross(
      { x: point.x - segment.x1, y: point.y - segment.y1 },
      { x: segment.x2 - segment.x1, y: segment.y2 - segment.y1 }
    );

    if (Math.abs(cross) > epsilon) return false;

    return (
      point.x >= Math.min(segment.x1, segment.x2) - epsilon &&
      point.x <= Math.max(segment.x1, segment.x2) + epsilon &&
      point.y >= Math.min(segment.y1, segment.y2) - epsilon &&
      point.y <= Math.max(segment.y1, segment.y2) + epsilon
    );
  }

  static _pointInAnyRectangle(point, rectangles, includeBoundary, epsilon) {
    return rectangles.some(rectangle =>
      this._pointInRectangle(point, rectangle, includeBoundary, epsilon)
    );
  }

  static _pointInRectangle(point, rectangle, includeBoundary, epsilon) {
    const left = rectangle.x;
    const right = rectangle.x + rectangle.width;
    const top = rectangle.y;
    const bottom = rectangle.y + rectangle.height;

    if (includeBoundary) {
      return (
        point.x >= left - epsilon &&
        point.x <= right + epsilon &&
        point.y >= top - epsilon &&
        point.y <= bottom + epsilon
      );
    }

    return (
      point.x > left + epsilon &&
      point.x < right - epsilon &&
      point.y > top + epsilon &&
      point.y < bottom - epsilon
    );
  }

  static _pointInAnyPolygon(point, polygons, includeBoundary, epsilon) {
    return polygons.some(polygon =>
      this._pointInPolygon(point, polygon, includeBoundary, epsilon)
    );
  }

  static _pointInPolygon(point, polygon, includeBoundary, epsilon) {
    for (const edge of this._polygonToSegments(polygon)) {
      if (this._pointOnSegment(point, edge, epsilon)) {
        return includeBoundary;
      }
    }

    let inside = false;

    for (
      let first = 0, second = polygon.length - 1;
      first < polygon.length;
      second = first++
    ) {
      const firstPoint = polygon[first];
      const secondPoint = polygon[second];

      const intersects =
        ((firstPoint[1] > point.y) !== (secondPoint[1] > point.y)) &&
        (
          point.x <
          (secondPoint[0] - firstPoint[0]) *
          (point.y - firstPoint[1]) /
          (secondPoint[1] - firstPoint[1]) +
          firstPoint[0]
        );

      if (intersects) inside = !inside;
    }

    return inside;
  }

  /**
   * Split collinear room edges at every endpoint before deduplication. This
   * preserves one physical internal wall when differently sized rooms share
   * only part of an edge and allows one shared-wall opening to cut it cleanly.
   */
  static _normalizeCollinearSegments(segments, epsilon) {
    const output = [];

    for (const segment of segments) {
      const values = new Set([0, 1]);
      for (const other of segments) {
        if (!this._segmentsAreCollinear(segment, other, epsilon)) continue;
        for (const point of [
          { x: other.x1, y: other.y1 },
          { x: other.x2, y: other.y2 }
        ]) {
          if (!this._pointOnSegment(point, segment, epsilon)) continue;
          const value = this._parameterOnSegment(segment, point, epsilon);
          if (value > epsilon && value < 1 - epsilon) values.add(value);
        }
      }
      output.push(...this._splitSegmentAtParameters(segment, values));
    }

    return this._deduplicateSegments(output, epsilon);
  }

  static _deduplicateSegments(segments, epsilon) {
    const unique = new Map();

    for (const segment of segments) {
      const key = this._segmentKey(segment, epsilon);
      if (!unique.has(key)) unique.set(key, segment);
    }

    return [...unique.values()];
  }

  static _segmentKey(segment, epsilon) {
    const precision = Math.max(0, Math.ceil(-Math.log10(epsilon)));
    const first = [
      Number(segment.x1.toFixed(precision)),
      Number(segment.y1.toFixed(precision))
    ];
    const second = [
      Number(segment.x2.toFixed(precision)),
      Number(segment.y2.toFixed(precision))
    ];

    const ordered =
      first[0] < second[0] ||
      (first[0] === second[0] && first[1] <= second[1])
        ? [first, second]
        : [second, first];

    return `${ordered[0][0]},${ordered[0][1]}:${ordered[1][0]},${ordered[1][1]}`;
  }

  static _segmentMidpoint(segment) {
    return {
      x: (segment.x1 + segment.x2) / 2,
      y: (segment.y1 + segment.y2) / 2
    };
  }

  static _segmentLength(segment) {
    return Math.hypot(
      segment.x2 - segment.x1,
      segment.y2 - segment.y1
    );
  }

  static _cross(first, second) {
    return first.x * second.y - first.y * second.x;
  }

  static _uniquePoints(points, epsilon) {
    const unique = [];

    for (const point of points) {
      if (
        unique.some(existing =>
          Math.abs(existing.x - point.x) <= epsilon &&
          Math.abs(existing.y - point.y) <= epsilon
        )
      ) {
        continue;
      }

      unique.push(point);
    }

    return unique;
  }
}
