// modules/ai-director/scripts/memory/narrative-memory-manager.js

import {
  createActiveNarrativeState
} from "./narrative-memory-schema.js";

export class NarrativeMemoryManager {

  static async getActiveNarrativeState() {

    const stored =
      game.settings.get(
        "ai-director",
        "activeNarrativeState"
      ) || {};

    return createActiveNarrativeState(
      stored
    );
  }

  static async saveActiveNarrativeState(
    state = {}
  ) {

    await game.settings.set(
      "ai-director",
      "activeNarrativeState",
      state
    );

    return state;
  }

  static async getArcRegistry() {

    return (
      game.settings.get(
        "ai-director",
        "arcRegistry"
      ) || []
    );
  }

  static async saveArcRegistry(
    registry = []
  ) {

    await game.settings.set(
      "ai-director",
      "arcRegistry",
      registry
    );

    return registry;
  }

  static async buildNarrativeContext(
    playerDirective = ""
  ) {

    return {
      activeNarrativeState:
        await this.getActiveNarrativeState(),

      activeArcs:
        await this.getArcRegistry(),

      relevantEntities: [],
      relevantLocations: [],
      relevantFactions: []
    };
  }
}

if (typeof window !== "undefined") {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector.NarrativeMemoryManager =
    NarrativeMemoryManager;
}