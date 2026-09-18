// modules/ai-director/scripts/memory/world-state-evolution-manager.js

import {
  createMemoryDelta
} from "./memory-delta-schema.js";

export class WorldStateEvolutionManager {

  static async extractWorldStateChanges(
    narrative = {}
  ) {

    const changes =
      narrative.worldStateChanges ||
      [];

    return changes
      .filter(change =>
        change?.type
      )
      .map(change =>
        createMemoryDelta(change)
      );
  }

  static applyEvent(
    manifest,
    event
  ) {

    if (
      event.eventType !==
      "ENTITY_DEFEATED"
    ) {
      return manifest;
    }

    const output =
      structuredClone(manifest);

    for (
      const sector of output.sectors
    ) {

      for (
        const threat of
        sector.threats || []
      ) {

        if (
          threat.stableId ===
          event.stableId
        ) {

          threat.threatState =
            "DEFEATED";

          threat.defeatedAt =
            event.timestamp;
        }
      }
    }

    return output;
  }

}

if (
  typeof window !==
  "undefined"
) {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .WorldStateEvolutionManager =
      WorldStateEvolutionManager;

}
