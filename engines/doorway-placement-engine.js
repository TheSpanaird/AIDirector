// doorway-placement-engine.js
// AI Director Cartographer Alpha 0.1
// FILE: /modules/ai-director/scripts/cartographer/doorway-placement-engine.js
// Plans room, corridor, and junction openings before wall generation.
// Shared room trunks receive one physical doorway; destination door semantics remain local.

export class DoorwayPlacementEngine {

  static CONFIG = {
    doorWidth: 200,
    doorSpacing: 200,
    gridSize: 100,
    sharedDoorType: "STANDARD",
    sharedConnectionType: "STANDARD_DOOR"
  };

  static plan(routes = [], normalizedTopology = {}, sectors = [], customConfig = {}) {
    const config = { ...this.CONFIG, ...customConfig };
    config.gridSize = Math.max(1, Number(config.gridSize) || 100);
    config.doorWidth = this._snapSize(config.doorWidth, config.gridSize);
    config.doorSpacing = this._snapSize(config.doorSpacing, config.gridSize);
    config.sharedDoorType = this._normalizeDoorType(config.sharedDoorType);
    config.sharedConnectionType = this._normalizeConnectionType(
      config.sharedConnectionType
    );

    const directConnections = customConfig.directConnections || [];
    const directPairs = new Set(directConnections.map(connection =>
      [connection.sourceId, connection.targetId].sort().join(":")
    ));
    const routedOnly = routes.filter(route =>
      !directPairs.has([route.sourceId, route.targetId].sort().join(":"))
    );
    const candidates = [
      ...this.extractRoomOpenings(routedOnly, config, sectors),
      ...this.extractSharedWallOpenings(
        directConnections,
        config
      ),
      ...this.extractCorridorOpenings(sectors, normalizedTopology, config)
    ];

    const validCandidates = candidates.filter(opening =>
      opening?.location &&
      Number.isFinite(Number(opening.location.x)) &&
      Number.isFinite(Number(opening.location.y)) &&
      Number(opening.width) > 0
    );
    const openings = this.resolveOverlaps(validCandidates, config);

    return {
      roomOpenings: openings.filter(opening => opening.hostType === "ROOM"),
      corridorOpenings: openings.filter(opening => opening.hostType === "CORRIDOR"),
      junctionOpenings: openings.filter(opening => opening.hostType === "JUNCTION"),
      openings
    };
  }

  static determineFace(sourcePoint, targetPoint) {
    const deltaX = targetPoint.x - sourcePoint.x;
    const deltaY = targetPoint.y - sourcePoint.y;

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      return deltaX >= 0 ? "EAST" : "WEST";
    }

