// modules/ai-director/scripts/memory/faction-relevance-engine.js

import { FactionMemoryManager }
  from "./faction-memory-manager.js";

export class FactionRelevanceEngine {
  static scoreFaction(
    faction,
    playerDirective = "",
    primaryLocation = null,
    activeNarrativeState = null
  ) {
    const query =
      String(playerDirective || "")
        .toLowerCase();

    let score = 0;
    const reasons = [];

    for (const goal of (faction.goals || [])) {
      if (
        query.includes(
          String(goal).toLowerCase()
        )
      ) {
        score += 30;
        reasons.push("GOAL_MATCH");
      }
    }

    for (const threat of (faction.threats || [])) {
      if (
        query.includes(
          String(threat).toLowerCase()
        )
      ) {
        score += 25;
        reasons.push("THREAT_MATCH");
      }
    }

    if (
      primaryLocation?.relatedFactions?.includes(
        faction.factionId
      )
    ) {
      score += 40;
      reasons.push("LOCATION_LINK");
    }

    if (
      activeNarrativeState
        ?.activeFactions
        ?.includes(
          faction.factionId
        )
    ) {
      score += 50;
      reasons.push(
        "ACTIVE_FACTION"
      );
    }

    score += faction.importance || 5;

    return {
      ...faction,
      relevanceScore: score,
      relevanceReasons: reasons
    };
  }

  static async findRelevantFactions({
    playerDirective = "",
    primaryLocation = null,
    activeNarrativeState = null
  } = {}) {
    const registry =
      FactionMemoryManager.getRegistry();

    return registry
      .map(faction =>
        this.scoreFaction(
          faction,
          playerDirective,
          primaryLocation,
          activeNarrativeState
        )
      )
      .filter(
        faction =>
          faction.relevanceReasons.length > 0
      )
      .filter(
        faction =>
          faction.relevanceScore >= 20
      )
      .sort(
        (a, b) =>
          b.relevanceScore -
          a.relevanceScore
      )
      .slice(0, 10);
  }
}