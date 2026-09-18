// boundary-feature-planner.js
// AI Director Cartographer Alpha 0.1
// FILE: /modules/ai-director/scripts/cartographer/boundary-feature-planner.js
// Plans polygon-aware non-door boundary features.

import { ShapePrimitiveGenerator }
  from "/modules/ai-director/scripts/cartographer/shape-primitive-generator.js";

export class BoundaryFeaturePlanner {
  static CONFIG = {
    gridSize: 100,
    defaultWidth: 100,
    featureSpacing: 100
  };

  static FEATURE_TYPES = {
    STANDARD_WALL: "STANDARD_WALL",
    TERRAIN_WALL: "TERRAIN_WALL",
    INVISIBLE_WALL: "INVISIBLE_WALL",
    ETHEREAL_WALL: "ETHEREAL_WALL",
    WINDOW_WALL: "WINDOW_WALL"
  };

  static HOST_TYPES = {
    ROOM: "ROOM",
    CORRIDOR: "CORRIDOR",
    JUNCTION: "JUNCTION"
  };

  static plan(sectors = [], normalizedTopology = {}, explicitFeatures = [], customConfig = {}) {
    const config = { ...this.CONFIG, ...customConfig };
    config.gridSize = Math.max(1, Number(config.gridSize) || 100);
    config.defaultWidth = this._snapSize(config.defaultWidth, config.gridSize);
    config.featureSpacing = this._snapSize(config.featureSpacing, config.gridSize);

    const declared = [
      ...this.extractSectorFeatures(sectors),
      ...(Array.isArray(explicitFeatures) ? explicitFeatures : [])
    ];

    const resolved = declared
      .map((feature, index) => this._resolveFeature(
        feature,
        index,
        sectors,
        normalizedTopology,
        config
      ))
      .filter(Boolean);

    const features = this.resolveOverlaps(resolved, config);

    return {
      features,
      roomFeatures: features.filter(feature => feature.hostType === "ROOM"),
      corridorFeatures: features.filter(feature => feature.hostType === "CORRIDOR"),
      junctionFeatures: features.filter(feature => feature.hostType === "JUNCTION"),
      windows: features.filter(feature => feature.featureType === "WINDOW_WALL")
    };
  }

  static extractSectorFeatures(sectors = []) {
    const output = [];

    for (const sector of sectors) {
      const declared = [
        ...(Array.isArray(sector.boundaryFeatures) ? sector.boundaryFeatures : []),
        ...(Array.isArray(sector.windows)
          ? sector.windows.map(feature => ({
              ...feature,
              featureType: feature.featureType || "WINDOW_WALL"
            }))
          : [])
      ];

      declared.forEach((feature, index) => output.push({
        ...feature,
        id: feature.id || `${sector.sectorId}:boundary:${index}`,
        sourceId: feature.sourceId || sector.sectorId,
        hostType: feature.hostType || "ROOM",
        hostId: feature.hostId || sector.sectorId
      }));
    }

    return output;
  }

  static resolveOverlaps(features = [], customConfig = {}) {
    const config = { ...this.CONFIG, ...customConfig };
    const groups = new Map();

    for (const feature of features) {
      const key = [
        feature.hostType,
        feature.hostId,
        feature.face,
        feature.location.x,
        feature.location.y,
        feature.orientation
      ].join(":");

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(feature);
    }

    const output = [];

    for (const group of groups.values()) {
      if (group.length === 1) {
        output.push(structuredClone(group[0]));
        continue;
      }

      const center = (group.length - 1) / 2;
      group.forEach((feature, index) => {
        const copy = structuredClone(feature);
        const offset = (index - center) * config.featureSpacing;

        if (copy.orientation === "VERTICAL") copy.location.y += offset;
        else copy.location.x += offset;

        output.push(copy);
      });
    }

    return output;
  }

