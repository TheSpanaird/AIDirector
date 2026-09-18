// Foundry VTT visual and connectivity test for all fortified-site configurations.
(async () => {
  const ROOT = "/modules/ai-director/scripts/cartographer";
  const ARCH = `${ROOT}/architecture`;
  const GRID_SIZE = 100;
  const PREFIX = "[Fortified Review]";

  try {
    if (!game.user?.isGM) throw new Error("A GM account is required.");
    const stamp = Date.now();
    const [{ FortifiedSiteGrammar }, { CartographerRoomRenderer }, { RoomLabelRenderer }, { CartographerWallRenderer }] = await Promise.all([
      import(`${ARCH}/fortified-site-grammar.js?v=${stamp}`),
      import(`${ROOT}/room-renderer.js?v=${stamp}`),
      import(`${ROOT}/room-label-renderer.js?v=${stamp}`),
      import(`${ROOT}/wall-renderer.js?v=${stamp}`)
    ]);

    for (const scene of game.scenes.contents.filter(s => s.name.startsWith(PREFIX))) await scene.delete();
    const rows = [];
    const signatures = new Map();

    for (const [subtype, configurations] of Object.entries(FortifiedSiteGrammar.CONFIGURATIONS)) {
      const levels = { OUTPOST: 2, FORT: 2, CASTLE: 3, FORTRESS: 4 }[subtype];
      for (const configuration of configurations) {
        for (let floor = 1; floor <= levels; floor++) {
          try {
            const layout = FortifiedSiteGrammar.build(
              { structureType: subtype, totalLevels: levels, sectors: [] },
              { structureType: subtype, fortifiedConfiguration: configuration, totalLevels: levels, floor, gridSize: GRID_SIZE, originX: 1000, originY: 1000, layoutSeed: `${configuration}-${floor}` }
            );
            const ids = new Set(layout.sectors.map(r => r.sectorId));
            const graph = new Map([...ids].map(id => [id, new Set()]));
            for (const o of layout.openings || []) if (ids.has(o.sourceId) && ids.has(o.targetId)) {
              graph.get(o.sourceId).add(o.targetId); graph.get(o.targetId).add(o.sourceId);
            }
            const start = floor === 1 ? "gatehouse" : "upper-hall";
            const visited = new Set([start]), queue = [start];
            while (queue.length) for (const n of graph.get(queue.shift()) || []) if (!visited.has(n)) { visited.add(n); queue.push(n); }
            const unreachable = [...ids].filter(id => !visited.has(id));
            const forbidden = layout.sectors.filter(r => ["L","T","L_SHAPE","T_SHAPE"].includes(String(r.shapeType).toUpperCase()));
            if (floor === 1) signatures.set(configuration, JSON.stringify(layout.sectors.map(r => [r.sectorId,r.gridPosition,r.gridDimensions,r.shapeType])));

            const e = layout.envelope, margin = 800;
            const scene = await Scene.create({ name:`${PREFIX} ${subtype} | ${configuration} | F${floor}`, navigation:false, width:Math.ceil((e.x+e.width+margin)/GRID_SIZE)*GRID_SIZE, height:Math.ceil((e.y+e.height+margin)/GRID_SIZE)*GRID_SIZE, padding:.02, grid:{type:CONST.GRID_TYPES.SQUARE,size:GRID_SIZE,distance:5,units:"ft"}, tokenVision:true, globalLight:true });
            const manifestId=`fortified-review-${configuration.toLowerCase()}-${floor}`, generationId=`${manifestId}-${Date.now()}`, metadata={gridSize:GRID_SIZE,manifestId,generationId};
            const rooms=await CartographerRoomRenderer.render(layout,scene,metadata);
            const labels=await RoomLabelRenderer.render(layout,scene,metadata);
            const walls=await CartographerWallRenderer.render(layout,layout.normalizedTopology||{gridSize:GRID_SIZE,rectangles:[]},layout.openingPlan||{openings:layout.openings||[]},{features:[]},scene,{generationId,manifestId,replaceExisting:true});
            const passed=unreachable.length===0&&forbidden.length===0&&rooms.length===layout.sectors.length&&labels.length===layout.sectors.length&&walls.length>0;
            rows.push({subtype,configuration,floor,passed,rooms:layout.sectors.length,openings:layout.openings.length,unreachable:unreachable.join(", "),forbidden:forbidden.length,walls:walls.length,scene:scene.name});
          } catch(error) { rows.push({subtype,configuration,floor,passed:false,error:error.message}); }
        }
      }
    }

    const diversity = Object.entries(FortifiedSiteGrammar.CONFIGURATIONS).map(([subtype,configs]) => ({ subtype, configurations:configs.length, uniqueLayouts:new Set(configs.map(c=>signatures.get(c))).size, passed:new Set(configs.map(c=>signatures.get(c))).size===configs.length }));
    const summary={requested:rows.length,passed:rows.filter(r=>r.passed).length,failed:rows.filter(r=>!r.passed).length,diversityPassed:diversity.every(r=>r.passed),valid:rows.every(r=>r.passed)&&diversity.every(r=>r.passed)};
    console.table(rows); console.table(diversity); console.table(summary);
    globalThis.fortifiedSiteConfigurationTests={rows,diversity,summary};
    return globalThis.fortifiedSiteConfigurationTests;
  } catch(error) { console.error("FORTIFIED SITE TEST FAILED",error); return {error}; }
})();
