// modules/ai-director/scripts/data/sector-regeneration-manager.js
// EN-17: Local sector regeneration with optional player guidance.

import {
  SectorPromptEnrichmentManager
} from "./sector-prompt-enrichment-manager.js";

import {
  normalizeSectorSceneRecord
} from "./scene-record-builder.js";

import {
  validateDungeonManifest
} from "./dungeon-schema.js";

export const SECTOR_REGENERATION_MODES = Object.freeze({
  CONTENT: "CONTENT",
  PROMPTS: "PROMPTS",
  CONTENT_AND_PROMPTS: "CONTENT_AND_PROMPTS"
});

const PROTECTED_MANIFEST_FIELDS = Object.freeze([
  "manifestId",
  "dungeonTitle",
  "overallGoal",
  "primaryOpportunityId",
  "narrativeOpportunities",
  "totalSectors",
  "layoutProfile",
  "layoutFamily",
  "layoutSeed",
  "structureType",
  "sceneArchetype",
  "floorCount",
  "floorPresentation",
  "floors",
  "verticalConnections",
  "roomProgram",
  "architecture",
  "ventilation"
]);

const PROTECTED_SECTOR_FIELDS = Object.freeze([
  "sectorId",
  "name",
  "displayName",
  "purpose",
  "graphRole",
  "narrativeRole",
  "floor",
  "connections",
  "adjacentSectors",
  "gridPosition",
  "gridDimensions",
  "shapePrimitive",
  "bounds",
  "pixelBounds",
  "center",
  "exits",
  "opportunityRefs",
  "narrativeOpportunities",
  "rewardPlacements"
]);

const CONTENT_FIELDS = Object.freeze([
  "sensoryDescription",
  "encounters",
  "npcs",
  "inhabitants",
  "monsters",
  "threats",
  "traps",
  "secrets",
  "clues",
  "loot",
  "rewards",
  "interactables",
  "trapsAndSecrets",
  "gmNotes"
]);

