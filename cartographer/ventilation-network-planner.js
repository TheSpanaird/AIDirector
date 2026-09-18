// ventilation-network-planner.js
// Plans logical duct routes and converts them into one non-overlapping physical network.
export class VentilationNetworkPlanner {
  static CONFIG = Object.freeze({
    gridSize: 100,
    networkType: "AIR_DUCT",
    visibility: "HIDDEN",
    accessType: "VENT_GRATE",
    autoConnectLimit: 8,
    elevationBottom: 10,
    elevationTop: 15
  });

  static plan(manifest = {}, sectors = [], layoutProfile = {}, customConfig = {}) {
    const config = this._normalizeConfig({ ...this.CONFIG, ...customConfig });
    const declaration = manifest.ventilation && typeof manifest.ventilation === "object"
      ? manifest.ventilation
      : {};
    const profileEnabled = Array.isArray(layoutProfile?.secondaryNetworks) &&
      layoutProfile.secondaryNetworks.includes("VENTILATION");
    const enabled = declaration.enabled === true ||
      (declaration.enabled !== false && profileEnabled);

    if (!enabled) return this._empty(config, "DISABLED");

    const sectorMap = new Map(sectors.map(sector => [sector.sectorId, sector]));
    const declared = Array.isArray(declaration.connections)
      ? declaration.connections
      : [];
    const links = declared.length
      ? declared
      : this._deriveConnections(sectors, config);

    const connections = [];
    const seenPairs = new Set();

    for (const link of links) {
      const sourceId = link.from || link.sourceId;
      const targetId = link.to || link.targetId;
      const source = sectorMap.get(sourceId);
      const target = sectorMap.get(targetId);
      if (!source || !target || sourceId === targetId) continue;

      const pairKey = [sourceId, targetId].sort().join(":");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const start = this._center(source);
      const end = this._center(target);
      if (!start || !end) continue;

      connections.push({
        id: `vent:${pairKey}`,
        sourceId,
        targetId,
        networkType: String(
          link.networkType || declaration.networkType || config.networkType
        ).toUpperCase(),
        visibility: String(
          link.visibility || declaration.visibility || config.visibility
        ).toUpperCase(),
        accessType: String(link.accessType || config.accessType).toUpperCase(),
        size: String(link.size || "SMALL").toUpperCase(),
        width: this._widthForSize(link.size, config),
        path: this._orthogonalPath(start, end, config.gridSize),
        accessPoints: [
          {
            sectorId: sourceId,
            location: start,
            accessType: String(link.accessType || config.accessType).toUpperCase()
          },
          {
            sectorId: targetId,
            location: end,
            accessType: String(link.accessType || config.accessType).toUpperCase()
          }
        ]
      });
    }

    const topology = this._normalizeTopology(connections, config);

    return {
      enabled: true,
      networkType: String(
        declaration.networkType || config.networkType
      ).toUpperCase(),
      visibility: String(
        declaration.visibility || config.visibility
      ).toUpperCase(),
      elevationBottom: Number(
        declaration.elevationBottom ?? config.elevationBottom
      ),
      elevationTop: Number(
        declaration.elevationTop ?? config.elevationTop
      ),
      connections,
      connectionCount: connections.length,
      accessPoints: this._uniqueAccessPoints(
        connections.flatMap(connection => connection.accessPoints)
      ),
      physicalSegments: topology.physicalSegments,
      topologyPoints: topology.topologyPoints,
      physicalBends: topology.physicalBends,
      physicalJunctions: topology.physicalJunctions,
      ductRectangles: topology.ductRectangles,
      nodeFillRectangles: topology.nodeFillRectangles,
      rawRectangles: topology.rawRectangles,
      rectangles: topology.rectangles,
      source: declared.length ? "MANIFEST" : "PROFILE"
    };
  }

