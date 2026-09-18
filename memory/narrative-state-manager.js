// modules/ai-director/scripts/memory/narrative-state-manager.js

import {
  NarrativeMemoryManager
} from "./narrative-memory-manager.js";

export class NarrativeStateManager {

  static async getState() {

    return await NarrativeMemoryManager
      .getActiveNarrativeState();

  }

  static async saveState(
    state
  ) {

    return await NarrativeMemoryManager
      .saveActiveNarrativeState(
        state
      );

  }

  static async addActiveArc(
    arcId
  ) {

    const state =
      await this.getState();

    if (
      !state.activeArcs.includes(
        arcId
      )
    ) {

      state.activeArcs.push(
        arcId
      );

    }

    return this.saveState(
      state
    );

  }

  static async addActiveFaction(
    factionId
  ) {

    const state =
      await this.getState();

    if (
      !state.activeFactions.includes(
        factionId
      )
    ) {

      state.activeFactions.push(
        factionId
      );

    }

    return this.saveState(
      state
    );

  }

  static async addActiveLocation(
    locationId
  ) {

    const state =
      await this.getState();

    if (
      !state.activeLocations.includes(
        locationId
      )
    ) {

      state.activeLocations.push(
        locationId
      );

    }

    return this.saveState(
      state
    );

  }

  static async addActiveObjective(
    objective
  ) {

    const state =
      await this.getState();

    if (
      !state.activeObjectives.includes(
        objective
      )
    ) {

      state.activeObjectives.push(
        objective
      );

    }

    return this.saveState(
      state
    );

  }

  static async addActiveMystery(
    mystery
  ) {

    const state =
      await this.getState();

    if (
      !state.activeMysteries.includes(
        mystery
      )
    ) {

      state.activeMysteries.push(
        mystery
      );

    }

    return this.saveState(
      state
    );

  }

  static async addActiveThreat(
    threat
  ) {

    const state =
      await this.getState();

    if (
      !state.activeThreats.includes(
        threat
      )
    ) {

      state.activeThreats.push(
        threat
      );

    }

    return this.saveState(
      state
    );

  }

  static async setNarrativePhase(
    phase
  ) {

    const state =
      await this.getState();

    state.currentNarrativePhase =
      phase;

    return this.saveState(
      state
    );

  }

}

if (
  typeof window !==
  "undefined"
) {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .NarrativeStateManager =
      NarrativeStateManager;

}