// fortification-perimeter-planner.js
export class FortificationPerimeterPlanner {
  static plan(layout = {}, options = {}) {
    const gridSize = Math.max(1, Number(options.gridSize) || 100);
    if (!layout.envelope) throw new Error("Fortification perimeter requires layout.envelope.");

    if (String(options.perimeterStyle || "").toUpperCase() === "PALISADE_MOTTE_BAILEY") {
      return this._keepAndBailey(layout, gridSize, options);
    }

    return this._rectangular(layout.envelope, gridSize, options);
  }

  static _keepAndBailey(layout, gridSize, options) {
    const sectors = Array.isArray(layout.sectors) ? layout.sectors : [];
    const byId = new Map(sectors.map(sector => [sector.sectorId, sector]));
    const keepRooms = ["keep-entry", "keep-guardroom", "keep-storage", "keep-internal-stair"]
      .map(id => byId.get(id))
      .filter(Boolean);
    const gatehouse = byId.get("gatehouse") || null;

    const keepBounds = this._boundsOfSectors(keepRooms) || layout.envelope;
    const keepCenter = {
      x: keepBounds.x + keepBounds.width / 2,
      y: keepBounds.y + keepBounds.height / 2
    };

    const gatehouseCenter = this._sectorCenter(gatehouse) || this._layoutCenter(layout.envelope);
    const excluded = new Set(["keep-entry", "keep-guardroom", "keep-storage", "keep-internal-stair", "motte-approach"]);
    const baileySectors = sectors.filter(sector => !excluded.has(sector.sectorId));
    const baileyBounds = this._boundsOfSectors(baileySectors) || layout.envelope;

    const baileyCenter = {
      x: gatehouseCenter.x,
      y: baileyBounds.y + baileyBounds.height / 2
    };

    const baseBaileyRadius = this._radiusToContainSectors(baileyCenter, baileySectors, gridSize * 1.75);
    const desiredSouthGateY = gatehouse?.bounds
      ? gatehouse.bounds.y + gatehouse.bounds.height + gridSize * 2
      : gatehouseCenter.y + gridSize * 3.5;
    const baileyRadius = Math.max(baseBaileyRadius, desiredSouthGateY - baileyCenter.y);
    baileyCenter.y = desiredSouthGateY - baileyRadius;

    const baileyDitchRadius = baileyRadius + gridSize * 1.35;
    const baileyPolygon = this._regularPolygon(baileyCenter.x, baileyCenter.y, baileyRadius, 64);
    const baileyDitchPolygon = this._regularPolygon(baileyCenter.x, baileyCenter.y, baileyDitchRadius, 64);

    const keepWallRadius = Math.max(gridSize * 4.1, Math.max(keepBounds.width, keepBounds.height) / 2 + gridSize * 1.25);
    const keepDitchRadius = keepWallRadius + gridSize * 0.9;
    const keepPolygon = this._regularPolygon(keepCenter.x, keepCenter.y, keepWallRadius, 56);
    const keepDitchPolygon = this._regularPolygon(keepCenter.x, keepCenter.y, keepDitchRadius, 56);

    const connectorWidth = gridSize * 3.2;
    const connectorPolygon = this._connectorPolygon(keepCenter, keepWallRadius, baileyCenter, baileyRadius, connectorWidth);
    const [topLeft, topRight, bottomRight, bottomLeft] = connectorPolygon;

    // Explicit gate segments match the bridge/connector width exactly. These replace the
    // curved wall pieces crossing the bridge so tokens can pass and see through.
    const keepGateSegment = {
      x1: topLeft[0],
      y1: topLeft[1],
      x2: topRight[0],
      y2: topRight[1],
      source: "KEEP_GATE_OPENING"
    };
    const baileyConnectorGateSegment = {
      x1: bottomLeft[0],
      y1: bottomLeft[1],
      x2: bottomRight[0],
      y2: bottomRight[1],
      source: "BAILEY_CONNECTOR_GATE_OPENING"
    };

    const connectorWallSegments = this._connectorWallSegments(connectorPolygon);

    const southGateAnchor = { x: gatehouseCenter.x, y: baileyCenter.y + baileyRadius };
    const southSplit = this._splitForGate(this._segments(baileyPolygon, "BAILEY_PALISADE"), southGateAnchor, gridSize * 3.2);
    const entryThroatWallSegments = this._entryThroatWalls(southSplit.gate, gatehouse, gridSize * 3.2);
    const gateLeft = entryThroatWallSegments[0]
      ? { x: entryThroatWallSegments[0].x2, y: entryThroatWallSegments[0].y2 }
      : { x: southSplit.gate.x1, y: southSplit.gate.y1 };
    const gateRight = entryThroatWallSegments[1]
      ? { x: entryThroatWallSegments[1].x2, y: entryThroatWallSegments[1].y2 }
      : { x: southSplit.gate.x2, y: southSplit.gate.y2 };
    const fullOuterGateSegment = {
      x1: gateLeft.x,
      y1: gateLeft.y,
      x2: gateRight.x,
      y2: gateRight.y,
      source: "OUTER_GATE_FULL_THROAT_OPENING"
    };
    const entryClearance = this._entryThroatClearancePolygon(fullOuterGateSegment, gatehouse, Math.hypot(gateRight.x - gateLeft.x, gateRight.y - gateLeft.y));

    // Remove any ring segments that intersect the bridge footprint. This is stronger than
    // midpoint-only removal and cleans up the two circled junctions in the screenshot.
    const connectorClearance = this._expandPolygon(connectorPolygon, gridSize * 0.18);
    const cleanedOuterWalls = this._removeSegmentsTouchingPolygons(
      southSplit.walls,
      [connectorClearance, entryClearance].filter(Boolean)
    );
    const cleanedInnerWalls = this._removeSegmentsTouchingPolygons(
      this._segments(keepPolygon, "KEEP_CURTAIN_WALL"),
      [connectorClearance]
    );

    // Bridge wing walls reconnect the curved rings to the open door endpoints.
    // Entry throat wing walls preserve the gatehouse cleanup by reconnecting the outer wall
    // to the full-width gatehouse throat door without recreating duplicate gatehouse doors.
    const connectorWingWallSegments = [
      ...this._wingWallsToNearestEndpoints(cleanedInnerWalls, topLeft, topRight, "KEEP_CONNECTOR_WING_WALL"),
      ...this._wingWallsToNearestEndpoints(cleanedOuterWalls, bottomLeft, bottomRight, "BAILEY_CONNECTOR_WING_WALL")
    ];
    const entryThroatWingWallSegments = this._wingWallsToNearestEndpoints(
      cleanedOuterWalls,
      [gateLeft.x, gateLeft.y],
      [gateRight.x, gateRight.y],
      "ENTRY_THROAT_WING_WALL"
    );

    const towerCount = this._towerCount(layout, options);
    const towers = this._watchTowers(baileyCenter, baileyRadius, gridSize, towerCount);

    return {
      perimeterType: "FORTIFICATION",
      style: "PALISADE_MOTTE_BAILEY_TWO_RING",
      polygon: baileyPolygon,
      baileyPolygon,
      keepPolygon,
      ditchPolygon: baileyDitchPolygon,
      ditchPolygons: [baileyDitchPolygon, keepDitchPolygon],
      keepDitchPolygon,
      connectorPolygon,
      connectorWallSegments,
      connectorWingWallSegments,
      entryThroatWallSegments,
      entryThroatWingWallSegments,
      connectorPath: {
        from: { x: keepCenter.x, y: keepCenter.y + keepWallRadius },
        to: { x: baileyCenter.x, y: baileyCenter.y - baileyRadius },
        width: connectorWidth,
        terrainType: "ROAD"
      },
      envelope: this._envelope([...baileyDitchPolygon, ...keepDitchPolygon, ...connectorPolygon]),
      wallSegments: cleanedOuterWalls,
      gateSegment: fullOuterGateSegment,
      baileyConnectorGateSegment,
      gatehouseAnchor: southGateAnchor,
      innerPolygon: keepPolygon,
      innerWallSegments: cleanedInnerWalls,
      keepGateSegment,
      towers,
      towerCount: towers.length,
      motte: {
        center: keepCenter,
        radiusX: keepWallRadius + gridSize,
        radiusY: keepWallRadius + gridSize * 1.6,
        elevationRole: "RAISED_MOTTE",
        placement: "NORTH_INTERNAL_SEPARATE_KEEP_RING"
      },
      bailey: { center: baileyCenter, radius: baileyRadius, shape: "CIRCULAR" },
      keepWall: { center: keepCenter, radius: keepWallRadius, shape: "CIRCULAR" },
      fortificationNetwork: {
        wallWalk: true,
        wallWalkMode: "METADATA_ONLY",
        hasDitch: true,
        ringLayout: "TWO_RING_MOTTE_AND_BAILEY",
        outerWallShape: "CIRCULAR",
        motteShape: "OVAL",
        keepWallShape: "CIRCULAR",
        connectorShape: "WALLED_OPEN_NECK",
        watchTowers: towers.length
      },
      renderData: {
        fillColor: "#6d5a35",
        fillAlpha: 0.10,
        strokeColor: "#9b7a42",
        strokeWidth: 8,
        ditchFillColor: "#3f5f69",
        ditchFillAlpha: 0.10,
        connectorFillColor: "#6f6047",
        connectorFillAlpha: 0.22
      },
      metadata: {
        source: "FORTIFICATION_PERIMETER_PLANNER",
        wallSystem: "TWO_RING_PALISADE_AND_KEEP",
        wallWalk: true,
        wallWalkMode: "METADATA_ONLY",
        hasDitch: true,
        towerCount: towers.length,
        mottePlacement: "NORTH_INTERNAL_SEPARATE_KEEP_RING",
        ringLayout: "TWO_RING_MOTTE_AND_BAILEY",
        connectorWalls: true,
        connectorWingWalls: true,
        entryThroatWingWalls: true,
        gatesReplaceBridgeCrossingWalls: true,
        roadsDeferred: false
      }
    };
  }

