import {
  MODULE_ID,
  getActiveModel
} from "/modules/ai-director/scripts/settings.js";
import {
  buildNarrativePrompt
} from "/modules/ai-director/scripts/prompt-factory/narrative-prompts.js";
import {
  OllamaClient
} from "/modules/ai-director/scripts/api/ollama-client.js";
import {
  getOrCreateActiveVolumePage
} from "/modules/ai-director/scripts/journal/volume-helper.js";
import {
  NarrativeContextBuilder
} from "../memory/narrative-context-builder.js";
import {
  MemoryExtractionManager
} from "../memory/memory-extraction-manager.js";
import {
  MemoryApplicationManager
} from "../memory/memory-application-manager.js";
import {
  WorldStateEvolutionManager
} from "../memory/world-state-evolution-manager.js";
import {
  NarrativeOpportunityEngine
} from "../memory/narrative-opportunity-engine.js";

const VALID_WORLD_STATE_TYPES = new Set([
  "LOCATION_CONTROL_CHANGE",
  "LOCATION_OCCUPANCY_CHANGE",
  "LOCATION_ACTIVITY_CHANGE",
  "LOCATION_THREAT_CHANGE"
]);

function normalizeText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map(v => String(v || "").trim())
        .filter(Boolean)
    )
  ];
}

function normalizeFaction(faction = {}, index = 0) {
  return {
    factionId: normalizeText(
      faction.factionId ||
      `faction_${index + 1}`
    ),
    name: normalizeText(
      faction.name ||
      `Faction ${index + 1}`
    ),
    status: normalizeText(
      faction.status || "UNKNOWN"
    ).toUpperCase(),
    description: normalizeText(
      faction.description || ""
    )
  };
}

function normalizeOpportunity(
  opportunity = {},
  index = 0
) {
  const fallbackId =
    `opportunity-${index + 1}`;

  return {
    opportunityId:
      normalizeText(
        opportunity.opportunityId ||
        fallbackId
      ),
    title:
      normalizeText(
        opportunity.title ||
        opportunity.objective ||
        `Opportunity ${index + 1}`
      ),
    objective:
      normalizeText(
        opportunity.objective ||
        opportunity.title
      ),
    clues:
      normalizeStringArray(
        opportunity.clues
      ),
    obstacles:
      normalizeStringArray(
        opportunity.obstacles
      ),
    rewards:
      Array.isArray(opportunity.rewards)
        ? opportunity.rewards.filter(
            reward =>
              reward &&
              typeof reward === "object"
          )
        : [],
    consequences:
      normalizeStringArray(
        opportunity.consequences
      ),
    sourceRefs:
      normalizeStringArray(
        opportunity.sourceRefs
      ),
    priority:
      Number.isFinite(
        Number(
          opportunity.priority
        )
      )
        ? Number(
          opportunity.priority
        )
        : 0,
    priorityReasons:
      normalizeStringArray(
        opportunity.priorityReasons
      ),
    isPrimary:
      opportunity.isPrimary === true
  };
}

export class NarrativeDirector {
  static buildGenerationContext({
    playerDirective = "",
    canonLore = "",
    memoryLore = "",
    sourceScene = null,
    options = {}
  } = {}) {
    return {
      playerDirective:
        normalizeText(playerDirective),
      canonLore:
        normalizeText(canonLore),
      memoryLore:
        normalizeText(memoryLore),
      sourceScene: sourceScene
        ? {
          id: sourceScene.id,
          name: sourceScene.name
        }
        : null,
      options:
        structuredClone(options)
    };
  }

  static createEmptyNarrative() {
    return {
      narrativeId:
        `narrative-${Date.now()}`,
      title: "",
      premise: "",
      history: "",
      currentSituation: "",
      occupancyState: "",
      occupancyIntent: {
        activityLevel: "UNKNOWN",
        controlLevel: "UNKNOWN",
        knownHazards: "UNKNOWN",
        factionPresence: "UNKNOWN"
      },
      genreProfile: "",
      themeProfile: "",
      toneProfile: "",
      sceneIntroduction: {
        openingDescription: "",
        atmosphere: "",
        observableDetails: []
      },
      factions: [],
      dangers: [],
      mysteries: [],
      objectives: [],
      obstacles: [],
      revelations: [],
      rewards: [],
      storyHooks: [],
      playerGoals: [],
      opportunities: [],
      worldStateChanges: [],
      tags: []
    };
  }