const PROMPT_FIELDS = Object.freeze([
  "playerViewPrompt",
  "tacticalMapPrompt",
  "mapPrompt",
  "promptMetadata",
  "flags"
]);

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();

    return `{${keys
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function valuesEqual(first, second) {
  return stableStringify(first) === stableStringify(second);
}

function restoreFields(target, source, fields) {
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      target[field] = clone(source[field]);
    } else {
      delete target[field];
    }
  }

  return target;
}

function copyAllowedFields(target, source, fields) {
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      target[field] = clone(source[field]);
    }
  }

  return target;
}

function collectChangedFields(previousSector, nextSector) {
  const fields = new Set([
    ...Object.keys(previousSector || {}),
    ...Object.keys(nextSector || {})
  ]);

  return [...fields]
    .filter(field =>
      !valuesEqual(
        previousSector?.[field],
        nextSector?.[field]
      )
    )
    .sort();
}

function validateProtectedFields(
  previousValue,
  nextValue,
  fields,
  scope
) {
  const problems = [];

  for (const field of fields) {
    if (
      !valuesEqual(
        previousValue?.[field],
        nextValue?.[field]
      )
    ) {
      problems.push(
        `${scope} protected field changed: ${field}`
      );
    }
  }

  return problems;
}

function validateUnrelatedSectors(
  previousManifest,
  nextManifest,
  targetSectorId
) {
  const problems = [];
  const nextSectorMap = new Map(
    (nextManifest.sectors || []).map(sector => [
      sector.sectorId,
      sector
    ])
  );

  for (const previousSector of previousManifest.sectors || []) {
    if (previousSector.sectorId === targetSectorId) {
      continue;
    }

    const nextSector = nextSectorMap.get(
      previousSector.sectorId
    );

    if (!nextSector) {
      problems.push(
        `Unrelated sector was removed: ${previousSector.sectorId}`
      );
      continue;
    }

    if (!valuesEqual(previousSector, nextSector)) {
      problems.push(
        `Unrelated sector changed: ${previousSector.sectorId}`
      );
    }
  }

  return problems;
}

function normalizeMode(mode) {
  const normalized = cleanText(
    mode || SECTOR_REGENERATION_MODES.CONTENT_AND_PROMPTS
  ).toUpperCase();

  if (
    !Object.values(SECTOR_REGENERATION_MODES)
      .includes(normalized)
  ) {
    throw new Error(
      `Unsupported sector regeneration mode: ${mode}`
    );
  }

  return normalized;
}

function buildGenerationRequest({
  sector,
  manifest,
  narrativeRecord,
  manualGuidance
}) {
  const opportunityIds = Array.isArray(
    sector.opportunityRefs
  )
    ? [...sector.opportunityRefs]
    : [];

  const opportunities = (
    narrativeRecord?.opportunities ||
    manifest.narrativeOpportunities ||
    []
  ).filter(opportunity =>
    opportunityIds.includes(
      opportunity.opportunityId
    )
  );

  return {
    sector: clone(sector),

    manifestContext: {
      manifestId: manifest.manifestId ?? null,
      dungeonTitle: manifest.dungeonTitle || "",
      overallGoal: manifest.overallGoal || "",
      structureType: manifest.structureType || "",
      sceneArchetype: manifest.sceneArchetype || "",
      missionContext: manifest.missionContext || null,
      occupancy:
        manifest.occupancyState ||
        manifest.occupancy ||
        null
    },

    narrativeContext: {
      primaryOpportunityId:
        manifest.primaryOpportunityId ?? null,
      opportunityRefs: opportunityIds,
      opportunities: clone(opportunities)
    },

    manualGuidance: cleanText(manualGuidance),

    instructions: {
      localRegenerationOnly: true,
      preserveNarrativeCanon: true,
      preserveSectorIdentity: true,
      preserveOpportunityAssignments: true,
      preserveRewardPlacements: true,
      preserveGeometry: true,
      doNotModifyOtherSectors: true
    }
  };
}

function normalizeGeneratedContent(generatedContent) {
  if (!generatedContent) {
    return {};
  }

  if (typeof generatedContent === "string") {
    const cleaned = generatedContent
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");

    return JSON.parse(cleaned);
  }

  if (typeof generatedContent === "object") {
    return clone(generatedContent.sector || generatedContent);
  }

  throw new Error(
    "The sector content generator returned an unsupported value."
  );
}

async function regenerateContent({
  previousSector,
  manifest,
  narrativeRecord,
  manualGuidance,
  contentGenerator
}) {
  if (typeof contentGenerator !== "function") {
    throw new Error(
      "CONTENT regeneration requires a contentGenerator function."
    );
  }

  const request = buildGenerationRequest({
    sector: previousSector,
    manifest,
    narrativeRecord,
    manualGuidance
  });

  const generatedContent = await contentGenerator(request);
  const normalizedContent = normalizeGeneratedContent(
    generatedContent
  );

  const nextSector = clone(previousSector);

  copyAllowedFields(
    nextSector,
    normalizedContent,
    CONTENT_FIELDS
  );

  restoreFields(
    nextSector,
    previousSector,
    PROTECTED_SECTOR_FIELDS
  );

  return nextSector;
}

export async function regenerateSector({
  manifest,
  sectorId,
  narrativeRecord = null,
  mode = SECTOR_REGENERATION_MODES.CONTENT_AND_PROMPTS,
  manualGuidance = "",
  forcePrompts = false,
  contentGenerator = null
} = {}) {
  const originalManifest = clone(manifest);
  const problems = [];

  try {
    if (
      !originalManifest ||
      !Array.isArray(originalManifest.sectors)
    ) {
      throw new Error(
        "A valid manifest with sectors is required."
      );
    }

    const targetSectorId = cleanText(sectorId);

    if (!targetSectorId) {
      throw new Error("A sectorId is required.");
    }

    const targetIndex = originalManifest.sectors
      .findIndex(
        sector => sector.sectorId === targetSectorId
      );

    if (targetIndex < 0) {
      throw new Error(
        `Sector was not found: ${targetSectorId}`
      );
    }

    const regenerationMode = normalizeMode(mode);
    const previousSector = clone(
      originalManifest.sectors[targetIndex]
    );

    const candidateManifest = clone(originalManifest);
    let regeneratedSector = clone(previousSector);

    if (
      regenerationMode ===
        SECTOR_REGENERATION_MODES.CONTENT ||
      regenerationMode ===
        SECTOR_REGENERATION_MODES.CONTENT_AND_PROMPTS
    ) {
      regeneratedSector = await regenerateContent({
        previousSector,
        manifest: candidateManifest,
        narrativeRecord,
        manualGuidance,
        contentGenerator
      });
    }

    if (
      regenerationMode ===
        SECTOR_REGENERATION_MODES.PROMPTS ||
      regenerationMode ===
        SECTOR_REGENERATION_MODES.CONTENT_AND_PROMPTS
    ) {
      regeneratedSector =
        SectorPromptEnrichmentManager
          .enrichSectorPrompts(
            regeneratedSector,
            candidateManifest,
            {
              force: forcePrompts === true
            }
          );
    } else {
      restoreFields(
        regeneratedSector,
        previousSector,
        PROMPT_FIELDS
      );
    }

    regeneratedSector =
      normalizeSectorSceneRecord(
        regeneratedSector,
        {
          manifestData: candidateManifest
        }
      );

    restoreFields(
      regeneratedSector,
      previousSector,
      PROTECTED_SECTOR_FIELDS
    );

    candidateManifest.sectors[targetIndex] =
      regeneratedSector;

    restoreFields(
      candidateManifest,
      originalManifest,
      PROTECTED_MANIFEST_FIELDS
    );

    problems.push(
      ...validateProtectedFields(
        originalManifest,
        candidateManifest,
        PROTECTED_MANIFEST_FIELDS,
        "Manifest"
      )
    );

    problems.push(
      ...validateProtectedFields(
        previousSector,
        regeneratedSector,
        PROTECTED_SECTOR_FIELDS,
        "Sector"
      )
    );

    problems.push(
      ...validateUnrelatedSectors(
        originalManifest,
        candidateManifest,
        targetSectorId
      )
    );

    if (!validateDungeonManifest(candidateManifest)) {
      problems.push(
        "The regenerated manifest failed canonical validation"
      );
    }

    if (problems.length) {
      return {
        success: false,
        manifest: originalManifest,
        sector: null,
        previousSector,
        manualGuidance: cleanText(manualGuidance),
        changedFields: [],
        validation: {
          valid: false,
          problems
        }
      };
    }

    return {
      success: true,
      manifest: candidateManifest,
      sector: regeneratedSector,
      previousSector,
      manualGuidance: cleanText(manualGuidance),
      changedFields: collectChangedFields(
        previousSector,
        regeneratedSector
      ),
      validation: {
        valid: true,
        problems: []
      }
    };
  } catch (error) {
    return {
      success: false,
      manifest: originalManifest,
      sector: null,
      previousSector: null,
      manualGuidance: cleanText(manualGuidance),
      changedFields: [],
      validation: {
        valid: false,
        problems: [
          error?.message ||
          "Sector regeneration failed."
        ]
      }
    };
  }
}

export async function refreshSectorAfterEvolution(
  sector,
  manifest
) {
  if (!sector?.sectorId) {
    throw new Error(
      "refreshSectorAfterEvolution requires sectorId."
    );
  }

  return regenerateSector({
    manifest,
    sectorId: sector.sectorId,
    mode: SECTOR_REGENERATION_MODES.PROMPTS,
    forcePrompts: true
  });
}

export const SectorRegenerationManager =
  Object.freeze({
    regenerateSector,
    refreshSectorAfterEvolution,
    buildGenerationRequest,
    SECTOR_REGENERATION_MODES
  });

if (typeof window !== "undefined") {
  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .SectorRegenerationManager =
      SectorRegenerationManager;
}