  static _rectangular(e, gridSize, options) {
    const p = gridSize * 1.5;
    const l = e.x - p;
    const t = e.y - p;
    const r = e.x + e.width + p;
    const b = e.y + e.height + p;
    const polygon = [[l, t], [r, t], [r, b], [l, b]];
    const split = this._splitForGate(this._segments(polygon, "CURTAIN_WALL"), { x: (l + r) / 2, y: b }, gridSize * 3);
    return {
      perimeterType: "FORTIFICATION",
      style: "RECTANGULAR",
      polygon,
      envelope: this._envelope(polygon),
      wallSegments: split.walls,
      gateSegment: split.gate,
      innerPolygon: [],
      innerWallSegments: [],
      towers: [],
      towerCount: 0,
      renderData: { fillColor: "#464233", fillAlpha: 0.12, strokeColor: "#8f825f", strokeWidth: 6 },
      metadata: { source: "FORTIFICATION_PERIMETER_PLANNER" }
    };
  }

  static _layoutCenter(envelope) {
    return { x: envelope.x + envelope.width / 2, y: envelope.y + envelope.height / 2 };
  }

  static _sectorCenter(sector) {
    const b = sector?.bounds || sector?.pixelBounds;
    return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
  }

  static _boundsOfSectors(sectors = []) {
    const bounds = sectors.map(sector => sector?.bounds || sector?.pixelBounds).filter(Boolean);
    if (!bounds.length) return null;
    const x = Math.min(...bounds.map(b => b.x));
    const y = Math.min(...bounds.map(b => b.y));
    const right = Math.max(...bounds.map(b => b.x + b.width));
    const bottom = Math.max(...bounds.map(b => b.y + b.height));
    return { x, y, width: right - x, height: bottom - y };
  }

