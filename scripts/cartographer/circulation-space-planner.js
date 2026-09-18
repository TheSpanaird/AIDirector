/*
 * CARTOGRAPHER ARCHITECTURE REBUILD BOUNDARY
 * Status: ACTIVE REBUILD: reserved circulation and minimal network extensions after adjacency planning.
 * Frozen infrastructure must not be modified to compensate for this file.
 * Source of truth: AI-README-CARTOGRAPHER.md, Architecture Rebuild Freeze Boundary.
 */
// circulation-space-planner.js
// Routes partitioned rooms through hybrid shared-wall and circulation access.
import { CorridorRouterEngine }
  from "/modules/ai-director/scripts/cartographer/corridor-router-engine.js";
import { HybridConnectionPlanner }
  from "/modules/ai-director/scripts/cartographer/hybrid-connection-planner.js";

export class CirculationSpacePlanner {
  static plan(sectors = [], profile = {}, config = {}) {
    const gridSize = Math.max(1, Number(config.gridSize) || 100);
    const corridorWidth = Math.max(gridSize, Number(config.corridorWidth) || gridSize * 2);
    const contract = sectors.find(sector => sector.footprintContract)?.footprintContract || {};
    const natural = contract.archetype === "NATURAL_BRANCHING" ||
      String(profile.layoutFamily || profile.family || "").toUpperCase() === "NATURAL";
    if (natural) return this._natural(sectors, config, contract);

    const hybridPlan = HybridConnectionPlanner.plan(sectors, profile, {
      ...config,
      corridorPattern: profile.corridorPattern
    });
    const gridSkeleton = sectors.find(sector =>
      Array.isArray(sector.footprintSkeletonGrid)
    )?.footprintSkeletonGrid || [];
    const rawSkeleton = this._pixels(gridSkeleton, sectors, gridSize);
    const hallwayIds = new Set(hybridPlan.hallwaySectorIds);
    const hallwaySectors = sectors.filter(sector => hallwayIds.has(sector.sectorId));
    let accessRoutes = [];
    let skeleton = rawSkeleton;
    let skeletonRoutes = [];

    if (rawSkeleton.length) {
      const preliminary = hallwaySectors.map(sector =>
        this._accessRoute(sector, rawSkeleton, corridorWidth, gridSize)
      ).filter(Boolean);
      skeleton = this._trimSkeleton(rawSkeleton, preliminary, corridorWidth);
      accessRoutes = hallwaySectors.map(sector =>
        this._accessRoute(sector, skeleton, corridorWidth, gridSize)
      ).filter(Boolean);
      skeletonRoutes = skeleton.map((segment, index) =>
        this._spineRoute(segment, index, corridorWidth)
      );
    }

    const routedFallback = rawSkeleton.length ? [] : CorridorRouterEngine.routeConnections(
      hybridPlan.routedRequirements,
      sectors,
      { ...config, corridorWidth }
    );
    const routes = [...skeletonRoutes, ...accessRoutes, ...routedFallback];
    const routed = [...accessRoutes, ...routedFallback];
    return {
      mode: "HYBRID_CIRCULATION",
      footprintContract: contract,
      hybridPlan,
      skeleton,
      accessRequirements: hybridPlan.requirements,
      networkConnections: [...hybridPlan.shared, ...routed],
      connectionPlan: { shared: hybridPlan.shared, routed },
      routes,
      skeletonRoutes,
      accessRoutes,
      connectedSectorIds: [...new Set([
        ...hybridPlan.shared.flatMap(connection => [connection.sourceId, connection.targetId]),
        ...routed.flatMap(route => [route.sourceId, route.targetId]).filter(Boolean)
      ])]
    };
  }

  static _natural(sectors, config, contract) {
    const requirements = CorridorRouterEngine.extractConnections(sectors, { connectionPolicy: "NATURAL_BRANCHING" });
    const connectionPlan = CorridorRouterEngine.planConnectionModes(requirements, sectors, { ...config, preferSharedWalls: false });
    const routes = CorridorRouterEngine.routeConnections(connectionPlan.routed, sectors, { ...config, connectionPolicy: "NATURAL_BRANCHING", allowCrossMapRoutes: true });
    return { mode: "NATURAL_BRANCHING", footprintContract: contract, skeleton: [], accessRequirements: requirements, networkConnections: requirements, connectionPlan, routes, skeletonRoutes: [], accessRoutes: routes, connectedSectorIds: [...new Set(requirements.flatMap(connection => [connection.sourceId, connection.targetId]))] };
  }

  static _spineRoute(segment, index, width) {
    return {
      sourceId: `__circulation_${index}`,
      targetId: `__circulation_${index + 1}`,
      sourceIsCirculation: true,
      targetIsCirculation: true,
      connectionType: "CIRCULATION_SPINE",
      doorType: "OPEN",
      corridorWidth: width,
      anchors: {},
      roomAnchors: [],
      path: [[segment.x1, segment.y1], [segment.x2, segment.y2]],
      polygon: [{ x1: segment.x1, y1: segment.y1, x2: segment.x2, y2: segment.y2, width }]
    };
  }

  static _accessRoute(sector, skeleton, width, gridSize) {
    const bounds = sector.pixelBounds || sector.bounds;
    if (!bounds || !skeleton.length) return null;
    const roomCenter = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    };

    const choices = skeleton.map(segment => {
      const destination = this._project(roomCenter, segment);
      const anchor = this._nearestBoundaryAnchor(bounds, destination, width, gridSize);
      return {
        anchor,
        destination,
        distance: this._distance(anchor, destination)
      };
    }).sort((a, b) => a.distance - b.distance);