  static _resolveFeature(feature, index, sectors, topology, config) {
    if (!feature) return null;

    const hostType = String(feature.hostType || "ROOM").toUpperCase();
    let host = null;

    if (hostType === "ROOM") {
      host = this._resolveRoomHost(feature, sectors, config);
    } else if (hostType === "CORRIDOR") {
      host = this._resolveCorridorHost(feature, topology, config);
    } else if (hostType === "JUNCTION") {
      host = this._resolveJunctionHost(feature, topology, config);
    }

    if (!host) {
      console.warn("Cartographer could not resolve boundary feature host.", feature);
      return null;
    }

    return {
      id: feature.id || `boundary-feature-${index}`,
      featureType: this._normalizeFeatureType(feature.featureType || feature.type),
      hostType,
      hostId: feature.hostId || host.hostId,
      sourceId: feature.sourceId || host.hostId,
      location: { ...host.location },
      face: host.face,
      orientation: host.orientation,
      width: this._snapSize(feature.width || config.defaultWidth, config.gridSize),
      direction: this._normalizeDirection(feature.direction),
      metadata: { ...(feature.metadata || {}) }
    };
  }

  static _resolveRoomHost(feature, sectors, config) {
    const sector = sectors.find(item => item.sectorId === feature.hostId);
    const bounds = sector?.bounds || sector?.pixelBounds;
    if (!sector || !bounds) return null;

    const polygon = ShapePrimitiveGenerator.generatePolygon(
      bounds,
      this._getShapeType(sector),
      config.gridSize
    );

    if (!Array.isArray(polygon) || polygon.length < 2) return null;

    const face = this._normalizeFace(feature.face || "NORTH");
    const edges = this._getPolygonFaceEdges(polygon, face);
    if (!edges.length) return null;

    const requested = feature.location || feature.position || null;
    const edge = this._selectPolygonEdge(edges, requested);
    const location = requested
      ? this._projectPointToEdge(requested, edge)
      : { ...edge.midpoint };

    return {
      hostId: sector.sectorId,
      location: this._snapPointOnEdge(location, edge, config.gridSize),
      face,
      orientation: edge.orientation
    };
  }

  static _getPolygonFaceEdges(polygon, face) {
    const edges = [];

    for (let index = 0; index < polygon.length; index++) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      const vertical = start[0] === end[0];
      const horizontal = start[1] === end[1];
      const compatible = (face === "EAST" || face === "WEST")
        ? vertical
        : horizontal;

      if (!compatible) continue;

      edges.push({
        face,
        orientation: vertical ? "VERTICAL" : "HORIZONTAL",
        x1: start[0],
        y1: start[1],
        x2: end[0],
        y2: end[1],
        midpoint: {
          x: (start[0] + end[0]) / 2,
          y: (start[1] + end[1]) / 2
        }
      });
    }

    if (!edges.length) return [];
    const extreme = this._getFaceExtreme(edges, face);