  static normalizeNarrative(data = {}) {
    const output = this.createEmptyNarrative();
    output.narrativeId = normalizeText(data.narrativeId) || output.narrativeId;
    output.title = normalizeText(data.title);
    output.premise = normalizeText(data.premise);
    output.history = normalizeText(data.history);
    output.currentSituation = normalizeText(data.currentSituation);
    output.occupancyState = normalizeText(data.occupancyState || "UNKNOWN").toUpperCase();
    output.occupancyIntent =
      data.occupancyIntent &&
      typeof data.occupancyIntent === "object"
        ? {
          activityLevel: normalizeText(
            data.occupancyIntent.activityLevel || "UNKNOWN"
          ).toUpperCase(),
          controlLevel: normalizeText(
            data.occupancyIntent.controlLevel || "UNKNOWN"
          ).toUpperCase(),
          knownHazards: normalizeText(
            data.occupancyIntent.knownHazards || "UNKNOWN"
          ).toUpperCase(),
          factionPresence: normalizeText(
            data.occupancyIntent.factionPresence || "UNKNOWN"
          ).toUpperCase()
        }
        : {
          activityLevel: "UNKNOWN",
          controlLevel: "UNKNOWN",
          knownHazards: "UNKNOWN",
          factionPresence: "UNKNOWN"
        };
    output.genreProfile = normalizeText(data.genreProfile);
    output.themeProfile = normalizeText(data.themeProfile);
    output.toneProfile = normalizeText(data.toneProfile);
    output.sceneIntroduction = {
      openingDescription: normalizeText(data.sceneIntroduction?.openingDescription),
      atmosphere: normalizeText(data.sceneIntroduction?.atmosphere),
      observableDetails: normalizeStringArray(data.sceneIntroduction?.observableDetails)
    };
    output.factions = Array.isArray(data.factions) ? data.factions.map(normalizeFaction) : [];
    output.dangers = normalizeStringArray(data.dangers);
    output.mysteries = normalizeStringArray(data.mysteries);
    output.objectives = normalizeStringArray(data.objectives);
    output.obstacles = normalizeStringArray(data.obstacles);
    output.revelations = normalizeStringArray(data.revelations);
    output.rewards = normalizeStringArray(data.rewards);
    output.storyHooks = normalizeStringArray(data.storyHooks);
    output.playerGoals = normalizeStringArray(data.playerGoals);
    output.opportunities =
      Array.isArray(
        data.opportunities
      )
        ? data.opportunities
            .map(
              normalizeOpportunity
            )
            .sort(
              (a, b) =>
                b.priority -
                a.priority
            )
            .slice(0, 3)
        : [];

    if (
      output.opportunities.length &&
      !output.opportunities.some(
        opportunity =>
          opportunity.isPrimary
      )
    ) {
      output.opportunities[0]
        .isPrimary = true;
    }
    output.worldStateChanges =
      Array.isArray(
        data.worldStateChanges
      )
        ? data.worldStateChanges
        : [];
    output.tags = normalizeStringArray(data.tags);
    return output;
  }

  static buildValidationReport() {
    return {
      valid: true,
      repaired: [],
      warnings: [],
      errors: []
    };
  }

  static repairOpportunity(opportunity = {}, index = 0) {
    const repaired = normalizeOpportunity(
      opportunity,
      index
    );

    repaired.clues ??= [];
    repaired.obstacles ??= [];
    repaired.rewards ??= [];
    repaired.consequences ??= [];
    repaired.sourceRefs ??= [];
    repaired.priorityReasons ??= [];

    if (
      !repaired.title &&
      repaired.objective
    ) {
      repaired.title =
        repaired.objective;
    }

    if (
      repaired.clues.length === 0
    ) {
      repaired.clues.push(
        "Potential clue undiscovered"
      );
    }

    if (
      repaired.obstacles.length === 0
    ) {
      repaired.obstacles.push(
        "Unknown obstacle"
      );
    }

    if (
      repaired.consequences.length === 0
    ) {
      repaired.consequences = [];
    }

    return repaired;
  }