  static _normalizeTopology(connections = [], config = {}) {
    const atomicSegments = new Map();

    for (const connection of connections) {
      for (let index = 0; index < connection.path.length - 1; index++) {
        const start = connection.path[index];
        const end = connection.path[index + 1];
        const horizontal = start.y === end.y;
        const distance = horizontal
          ? Math.abs(end.x - start.x)
          : Math.abs(end.y - start.y);
        const steps = Math.max(1, Math.round(distance / config.gridSize));

        for (let step = 0; step < steps; step++) {
          const first = horizontal
            ? {
                x: Math.min(start.x, end.x) + step * config.gridSize,
                y: start.y
              }
            : {
                x: start.x,
                y: Math.min(start.y, end.y) + step * config.gridSize
              };
          const second = horizontal
            ? { x: first.x + config.gridSize, y: first.y }
            : { x: first.x, y: first.y + config.gridSize };
          const key = this._segmentKey(first, second);

          if (!atomicSegments.has(key)) {
            atomicSegments.set(key, {
              start: first,
              end: second,
              width: connection.width,
              connectionIds: new Set(),
              sectorIds: new Set()
            });
          }

          const physical = atomicSegments.get(key);
          physical.width = Math.max(physical.width, connection.width);
          physical.connectionIds.add(connection.id);
          physical.sectorIds.add(connection.sourceId);
          physical.sectorIds.add(connection.targetId);
        }
      }
    }

    const physicalSegments = [...atomicSegments.values()].map(
      (segment, index) => ({
        id: `vent-physical:${index}`,
        start: segment.start,
        end: segment.end,
        width: segment.width,
        connectionIds: [...segment.connectionIds],
        sectorIds: [...segment.sectorIds]
      })
    );

    const pointMap = new Map();
    const addDirection = (point, direction, width) => {
      const key = `${point.x}:${point.y}`;
      if (!pointMap.has(key)) {
        pointMap.set(key, {
          x: point.x,
          y: point.y,
          directions: new Set(),
          width: 0
        });
      }
      const entry = pointMap.get(key);
      entry.directions.add(direction);
      entry.width = Math.max(entry.width, width);
    };

    for (const segment of physicalSegments) {
      if (segment.start.y === segment.end.y) {
        addDirection(segment.start, "EAST", segment.width);
        addDirection(segment.end, "WEST", segment.width);
      } else {
        addDirection(segment.start, "SOUTH", segment.width);
        addDirection(segment.end, "NORTH", segment.width);
      }
    }

    const topologyPoints = [...pointMap.values()].map(entry => {
      const directions = [...entry.directions];
      return {
        x: entry.x,
        y: entry.y,
        width: entry.width,
        directions,
        degree: directions.length,
        type: this._classifyDirections(directions)
      };
    });

    const physicalBends = topologyPoints.filter(
      point => point.type === "L_CORNER"
    );
    const physicalJunctions = topologyPoints.filter(point =>
      ["T_JUNCTION", "CROSS_JUNCTION"].includes(point.type)
    );

    const ductRectangles = physicalSegments.map(segment =>
      this._segmentToRectangle(segment)
    );
    const nodeFillRectangles = topologyPoints
      .filter(point =>
        ["L_CORNER", "T_JUNCTION", "CROSS_JUNCTION"].includes(point.type)
      )
      .map((point, index) => ({
        id: `vent-node-fill:${index}`,
        type: "NODE_FILL",
        topologyType: point.type,
        x: point.x - point.width / 2,
        y: point.y - point.width / 2,
        width: point.width,
        height: point.width
      }));

    const rawRectangles = [...ductRectangles, ...nodeFillRectangles];
    const rectangles = this._buildNonOverlappingUnion(rawRectangles);

    return {
      physicalSegments,
      topologyPoints,
      physicalBends,
      physicalJunctions,
      ductRectangles,
      nodeFillRectangles,
      rawRectangles,
      rectangles
    };
  }

  static _segmentToRectangle(segment) {
    const horizontal = segment.start.y === segment.end.y;
    return horizontal
      ? {
          id: segment.id,
          type: "DUCT",
          orientation: "HORIZONTAL",
          x: Math.min(segment.start.x, segment.end.x),
          y: segment.start.y - segment.width / 2,
          width: Math.abs(segment.end.x - segment.start.x),
          height: segment.width
        }
      : {
          id: segment.id,
          type: "DUCT",
          orientation: "VERTICAL",
          x: segment.start.x - segment.width / 2,
          y: Math.min(segment.start.y, segment.end.y),
          width: segment.width,
          height: Math.abs(segment.end.y - segment.start.y)
        };
  }

  static _buildNonOverlappingUnion(rectangles = []) {
    const valid = rectangles.filter(rectangle =>
      Number.isFinite(rectangle.x) &&
      Number.isFinite(rectangle.y) &&
      Number.isFinite(rectangle.width) &&
      Number.isFinite(rectangle.height) &&
      rectangle.width > 0 &&
      rectangle.height > 0
    );
    if (!valid.length) return [];

    const xValues = [...new Set(
      valid.flatMap(rectangle => [rectangle.x, rectangle.x + rectangle.width])
    )].sort((a, b) => a - b);
    const yValues = [...new Set(
      valid.flatMap(rectangle => [rectangle.y, rectangle.y + rectangle.height])
    )].sort((a, b) => a - b);

    const cells = [];
    for (let xIndex = 0; xIndex < xValues.length - 1; xIndex++) {
      for (let yIndex = 0; yIndex < yValues.length - 1; yIndex++) {
        const x = xValues[xIndex];
        const y = yValues[yIndex];
        const width = xValues[xIndex + 1] - x;
        const height = yValues[yIndex + 1] - y;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const occupied = valid.some(rectangle =>
          centerX >= rectangle.x - 0.001 &&
          centerX <= rectangle.x + rectangle.width + 0.001 &&
          centerY >= rectangle.y - 0.001 &&
          centerY <= rectangle.y + rectangle.height + 0.001
        );
        if (occupied) {
          cells.push({ type: "DUCT_UNION", x, y, width, height });
        }
      }
    }

    return this._mergeUnionCells(cells);
  }

