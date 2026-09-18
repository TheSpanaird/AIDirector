// corridor-router-engine.js
// AI Director Cartographer Alpha 0.1
// FILE: /modules/ai-director/scripts/cartographer/corridor-router-engine.js
// Routes grid-aligned corridors between actual room polygon edges.
// Doorways prefer centered edge positions and shared room faces use one trunk.

import { ShapePrimitiveGenerator }
  from "/modules/ai-director/scripts/cartographer/shape-primitive-generator.js";

export class CorridorRouterEngine {

  static CONFIG = {
    corridorWidth: 200,
    gridSize: 100,
    sharedTrunkLength: 400,
    approachLength: 200,
    bendPenalty: 300,
    wrongWayPenalty: 600
  };

  /**
   * Split manifest connections into direct shared-wall doors and routed links.
   * A direct connection is selected only when the rendered room polygons share
   * an axis-aligned edge wide enough to host the requested doorway.
   */
  static planConnectionModes(connections = [], sectors = [], customConfig = {}) {
    const config = { ...this.CONFIG, ...customConfig };
    config.gridSize = Math.max(1, Number(config.gridSize) || 100);
    config.doorWidth = Math.max(
      config.gridSize,
      Math.round((Number(config.doorWidth) || config.gridSize * 2) / config.gridSize) * config.gridSize
    );

    const sectorMap = new Map(sectors.map(sector => [sector.sectorId, sector]));
    const shared = [];
    const routed = [];
    const seen = new Set();

    for (const connection of connections) {
      const source = sectorMap.get(connection.sourceId);
      const target = sectorMap.get(connection.targetId);
      if (!source || !target || source.sectorId === target.sectorId) continue;

      const key = [source.sectorId, target.sectorId].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);

      const requestedType = String(connection.connectionType || "CORRIDOR").toUpperCase();
      const wall = this._findSharedPolygonWall(source, target, config);
      const explicitlyRouted = [
        "CORRIDOR",
        "SHORT_HALL",
        "SERVICE_CORRIDOR",
        "NATURAL_PASSAGE"
      ].includes(requestedType) && connection.connectionTypeExplicit === true;

      if (wall && !explicitlyRouted) {
        shared.push({
          ...connection,
          connectionType: "SHARED_WALL",
          sharedWall: wall
        });
      } else if (wall && requestedType === "SHARED_WALL") {
        shared.push({
          ...connection,
          connectionType: "SHARED_WALL",
          sharedWall: wall
        });
      } else {
        routed.push({
          ...connection,
          connectionType: requestedType === "SHARED_WALL"
            ? "SHORT_HALL"
            : requestedType
        });
      }
    }