  static hydrateOpportunityMetadata(
    generatedOpportunities = [],
    engineOpportunities = []
  ) {
    const engineMap =
      new Map(
        engineOpportunities.map(
          opportunity => [
            opportunity.opportunityId,
            opportunity
          ]
        )
      );

    return generatedOpportunities.map(
      generated => {

        const source =
          engineMap.get(
            generated.opportunityId
          );

        if (!source) {
          return generated;
        }

        return {
          ...generated,

          sourceRefs:
            Array.isArray(
              source.sourceRefs
            )
              ? [...source.sourceRefs]
              : [],

          priority:
            source.priority ?? 0,

          priorityReasons:
            Array.isArray(
              source.priorityReasons
            )
              ? [
                ...source.priorityReasons
              ]
              : [],

          isPrimary:
            source.isPrimary === true
        };
      }
    );
  }

  static repairWorldStateChange(
    change = {}
  ) {
    const repaired = {
      ...structuredClone(change)
    };

    repaired.type =
      normalizeText(
        repaired.type
      ).toUpperCase();

    repaired.locationId =
      normalizeText(
        repaired.locationId
      );

    repaired.locationName =
      normalizeText(
        repaired.locationName
      );

    if (
      repaired.value === undefined &&
      repaired.change !== undefined
    ) {
      repaired.value = repaired.change;
    }

    delete repaired.change;

    if (
      repaired.type ===
      "LOCATION_CONTROL_CHANGE" &&
      Array.isArray(repaired.value)
    ) {
      repaired.value =
        repaired.value[0] ?? "";
    }

    if (
      repaired.type ===
      "LOCATION_OCCUPANCY_CHANGE" ||
      repaired.type ===
      "LOCATION_ACTIVITY_CHANGE" ||
      repaired.type ===
      "LOCATION_THREAT_CHANGE"
    ) {
      if (
        typeof repaired.value === "string" &&
        repaired.value.includes(",")
      ) {
        repaired.value =
          repaired.value
            .split(",")
            .map(v => v.trim())
            .filter(Boolean);
      }

      if (typeof repaired.value === "string") {
        repaired.value = [
          repaired.value
        ];
      }

      if (!Array.isArray(repaired.value)) {
        repaired.value = [];
      }
    }

    return repaired;
  }

  static repairNarrative(
    narrative = {}
  ) {
    const repaired =
      structuredClone(narrative);

    repaired.opportunities =
      (repaired.opportunities || [])
        .map((o, index) =>
          this.repairOpportunity(
            o,
            index
          )
        )
        .slice(0, 3);

    for (const opportunity of repaired.opportunities) {

      if (
        opportunity.isPrimary &&
        opportunity.rewards.length === 0 &&
        Array.isArray(repaired.rewards) &&
        repaired.rewards.length
      ) {

        opportunity.rewards =
          repaired.rewards.map(
            (text, index) => ({
              rewardId:
                `reward_${index + 1}`,

              title:
                String(text)
                  .slice(0, 80),

              rewardType:
                "REPUTATION",

              description:
                String(text)
            })
          );
      }
    }

    const primaries =
      repaired.opportunities.filter(
        o => o.isPrimary
      );

    if (
      repaired.opportunities.length &&
      primaries.length === 0
    ) {
      repaired.opportunities[0]
        .isPrimary = true;
    }

    if (primaries.length > 1) {

      const highest =
        repaired.opportunities
          .sort(
            (a, b) =>
              b.priority - a.priority
          )[0];

      repaired.opportunities.forEach(
        opportunity => {
          opportunity.isPrimary =
            opportunity === highest;
        }
      );
    }

    repaired.worldStateChanges =
      (repaired.worldStateChanges || [])
        .map(change =>
          this.repairWorldStateChange(
            change
          )
        );

    return repaired;
  }

  static validateWorldStateChange(
    change,
    report
  ) {
    if (
      !VALID_WORLD_STATE_TYPES.has(
        change.type
      )
    ) {
      report.errors.push(
        `Invalid worldStateChange type: ${change.type}`
      );
      return;
    }

    if (!change.locationId) {
      report.errors.push(
        "worldStateChange missing locationId"
      );
    }

    if (!change.locationName) {
      report.errors.push(
        "worldStateChange missing locationName"
      );
    }

    switch (change.type) {
      case
        "LOCATION_CONTROL_CHANGE":
        if (
          typeof change.value !==
          "string"
        ) {
          report.errors.push(
            "Control change requires string value"
          );
        }
        break;

      default:
        if (
          !Array.isArray(
            change.value
          )
        ) {
          report.errors.push(
            `${change.type} requires array value`
          );
        }
    }
  }

