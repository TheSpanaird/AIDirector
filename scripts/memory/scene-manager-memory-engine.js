// modules/ai-director/scripts/memory/scene-manager-memory-engine.js

import {
  LocationMemoryManager
} from "./location-memory-manager.js";

import {
  FactionMemoryManager
} from "./faction-memory-manager.js";

export class SceneManagerMemoryEngine {

  static async buildSceneMemory({
    currentLocation,
    activeNarrativeState,
    primaryLocation,
    importantFactions
  } = {}) {

    const location =
      primaryLocation;

    if (!location) {

      return {
        selectedNPCs: [],
        selectedFactions: [],
        selectedThreats: [],
        selectedActivities: [],
        selectedOccupants: []
      };

    }

    const memory =
      await LocationMemoryManager
        .getLocationMemory(
          location.locationId
        );

    const factions = [];

    for (
      const factionId
      of (
        memory.relatedFactions || []
      )
    ) {

      factions.push(
        await FactionMemoryManager
          .getFactionMemory(
            factionId
          )
      );

    }

    return {

      selectedNPCs:
        memory.relatedNPCs || [],

      selectedFactions:
        factions.map(
          faction =>
            faction.factionId
        ),

      selectedThreats:
        memory.activeThreats || [],

      selectedActivities:
        memory.activeActivities || [],

      selectedOccupants:
        memory.occupants || []

    };

  }

}

if (
  typeof window !==
  "undefined"
) {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .SceneManagerMemoryEngine =
      SceneManagerMemoryEngine;

}