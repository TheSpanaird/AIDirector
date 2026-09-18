// modules/ai-director/scripts/memory/narrative-opportunity-engine.js

function text(value = "") {
  return String(value ?? "").trim();
}

function tokens(value = "") {
  return [
    ...new Set(
      text(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s_-]/g, " ")
        .split(/\s+/)
        .filter(token => token.length >= 4)
    )
  ];
}

function overlapScore(left = "", right = "") {
  const leftTokens = tokens(left);
  const rightTokens = new Set(tokens(right));

  return leftTokens.reduce(
    (score, token) =>
      score + (
        rightTokens.has(token)
          ? 10
          : 0
      ),
    0
  );
}

function searchableValue(value) {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  return [
    value.name,
    value.title,
    value.description,
    value.objective,
    value.factionId,
    value.locationId,
    value.arcId,
    value.actor?.name,
    ...(value.facts || []),
    ...(value.events || []),
    ...(value.goals || []),
    ...(value.threats || []),
    ...(value.mysteries || []),
    ...(value.objectives || [])
  ]
    .filter(Boolean)
    .join(" ");
}

function stableId(prefix, value, index = 0) {
  const normalized = text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized
    ? `${prefix}-${normalized}`
    : `${prefix}-${index + 1}`;
}

export class NarrativeOpportunityEngine {
  static correlate(
    objective,
    values = [],
    limit = 2
  ) {
    return values
      .map(value => ({
        value,
        score: overlapScore(
          objective,
          searchableValue(value)
        )
      }))
      .sort(
        (a, b) =>
          b.score - a.score
      )
      .filter(
        candidate =>
          candidate.score > 0
      )
      .slice(0, limit)
      .map(
        candidate =>
          candidate.value
      );
  }

  static scoreCandidate(
    candidate,
    {
      playerDirective = "",
      narrativeContext = {}
    } = {}
  ) {
    let priority = 0;
    const priorityReasons = [];

    const candidateText = [
      candidate.title,
      candidate.objective,
      ...candidate.clues,
      ...candidate.obstacles
    ].join(" ");

    const directiveScore =
      overlapScore(
        playerDirective,
        candidateText
      );

    if (directiveScore > 0) {
      priority += 50 + directiveScore;

      priorityReasons.push(
        "DIRECTIVE_MATCH"
      );
    }

    const primaryLocation =
      narrativeContext.primaryLocation;

    if (primaryLocation) {
      const locationScore =
        overlapScore(
          searchableValue(primaryLocation),
          candidateText
        );

      if (locationScore > 0) {
        priority += 30 + locationScore;

        priorityReasons.push(
          "PRIMARY_LOCATION_MATCH"
        );
      }
    }

    const matchingArcs =
      this.correlate(
        candidateText,
        narrativeContext.relevantArcs || [],
        3
      );

    if (matchingArcs.length) {
      priority +=
        matchingArcs.length * 15;

      priorityReasons.push(
        "ARC_LINK"
      );
    }

    const matchingFactions =
      this.correlate(
        candidateText,
        narrativeContext.relevantFactions || [],
        2
      );

    if (matchingFactions.length) {
      priority +=
        matchingFactions.length * 10;

      priorityReasons.push(
        "FACTION_LINK"
      );
    }

    const matchingNPCs =
      this.correlate(
        candidateText,
        narrativeContext.relevantNPCs || [],
        2
      );

    if (matchingNPCs.length) {
      priority +=
        matchingNPCs.length * 10;

      priorityReasons.push(
        "NPC_LINK"
      );
    }

    const matchingGoals =
      this.correlate(
        candidateText,
        narrativeContext.playerGoals || [],
        2
      );

    if (matchingGoals.length) {
      priority +=
        matchingGoals.length * 10;

      priorityReasons.push(
        "PLAYER_GOAL_MATCH"
      );
    }

    if (
      candidate.sourceType ===
      "ACTIVE_OBJECTIVE"
    ) {
      priority += 20;

      priorityReasons.push(
        "ACTIVE_OBJECTIVE"
      );
    }

    if (
      candidate.sourceType ===
      "ACTIVE_MYSTERY"
    ) {
      priority += 15;

      priorityReasons.push(
        "ACTIVE_MYSTERY"
      );
    }

    if (
      candidate.sourceType ===
      "ACTIVE_THREAT"
    ) {
      priority += 10;

      priorityReasons.push(
        "ACTIVE_THREAT"
      );
    }

    if (
      candidate.sourceType ===
      "PRIMARY_LOCATION"
    ) {
      priority += 25;

      priorityReasons.push(
        "PRIMARY_LOCATION"
      );
    }

    return {
      ...candidate,
      priority,
      priorityReasons,
      sourceRefs: [
        ...new Set([
          ...candidate.sourceRefs,
          ...matchingArcs
            .map(arc => arc.arcId)
            .filter(Boolean),
          ...matchingFactions
            .map(faction => faction.factionId)
            .filter(Boolean),
          ...matchingNPCs
            .map(npc =>
              npc.actorId ||
              npc.actor?.id
            )
            .filter(Boolean),
          ...(
            priorityReasons.includes(
              "PRIMARY_LOCATION_MATCH"
            ) ||
            candidate.sourceType ===
            "PRIMARY_LOCATION"
              ? [
                primaryLocation
                  ?.locationId
              ]
              : []
          )
        ].filter(Boolean))
      ]
    };
  }