  static validateNarrative(
    record = {}
  ) {

    record =
      this.normalizeNarrative(
        record
      );

    const report =
      this.buildValidationReport();

    if (!record.title) {
      report.errors.push(
        "Missing title"
      );
    }

    if (!record.premise) {
      report.errors.push(
        "Missing premise"
      );
    }

    if (
      !record.currentSituation
    ) {
      report.errors.push(
        "Missing currentSituation"
      );
    }

    if (
      !record.sceneIntroduction
        ?.openingDescription
    ) {
      report.errors.push(
        "Missing scene introduction"
      );
    }

    if (
      !record.objectives?.length &&
      !record.playerGoals?.length
    ) {
      report.errors.push(
        "Missing objectives and player goals"
      );
    }

    const primaryCount =
      (record.opportunities || [])
        .filter(
          o => o.isPrimary
        )
        .length;

    if (
      record.opportunities.length > 3
    ) {
      report.errors.push(
        "More than three opportunities present"
      );
    }

    if (
      record.opportunities.length &&
      primaryCount !== 1
    ) {
      report.errors.push(
        "Exactly one primary opportunity required"
      );
    }

    for (const opportunity of (
      record.opportunities || []
    )) {
      if (
        !opportunity.opportunityId
      ) {
        report.errors.push(
          "Opportunity missing ID"
        );
      }

      if (
        !opportunity.objective
      ) {
        report.errors.push(
          "Opportunity missing objective"
        );
      }

      if (
        !opportunity.sourceRefs
          ?.length
      ) {
        report.errors.push(
          `Opportunity ${opportunity.opportunityId} missing sourceRefs`
        );
      }

      if (!Array.isArray(opportunity.rewards)) {
        report.errors.push(
          `Opportunity ${opportunity.opportunityId} rewards must be array`
        );
      }

      if (
        opportunity.isPrimary &&
        opportunity.rewards.length === 0
      ) {
        report.errors.push(
          `Primary opportunity ${opportunity.opportunityId} requires at least one reward`
        );
      }

      for (const reward of (opportunity.rewards || [])) {

        if (
          !reward ||
          typeof reward !== "object"
        ) {
          report.errors.push(
            `Opportunity ${opportunity.opportunityId} contains invalid reward`
          );
          continue;
        }

        if (!reward.rewardId) {
          report.errors.push(
            `Reward missing rewardId in ${opportunity.opportunityId}`
          );
        }

        if (!reward.title) {
          report.errors.push(
            `Reward missing title in ${opportunity.opportunityId}`
          );
        }

        if (!reward.rewardType) {
          report.errors.push(
            `Reward missing rewardType in ${opportunity.opportunityId}`
          );
        }
      }
    }

    for (const change of (
      record.worldStateChanges ||
      []
    )) {
      this.validateWorldStateChange(
        change,
        report
      );
    }

    report.valid =
      report.errors.length === 0;

    return report;
  }

  static buildCanonicalContext(record = {}) {
    const narrative = this.normalizeNarrative(record);
    return `
CANONICAL NARRATIVE RECORD
TITLE
${narrative.title}
PREMISE
${narrative.premise}
HISTORY
${narrative.history}
CURRENT SITUATION
${narrative.currentSituation}
OCCUPANCY
${narrative.occupancyState}
GENRE
${narrative.genreProfile}
THEME
${narrative.themeProfile}
TONE
${narrative.toneProfile}
SCENE INTRODUCTION
ATMOSPHERE
${narrative.sceneIntroduction.atmosphere}
OPENING DESCRIPTION
${narrative.sceneIntroduction.openingDescription}
OBSERVABLE DETAILS
${JSON.stringify(
narrative.sceneIntroduction.observableDetails,
null,
2
)}

FACTIONS
${JSON.stringify(narrative.factions, null, 2)}

DANGERS
${JSON.stringify(narrative.dangers, null, 2)}

MYSTERIES
${JSON.stringify(narrative.mysteries, null, 2)}

OBJECTIVES
${JSON.stringify(narrative.objectives, null, 2)}

OBSTACLES
${JSON.stringify(narrative.obstacles, null, 2)}

REVELATIONS
${JSON.stringify(narrative.revelations, null, 2)}

REWARDS
${JSON.stringify(narrative.rewards, null, 2)}

STORY HOOKS
${JSON.stringify(narrative.storyHooks, null, 2)}

PLAYER GOALS
${JSON.stringify(narrative.playerGoals, null, 2)}

IMPORTANT RULES
- This narrative is canonical.
- Do not contradict it.
- Do not replace it.
- Do not rewrite history.
- Do not invent alternate explanations.
- Expand upon these facts only.
`.trim();
  }

