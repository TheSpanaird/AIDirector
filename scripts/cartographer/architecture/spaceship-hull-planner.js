// spaceship-hull-planner.js
// Vessel-level hull geometry, polygon containment, hull walls, and airlock projection.

export class SpaceshipHullPlanner {
  static HULL_TYPES = Object.freeze({
    SHUTTLE: "SHUTTLE",
    FREIGHTER: "FREIGHTER",
    GUNSHIP: "GUNSHIP",
    WARSHIP: "WARSHIP",
    CAPITAL_SHIP: "CAPITAL_SHIP",
    RESEARCH_VESSEL: "RESEARCH_VESSEL",
    PASSENGER_VESSEL: "PASSENGER_VESSEL"
  });

  static plan(layout = {}, options = {}) {
    const gridSize = Math.max(1, Number(options.gridSize) || 100);
    const hullType = this._normalizeType(
      options.hullType || layout.sceneArchetype || "SHUTTLE"
    );
    const roomEnvelope = layout.envelope ||
      this._calculateEnvelope(layout.sectors || []);
    const padding = Math.max(
      Number(options.hullPadding) || gridSize * 2,
      gridSize
    );
    const polygon = this._buildPolygon(
      hullType,
      roomEnvelope,
      padding
    );
    const airlockAnchors = this._resolveAirlockAnchors(
      layout,
      polygon
    );
    const airlockWidth = Math.max(
      gridSize,
      Number(options.airlockWidth) || gridSize * 2
    );
    const wallPlan = this._buildHullWallPlan(
      polygon,
      airlockAnchors,
      airlockWidth
    );
    const airlockConnectors = this._buildAirlockConnectors(
      airlockAnchors,
      airlockWidth
    );
    const containment = this.validateRoomContainment(
      layout.sectors || [],
      polygon
    );

    return {
      hullType,
      roomEnvelope,
      envelope: this._polygonEnvelope(polygon),
      polygon,
      wallSegments: wallPlan.wallSegments,
      airlockSegments: wallPlan.airlockSegments,
      airlockConnectors,
      airlockAnchors,
      containment,
      decorativePolygons: this._buildDecorativePolygons(
        hullType,
        roomEnvelope,
        padding
      ),
      renderData: {
        fillColor: options.fillColor || "#202733",
        fillAlpha: options.fillAlpha ?? 0.55,
        strokeColor: options.strokeColor || "#7fa3c7",
        strokeWidth: options.strokeWidth ?? 4
      },
      metadata: {
        source: "SPACESHIP_HULL_PLANNER",
        layoutSeed: layout.layoutSeed || null
      }
    };
  }

