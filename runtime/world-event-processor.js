// modules/ai-director/scripts/runtime/world-event-processor.js
// EN-18: Applies a world event to a manifest and recalculates occupancy.

import {
  EventLedgerManager
}
from "./event-ledger-manager.js";

import {
  OccupancyRecalculator
}
from "./occupancy-recalculator.js";

import {
  WorldStateEvolutionManager
}
from "../memory/world-state-evolution-manager.js";

export class WorldEventProcessor {

  static async process(
    manifest,
    event
  ) {

    let updated =
      WorldStateEvolutionManager
        .applyEvent(
          manifest,
          event
        );

    updated.sectors =
      updated.sectors.map(
        sector =>
          OccupancyRecalculator
            .recalculate(
              sector
            )
      );

    return updated;
  }

}

if (typeof window !== "undefined") {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .WorldEventProcessor =
      WorldEventProcessor;
}