  static _radiusToContainSectors(center, sectors, padding) {
    let radius = 0;
    for (const sector of sectors) {
      const b = sector.bounds || sector.pixelBounds;
      if (!b) continue;
      const corners = [
        { x: b.x, y: b.y },
        { x: b.x + b.width, y: b.y },
        { x: b.x + b.width, y: b.y + b.height },
        { x: b.x, y: b.y + b.height }
      ];
      for (const corner of corners) {
        radius = Math.max(radius, Math.hypot(corner.x - center.x, corner.y - center.y));
      }
    }
    return radius + padding;
  }

  static _connectorPolygon(keepCenter, keepRadius, baileyCenter, baileyRadius, width) {
    const half = width / 2;
    const y1 = keepCenter.y + keepRadius;
    const y2 = baileyCenter.y - baileyRadius;
    const x = (keepCenter.x + baileyCenter.x) / 2;
    return [
      [x - half, y1],
      [x + half, y1],
      [x + half, y2],
      [x - half, y2]
    ];
  }

  static _connectorWallSegments(connectorPolygon) {
    if (!Array.isArray(connectorPolygon) || connectorPolygon.length < 4) return [];
    const [topLeft, topRight, bottomRight, bottomLeft] = connectorPolygon;
    return [
      { x1: topLeft[0], y1: topLeft[1], x2: bottomLeft[0], y2: bottomLeft[1], source: "KEEP_BAILEY_CONNECTOR_WALL" },
      { x1: topRight[0], y1: topRight[1], x2: bottomRight[0], y2: bottomRight[1], source: "KEEP_BAILEY_CONNECTOR_WALL" }
    ];
  }