    const selected = choices[0];
    if (!selected) return null;
    const face = this._face(bounds, selected.anchor);
    const path = [
      [selected.anchor.x, selected.anchor.y],
      [selected.destination.x, selected.destination.y]
    ];

    return {
      sourceId: sector.sectorId,
      targetId: "__circulation__",
      targetIsCirculation: true,
      connectionType: "CIRCULATION_ACCESS",
      doorType: "STANDARD",
      corridorWidth: width,
      anchors: {
        start: selected.anchor,
        end: selected.destination,
        startFace: face,
        endFace: null,
        startShared: false,
        endShared: true
      },
      roomAnchors: [{ ...selected.anchor, sectorId: sector.sectorId }],
      path,
      polygon: [{
        x1: path[0][0], y1: path[0][1],
        x2: path[1][0], y2: path[1][1],
        width
      }]
    };
  }

  static _trimSkeleton(skeleton, accessRoutes, width) {
    if (!accessRoutes.length) return skeleton;
    return skeleton.map(segment => {
      const vertical = Math.abs(segment.x1 - segment.x2) < 0.001;
      const points = accessRoutes
        .map(route => route.anchors?.end)
        .filter(Boolean)
        .filter(point => vertical
          ? Math.abs(point.x - segment.x1) <= 0.001
          : Math.abs(point.y - segment.y1) <= 0.001);
      if (!points.length) return segment;
      const values = points.map(point => vertical ? point.y : point.x);
      const minimum = Math.min(...values) - width / 2;
      const maximum = Math.max(...values) + width / 2;
      if (vertical) {
        const low = Math.min(segment.y1, segment.y2);
        const high = Math.max(segment.y1, segment.y2);
        return { ...segment, y1: Math.max(low, minimum), y2: Math.min(high, maximum) };
      }
      const low = Math.min(segment.x1, segment.x2);
      const high = Math.max(segment.x1, segment.x2);
      return { ...segment, x1: Math.max(low, minimum), x2: Math.min(high, maximum) };
    });
  }

  static _nearestBoundaryAnchor(bounds, point, width, gridSize) {
    const half = width / 2;
    const clamp = (value, minimum, maximum) => {
      if (minimum > maximum) return (minimum + maximum) / 2;
      return Math.max(minimum, Math.min(maximum, value));
    };
    const snap = value => Math.round(value / gridSize) * gridSize;
    const candidates = [
      { x: bounds.x, y: snap(clamp(point.y, bounds.y + half, bounds.y + bounds.height - half)) },
      { x: bounds.x + bounds.width, y: snap(clamp(point.y, bounds.y + half, bounds.y + bounds.height - half)) },
      { x: snap(clamp(point.x, bounds.x + half, bounds.x + bounds.width - half)), y: bounds.y },
      { x: snap(clamp(point.x, bounds.x + half, bounds.x + bounds.width - half)), y: bounds.y + bounds.height }
    ];
    candidates.sort((a, b) => this._distance(a, point) - this._distance(b, point));
    return candidates[0];
  }

  static _face(bounds, anchor) {
    if (Math.abs(anchor.x - bounds.x) < 0.001) return "WEST";
    if (Math.abs(anchor.x - (bounds.x + bounds.width)) < 0.001) return "EAST";
    if (Math.abs(anchor.y - bounds.y) < 0.001) return "NORTH";
    return "SOUTH";
  }

  static _pixels(skeleton, sectors, gridSize) {
    if (!skeleton.length) return [];
    const sample = sectors.find(sector => sector.pixelBounds || sector.bounds);
    if (!sample) return [];
    const bounds = sample.pixelBounds || sample.bounds;
    const position = sample.gridPosition || { col: 0, row: 0 };
    const originX = bounds.x - Number(position.col || 0) * gridSize;
    const originY = bounds.y - Number(position.row || 0) * gridSize;
    return skeleton.map(segment => ({ x1: originX + segment.x1 * gridSize, y1: originY + segment.y1 * gridSize, x2: originX + segment.x2 * gridSize, y2: originY + segment.y2 * gridSize }));
  }

  static _project(point, segment) {
    if (segment.x1 === segment.x2) return { x: segment.x1, y: Math.max(Math.min(segment.y1, segment.y2), Math.min(Math.max(segment.y1, segment.y2), point.y)) };
    return { x: Math.max(Math.min(segment.x1, segment.x2), Math.min(Math.max(segment.x1, segment.x2), point.x)), y: segment.y1 };
  }

  static _anchor(bounds, point, width, gridSize) {
    const half = width / 2;
    const candidates = [
      { x: bounds.x, y: Math.max(bounds.y + half, Math.min(bounds.y + bounds.height - half, point.y)) },
      { x: bounds.x + bounds.width, y: Math.max(bounds.y + half, Math.min(bounds.y + bounds.height - half, point.y)) },
      { x: Math.max(bounds.x + half, Math.min(bounds.x + bounds.width - half, point.x)), y: bounds.y },
      { x: Math.max(bounds.x + half, Math.min(bounds.x + bounds.width - half, point.x)), y: bounds.y + bounds.height }
    ];
    candidates.sort((a, b) => this._distance(a, point) - this._distance(b, point));
    return { x: Math.round(candidates[0].x / gridSize) * gridSize, y: Math.round(candidates[0].y / gridSize) * gridSize };
  }

  static _distance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
}
