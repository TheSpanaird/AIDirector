// modules/ai-director/scripts/memory/occupancy-intent-manager.js

import {
  LocationMemoryManager
} from "./location-memory-manager.js";

export class OccupancyIntentManager {

  static async getLocationState(
    locationId
  ) {

    const location =
      await LocationMemoryManager
        .getLocationMemory(
          locationId
        );

    if (!location) {
      return null;
    }

    return {

      occupants:
        location.occupants || [],

      controllingFaction:
        location.controllingFaction,

      activeThreats:
        location.activeThreats || [],

      activeActivities:
        location.activeActivities || []

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
    .OccupancyIntentManager =
      OccupancyIntentManager;

}