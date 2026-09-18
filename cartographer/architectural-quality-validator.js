// architectural-quality-validator.js
export class ArchitecturalQualityValidator {
  static validate(layout = {}, specification = {}) {
    const sectors = Array.isArray(layout.sectors) ? layout.sectors : [];
    const byId = new Map(sectors.map(s => [s.sectorId, s]));
    const openings = layout.openingPlan?.openings || [];
    const rectangles = layout.normalizedTopology?.rectangles || [];
    const envelope = specification.envelope || layout.envelope || this._envelope(sectors);
    const checks = {
      envelopeContainment: this._containment(sectors, envelope),
      requiredAdjacency: this._adjacency(byId, specification.requiredAdjacencies || []),
      actualOpeningReachability: this._reachability(sectors, openings, specification.entryIds || []),
      corridorRatio: this._corridorRatio(sectors, rectangles, specification.maxCorridorRatio ?? 0.18),
      corridorCount: this._corridorCount(rectangles, specification.maxCorridorRectangles ?? Infinity),
      compactness: this._compactness(sectors, envelope, specification.minEnvelopeUtilization ?? 0.62),
      internalVoids: this._internalVoids(sectors, envelope, specification.maxInternalVoidRatio ?? 0.02),
      exteriorEntry: this._exteriorEntry(openings, byId, envelope, specification.exteriorEntry),
      privacyPaths: this._privacyPaths(openings, specification.privacyRooms || [], specification.privacyAccessHub),
      windows: this._windows(sectors, envelope, specification.requiredWindowRooms || [])
    };
    const problems = Object.entries(checks).flatMap(([check, result]) =>
      result.valid ? [] : result.problems.map(problem => ({ check, ...problem }))
    );
    const roomArea = this._roomArea(sectors);
    const corridorArea = this._rectangleArea(rectangles);
    const envelopeArea = envelope.width * envelope.height;
    return {
      valid: problems.length === 0,
      checks,
      problems,
      metrics: {
        rooms: sectors.length,
        envelope,
        roomArea,
        corridorArea,
        corridorRatio: roomArea + corridorArea ? corridorArea / (roomArea + corridorArea) : 0,
        envelopeUtilization: envelopeArea ? roomArea / envelopeArea : 0,
        internalVoidRatio: envelopeArea ? Math.max(0, envelopeArea - roomArea) / envelopeArea : 0
      }
    };
  }