  static _mergeUnionCells(cells = []) {
    let output = cells.map(cell => ({ ...cell }));
    let changed = true;

    while (changed) {
      changed = false;
      outer: for (let first = 0; first < output.length; first++) {
        for (let second = first + 1; second < output.length; second++) {
          const a = output[first];
          const b = output[second];

          if (
            a.y === b.y &&
            a.height === b.height &&
            (a.x + a.width === b.x || b.x + b.width === a.x)
          ) {
            output[first] = {
              type: "DUCT_UNION",
              x: Math.min(a.x, b.x),
              y: a.y,
              width: a.width + b.width,
              height: a.height
            };
            output.splice(second, 1);
            changed = true;
            break outer;
          }

          if (
            a.x === b.x &&
            a.width === b.width &&
            (a.y + a.height === b.y || b.y + b.height === a.y)
          ) {
            output[first] = {
              type: "DUCT_UNION",
              x: a.x,
              y: Math.min(a.y, b.y),
              width: a.width,
              height: a.height + b.height
            };
            output.splice(second, 1);
            changed = true;
            break outer;
          }
        }
      }
    }

    return output;
  }

  static _classifyDirections(directions = []) {
    const set = new Set(directions);
    if (set.size >= 4) return "CROSS_JUNCTION";
    if (set.size === 3) return "T_JUNCTION";
    if (set.size === 2) {
      const straight =
        (set.has("WEST") && set.has("EAST")) ||
        (set.has("NORTH") && set.has("SOUTH"));
      return straight ? "STRAIGHT" : "L_CORNER";
    }
    if (set.size === 1) return "DEAD_END";
    return "ISOLATED";
  }

  static _uniqueAccessPoints(points = []) {
    const unique = new Map();
    for (const point of points) {
      const key = `${point.sectorId}:${point.location.x}:${point.location.y}`;
      if (!unique.has(key)) unique.set(key, point);
    }
    return [...unique.values()];
  }

  static _segmentKey(first, second) {
    const ordered =
      first.x < second.x ||
      (first.x === second.x && first.y <= second.y)
        ? [first, second]
        : [second, first];
    return `${ordered[0].x}:${ordered[0].y}:${ordered[1].x}:${ordered[1].y}`;
  }

  static _deriveConnections(sectors, config) {
    const candidates = sectors
      .filter(sector => sector.bounds || sector.pixelBounds)
      .slice(0, config.autoConnectLimit);
    return candidates.slice(1).map((sector, index) => ({
      from: candidates[index].sectorId,
      to: sector.sectorId,
      accessType: config.accessType,
      size: "SMALL"
    }));
  }

  static _center(sector) {
    const bounds = sector.bounds || sector.pixelBounds;
    if (!bounds) return null;
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    };
  }

  static _orthogonalPath(start, end, gridSize) {
    const snap = value => Math.round(value / gridSize) * gridSize;
    const middle = { x: snap(end.x), y: snap(start.y) };
    return [start, middle, end]
      .map(point => ({ x: snap(point.x), y: snap(point.y) }))
      .filter((point, index, values) =>
        index === 0 ||
        point.x !== values[index - 1].x ||
        point.y !== values[index - 1].y
      );
  }

  static _widthForSize(size, config) {
    const factors = { SMALL: 1, MEDIUM: 2, LARGE: 3 };
    return config.gridSize * (
      factors[String(size || "SMALL").toUpperCase()] || 1
    );
  }

  static _normalizeConfig(config) {
    return {
      ...config,
      gridSize: Math.max(1, Number(config.gridSize) || 100),
      autoConnectLimit: Math.max(2, Number(config.autoConnectLimit) || 8),
      elevationBottom: Number(config.elevationBottom ?? 10),
      elevationTop: Number(config.elevationTop ?? 15)
    };
  }

  static _empty(config, source) {
    return {
      enabled: false,
      networkType: config.networkType,
      visibility: config.visibility,
      elevationBottom: config.elevationBottom,
      elevationTop: config.elevationTop,
      connections: [],
      connectionCount: 0,
      accessPoints: [],
      physicalSegments: [],
      topologyPoints: [],
      physicalBends: [],
      physicalJunctions: [],
      ductRectangles: [],
      nodeFillRectangles: [],
      rawRectangles: [],
      rectangles: [],
      source
    };
  }
}