  static formatNarrativeHtml(record = {}) {
    const narrative = this.normalizeNarrative(record);
    const factionList = narrative.factions.length
      ? `<ul>${narrative.factions.map(f =>
        `<li><strong>${f.name}</strong> (${f.status})${f.description ? ` - ${f.description}` : ""}</li>`
      ).join("")}</ul>`
      : "<p>None</p>";
    const dangerList = narrative.dangers.length
      ? `<ul>${narrative.dangers.map(d =>
        `<li>${d}</li>`
      ).join("")}</ul>`
      : "<p>None</p>";
    const mysteryList = narrative.mysteries.length
      ? `<ul>${narrative.mysteries.map(m =>
        `<li>${m}</li>`
      ).join("")}</ul>`
      : "<p>None</p>";
    const goalList = narrative.playerGoals.length
      ? `<ul>${narrative.playerGoals.map(g =>
        `<li>${g}</li>`
      ).join("")}</ul>`
      : "<p>None</p>";
    const objectiveList = narrative.objectives.length
      ? `<ul>${narrative.objectives.map(o =>
        `<li>${o}</li>`
      ).join("")}</ul>`
      : "<p>None</p>";
    const obstacleList = narrative.obstacles.length
      ? `<ul>${narrative.obstacles.map(o =>
        `<li>${o}</li>`
      ).join("")}</ul>`
      : "<p>None</p>";
    const revelationList = narrative.revelations.length
      ? `<ul>${narrative.revelations.map(r =>
        `<li>${r}</li>`
      ).join("")}</ul>`
      : "<p>None</p>";
    const rewardList = narrative.rewards.length
      ? `<ul>${narrative.rewards.map(r =>
        `<li>${r}</li>`
      ).join("")}</ul>`
      : "<p>None</p>";
    const storyHookList = narrative.storyHooks.length
      ? `<ul>${narrative.storyHooks.map(sh =>
        `<li>${sh}</li>`
      ).join("")}</ul>`
      : "<p>None</p>";
    return `
<h2>${narrative.title}</h2>
<p>
<strong>Premise:</strong><br>
${narrative.premise}
</p>
<p>
<strong>History:</strong><br>
${narrative.history}
</p>
<p>
<strong>Current Situation:</strong><br>
${narrative.currentSituation}
</p>
<p>
<strong>Occupancy State:</strong><br>
${narrative.occupancyState}
</p>
<hr>
<p>
  <strong>Genre:</strong>
  ${narrative.genreProfile}
</p>
<p>
  <strong>Theme:</strong>
  ${narrative.themeProfile}
</p>
<p>
  <strong>Tone:</strong>
  ${narrative.toneProfile}
</p>
<h3>Scene Introduction</h3>
<p>
<strong>Atmosphere:</strong><br>
${narrative.sceneIntroduction.atmosphere}
</p>
<p>
${narrative.sceneIntroduction.openingDescription}
</p>
<hr>
<h3>Factions</h3>
${factionList}
<h3>Dangers</h3>
${dangerList}
<h3>Mysteries</h3>
${mysteryList}
<h3>Objectives</h3>
${objectiveList}
<h3>Obstacles</h3>
${obstacleList}
<h3>Revelations</h3>
${revelationList}
<h3>Rewards</h3>
${rewardList}
<h3>Story Hooks</h3>
${storyHookList}
<h3>Player Goals</h3>
${goalList}
<hr>
`;
  }