  static validateRoomContainment(sectors = [], polygon = []) {
    const failures = [];
    for (const sector of sectors) {
      const bounds = sector.bounds || sector.pixelBounds;
      if (!bounds) {
        failures.push({ sectorId: sector.sectorId, problem: "missing-bounds" });
        continue;
      }
      const corners = [
        { x: bounds.x, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
        { x: bounds.x, y: bounds.y + bounds.height }
      ];
      const outside = corners.filter(point =>
        !this._pointInPolygonOrBoundary(point, polygon)
      );
      if (outside.length) {
        failures.push({
          sectorId: sector.sectorId,
          problem: "room-crosses-hull",
          outsideCorners: outside
        });
      }
    }
    return { valid: failures.length === 0, failures };
  }

  static _buildPolygon(type, envelope, padding) {
    switch (type) {
      case "SHUTTLE":
        return this._buildShuttleHull(envelope, padding);
      case "FREIGHTER":
        return this._buildFreighterHull(envelope, padding);
      case "GUNSHIP":
        return this._buildGunshipHull(envelope, padding);
      case "CAPITAL_SHIP":
        return this._buildCapitalHull(envelope, padding);
      default:
        return this._buildLinearHull(envelope, padding);
    }
  }

  static _buildShuttleHull(envelope, padding) {
    const left = envelope.x;
    const top = envelope.y;
    const right = envelope.x + envelope.width;
    const bottom = envelope.y + envelope.height;
    const centerY = top + envelope.height / 2;

    // The full room envelope is retained inside the polygon.
    // The tapered bow extends beyond the cockpit rather than cutting through it.
    return [
      [left - padding * 1.8, centerY],
      [left, top - padding * 0.35],
      [right - padding * 0.8, top - padding],
      [right + padding, top - padding * 0.55],
      [right + padding, bottom + padding * 0.55],
      [right - padding * 0.8, bottom + padding],
      [left, bottom + padding * 0.35]
    ];
  }

  static _buildFreighterHull(envelope, padding) {
    const l=envelope.x,t=envelope.y,r=l+envelope.width,b=t+envelope.height,cy=t+envelope.height/2;
    return [[l-padding,cy],[l,t-padding*.35],[r-padding*.4,t-padding],[r+padding,t-padding],[r+padding,b+padding],[r-padding*.4,b+padding],[l,b+padding*.35]];
  }

  static _buildGunshipHull(envelope, padding) {
    const left = envelope.x;
    const top = envelope.y;
    const right = envelope.x + envelope.width;
    const bottom = envelope.y + envelope.height;
    const centerY = top + envelope.height / 2;

    return [
      [left - padding * 1.9, centerY],
      [left - padding * 0.35, top - padding * 0.35],
      [left + envelope.width * 0.38, top - padding],
      [right - padding * 0.35, top - padding * 0.65],
      [right + padding * 0.85, top - padding * 0.2],
      [right + padding * 0.85, bottom + padding * 0.2],
      [right - padding * 0.35, bottom + padding * 0.65],
      [left + envelope.width * 0.38, bottom + padding],
      [left - padding * 0.35, bottom + padding * 0.35]
    ];
  }

  static _buildDecorativePolygons(type, envelope, padding) {
    if (type !== "GUNSHIP") return [];

    const left = envelope.x;
    const top = envelope.y;
    const right = envelope.x + envelope.width;
    const bottom = envelope.y + envelope.height;
    const podStart = left + envelope.width * 0.42;
    const podEnd = right + padding * 0.55;
    const podDepth = Math.max(padding * 0.7, envelope.height * 0.16);

    return [
      {
        decorativeType: "ENGINE_POD_PORT",
        polygon: [
          [podStart, top - padding * 1.45],
          [podEnd, top - padding * 1.15],
          [podEnd + padding * 0.25, top - padding * 0.45],
          [podStart, top - padding * 0.55]
        ]
      },
      {
        decorativeType: "ENGINE_POD_STARBOARD",
        polygon: [
          [podStart, bottom + padding * 0.55],
          [podEnd + padding * 0.25, bottom + padding * 0.45],
          [podEnd, bottom + padding * 1.15],
          [podStart, bottom + padding * 1.45]
        ]
      }
    ].map(item => ({ ...item, depth: podDepth }));
  }

  static _buildCapitalHull(envelope, padding) {
    const l=envelope.x,t=envelope.y,r=l+envelope.width,b=t+envelope.height,cy=t+envelope.height/2;
    return [[l-padding*1.5,cy],[l,t-padding*.6],[l+envelope.width*.5,t-padding],[r+padding,t-padding*.5],[r+padding,b+padding*.5],[l+envelope.width*.5,b+padding],[l,b+padding*.6]];
  }

  static _buildLinearHull(envelope, padding) {
    const l=envelope.x,t=envelope.y,r=l+envelope.width,b=t+envelope.height,cy=t+envelope.height/2;
    return [[l-padding,cy],[l,t-padding],[r,t-padding],[r+padding,cy],[r,b+padding],[l,b+padding]];
  }

  static _resolveAirlockAnchors(layout, polygon) {
    return (layout.openingPlan?.openings || [])
      .filter(opening =>
        opening.connectionType === "AIRLOCK" ||
        opening.targetId === "__exterior__"
      )
      .map(opening => ({
        openingId: opening.openingId,
        hostId: opening.hostId,
        requestedLocation: { ...opening.location },
        hullLocation: this._nearestPointOnPolygon(
          opening.location,
          polygon
        )
      }));
  }

  static _buildAirlockConnectors(anchors, width) {
    return anchors
      .map(anchor => {
        const start = anchor.requestedLocation;
        const end = anchor.hullLocation;
        if (!start || !end) return null;

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        if (length <= 0.01) {
          return {
            openingId: anchor.openingId,
            hostId: anchor.hostId,
            length: 0,
            wallSegments: [],
            floorPolygon: []
          };
        }

        const nx = -dy / length;
        const ny = dx / length;
        const half = width / 2;

        const startLeft = { x: start.x + nx * half, y: start.y + ny * half };
        const startRight = { x: start.x - nx * half, y: start.y - ny * half };
        const endLeft = { x: end.x + nx * half, y: end.y + ny * half };
        const endRight = { x: end.x - nx * half, y: end.y - ny * half };

        return {
          openingId: anchor.openingId,
          hostId: anchor.hostId,
          length,
          width,
          start: { x: start.x, y: start.y },
          end: { x: end.x, y: end.y },
          wallSegments: [
            {
              x1: startLeft.x,
              y1: startLeft.y,
              x2: endLeft.x,
              y2: endLeft.y,
              source: "SPACESHIP_AIRLOCK_CONNECTOR"
            },
            {
              x1: startRight.x,
              y1: startRight.y,
              x2: endRight.x,
              y2: endRight.y,
              source: "SPACESHIP_AIRLOCK_CONNECTOR"
            }
          ],
          floorPolygon: [
            [startLeft.x, startLeft.y],
            [endLeft.x, endLeft.y],
            [endRight.x, endRight.y],
            [startRight.x, startRight.y]
          ]
        };
      })
      .filter(Boolean);
  }

  static _buildHullWallPlan(polygon, anchors, airlockWidth) {
    let wallSegments = this._polygonToSegments(polygon);
    const airlockSegments = [];

    for (const anchor of anchors) {
      const host = wallSegments.find(
        segment => segment.segmentIndex === anchor.hullLocation.segmentIndex
      );
      if (!host) continue;

      const split = this._splitSegmentForOpening(
        host,
        anchor.hullLocation,
        airlockWidth
      );
      wallSegments = wallSegments.filter(segment => segment !== host);
      wallSegments.push(...split.walls);
      airlockSegments.push({
        ...split.opening,
        openingId: anchor.openingId,
        hostId: anchor.hostId,
        source: "SPACESHIP_HULL_AIRLOCK"
      });
    }

    return { wallSegments, airlockSegments };
  }

  static _splitSegmentForOpening(segment, point, width) {
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const length = Math.hypot(dx, dy);
    if (!length) return { walls: [segment], opening: null };
    const ux = dx / length;
    const uy = dy / length;
    const half = Math.min(width / 2, length * 0.4);
    const opening = {
      x1: point.x - ux * half,
      y1: point.y - uy * half,
      x2: point.x + ux * half,
      y2: point.y + uy * half
    };
    const walls = [];
    if (Math.hypot(opening.x1-segment.x1,opening.y1-segment.y1) > 0.01) {
      walls.push({ ...segment, x2: opening.x1, y2: opening.y1 });
    }
    if (Math.hypot(segment.x2-opening.x2,segment.y2-opening.y2) > 0.01) {
      walls.push({ ...segment, x1: opening.x2, y1: opening.y2 });
    }
    return { walls, opening };
  }

  static _pointInPolygonOrBoundary(point, polygon) {
    for (let index=0; index<polygon.length; index++) {
      if (this._pointOnSegment(point, polygon[index], polygon[(index+1)%polygon.length])) return true;
    }
    let inside = false;
    for (let i=0,j=polygon.length-1; i<polygon.length; j=i++) {
      const xi=polygon[i][0], yi=polygon[i][1];
      const xj=polygon[j][0], yj=polygon[j][1];
      const intersects=((yi>point.y)!==(yj>point.y)) &&
        point.x < ((xj-xi)*(point.y-yi))/(yj-yi)+xi;
      if (intersects) inside=!inside;
    }
    return inside;
  }

  static _pointOnSegment(point, start, end) {
    const cross=(point.y-start[1])*(end[0]-start[0])-(point.x-start[0])*(end[1]-start[1]);
    if (Math.abs(cross)>0.01) return false;
    return point.x>=Math.min(start[0],end[0])-.01 && point.x<=Math.max(start[0],end[0])+.01 &&
      point.y>=Math.min(start[1],end[1])-.01 && point.y<=Math.max(start[1],end[1])+.01;
  }

  static _nearestPointOnPolygon(point, polygon) {
    let best=null;
    polygon.forEach((start,index)=>{
      const end=polygon[(index+1)%polygon.length];
      const projected=this._projectPointToSegment(point,start,end);
      const distance=Math.hypot(projected.x-point.x,projected.y-point.y);
      if(!best||distance<best.distance)best={...projected,segmentIndex:index,distance};
    });
    return best;
  }

  static _projectPointToSegment(point,start,end) {
    const dx=end[0]-start[0],dy=end[1]-start[1],lengthSquared=dx*dx+dy*dy;
    if(!lengthSquared)return{x:start[0],y:start[1]};
    const t=Math.max(0,Math.min(1,((point.x-start[0])*dx+(point.y-start[1])*dy)/lengthSquared));
    return{x:start[0]+t*dx,y:start[1]+t*dy};
  }

  static _polygonToSegments(polygon) {
    return polygon.map((point,index)=>{
      const next=polygon[(index+1)%polygon.length];
      return{x1:point[0],y1:point[1],x2:next[0],y2:next[1],segmentIndex:index,source:"SPACESHIP_HULL"};
    });
  }

  static _polygonEnvelope(polygon) {
    const xs=polygon.map(point=>point[0]),ys=polygon.map(point=>point[1]);
    const x=Math.min(...xs),y=Math.min(...ys);
    return{x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};
  }

  static _calculateEnvelope(sectors) {
    const bounds=sectors.map(sector=>sector.bounds||sector.pixelBounds).filter(Boolean);
    if(!bounds.length)return{x:0,y:0,width:0,height:0};
    const x=Math.min(...bounds.map(b=>b.x)),y=Math.min(...bounds.map(b=>b.y));
    const right=Math.max(...bounds.map(b=>b.x+b.width)),bottom=Math.max(...bounds.map(b=>b.y+b.height));
    return{x,y,width:right-x,height:bottom-y};
  }

  static _normalizeType(value) {
    const normalized=String(value||"SHUTTLE").trim().toUpperCase().replace(/[\s-]+/g,"_");
    return this.HULL_TYPES[normalized]||"SHUTTLE";
  }
}