    return edges.filter(edge =>
      (face === "EAST" || face === "WEST")
        ? edge.midpoint.x === extreme
        : edge.midpoint.y === extreme
    );
  }

  static _selectPolygonEdge(edges, requested) {
    if (!requested) {
      return [...edges].sort((a, b) => this._edgeLength(b) - this._edgeLength(a))[0];
    }

    return [...edges].sort((a, b) => {
      const pa = this._projectPointToEdge(requested, a);
      const pb = this._projectPointToEdge(requested, b);
      return Math.hypot(pa.x - requested.x, pa.y - requested.y) -
        Math.hypot(pb.x - requested.x, pb.y - requested.y);
    })[0];
  }

  static _resolveCorridorHost(feature, topology, config) {
    const rectangles = Array.isArray(topology.rectangles) ? topology.rectangles : [];
    const requested = feature.location || feature.position;
    if (!requested) return null;

    const preferredFace = feature.face ? this._normalizeFace(feature.face) : null;
    let best = null;

    rectangles.forEach((rectangle, index) => {
      for (const edge of this._rectangleEdges(rectangle)) {
        if (preferredFace && edge.face !== preferredFace) continue;
        const location = this._projectPointToEdge(requested, edge);
        const distance = Math.hypot(location.x - requested.x, location.y - requested.y);

        if (!best || distance < best.distance) {
          best = {
            hostId: feature.hostId || `corridor-rectangle-${index}`,
            distance,
            location: this._snapPointOnEdge(location, edge, config.gridSize),
            face: edge.face,
            orientation: edge.orientation
          };
        }
      }
    });

    return best;
  }

  static _resolveJunctionHost(feature, topology, config) {
    const junctions = Array.isArray(topology.junctions) ? topology.junctions : [];
    const requested = feature.location || feature.position;
    if (!requested) return null;

    let best = null;

    junctions.forEach((junction, index) => {
      const distance = Math.hypot(junction.x - requested.x, junction.y - requested.y);
      if (!best || distance < best.distance) {
        const face = this._normalizeFace(
          feature.face || this._determineFace(junction, requested)
        );
        best = {
          hostId: feature.hostId || `junction-${index}`,
          distance,
          location: {
            x: this._snapCoordinate(junction.x, config.gridSize),
            y: this._snapCoordinate(junction.y, config.gridSize)
          },
          face,
          orientation: this._orientationForFace(face)
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

  static _projectPointToEdge(point, edge) {
    if (edge.orientation === "VERTICAL") {
      return {
        x: edge.x1,
        y: this._clamp(point.y, Math.min(edge.y1, edge.y2), Math.max(edge.y1, edge.y2))
      };
    }

    return {
      x: this._clamp(point.x, Math.min(edge.x1, edge.x2), Math.max(edge.x1, edge.x2)),
      y: edge.y1
    };
  }

  static _snapPointOnEdge(point, edge, gridSize) {
    if (edge.orientation === "VERTICAL") {
      return {
        x: edge.x1,
        y: this._clamp(
          this._snapCoordinate(point.y, gridSize),
          Math.min(edge.y1, edge.y2),
          Math.max(edge.y1, edge.y2)
        )
      };
    }

    return {
      x: this._clamp(
        this._snapCoordinate(point.x, gridSize),
        Math.min(edge.x1, edge.x2),
        Math.max(edge.x1, edge.x2)
      ),
      y: edge.y1
    };
  }

  static _getFaceExtreme(edges, face) {
    if (face === "EAST") return Math.max(...edges.map(edge => edge.midpoint.x));
    if (face === "WEST") return Math.min(...edges.map(edge => edge.midpoint.x));
    if (face === "SOUTH") return Math.max(...edges.map(edge => edge.midpoint.y));
    return Math.min(...edges.map(edge => edge.midpoint.y));
  }

  static _edgeLength(edge) {
    return Math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1);
  }

  static _getShapeType(sector) {
    if (sector.shapeType) return String(sector.shapeType).toUpperCase();
    switch (String(sector.graphRole || "").toUpperCase()) {
      case "OBJECTIVE": return "OCTAGON";
      case "HUB": return "CROSS";
      case "OPTIONAL": return "L_SHAPE";
      case "SECRET": return "T_SHAPE";
      default: return "RECTANGLE";
    }
  }

  static _normalizeFeatureType(type) {
    const value = String(type || "WINDOW_WALL").toUpperCase();
    const aliases = {
      WALL: "STANDARD_WALL",
      STANDARD: "STANDARD_WALL",
      TERRAIN: "TERRAIN_WALL",
      INVISIBLE: "INVISIBLE_WALL",
      ETHEREAL: "ETHEREAL_WALL",
      WINDOW: "WINDOW_WALL"
    };
    const normalized = aliases[value] || value;
    return Object.values(this.FEATURE_TYPES).includes(normalized)
      ? normalized
      : "STANDARD_WALL";
  }

  static _normalizeFace(face) {
    const value = String(face || "NORTH").toUpperCase();
    return ["NORTH", "SOUTH", "EAST", "WEST"].includes(value) ? value : "NORTH";
  }

  static _normalizeDirection(direction) {
    const value = String(direction || "BOTH").toUpperCase();
    return ["BOTH", "IN", "OUT"].includes(value) ? value : "BOTH";
  }

  static _orientationForFace(face) {
    return face === "EAST" || face === "WEST" ? "VERTICAL" : "HORIZONTAL";
  }

  static _determineFace(source, target) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "EAST" : "WEST";
    return dy >= 0 ? "SOUTH" : "NORTH";
  }

  static _snapCoordinate(value, gridSize) {
    return Math.round(Number(value) / gridSize) * gridSize;
  }

  static _snapSize(value, gridSize) {
    return Math.max(gridSize, Math.round((Number(value) || gridSize) / gridSize) * gridSize);
  }

  static _clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }
}