  static async build({
    playerDirective = "",
    narrativeContext = {},
    limit = 3
  } = {}) {
    const state =
      narrativeContext
        .activeNarrativeState || {};

    const objectives =
      state.activeObjectives || [];

    const mysteries =
      state.activeMysteries || [];

    const threats =
      state.activeThreats || [];

    const arcs =
      narrativeContext.relevantArcs || [];

    const candidates = [];

    objectives.forEach(
      (objective, index) => {
        const clues =
          this.correlate(
            objective,
            mysteries,
            2
          );

        const obstacles =
          this.correlate(
            objective,
            threats,
            2
          );

        const sourceRefs =
          this.correlate(
            objective,
            arcs,
            3
          )
            .map(arc => arc.arcId)
            .filter(Boolean);

        candidates.push({
          opportunityId:
            stableId(
              "opportunity",
              objective,
              index
            ),
          title: text(objective),
          objective: text(objective),
          clues:
            clues.length
              ? clues.map(text)
              : mysteries.slice(0, 1).map(text),
          obstacles:
            obstacles.length
              ? obstacles.map(text)
              : threats.slice(0, 1).map(text),
          rewards: [],
          consequences: [],
          sourceRefs,
          sourceType:
            "ACTIVE_OBJECTIVE",
          priority: 0,
          priorityReasons: []
        });
      }
    );

    const primaryLocation =
      narrativeContext.primaryLocation;

    const locationDirectiveScore =
      overlapScore(
        playerDirective,
        searchableValue(
          primaryLocation
        )
      );

    if (
      primaryLocation &&
      locationDirectiveScore > 0
    ) {
      const locationName =
        text(
          primaryLocation.name ||
          primaryLocation.locationId
        );

      const locationObjective =
        `Investigate ${locationName}`;

      const alreadyRepresented =
        candidates.some(
          candidate =>
            overlapScore(
              candidate.objective,
              locationName
            ) > 0
        );

      if (!alreadyRepresented) {
        candidates.push({
          opportunityId:
            stableId(
              "location",
              primaryLocation.locationId ||
              locationName
            ),
          title:
            locationObjective,
          objective:
            locationObjective,
          clues: [
            ...new Set([
              ...(primaryLocation.facts || []),
              ...(primaryLocation.events || []),
              ...mysteries
            ])
          ]
            .map(text)
            .filter(Boolean)
            .slice(0, 2),
          obstacles: [
            ...new Set([
              ...(
                narrativeContext
                  .locationState
                  ?.activeThreats || []
              ),
              ...threats
            ])
          ]
            .map(text)
            .filter(Boolean)
            .slice(0, 2),
          rewards: [],
          consequences: [],
          sourceRefs: [
            primaryLocation.locationId
          ].filter(Boolean),
          sourceType:
            "PRIMARY_LOCATION",
          priority: 0,
          priorityReasons: []
        });
      }
    }

    if (!candidates.length) {
      mysteries.slice(0, 2).forEach(
        (mystery, index) => {
          candidates.push({
            opportunityId:
              stableId(
                "mystery",
                mystery,
                index
              ),
            title:
              `Investigate ${text(mystery)}`,
            objective:
              `Investigate ${text(mystery)}`,
            clues: [text(mystery)],
            obstacles:
              threats.slice(0, 1).map(text),
            rewards: [],
            consequences: [],
            sourceRefs: [],
            sourceType:
              "ACTIVE_MYSTERY",
            priority: 0,
            priorityReasons: []
          });
        }
      );
    }

    if (!candidates.length) {
      threats.slice(0, 2).forEach(
        (threat, index) => {
          candidates.push({
            opportunityId:
              stableId(
                "threat",
                threat,
                index
              ),
            title:
              `Respond to ${text(threat)}`,
            objective:
              `Respond to ${text(threat)}`,
            clues: [],
            obstacles: [text(threat)],
            rewards: [],
            consequences: [],
            sourceRefs: [],
            sourceType:
              "ACTIVE_THREAT",
            priority: 0,
            priorityReasons: []
          });
        }
      );
    }

    const ranked =
      candidates
        .map(candidate =>
          this.scoreCandidate(
            candidate,
            {
              playerDirective,
              narrativeContext
            }
          )
        )
        .sort(
          (a, b) =>
            b.priority - a.priority
        )
        .slice(0, limit)
        .map(
          (opportunity, index) => ({
            ...opportunity,
            isPrimary:
              index === 0
          })
        );

    console.group(
      "[AI Director] Narrative Opportunities"
    );

    console.table(
      ranked.map(opportunity => ({
        title:
          opportunity.title,
        priority:
          opportunity.priority,
        primary:
          opportunity.isPrimary,
        reasons:
          opportunity
            .priorityReasons
            .join(", ")
      }))
    );

    console.groupEnd();

    return ranked;
  }
}

if (typeof window !== "undefined") {
  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .NarrativeOpportunityEngine =
      NarrativeOpportunityEngine;
}
