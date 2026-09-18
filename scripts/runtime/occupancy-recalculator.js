// modules/ai-director/scripts/runtime/occupancy-recalculator.js
// EN-18C: Recalculates sector occupancy state from active threat counts.

export class OccupancyRecalculator {

  static recalculate(
    sector
  ) {

    const threats =
      sector.threats || [];

    const active =
      threats.filter(
        t =>
          t.threatState ===
          "ACTIVE"
      ).length;

    if (active === 0) {
      sector.areaState =
        "CLEARED";
    }
    else if (
      active <= 2
    ) {
      sector.areaState =
        "WEAKENED";
    }
    else {
      sector.areaState =
        "ACTIVE";
    }

    return sector;
  }

}

if (typeof window !== "undefined") {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .OccupancyRecalculator =
      OccupancyRecalculator;
}