    return { shared, routed };
  }

  static routeConnections(connections = [], sectors = [], customConfig = {}) {
    const config = { ...this.CONFIG, ...customConfig };
    config.gridSize = Math.max(1, Number(config.gridSize) || 100);
    config.corridorWidth = this._normalizeWidth(config.corridorWidth, config.gridSize);
    config.sharedTrunkLength = this._normalizeDistance(
      config.sharedTrunkLength,
      config.gridSize,
      config.corridorWidth
    );
    config.approachLength = this._normalizeDistance(
      config.approachLength,
      config.gridSize,
      config.corridorWidth
    );

    const sectorMap = new Map(sectors.map(sector => [sector.sectorId, sector]));
    const drafts = [];

    for (const connection of connections) {
      const source = sectorMap.get(connection.sourceId);
      const target = sectorMap.get(connection.targetId);
      if (!source || !target) continue;

      const endpointData = this._createEndpointData(source, target, config);
      if (!endpointData) continue;

      drafts.push({
        connection,
        source,
        target,
        ...endpointData,
        startTrunk: null,
        endTrunk: null,
        startShared: false,
        endShared: false
      });
    }

    this._assignSharedEndpointTrunks(drafts, config);

    return drafts.map(draft => {
      const initialPath = this._buildRoutePath(draft, config);
      const path = this._avoidRoomCollisions(initialPath, draft, sectors, config);
      return {
        sourceId: draft.connection.sourceId,
        targetId: draft.connection.targetId,
        doorType: draft.connection.doorType || "STANDARD",
        connectionType: draft.connection.connectionType || "CORRIDOR",
        corridorWidth: config.corridorWidth,
        anchors: {
          start: draft.startAnchor,
          end: draft.endAnchor,
          startFace: draft.sourceFace,
          endFace: draft.targetFace,
          startTrunk: draft.startTrunk,
          endTrunk: draft.endTrunk,
          startApproach: draft.startApproach,
          endApproach: draft.endApproach,
          startShared: draft.startShared,
          endShared: draft.endShared
        },
        roomAnchors: [
          { x: draft.startAnchor.x, y: draft.startAnchor.y, sectorId: draft.source.sectorId },
          { x: draft.endAnchor.x, y: draft.endAnchor.y, sectorId: draft.target.sectorId }
        ],
        path,
        polygon: this._extrudePathToPolygon(path, config.corridorWidth)
      };
    });
  }

  static extractConnections(sectors = [], customConfig = {}) {
    const results = [];
    const byPair = new Map();
    const validIds = new Set(sectors.map(sector => sector.sectorId));

    for (const sector of sectors) {
      if (!Array.isArray(sector.connections)) continue;
      for (const connection of sector.connections) {
        const targetId = connection.to || connection.targetId || connection.targetSectorId;
        if (!targetId || targetId === sector.sectorId || !validIds.has(targetId)) continue;
        const pairKey = [sector.sectorId, targetId].sort().join(":");
        const candidate = {
          sourceId: sector.sectorId,
          targetId,
          doorType: connection.doorType || "STANDARD",
          connectionType: connection.connectionType || "CORRIDOR",
          connectionTypeExplicit: Boolean(connection.connectionType),
          priority: Number(connection.priority) || 0
        };
        const existing = byPair.get(pairKey);
        if (!existing || candidate.priority > existing.priority ||
          (candidate.connectionTypeExplicit && !existing.connectionTypeExplicit)) {
          byPair.set(pairKey, candidate);
        }
      }
    }

    results.push(...byPair.values());
    return this._applyConnectionPolicy(results, sectors, customConfig);
  }

  static _applyConnectionPolicy(connections, sectors, customConfig = {}) {
    const policy = String(customConfig.connectionPolicy || "PRESERVE_GRAPH").toUpperCase();
    if (["NATURAL_BRANCHING", "PRESERVE_GRAPH", "DUNGEON_NETWORK"].includes(policy)) {
      return connections;
    }

    const maximumRoomDegree = Math.max(1, Number(customConfig.maximumRoomDegree) || 3);
    const degree = new Map();
    const parent = new Map(sectors.map(sector => [sector.sectorId, sector.sectorId]));
    const find = value => {
      let root = value;
      while (parent.get(root) !== root) root = parent.get(root);
      while (parent.get(value) !== value) {
        const next = parent.get(value);
        parent.set(value, root);
        value = next;
      }
      return root;
    };
    const union = (left, right) => {
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot === rightRoot) return false;
      parent.set(rightRoot, leftRoot);
      return true;
    };

    const ordered = [...connections].sort((a, b) =>
      Number(b.priority || 0) - Number(a.priority || 0)
    );
    const selected = [];
    const selectedKeys = new Set();

    for (const connection of ordered) {
      if (!union(connection.sourceId, connection.targetId)) continue;
      const key = [connection.sourceId, connection.targetId].sort().join(":");
      selected.push(connection);
      selectedKeys.add(key);
      degree.set(connection.sourceId, (degree.get(connection.sourceId) || 0) + 1);
      degree.set(connection.targetId, (degree.get(connection.targetId) || 0) + 1);
    }

    for (const connection of ordered) {
      const key = [connection.sourceId, connection.targetId].sort().join(":");
      if (selectedKeys.has(key)) continue;
      const sourceDegree = degree.get(connection.sourceId) || 0;
      const targetDegree = degree.get(connection.targetId) || 0;
      if (sourceDegree >= maximumRoomDegree || targetDegree >= maximumRoomDegree) continue;
      selected.push(connection);
      selectedKeys.add(key);
      degree.set(connection.sourceId, sourceDegree + 1);
      degree.set(connection.targetId, targetDegree + 1);
    }

    return selected;
  }

  static _createEndpointData(source, target, config) {
    const sourceBounds = source.bounds || source.pixelBounds;
    const targetBounds = target.bounds || target.pixelBounds;
    if (!sourceBounds || !targetBounds) return null;

    const sourceCenter = this._getBoundsCenter(sourceBounds);
    const targetCenter = this._getBoundsCenter(targetBounds);
    const sourcePolygon = ShapePrimitiveGenerator.generatePolygon(
      sourceBounds,
      this._getShapeType(source),
      config.gridSize
    );
    const targetPolygon = ShapePrimitiveGenerator.generatePolygon(
      targetBounds,
      this._getShapeType(target),
      config.gridSize
    );

    const choice = this._chooseAnchorPair(
      sourcePolygon,
      targetPolygon,
      sourceCenter,
      targetCenter,
      config
    );
    if (!choice) return null;

    return {
      sourceCenter,
      targetCenter,
      sourcePolygon,
      targetPolygon,
      sourceFace: choice.source.face,
      targetFace: choice.target.face,
      startAnchor: choice.source.anchor,
      endAnchor: choice.target.anchor
    };
  }

  static _chooseAnchorPair(sourcePolygon, targetPolygon, sourceCenter, targetCenter, config) {
    const sourceCandidates = this._buildFaceCandidates(sourcePolygon, targetCenter, config);
    const targetCandidates = this._buildFaceCandidates(targetPolygon, sourceCenter, config);
    if (!sourceCandidates.length || !targetCandidates.length) return null;

    let best = null;

    for (const source of sourceCandidates) {
      for (const target of targetCandidates) {
        const sourceApproach = this._createApproachPoint(
          source.anchor,
          source.face,
          config
        );
        const targetApproach = this._createApproachPoint(
          target.anchor,
          target.face,
          config
        );
        const path = this._generateOrthogonalPath(
          sourceApproach,
          targetApproach,
          config
        );
        const bends = Math.max(0, path.length - 2);
        const distance = this._pathLength(path);
        const sourcePenalty = this._faceDirectionPenalty(
          source.face,
          sourceCenter,
          targetCenter,
          config.wrongWayPenalty
        );
        const targetPenalty = this._faceDirectionPenalty(
          target.face,
          targetCenter,
          sourceCenter,
          config.wrongWayPenalty
        );
        const score = distance + bends * config.bendPenalty + sourcePenalty + targetPenalty;

        if (!best || score < best.score) {
          best = { source, target, score };
        }
      }
    }

    return best;
  }

  static _buildFaceCandidates(polygon, targetCenter, config) {
    const candidates = [];
    const faces = ["NORTH", "SOUTH", "EAST", "WEST"];

    for (const face of faces) {
      const edges = this._getFaceEdges(polygon, face);
      for (const edge of edges) {
        const anchor = this._getCenteredAnchor(edge, config);
        if (!anchor) continue;
        candidates.push({ face, edge, anchor });
      }
    }

    candidates.sort((a, b) =>
      this._distance(a.anchor, targetCenter) - this._distance(b.anchor, targetCenter)
    );
    return candidates;
  }

  static _getFaceEdges(polygon, face) {
    if (!Array.isArray(polygon) || polygon.length < 2) return [];
    const edges = [];

    for (let index = 0; index < polygon.length; index++) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      const vertical = start[0] === end[0];
      const horizontal = start[1] === end[1];
      if (!vertical && !horizontal) continue;

      const midpoint = {
        x: (start[0] + end[0]) / 2,
        y: (start[1] + end[1]) / 2
      };
      edges.push({ start, end, vertical, horizontal, midpoint });
    }

    const compatible = edges.filter(edge =>
      (face === "EAST" || face === "WEST") ? edge.vertical : edge.horizontal
    );
    if (!compatible.length) return [];

    const extreme = this._getFaceExtreme(compatible, face);
    return compatible.filter(edge =>
      (face === "EAST" || face === "WEST")
        ? edge.midpoint.x === extreme
        : edge.midpoint.y === extreme
    );
  }

  static _getCenteredAnchor(edge, config) {
    const halfWidth = config.corridorWidth / 2;

    if (edge.vertical) {
      const minimum = Math.min(edge.start[1], edge.end[1]);
      const maximum = Math.max(edge.start[1], edge.end[1]);
      const safeMinimum = minimum + halfWidth;
      const safeMaximum = maximum - halfWidth;
      if (safeMinimum > safeMaximum) return null;
      const centered = (minimum + maximum) / 2;
      return {
        x: edge.start[0],
        y: this._snapAndClamp(centered, safeMinimum, safeMaximum, config)
      };
    }

    const minimum = Math.min(edge.start[0], edge.end[0]);
    const maximum = Math.max(edge.start[0], edge.end[0]);
    const safeMinimum = minimum + halfWidth;
    const safeMaximum = maximum - halfWidth;
    if (safeMinimum > safeMaximum) return null;
    const centered = (minimum + maximum) / 2;
    return {
      x: this._snapAndClamp(centered, safeMinimum, safeMaximum, config),
      y: edge.start[1]
    };
  }

  static _assignSharedEndpointTrunks(drafts, config) {
    const groups = new Map();
    const add = (draft, endpoint) => {
      const isStart = endpoint === "START";
      const sector = isStart ? draft.source : draft.target;
      const face = isStart ? draft.sourceFace : draft.targetFace;
      const key = `${sector.sectorId}:${face}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ draft, endpoint });
    };

    for (const draft of drafts) {
      add(draft, "START");
      add(draft, "END");
    }

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const first = group[0];
      const isStart = first.endpoint === "START";
      const anchor = isStart ? first.draft.startAnchor : first.draft.endAnchor;
      const face = isStart ? first.draft.sourceFace : first.draft.targetFace;
      const trunk = this._createTrunkPoint(anchor, face, config);

      for (const item of group) {
        if (item.endpoint === "START") {
          item.draft.startAnchor = { ...anchor };
          item.draft.startTrunk = { ...trunk };
          item.draft.startShared = true;
        } else {
          item.draft.endAnchor = { ...anchor };
          item.draft.endTrunk = { ...trunk };
          item.draft.endShared = true;
        }
      }
    }
  }

  static _buildRoutePath(draft, config) {
    const startApproach = draft.startTrunk || this._createApproachPoint(
      draft.startAnchor,
      draft.sourceFace,
      config
    );

    const endApproach = draft.endTrunk || this._createApproachPoint(
      draft.endAnchor,
      draft.targetFace,
      config
    );

    draft.startApproach = { ...startApproach };
    draft.endApproach = { ...endApproach };

    const interiorPath = this._generateOrthogonalPath(
      startApproach,
      endApproach,
      config
    );

    const points = [];

    this._appendPoint(points, draft.startAnchor);
    this._appendPoint(points, startApproach);

    for (const point of interiorPath) {
      this._appendPoint(points, { x: point[0], y: point[1] });
    }

    this._appendPoint(points, endApproach);
    this._appendPoint(points, draft.endAnchor);

    return points.map(point => [point.x, point.y]);
  }

  static _generateOrthogonalPath(start, end, config) {
    if (start.x === end.x || start.y === end.y) {
      return [[start.x, start.y], [end.x, end.y]];
    }

    const horizontalFirst = [
      [start.x, start.y],
      [end.x, start.y],
      [end.x, end.y]
    ];
    const verticalFirst = [
      [start.x, start.y],
      [start.x, end.y],
      [end.x, end.y]
    ];

    const firstLength = this._pathLength(horizontalFirst);
    const secondLength = this._pathLength(verticalFirst);
    const chosen = firstLength <= secondLength ? horizontalFirst : verticalFirst;

    return chosen.map(point => [
      this._snapCenterline(point[0], config),
      this._snapCenterline(point[1], config)
    ]);
  }

  static _avoidRoomCollisions(path, draft, sectors, config) {
    const obstacles = sectors
      .filter(sector => sector.sectorId !== draft.source.sectorId && sector.sectorId !== draft.target.sectorId)
      .map(sector => sector.bounds || sector.pixelBounds)
      .filter(Boolean);
    if (!obstacles.length || !this._pathHitsObstacles(path, obstacles, config)) return path;
    const routed = this._findGridPath(path[0], path[path.length - 1], obstacles, config);
    if (routed) return routed;
    console.warn("Cartographer could not find a room-safe corridor route", {
      sourceId: draft.source.sectorId,
      targetId: draft.target.sectorId
    });
    return path;
  }

  static _findGridPath(start, end, obstacles, config) {
    const step = config.gridSize;
    const padding = config.corridorWidth / 2 + step;
    const snap = value => Math.round(value / step) * step;
    const startNode = { x: snap(start[0]), y: snap(start[1]) };
    const endNode = { x: snap(end[0]), y: snap(end[1]) };
    const minimumX = snap(Math.min(startNode.x, endNode.x, ...obstacles.map(b => b.x)) - step * 6);
    const maximumX = snap(Math.max(startNode.x, endNode.x, ...obstacles.map(b => b.x + b.width)) + step * 6);
    const minimumY = snap(Math.min(startNode.y, endNode.y, ...obstacles.map(b => b.y)) - step * 6);
    const maximumY = snap(Math.max(startNode.y, endNode.y, ...obstacles.map(b => b.y + b.height)) + step * 6);
    const key = node => `${node.x},${node.y}`;
    const blocked = node => obstacles.some(bounds =>
      node.x > bounds.x - padding && node.x < bounds.x + bounds.width + padding &&
      node.y > bounds.y - padding && node.y < bounds.y + bounds.height + padding
    );
    const queue = [{ ...startNode, score: 0 }];
    const cameFrom = new Map();
    const cost = new Map([[key(startNode), 0]]);
    const visited = new Set();
    const directions = [[step, 0], [-step, 0], [0, step], [0, -step]];
    let iterations = 0;

    while (queue.length && iterations++ < 30000) {
      queue.sort((a, b) => a.score - b.score);
      const current = queue.shift();
      const currentKey = key(current);
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);
      if (current.x === endNode.x && current.y === endNode.y) {
        const nodes = [[current.x, current.y]];
        let cursor = currentKey;
        while (cameFrom.has(cursor)) {
          const previous = cameFrom.get(cursor);
          nodes.push([previous.x, previous.y]);
          cursor = key(previous);
        }
        nodes.reverse();
        nodes[0] = [start[0], start[1]];
        nodes[nodes.length - 1] = [end[0], end[1]];
        return this._simplifyPath(nodes);
      }
      for (const [dx, dy] of directions) {
        const next = { x: current.x + dx, y: current.y + dy };
        if (next.x < minimumX || next.x > maximumX || next.y < minimumY || next.y > maximumY) continue;
        const nextKey = key(next);
        if (blocked(next) && nextKey !== key(endNode)) continue;
        const nextCost = (cost.get(currentKey) || 0) + step;
        if (nextCost >= (cost.get(nextKey) ?? Infinity)) continue;
        cost.set(nextKey, nextCost);
        cameFrom.set(nextKey, { x: current.x, y: current.y });
        const heuristic = Math.abs(endNode.x - next.x) + Math.abs(endNode.y - next.y);
        queue.push({ ...next, score: nextCost + heuristic });
      }
    }
    return null;
  }

  static _pathHitsObstacles(path, obstacles, config) {
    const padding = config.corridorWidth / 2;
    for (let index = 0; index < path.length - 1; index++) {
      for (const bounds of obstacles) {
        const rectangle = {
          left: bounds.x - padding,
          top: bounds.y - padding,
          right: bounds.x + bounds.width + padding,
          bottom: bounds.y + bounds.height + padding
        };
        if (this._axisSegmentIntersectsRectangle(path[index], path[index + 1], rectangle)) return true;
      }
    }
    return false;
  }

  static _axisSegmentIntersectsRectangle(start, end, rectangle) {
    if (start[0] === end[0]) {
      const minimum = Math.min(start[1], end[1]);
      const maximum = Math.max(start[1], end[1]);
      return start[0] > rectangle.left && start[0] < rectangle.right && maximum > rectangle.top && minimum < rectangle.bottom;
    }
    if (start[1] === end[1]) {
      const minimum = Math.min(start[0], end[0]);
      const maximum = Math.max(start[0], end[0]);
      return start[1] > rectangle.top && start[1] < rectangle.bottom && maximum > rectangle.left && minimum < rectangle.right;
    }
    return true;
  }

  static _simplifyPath(path) {
    const output = [];
    for (const point of path) {
      const previous = output[output.length - 1];
      if (previous && previous[0] === point[0] && previous[1] === point[1]) continue;
      output.push(point);
      while (output.length >= 3) {
        const a = output[output.length - 3];
        const b = output[output.length - 2];
        const c = output[output.length - 1];
        if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) output.splice(output.length - 2, 1);
        else break;
      }
    }
    return output;
  }

  static _faceDirectionPenalty(face, sourceCenter, targetCenter, penalty) {
    const deltaX = targetCenter.x - sourceCenter.x;
    const deltaY = targetCenter.y - sourceCenter.y;
    if (face === "EAST" && deltaX >= 0) return 0;
    if (face === "WEST" && deltaX <= 0) return 0;
    if (face === "SOUTH" && deltaY >= 0) return 0;
    if (face === "NORTH" && deltaY <= 0) return 0;
    return penalty;
  }

  static _pathLength(path = []) {
    let length = 0;
    for (let index = 0; index < path.length - 1; index++) {
      length += Math.abs(path[index + 1][0] - path[index][0]);
      length += Math.abs(path[index + 1][1] - path[index][1]);
    }
    return length;
  }

  static _appendPoint(points, point) {
    if (!point) return;
    const last = points[points.length - 1];
    if (last && last.x === point.x && last.y === point.y) return;
    points.push({ x: point.x, y: point.y });
  }

  static _createApproachPoint(anchor, face, config) {
    const vector = this._getFaceVector(face);

    return {
      x: this._snapCenterline(
        anchor.x + vector.x * config.approachLength,
        config
      ),
      y: this._snapCenterline(
        anchor.y + vector.y * config.approachLength,
        config
      )
    };
  }

  static _createTrunkPoint(anchor, face, config) {
    const vector = this._getFaceVector(face);
    return {
      x: this._snapCenterline(
        anchor.x + vector.x * config.sharedTrunkLength,
        config
      ),
      y: this._snapCenterline(
        anchor.y + vector.y * config.sharedTrunkLength,
        config
      )
    };
  }

  static _getFaceVector(face) {
    const vectors = {
      NORTH: { x: 0, y: -1 },
      SOUTH: { x: 0, y: 1 },
      EAST: { x: 1, y: 0 },
      WEST: { x: -1, y: 0 }
    };
    return vectors[face] || { x: 0, y: 0 };
  }

  static _getFaceExtreme(edges, face) {
    if (face === "EAST") return Math.max(...edges.map(edge => edge.midpoint.x));
    if (face === "WEST") return Math.min(...edges.map(edge => edge.midpoint.x));
    if (face === "SOUTH") return Math.max(...edges.map(edge => edge.midpoint.y));
    return Math.min(...edges.map(edge => edge.midpoint.y));
  }

  static _extrudePathToPolygon(points = [], width = 200) {
    const segments = [];
    for (let index = 0; index < points.length - 1; index++) {
      const start = points[index];
      const end = points[index + 1];
      if (start[0] === end[0] && start[1] === end[1]) continue;
      segments.push({
        x1: start[0],
        y1: start[1],
        x2: end[0],
        y2: end[1],
        width
      });
    }
    return segments;
  }

  static _getShapeType(sector) {
    if (sector.shapeType) return String(sector.shapeType).toUpperCase();
    const purpose = String(
      sector.purpose || sector.sectorPurpose || sector.roomType || ""
    ).toUpperCase();
    if (purpose.includes("TOWER")) return "TOWER_SQUARE";
    if (purpose.includes("COURTYARD")) return "RECTANGLE";
    if (purpose.includes("CORRIDOR") || purpose.includes("HALL")) return "RECTANGLE";
    switch (String(sector.graphRole || "").toUpperCase()) {
      case "OBJECTIVE": return "OCTAGON";
      case "HUB": return "CROSS";
      case "OPTIONAL": return "L_SHAPE";
      case "SECRET": return "T_SHAPE";
      default: return "RECTANGLE";
    }
  }

  static _findSharedPolygonWall(source, target, config) {
    const sourceBounds = source.bounds || source.pixelBounds;
    const targetBounds = target.bounds || target.pixelBounds;
    if (!sourceBounds || !targetBounds) return null;

    const sourcePolygon = ShapePrimitiveGenerator.generatePolygon(
      sourceBounds,
      this._getShapeType(source),
      config.gridSize
    );
    const targetPolygon = ShapePrimitiveGenerator.generatePolygon(
      targetBounds,
      this._getShapeType(target),
      config.gridSize
    );
    const sourceEdges = this._polygonEdges(sourcePolygon);
    const targetEdges = this._polygonEdges(targetPolygon);
    let best = null;

    for (const first of sourceEdges) {
      for (const second of targetEdges) {
        const overlap = this._sharedEdgeOverlap(first, second);
        if (!overlap || overlap.length < config.doorWidth) continue;
        if (!best || overlap.length > best.length) best = overlap;
      }
    }

    if (!best) return null;
    const sourceCenter = this._getBoundsCenter(sourceBounds);
    const targetCenter = this._getBoundsCenter(targetBounds);
    const sourceFace = this._faceFromWall(best, sourceCenter, targetCenter);
    const opposite = { NORTH: "SOUTH", SOUTH: "NORTH", EAST: "WEST", WEST: "EAST" };

    return {
      location: best.orientation === "VERTICAL"
        ? { x: best.axis, y: (best.start + best.end) / 2 }
        : { x: (best.start + best.end) / 2, y: best.axis },
      orientation: best.orientation,
      sourceFace,
      targetFace: opposite[sourceFace],
      length: best.length
    };
  }

  static _polygonEdges(polygon = []) {
    const edges = [];
    for (let index = 0; index < polygon.length; index++) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      if (start[0] === end[0]) {
        edges.push({
          orientation: "VERTICAL",
          axis: start[0],
          start: Math.min(start[1], end[1]),
          end: Math.max(start[1], end[1])
        });
      } else if (start[1] === end[1]) {
        edges.push({
          orientation: "HORIZONTAL",
          axis: start[1],
          start: Math.min(start[0], end[0]),
          end: Math.max(start[0], end[0])
        });
      }
    }
    return edges;
  }

  static _sharedEdgeOverlap(first, second) {
    if (first.orientation !== second.orientation || first.axis !== second.axis) return null;
    const start = Math.max(first.start, second.start);
    const end = Math.min(first.end, second.end);
    if (end <= start) return null;
    return {
      orientation: first.orientation,
      axis: first.axis,
      start,
      end,
      length: end - start
    };
  }

  static _faceFromWall(wall, sourceCenter, targetCenter) {
    if (wall.orientation === "VERTICAL") {
      return targetCenter.x >= sourceCenter.x ? "EAST" : "WEST";
    }
    return targetCenter.y >= sourceCenter.y ? "SOUTH" : "NORTH";
  }

  static _normalizeWidth(width, gridSize) {
    const units = Math.max(1, Math.round((Number(width) || gridSize) / gridSize));
    return units * gridSize;
  }

  static _normalizeDistance(distance, gridSize, minimum) {
    const requested = Math.max(Number(distance) || 0, minimum);
    return Math.max(1, Math.round(requested / gridSize)) * gridSize;
  }

  static _snapAndClamp(value, minimum, maximum, config) {
    return this._clamp(this._snapCenterline(value, config), minimum, maximum);
  }

  static _snapCenterline(value, config) {
    const units = Math.max(1, Math.round(config.corridorWidth / config.gridSize));
    const offset = units % 2 === 0 ? 0 : config.gridSize / 2;
    return Math.round((value - offset) / config.gridSize) * config.gridSize + offset;
  }

  static _getBoundsCenter(bounds) {
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    };
  }

  static _distance(first, second) {
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  static _clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }
}
