// modules/ai-director/scripts/memory/location-relevance-engine.js

// modules/ai-director/scripts/memory/location-relevance-engine.js

import {
  LocationMemoryManager
} from "./location-memory-manager.js";

export class LocationRelevanceEngine {

  static normalize(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
  }

  static scoreLocation(
    location,
    playerDirective = "",
    currentLocation = null
  ) {

    const query =
      String(playerDirective || "")
        .toLowerCase();

    let score = 0;
    const reasons = [];

    const name =
      String(location.name || "")
        .toLowerCase();

    if (
      name &&
      query.includes(name)
    ) {
      score += 50;
      reasons.push("NAME_MATCH");
    }

    for (const fact of (location.facts || [])) {

      if (
        query.includes(
          String(fact).toLowerCase()
        )
      ) {
        score += 15;
        reasons.push("FACT_MATCH");
      }
    }

    for (const event of (location.events || [])) {

      if (
        query.includes(
          String(event).toLowerCase()
        )
      ) {
        score += 10;
        reasons.push("EVENT_MATCH");
      }
    }

    const currentSceneName =
      this.normalize(
        currentLocation?.sceneName
      );

    const locationName =
      this.normalize(
        location.name
      );

    if (
      currentSceneName &&
      locationName &&
      currentSceneName === locationName
    ) {
      score += 40;
      reasons.push("CURRENT_SCENE");
    }

    score += Number(
      location.importance || 0
    );

    return {
      ...location,
      relevanceScore: score,
      relevanceReasons: reasons
    };
  }

  static async findRelevantLocations({
    playerDirective = "",
    currentLocation = null
  } = {}) {

    const locations =
      LocationMemoryManager
        .getRegistry();

    return locations
      .map(location =>
        this.scoreLocation(
          location,
          playerDirective,
          currentLocation
        )
      )
      .filter(
        location =>
          location.relevanceReasons.length > 0
      )
      .sort(
        (a, b) =>
          b.relevanceScore -
          a.relevanceScore
      );
  }
}

if (typeof window !== "undefined") {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .LocationRelevanceEngine =
      LocationRelevanceEngine;
}