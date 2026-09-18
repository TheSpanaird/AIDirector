// modules/ai-director/scripts/memory/npc-relevance-engine.js

import { NPCMemoryManager } from "./npc-memory-manager.js";

export class NPCRelevanceEngine {
  static async scoreActor(
    actor,
    playerDirective = "",
    primaryLocation = null,
    activeObjectives = []
  ) {
    const query =
      String(playerDirective || "")
        .toLowerCase();

    const profile =
      await NPCMemoryManager.getProfile(actor);

    const memory =
      await NPCMemoryManager.getMemory(actor);

    let score = 0;
    const reasons = [];

    if (
      query.includes(
        actor.name.toLowerCase()
      )
    ) {
      score += 100;
      reasons.push("NAME_MATCH");
    }

    for (const location of (memory?.knownLocations || [])) {
      if (
        primaryLocation?.name &&
        location
          .toLowerCase()
          .includes(
            primaryLocation.name.toLowerCase()
          )
      ) {
        score += 30;
        reasons.push("LOCATION_LINK");
        break;
      }
    }

    for (const objective of activeObjectives) {
      const normalized =
        String(objective).toLowerCase();

      if (
        query.includes(normalized)
      ) {
        score += 15;
        reasons.push("OBJECTIVE_LINK");
        break;
      }
    }

    score += profile?.importance || 5;

    return {
      actor,
      relevanceScore: score,
      relevanceReasons: reasons
    };
  }

  static async findRelevantNPCs({
    playerDirective = "",
    primaryLocation = null,
    activeObjectives = []
  } = {}) {
    const results = [];

    for (const actor of game.actors.contents) {
      results.push(
        await this.scoreActor(
          actor,
          playerDirective,
          primaryLocation,
          activeObjectives
        )
      );
    }

    return results
      .filter(
        npc =>
          npc.relevanceScore >= 20
      )
      .sort(
        (a, b) =>
          b.relevanceScore -
          a.relevanceScore
      )
      .slice(0, 5);
  }
}