  static _wingWallsToNearestEndpoints(wallSegments, leftPoint, rightPoint, source) {
    const left = { x: leftPoint[0], y: leftPoint[1] };
    const right = { x: rightPoint[0], y: rightPoint[1] };
    const leftEndpoint = this._nearestWallEndpoint(wallSegments, left, point => point.x <= left.x);
    const rightEndpoint = this._nearestWallEndpoint(wallSegments, right, point => point.x >= right.x);
    const segments = [];

    if (leftEndpoint && Math.hypot(leftEndpoint.x - left.x, leftEndpoint.y - left.y) > 1) {
      segments.push({ x1: leftEndpoint.x, y1: leftEndpoint.y, x2: left.x, y2: left.y, source });
    }
    if (rightEndpoint && Math.hypot(rightEndpoint.x - right.x, rightEndpoint.y - right.y) > 1) {
      segments.push({ x1: right.x, y1: right.y, x2: rightEndpoint.x, y2: rightEndpoint.y, source });
    }

    return segments;
  }

  static _nearestWallEndpoint(wallSegments, point, predicate = () => true) {
    const endpoints = [];
    for (const segment of wallSegments || []) {
      endpoints.push({ x: segment.x1, y: segment.y1 });
      endpoints.push({ x: segment.x2, y: segment.y2 });
    }
    const candidates = endpoints.filter(predicate);
    const pool = candidates.length ? candidates : endpoints;
    let best = null;
    let bestDistance = Infinity;
    for (const endpoint of pool) {
      const distance = Math.hypot(endpoint.x - point.x, endpoint.y - point.y);
      if (distance < bestDistance) {
        best = endpoint;
        bestDistance = distance;
      }
    }
    return best;
  }

  static _entryThroatWalls(gateSegment, gatehouse, width) {
    const b = gatehouse?.bounds || gatehouse?.pixelBounds;
    if (!gateSegment || !b) return [];
    const mid = this._segmentMidpoint(gateSegment);
    const half = width / 2;
    return [
      { x1: b.x, y1: b.y + b.height, x2: mid.x - half, y2: mid.y, source: "ENTRY_THROAT_WALL" },
      { x1: b.x + b.width, y1: b.y + b.height, x2: mid.x + half, y2: mid.y, source: "ENTRY_THROAT_WALL" }
    ];
  }

  static _entryThroatClearancePolygon(gateSegment, gatehouse, width) {
    const b = gatehouse?.bounds || gatehouse?.pixelBounds;
    if (!gateSegment || !b) return null;
    const mid = this._segmentMidpoint(gateSegment);
    const half = width / 2;
    return [
      [b.x, b.y + b.height],
      [b.x + b.width, b.y + b.height],
      [mid.x + half, mid.y],
      [mid.x - half, mid.y]
    ];
  }

  static _expandPolygon(polygon, amount) {
    if (!Array.isArray(polygon) || !polygon.length || !amount) return polygon;
    const center = {
      x: polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length,
      y: polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length
    };
    return polygon.map(([x, y]) => {
      const dx = x - center.x;
      const dy = y - center.y;
      const len = Math.hypot(dx, dy) || 1;
      return [x + dx / len * amount, y + dy / len * amount];
    });
  }

  static _removeSegmentsTouchingPolygons(segments, polygons) {
    return segments.filter(segment => !polygons.some(polygon => this._segmentTouchesPolygon(segment, polygon)));
  }

