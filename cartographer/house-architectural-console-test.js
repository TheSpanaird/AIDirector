(async () => {
  const result = globalThis.houseTestResult || globalThis.cartographerTestResult;
  if (!result) {
    console.error("Generate or prototype a House layout first, then store it as globalThis.houseTestResult.");
    return null;
  }

  const { ArchitecturalQualityValidator } = await import(
    "/modules/ai-director/scripts/cartographer/architectural-quality-validator.js"
  );
  const { HOUSE_ARCHITECTURAL_ACCEPTANCE } = await import(
    "/modules/ai-director/scripts/cartographer/house-architectural-acceptance.js"
  );

  const report = ArchitecturalQualityValidator.validate(
    result,
    HOUSE_ARCHITECTURAL_ACCEPTANCE
  );

  console.log("=== HOUSE ARCHITECTURAL ACCEPTANCE ===");
  console.table({
    valid: report.valid,
    rooms: report.metrics.rooms,
    corridorRatio: Number(report.metrics.corridorRatio.toFixed(3)),
    envelopeUtilization: Number(report.metrics.envelopeUtilization.toFixed(3)),
    problems: report.problems.length
  });
  console.table(report.problems);
  console.log(report.valid ? "PASS: House architecture accepted." : "FAIL: House architecture rejected.");
  globalThis.houseArchitecturalReport = report;
  return report;
})();
