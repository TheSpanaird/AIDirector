(async () => {
  const { SpaceshipGrammar } = await import(
    "/modules/ai-director/scripts/cartographer/architecture/spaceship-grammar.js"
  );
  const { SpaceshipArchetypeLibrary } = await import(
    "/modules/ai-director/scripts/cartographer/architecture/spaceship-archetype-library.js"
  );

  const reports = [];
  for (const archetype of SpaceshipArchetypeLibrary.list()) {
    const seed = `spaceship-${archetype.toLowerCase()}-001`;
    const result = SpaceshipGrammar.build({}, {
      sceneArchetype: archetype,
      layoutSeed: seed,
      gridSize: 100,
      originX: 800,
      originY: 800
    });
    const duplicate = SpaceshipGrammar.build({}, {
      sceneArchetype: archetype,
      layoutSeed: seed,
      gridSize: 100,
      originX: 800,
      originY: 800
    });
    const deterministic = JSON.stringify(result.sectors.map(s => [s.sectorId, s.gridPosition, s.gridDimensions])) ===
      JSON.stringify(duplicate.sectors.map(s => [s.sectorId, s.gridPosition, s.gridDimensions]));
    const airlocks = result.openings.filter(opening => opening.connectionType === "AIRLOCK").length;
    const reachable = result.sectors.every(sector =>
      sector.sectorId === "central-passage" ||
      result.openings.some(opening => opening.targetId === sector.sectorId)
    );
    reports.push({
      archetype,
      variantId: result.variantId,
      rooms: result.sectors.length,
      openings: result.openings.length,
      airlocks,
      deterministic,
      reachable,
      valid: airlocks > 0 && deterministic && reachable
    });
  }
  console.log("=== SPACESHIP ARCHETYPE MATRIX ===");
  console.table(reports);
  console.log(reports.every(item => item.valid)
    ? "PASS: All spaceship archetype prototypes passed structural validation."
    : "FAIL: Review spaceship archetype problems.");
  globalThis.spaceshipArchetypeMatrix = reports;
  return reports;
})();