    return deltaY >= 0 ? "SOUTH" : "NORTH";
  }

  static extractDoorways(routes = [], customConfig = {}) {
    return this.extractRoomOpenings(routes, {
      ...this.CONFIG,
      ...customConfig
    });
  }

  static extractRoomOpenings(routes = [], config = this.CONFIG, sectors = []) {
    const openings = [];
    const sectorById = new Map(
      sectors.map(sector => [sector.sectorId, sector])
    );

    for (const route of routes) {
      if (!route?.anchors?.start || !route?.anchors?.end) continue;

      openings.push(this._createRoomOpening({
        id: `${route.sourceId}:${route.targetId}:start`,
        sourceId: route.sourceId,
        targetId: route.targetId,
        route,
        hostId: route.sourceId,
        location: route.anchors.start,
        face: route.anchors.startFace,
        isShared: route.anchors.startShared === true,
        sector: sectorById.get(route.sourceId) || null,
        config
      }));

      if (!route.targetIsCirculation) openings.push(this._createRoomOpening({
        id: `${route.sourceId}:${route.targetId}:end`,
        sourceId: route.targetId,
        targetId: route.sourceId,
        route,
        hostId: route.targetId,
        location: route.anchors.end,
        face: route.anchors.endFace,
        isShared: route.anchors.endShared === true,
        sector: sectorById.get(route.targetId) || null,
        config
      }));
    }

    return openings;
  }

  static _createRoomOpening({
    id,
    sourceId,
    targetId,
    route,
    hostId,
    location,
    face,
    isShared,
    sector = null,
    config
  }) {
    const originalConnectionType = this._normalizeConnectionType(
      route.connectionType || "CORRIDOR"
    );
    const originalDoorType = this._normalizeDoorType(
      route.doorType || "STANDARD"
    );
    const declared = route.targetIsCirculation
      ? this._declaredHallwayOpening(sector, config)
      : null;
    const resolvedLocation = declared?.location || location;
    const resolvedFace = declared?.face || face;

    return {
      id,
      sourceId,
      targetId,
      connectionType: isShared
        ? config.sharedConnectionType
        : originalConnectionType,
      doorType: isShared
        ? config.sharedDoorType
        : originalDoorType,
      originalConnectionType,
      originalDoorType,
      sharedAnchor: isShared,
      hostType: "ROOM",
      hostId,
      hallwayHostId: declared?.hostId || null,
      declaredHallwayFace: declared?.face || null,
      exactFaceRequired: Boolean(declared),
      location: {
        x: Number(resolvedLocation.x),
        y: Number(resolvedLocation.y)
      },
      requestedLocation: {
        x: Number(resolvedLocation.x),
        y: Number(resolvedLocation.y)
      },
      face: resolvedFace,
      orientation: this._doorOrientationForFace(resolvedFace),
      width: Math.max(
        config.gridSize,
        Number(route.corridorWidth) ||
        config.doorWidth ||
        this.CONFIG.doorWidth
      ),
      alignedToRoute: true
    };
  }

  static _declaredHallwayOpening(sector, config = this.CONFIG) {
    const access = sector?.hallwayAccess;
    const bounds = sector?.pixelBounds || sector?.bounds;
    if (!access?.face || !bounds) return null;

    const face = String(access.face).toUpperCase();
    const ratio = Math.max(
      0.2,
      Math.min(0.8, Number(access.offsetRatio) || 0.5)
    );
    const half = (config.doorWidth || this.CONFIG.doorWidth) / 2;
    const clamp = (value, minimum, maximum) =>
      minimum <= maximum
        ? Math.max(minimum, Math.min(maximum, value))
        : (minimum + maximum) / 2;

    let location;
    if (face === "EAST" || face === "WEST") {
      location = {
        x: face === "EAST" ? bounds.x + bounds.width : bounds.x,
        y: clamp(
          bounds.y + bounds.height * ratio,
          bounds.y + half,
          bounds.y + bounds.height - half
        )
      };
    } else {
      location = {
        x: clamp(
          bounds.x + bounds.width * ratio,
          bounds.x + half,
          bounds.x + bounds.width - half
        ),
        y: face === "SOUTH" ? bounds.y + bounds.height : bounds.y
      };
    }

    return {
      hostId: access.hostId || sector.hallwayHostId || "primary-hall",
      face,
      location
    };
  }

  static extractSharedWallOpenings(connections = [], config = this.CONFIG) {
    const openings = [];

    for (const connection of connections) {
      const wall = connection?.sharedWall;
      if (!wall?.location) continue;

      openings.push({
        id: `${connection.sourceId}:${connection.targetId}:shared-wall`,
        sourceId: connection.sourceId,
        targetId: connection.targetId,
        connectionType: "SHARED_WALL",
        doorType: this._normalizeDoorType(
          connection.doorType || config.sharedDoorType || "STANDARD"
        ),
        originalConnectionType: this._normalizeConnectionType(
          connection.connectionType || "SHARED_WALL"
        ),
        originalDoorType: this._normalizeDoorType(
          connection.doorType || "STANDARD"
        ),
        sharedAnchor: true,
        sharedDoor: true,
        hostType: "ROOM",
        hostId: connection.sourceId,
        location: { ...wall.location },
        face: wall.sourceFace,
        orientation: wall.orientation,
        width: Math.min(
          config.doorWidth || this.CONFIG.doorWidth,
          wall.length
        ),
        connectedTargets: [connection.targetId],
        connectedSources: [connection.sourceId],
        connectionIds: [
          `${connection.sourceId}:${connection.targetId}:shared-wall`
        ],
        connectionCount: 1
      });
    }

    return openings;
  }

  static extractCorridorOpenings(
    sectors = [],
    normalizedTopology = {},
    config = this.CONFIG
  ) {
    const openings = [];
    const rectangles = Array.isArray(normalizedTopology.rectangles)
      ? normalizedTopology.rectangles
      : [];
    const junctions = Array.isArray(normalizedTopology.junctions)
      ? normalizedTopology.junctions
      : [];

    for (const sector of sectors) {
      if (!Array.isArray(sector.connections)) continue;

      for (let index = 0; index < sector.connections.length; index++) {
        const connection = sector.connections[index];
        const hostType = String(
          connection.hostType ||
          connection.doorway?.hostType ||
          "ROOM"
        ).toUpperCase();

        if (hostType !== "CORRIDOR" && hostType !== "JUNCTION") continue;

        const requested = connection.location || connection.doorway?.location;
        if (!requested) continue;

        const host = hostType === "JUNCTION"
          ? this._findNearestJunction(requested, junctions)
          : this._findNearestCorridorBoundary(requested, rectangles);

        if (!host) continue;

        const targetId =
          connection.to ||
          connection.targetId ||
          connection.targetSectorId ||
          sector.sectorId;

        openings.push({
          id: `${sector.sectorId}:${targetId}:${hostType}:${index}`,
          sourceId: sector.sectorId,
          targetId,
          connectionType: this._normalizeConnectionType(
            connection.connectionType || "SECRET_DOOR"
          ),
          doorType: this._normalizeDoorType(
            connection.doorType || "SECRET"
          ),
          sharedAnchor: false,
          hostType,
          hostId: connection.hostId || connection.doorway?.hostId || host.id,
          location: { ...host.location },
          face: host.face,
          orientation: host.orientation,
          width: config.doorWidth || this.CONFIG.doorWidth
        });
      }
    }

    return openings;
  }

  static resolveOverlaps(openings = [], customConfig = {}) {
    const config = { ...this.CONFIG, ...customConfig };
    const physicalGroups = new Map();

    for (const opening of openings) {
      if (!opening?.location) continue;

      const key = this._physicalOpeningKey(opening);
      if (!physicalGroups.has(key)) physicalGroups.set(key, []);
      physicalGroups.get(key).push(opening);
    }

    const resolved = [];

    for (const physicalGroup of physicalGroups.values()) {
      if (physicalGroup.some(opening => opening.sharedAnchor === true)) {
        resolved.push(this._consolidateSharedOpening(physicalGroup, config));
        continue;
      }

      const semanticGroups = new Map();

      for (const opening of physicalGroup) {
        const profile = this._doorProfileKey(opening);
        if (!semanticGroups.has(profile)) semanticGroups.set(profile, []);
        semanticGroups.get(profile).push(opening);
      }

      for (const semanticGroup of semanticGroups.values()) {
        resolved.push(this._consolidateMatchingOpenings(semanticGroup));
      }
    }

    return resolved;
  }

  static _consolidateSharedOpening(openings = [], config = this.CONFIG) {
    const primary = structuredClone(openings[0]);

    primary.connectionType = this._normalizeConnectionType(
      config.sharedConnectionType || "STANDARD_DOOR"
    );
    primary.doorType = this._normalizeDoorType(
      config.sharedDoorType || "STANDARD"
    );
    primary.sharedAnchor = true;
    primary.sharedDoor = true;
    primary.mixedDoorGroup = false;
    primary.originalDoorProfiles = [
      ...new Set(openings.map(opening => [
        this._normalizeConnectionType(
          opening.originalConnectionType || opening.connectionType
        ),
        this._normalizeDoorType(
          opening.originalDoorType || opening.doorType
        )
      ].join(":")))
    ];
    primary.connectedTargets = [
      ...new Set(openings.map(opening => opening.targetId).filter(Boolean))
    ];
    primary.connectedSources = [
      ...new Set(openings.map(opening => opening.sourceId).filter(Boolean))
    ];
    primary.connectionIds = [
      ...new Set(openings.map(opening => opening.id).filter(Boolean))
    ];
    primary.connectionCount = openings.length;

    return primary;
  }

  static _consolidateMatchingOpenings(openings = []) {
    const primary = structuredClone(openings[0]);

    primary.connectedTargets = [
      ...new Set(openings.map(opening => opening.targetId).filter(Boolean))
    ];
    primary.connectedSources = [
      ...new Set(openings.map(opening => opening.sourceId).filter(Boolean))
    ];
    primary.connectionIds = [
      ...new Set(openings.map(opening => opening.id).filter(Boolean))
    ];
    primary.connectionCount = openings.length;
    primary.connectionType = this._normalizeConnectionType(
      primary.connectionType
    );
    primary.doorType = this._normalizeDoorType(primary.doorType);

    return primary;
  }

  static _physicalOpeningKey(opening) {
    return [
      opening.hostType,
      opening.hostId,
      opening.face,
      opening.location.x,
      opening.location.y,
      opening.orientation,
      opening.width
    ].join(":");
  }

  static _doorProfileKey(opening) {
    return [
      this._normalizeConnectionType(opening.connectionType),
      this._normalizeDoorType(opening.doorType)
    ].join(":");
  }

  static _normalizeConnectionType(value) {
    return String(value || "CORRIDOR").toUpperCase();
  }

  static _normalizeDoorType(value) {
    return String(value || "STANDARD").toUpperCase();
  }

  static attachToSectors(sectors = [], openings = []) {
    for (const sector of sectors) {
      sector.doorways = openings.filter(opening =>
        opening.hostType === "ROOM" &&
        opening.hostId === sector.sectorId
      );
    }

    return sectors;
  }

  static _findNearestCorridorBoundary(requested, rectangles) {
    let best = null;

    rectangles.forEach((rectangle, index) => {
      for (const edge of this._rectangleEdges(rectangle)) {
        const projected = this._projectPointToAxisEdge(requested, edge);
        const distance = Math.hypot(
          projected.x - requested.x,
          projected.y - requested.y
        );

        if (!best || distance < best.distance) {
          best = {
            id: `corridor-rectangle-${index}`,
            distance,
            face: edge.face,
            orientation: edge.orientation,
            location: projected
          };
        }
      }
    });

    return best;
  }

  static _findNearestJunction(requested, junctions) {
    let best = null;

    junctions.forEach((junction, index) => {
      const distance = Math.hypot(
        junction.x - requested.x,
        junction.y - requested.y
      );

      if (!best || distance < best.distance) {
        const face = this.determineFace(junction, requested);
        best = {
          id: `junction-${index}`,
          distance,
          face,
          orientation: this._doorOrientationForFace(face),
          location: {
            x: junction.x,
            y: junction.y
          }
        };
      }
    });

    return best;
  }

  static _rectangleEdges(rectangle) {
    const left = rectangle.x;
    const right = rectangle.x + rectangle.width;
    const top = rectangle.y;
    const bottom = rectangle.y + rectangle.height;

    return [
      { face: "NORTH", orientation: "HORIZONTAL", x1: left, y1: top, x2: right, y2: top },
      { face: "SOUTH", orientation: "HORIZONTAL", x1: left, y1: bottom, x2: right, y2: bottom },
      { face: "WEST", orientation: "VERTICAL", x1: left, y1: top, x2: left, y2: bottom },
      { face: "EAST", orientation: "VERTICAL", x1: right, y1: top, x2: right, y2: bottom }
    ];
  }

  static _projectPointToAxisEdge(point, edge) {
    if (edge.orientation === "VERTICAL") {
      return {
        x: edge.x1,
        y: this._clamp(
          point.y,
          Math.min(edge.y1, edge.y2),
          Math.max(edge.y1, edge.y2)
        )
      };
    }

    return {
      x: this._clamp(
        point.x,
        Math.min(edge.x1, edge.x2),
        Math.max(edge.x1, edge.x2)
      ),
      y: edge.y1
    };
  }

  static _doorOrientationForFace(face) {
    return face === "EAST" || face === "WEST"
      ? "VERTICAL"
      : "HORIZONTAL";
  }

  static _snapSize(value, gridSize) {
    return Math.max(
      gridSize,
      Math.round((Number(value) || gridSize) / gridSize) * gridSize
    );
  }

  static _clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }
}
