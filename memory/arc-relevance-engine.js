// modules/ai-director/scripts/memory/arc-relevance-engine.js

import { ArcRegistryManager }
  from "./arc-registry-manager.js";

export class ArcRelevanceEngine {
  static scoreArc(
    arc,
    playerDirective,
    activeNarrativeState
  ) {
    const query =
      String(playerDirective || "")
        .toLowerCase();

    let score = 0;
    const reasons = [];

    const fields = [
      arc.name,
      ...(arc.aliases || []),
      ...(arc.facts || []),
      ...(arc.objectives || []),
      ...(arc.mysteries || []),
      ...(arc.threats || [])
    ];

    if (
      query.includes(
        String(arc.name)
          .toLowerCase()
      )
    ) {
      score += 100;
      reasons.push("ARC_NAME_MATCH");
    }

    for (const field of fields) {
      if (
        query.includes(
          String(field)
            .toLowerCase()
        )
      ) {
        score += 25;
        reasons.push("CONTENT_MATCH");
      }
    }

    const stateTerms = [
      ...(
        activeNarrativeState
          ?.activeObjectives || []
      ),
      ...(
        activeNarrativeState
          ?.activeMysteries || []
      ),
      ...(
        activeNarrativeState
          ?.playerGoals || []
      )
    ];

    for (const term of stateTerms) {
      const normalized =
        String(term).toLowerCase();

      const match =
        fields.some(field =>
          String(field)
            .toLowerCase()
            .includes(normalized)
        );

      if (match) {
        score += 40;
        reasons.push(
          "ACTIVE_STATE_MATCH"
        );
        break;
      }
    }

    score += arc.importance || 5;

    return {
      ...arc,
      relevanceScore: score,
      relevanceReasons: reasons
    };
  }

  static async findRelevantArcs({
    playerDirective = "",
    activeNarrativeState = null
  } = {}) {
    const arcs =
      await ArcRegistryManager
        .getActiveArcs();

    return arcs
      .map(arc =>
        this.scoreArc(
          arc,
          playerDirective,
          activeNarrativeState
        )
      )
      .filter(
        arc =>
          arc.relevanceReasons.length > 0
      )
      .filter(
        arc =>
          arc.relevanceScore >= 20
      )
      .sort(
        (a, b) =>
          b.relevanceScore -
          a.relevanceScore
      )
      .slice(0, 5);
  }
}