  static _segmentTouchesPolygon(segment, polygon) {
    if (!polygon?.length) return false;
    const midpoint = this._segmentMidpoint(segment);
    if (this._pointInPolygon(midpoint, polygon)) return true;
    if (this._pointInPolygon({ x: segment.x1, y: segment.y1 }, polygon)) return true;
    if (this._pointInPolygon({ x: segment.x2, y: segment.y2 }, polygon)) return true;

    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      if (this._segmentsIntersect(
        [segment.x1, segment.y1],
        [segment.x2, segment.y2],
        a,
        b
      )) return true;
    }
    return false;
  }

  static _segmentsIntersect(a, b, c, d) {
    const orient = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    const onSegment = (p, q, r) => Math.min(p[0], r[0]) <= q[0] && q[0] <= Math.max(p[0], r[0]) && Math.min(p[1], r[1]) <= q[1] && q[1] <= Math.max(p[1], r[1]);
    const o1 = orient(a, b, c);
    const o2 = orient(a, b, d);
    const o3 = orient(c, d, a);
    const o4 = orient(c, d, b);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(a, c, b)) return true;
    if (o2 === 0 && onSegment(a, d, b)) return true;
    if (o3 === 0 && onSegment(c, a, d)) return true;
    if (o4 === 0 && onSegment(c, b, d)) return true;
    return false;
  }

  static _pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  static _segmentMidpoint(segment) {
    return { x: (segment.x1 + segment.x2) / 2, y: (segment.y1 + segment.y2) / 2 };
  }

  static _towerCount(layout, options) {
    const requested = Number(options.towerCount ?? layout.towerCount);
    if (Number.isFinite(requested)) return Math.max(0, Math.min(2, Math.round(requested)));
    return this._hash(String(layout.layoutSeed || "keep-bailey")) % 3;
  }

  static _watchTowers(center, radius, gridSize, count) {
    const placements = count === 1
      ? [{ id: "watch-tower-south", angle: Math.PI / 2, position: "SOUTH_GATE_APPROACH" }]
      : [
          { id: "watch-tower-west", angle: Math.PI * 0.82, position: "WEST_PALISADE" },
          { id: "watch-tower-east", angle: Math.PI * 0.18, position: "EAST_PALISADE" }
        ];
    return placements.slice(0, count).map(item => ({
      towerId: item.id,
      type: "WATCH_TOWER",
      role: "PALISADE_DEFENSE",
      position: item.position,
      floorCount: 2,
      wallWalkAccess: true,
      location: {
        x: center.x + Math.cos(item.angle) * radius,
        y: center.y + Math.sin(item.angle) * radius
      },
      radius: gridSize * 0.85
    }));
  }

  static _regularPolygon(cx, cy, r, n) {
    return Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / n;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    });
  }

  static _segments(p, source) {
    return p.map((a, i) => {
      const b = p[(i + 1) % p.length];
      return { x1: a[0], y1: a[1], x2: b[0], y2: b[1], source };
    });
  }

  static _splitForGate(segments, point, width) {
    let best = segments[0];
    let bp = this._project(point, best);
    let bd = Math.hypot(bp.x - point.x, bp.y - point.y);

    for (const s of segments.slice(1)) {
      const p = this._project(point, s);
      const d = Math.hypot(p.x - point.x, p.y - point.y);
      if (d < bd) {
        best = s;
        bp = p;
        bd = d;
      }
    }

    const dx = best.x2 - best.x1;
    const dy = best.y2 - best.y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const half = Math.min(width / 2, len * 0.35);
    const gate = {
      x1: bp.x - ux * half,
      y1: bp.y - uy * half,
      x2: bp.x + ux * half,
      y2: bp.y + uy * half,
      source: "FORTIFICATION_GATE"
    };

    return {
      walls: segments.filter(s => s !== best).concat([
        { ...best, x2: gate.x1, y2: gate.y1 },
        { ...best, x1: gate.x2, y1: gate.y2 }
      ]),
      gate
    };
  }

  static _project(p, s) {
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const q = dx * dx + dy * dy;
    const t = q
      ? Math.max(0, Math.min(1, ((p.x - s.x1) * dx + (p.y - s.y1) * dy) / q))
      : 0;
    return { x: s.x1 + t * dx, y: s.y1 + t * dy };
  }

  static _envelope(p) {
    const xs = p.map(x => x[0]);
    const ys = p.map(x => x[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }

  static _hash(value) {
    let hash = 2166136261;
    for (const character of String(value || "")) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}