  static compareDeterminism(a, b) { return { valid: this._signature(a) === this._signature(b) }; }
  static compareVariability(a, b) { return { valid: this._signature(a) !== this._signature(b) }; }
  static _signature(layout) { return JSON.stringify((layout.sectors || []).map(s => [s.sectorId, s.gridPosition, s.gridDimensions]).sort()); }
  static _bounds(s) { return s?.bounds || s?.pixelBounds; }
  static _roomArea(sectors) { return sectors.reduce((n, s) => { const b=this._bounds(s); return n+(b?b.width*b.height:0); },0); }
  static _rectangleArea(rs) { return rs.reduce((n,r)=>n+(Number(r.width)||0)*(Number(r.height)||0),0); }
  static _envelope(sectors) { const bs=sectors.map(s=>this._bounds(s)).filter(Boolean); if(!bs.length)return{x:0,y:0,width:0,height:0}; const x=Math.min(...bs.map(b=>b.x)),y=Math.min(...bs.map(b=>b.y)),r=Math.max(...bs.map(b=>b.x+b.width)),d=Math.max(...bs.map(b=>b.y+b.height)); return{x,y,width:r-x,height:d-y}; }
  static _shared(a,b){ if(!a||!b)return 0; const e=.01, oy=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)), ox=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)); const v=Math.abs(a.x+a.width-b.x)<=e||Math.abs(b.x+b.width-a.x)<=e; const h=Math.abs(a.y+a.height-b.y)<=e||Math.abs(b.y+b.height-a.y)<=e; return Math.max(v?oy:0,h?ox:0); }
  static _containment(ss,e){const p=ss.filter(s=>{const b=this._bounds(s);return !b||b.x<e.x||b.y<e.y||b.x+b.width>e.x+e.width||b.y+b.height>e.y+e.height}).map(s=>({sectorId:s.sectorId,problem:"outside-envelope"}));return{valid:!p.length,problems:p};}
  static _adjacency(m,rs){const p=[];for(const r of rs){const shared=this._shared(this._bounds(m.get(r.source)),this._bounds(m.get(r.target)));if(shared<(r.minimumSharedBoundary||100))p.push({source:r.source,target:r.target,problem:"required-adjacency-missing",sharedBoundary:shared});}return{valid:!p.length,problems:p};}
  static _reachability(ss,os,entries){const g=new Map(ss.map(s=>[s.sectorId,new Set()]));for(const o of os){if(g.has(o.sourceId)&&g.has(o.targetId)){g.get(o.sourceId).add(o.targetId);g.get(o.targetId).add(o.sourceId)}}const q=entries.filter(x=>g.has(x)),v=new Set(q);while(q.length){for(const n of g.get(q.shift())||[])if(!v.has(n)){v.add(n);q.push(n)}}const p=ss.filter(s=>!v.has(s.sectorId)).map(s=>({sectorId:s.sectorId,problem:"unreachable-by-openings"}));return{valid:!p.length,problems:p};}
  static _corridorRatio(ss,rs,max){const a=this._roomArea(ss),c=this._rectangleArea(rs),ratio=a+c?c/(a+c):0;return{valid:ratio<=max,problems:ratio<=max?[]:[{problem:"corridor-ratio-exceeded",ratio,maximum:max}]};}
  static _corridorCount(rs,max){return{valid:rs.length<=max,problems:rs.length<=max?[]:[{problem:"too-many-corridor-rectangles",actual:rs.length,maximum:max}]};}
  static _compactness(ss,e,min){const a=e.width*e.height,u=a?this._roomArea(ss)/a:0;return{valid:u>=min,problems:u>=min?[]:[{problem:"low-envelope-utilization",utilization:u,minimum:min}]};}
  static _internalVoids(ss,e,max){const a=e.width*e.height,r=a?Math.max(0,a-this._roomArea(ss))/a:0;return{valid:r<=max,problems:r<=max?[]:[{problem:"internal-void-ratio-exceeded",voidRatio:r,maximum:max}]};}
  static _exteriorEntry(os,m,e,r){
    if(!r)return{valid:true,problems:[]};
    const s=m.get(r.hostId),b=this._bounds(s);
    const o=os.find(x=>x.hostId===r.hostId&&x.targetId===r.targetId&&x.exterior===true);
    const l=o?.location;
    const roomTouchesEnvelope=Boolean(b)&&(b.x===e.x||b.y===e.y||b.x+b.width===e.x+e.width||b.y+b.height===e.y+e.height);
    const faceMatchesBoundary=Boolean(o&&b&&l)&&({
      NORTH:o.face==="NORTH"&&b.y===e.y&&l.y===b.y&&l.x>=b.x&&l.x<=b.x+b.width,
      SOUTH:o.face==="SOUTH"&&b.y+b.height===e.y+e.height&&l.y===b.y+b.height&&l.x>=b.x&&l.x<=b.x+b.width,
      WEST:o.face==="WEST"&&b.x===e.x&&l.x===b.x&&l.y>=b.y&&l.y<=b.y+b.height,
      EAST:o.face==="EAST"&&b.x+b.width===e.x+e.width&&l.x===b.x+b.width&&l.y>=b.y&&l.y<=b.y+b.height
    }[o.face]===true);
    const valid=Boolean(o&&roomTouchesEnvelope&&faceMatchesBoundary);
    return{valid,problems:valid?[]:[{problem:"missing-valid-exterior-entry",hostId:r.hostId,face:o?.face||null,location:o?.location||null}]};
  }
  static _privacyPaths(os,rooms,hub){const g=new Map();for(const o of os){if(!o.sourceId||!o.targetId||o.targetId.startsWith("__"))continue;if(!g.has(o.sourceId))g.set(o.sourceId,new Set());if(!g.has(o.targetId))g.set(o.targetId,new Set());g.get(o.sourceId).add(o.targetId);g.get(o.targetId).add(o.sourceId)}const p=rooms.filter(r=>!g.get(r)?.has(hub)).map(r=>({roomId:r,problem:"privacy-room-not-directly-accessible-from-hub"}));return{valid:!p.length,problems:p};}
  static _windows(ss,e,required){const p=[];for(const id of required){const s=ss.find(x=>x.sectorId===id),b=this._bounds(s);if(!s?.windows?.length){p.push({roomId:id,problem:"required-window-missing"});continue}for(const w of s.windows){const ok={NORTH:b.y===e.y,SOUTH:b.y+b.height===e.y+e.height,WEST:b.x===e.x,EAST:b.x+b.width===e.x+e.width}[w.face];if(!ok)p.push({roomId:id,face:w.face,problem:"window-not-on-exterior"})}}return{valid:!p.length,problems:p};}
}