  static formatNarrativeJson(record = {}) {
    const narrative = this.normalizeNarrative(record);
    return `
<pre>${JSON.stringify(narrative, null, 2)}</pre>
`.trim();
  }

  static async saveNarrativeRecord(record = {}) {
    const narrative = this.normalizeNarrative(record);
    const timestamp = new Date().toLocaleDateString();
    const title = `Narrative: ${narrative.title} (${timestamp})`;
    const html = this.formatNarrativeHtml(narrative);
    return await getOrCreateActiveVolumePage(
      "AI Director Canon",
      title,
      html
    );
  }

  static async saveNarrativeMemory(record = {}) {
    const narrative = this.normalizeNarrative(record);
    const timestamp = new Date().toLocaleDateString();
    const title = `Narrative Record: ${narrative.title} (${timestamp})`;
    const html = this.formatNarrativeJson(narrative);
    return await getOrCreateActiveVolumePage(
      "AI Director Memory",
      title,
      html
    );
  }

  static async generateNarrative(
    context = {},
    options = {}
  ) {
    const narrativeContext =
      await NarrativeContextBuilder.build(
        context.playerDirective || ""
      );

    const opportunities =
      await NarrativeOpportunityEngine
        .build({
          playerDirective:
            context.playerDirective || "",
          narrativeContext,
          limit: 3
        });

    console.log(
      "[AI Director] Narrative Context",
      narrativeContext
    );

    console.group(
      "[AI Director] Scene Selection"
    );

    console.log(
      narrativeContext
        .sceneMemory
    );

    console.groupEnd();

    const prompt = buildNarrativePrompt({
      ...context,
      narrativeContext,
      opportunities
    });

    console.group(
      "[AI Director] Prompt Diagnostics"
    );

    console.log(
      "System Length",
      prompt.systemDirective.length
    );

    console.log(
      "User Length",
      prompt.userPayload.length
    );

    console.log(
      "Total Length",
      prompt.systemDirective.length +
      prompt.userPayload.length
    );

    console.groupEnd();

    const activeModel = getActiveModel();
    const response = await OllamaClient.generate(
      prompt.userPayload,
      prompt.systemDirective,
      {
        model: activeModel,
        format: "json"
      }
    );

    console.log(
      "[AI Director] Raw Response",
      response
    );

    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch (err) {
      console.error(
        "[AI Director] Narrative parse failure",
        err,
        response
      );
      throw new Error(
        "Narrative Director returned invalid JSON."
      );
    }

    let narrative =
      this.normalizeNarrative(
        parsed
      );

    narrative.opportunities =
      this.hydrateOpportunityMetadata(
        narrative.opportunities,
        opportunities
      );

    narrative =
      this.repairNarrative(
        narrative
      );

    console.group(
      "PRE VALIDATION"
    );

    console.log(
      structuredClone(
        narrative
      )
    );

    console.groupEnd();

    const validation =
      this.validateNarrative(
        narrative
      );
    if (!validation.valid) {
      console.error(
        "[AI Director] Narrative validation failed",
        validation.errors,
        validation.warnings,
        narrative
      );
      throw new Error(
        `Narrative validation failed: ${validation.errors.join(", ")}`
      );
    }
    if (options.persist !== false) {
      await this.saveNarrativeRecord(narrative);
      await this.saveNarrativeMemory(narrative);

      const deltas =
        await MemoryExtractionManager
          .extractFromNarrative(
            narrative
          );

      console.log(
        "[AI Director] World State Changes",
        narrative.worldStateChanges
      );

      console.group(
        "[AI Director] World State"
      );

      console.log(
        deltas.filter(
          delta =>
            delta.type.includes(
              "LOCATION"
            )
        )
      );

      console.groupEnd();

      await MemoryApplicationManager
        .applyDeltas(
          deltas
        );

    }
    return narrative;
  }

  static async testNarrative(playerDirective) {
    return await this.generateNarrative(
      {
        playerDirective,
        canonLore: "",
        memoryLore: "",
        sourceScene: canvas.scene
      },
      {
        persist: false
      }
    );
  }
}

if (typeof window !== "undefined") {
  window.AIDirector =
    window.AIDirector || {};
  window.AIDirector.NarrativeDirector =
    NarrativeDirector;
}