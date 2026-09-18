(async () => {
  const SEED = "house-grammar-001";
  const NAME = `[Prototype] House Grammar ${SEED}`;

  const { HouseGrammar } = await import(
    "/modules/ai-director/scripts/cartographer/architecture/house-grammar.js"
  );
  const { ArchitecturalQualityValidator } = await import(
    "/modules/ai-director/scripts/cartographer/architectural-quality-validator.js"
  );
  const { HOUSE_ARCHITECTURAL_ACCEPTANCE } = await import(
    "/modules/ai-director/scripts/cartographer/house-architectural-acceptance.js"
  );

  const existing = game.scenes.contents.find(scene => scene.name === NAME);
  if (existing) await existing.delete();

  const scene = await Scene.create({
    name: NAME,
    navigation: true,
    width: 5000,
    height: 5000,
    padding: 0.05,
    grid: { type: CONST.GRID_TYPES.SQUARE, size: 100 },
    tokenVision: true,
    globalLight: true
  });
  await scene.activate();
  await scene.view();

  const result = HouseGrammar.build({}, {
    layoutSeed: SEED,
    gridSize: 100,
    originX: 1000,
    originY: 1000
  });

  const layoutResult = {
    sectors: result.sectors,
    floors: result.floors
  };

  await CartographerRoomRenderer.render(layoutResult, scene, {
    gridSize: 100,
    generationId: `prototype-${SEED}`,
    manifestId: "house-grammar-prototype"
  });
  await RoomLabelRenderer.render(layoutResult, scene, {
    gridSize: 100,
    generationId: `prototype-${SEED}`,
    manifestId: "house-grammar-prototype"
  });
  await CartographerWallRenderer.render(
    layoutResult,
    result.normalizedTopology,
    result.openingPlan,
    { features: [] },
    scene,
    {
      generationId: `prototype-${SEED}`,
      manifestId: "house-grammar-prototype"
    }
  );

  const report = ArchitecturalQualityValidator.validate(
    result,
    HOUSE_ARCHITECTURAL_ACCEPTANCE
  );

  globalThis.houseGrammarPrototype = result;
  globalThis.houseTestResult = result;
  globalThis.houseArchitecturalReport = report;

  console.log("=== HOUSE GRAMMAR PROTOTYPE ===");
  console.table({
    grammarId: result.grammarId,
    variantId: result.variantId,
    valid: report.valid,
    rooms: report.metrics.rooms,
    corridorRatio: Number(report.metrics.corridorRatio.toFixed(3)),
    envelopeUtilization: Number(report.metrics.envelopeUtilization.toFixed(3)),
    problems: report.problems.length
  });
  console.table(report.problems);
  return { scene, result, report };
})();
