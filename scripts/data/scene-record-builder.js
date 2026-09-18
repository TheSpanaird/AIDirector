// modules/ai-director/scripts/data/scene-record-builder.js

const SCENE_RECORD_ARRAY_FIELDS = [
  "inhabitants",
  "monsters",
  "threats",
  "traps",
  "secrets",
  "clues",
  "loot",
  "rewards",
  "rewardPlacements",
  "interactables"
];

const SCENE_RECORD_TEXT_FIELDS = [
  "displayName",
  "sectorType",
  "areaState",
  "playerViewPrompt",
  "tacticalMapPrompt",
  "gmNotes"
];

function normalizeText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeSceneRecordArray(value) {
  return Array.isArray(value) ? structuredClone(value) : [];
}

function normalizeSceneRecordEntity(entity, fallbackPrefix, index) {
  if (typeof entity === "string") {
    return {
      stableId: `${fallbackPrefix}-${index + 1}`,
      name: entity,
      role: "UNSPECIFIED",
      count: 1,
      disposition: "UNKNOWN",
      currentActivity: "",
      visibility: "VISIBLE",
      generationNeeds: []
    };
  }
  if (!entity || typeof entity !== "object") return null;
  const stableId = normalizeText(entity.stableId || entity.id || `${fallbackPrefix}-${index + 1}`);
  return {
    ...structuredClone(entity),
    stableId,
    name: normalizeText(entity.name || entity.archetype || stableId),
    role: normalizeText(entity.role || "UNSPECIFIED"),
    count: Math.max(1, Number(entity.count) || 1),
    disposition: normalizeText(entity.disposition || "UNKNOWN").toUpperCase(),
    currentActivity: normalizeText(entity.currentActivity || ""),
    visibility: normalizeText(entity.visibility || "VISIBLE").toUpperCase(),
    generationNeeds: Array.isArray(entity.generationNeeds) ? [...entity.generationNeeds] : []
  };
}

function normalizeSceneRecordEntities(value, fallbackPrefix) {
  return normalizeSceneRecordArray(value)
    .map((entry, index) => normalizeSceneRecordEntity(entry, fallbackPrefix, index))
    .filter(Boolean);
}

function normalizeSceneRecordDetail(detail, fallbackPrefix, index) {
  if (typeof detail === "string") {
    return {
      id: `${fallbackPrefix}-${index + 1}`,
      description: detail,
      visibility: "VISIBLE"
    };
  }
  if (!detail || typeof detail !== "object") return null;

  if (
    detail &&
    detail.trapId &&
    !detail.id
  ) {
    detail.id =
      detail.trapId;
  }

  if (
    detail &&
    detail.clueId &&
    !detail.id
  ) {
    detail.id =
      detail.clueId;
  }

  if (
    detail &&
    detail.secretId &&
    !detail.id
  ) {
    detail.id =
      detail.secretId;
  }

  if (
    detail &&
    detail.threatId &&
    !detail.id
  ) {
    detail.id =
      detail.threatId;
  }

  return {
    ...structuredClone(detail),
    id: normalizeText(detail.id || detail.name || `${fallbackPrefix}-${index + 1}`),
    visibility: normalizeText(detail.visibility || "VISIBLE").toUpperCase()
  };
}

function normalizeSceneRecordDetails(value, fallbackPrefix) {
  return normalizeSceneRecordArray(value)
    .map((entry, index) => normalizeSceneRecordDetail(entry, fallbackPrefix, index))
    .filter(Boolean);
}

function normalizeHazardEntry(
  hazard = {}
) {
  if (!hazard || typeof hazard !== "object") {
    return null;
  }

  return {
    ...structuredClone(hazard),

    hazardState:
      hazard.hazardState ??
      "UNDISCOVERED",

    discoveredAt:
      hazard.discoveredAt ?? null,

    disabledAt:
      hazard.disabledAt ?? null,

    triggeredAt:
      hazard.triggeredAt ?? null,

    resolvedAt:
      hazard.resolvedAt ?? null
  };
}

function normalizeClueEntry(
  clue = {}
) {
  if (
    !clue ||
    typeof clue !== "object"
  ) {
    return null;
  }

  const clueId =
    normalizeText(
      clue.clueId ||
      clue.id
    );

  const description =
    normalizeText(
      clue.description ||
      clue.text ||
      clue.title
    );

  return {
    ...structuredClone(clue),

    id:
      clueId ||
      normalizeText(clue.id),

    clueId:
      clueId ||
      normalizeText(clue.id),

    clueType:
      normalizeText(
        clue.clueType ||
        clue.category ||
        "GENERAL_CLUE"
      ).toUpperCase(),

    title:
      normalizeText(
        clue.title ||
        description ||
        "Unknown Clue"
      ),

    description,

    text:
      normalizeText(
        clue.text ||
        description
      ),

    visibility:
      normalizeText(
        clue.visibility ||
        "VISIBLE"
      ).toUpperCase(),

    clueState:
      normalizeText(
        clue.clueState ||
        (
          clue.visibility === "HIDDEN"
            ? "UNDISCOVERED"
            : "DISCOVERED"
        )
      ).toUpperCase(),

    discoveredAt:
      clue.discoveredAt ?? null,

    resolvedAt:
      clue.resolvedAt ?? null,

    sourceOpportunityId:
      clue.sourceOpportunityId ??
      clue.opportunityId ??
      null,

    sourceRefs:
      Array.isArray(clue.sourceRefs)
        ? [...clue.sourceRefs]
        : []
  };
}

function normalizeSecretEntry(
  secret = {}
) {
  if (
    !secret ||
    typeof secret !== "object"
  ) {
    return null;
  }

  const secretId =
    normalizeText(
      secret.secretId ||
      secret.id
    );

  const description =
    normalizeText(
      secret.description ||
      secret.text ||
      secret.title
    );

  return {
    ...structuredClone(secret),

    id:
      secretId ||
      normalizeText(secret.id),

    secretId:
      secretId ||
      normalizeText(secret.id),

    secretType:
      normalizeText(
        secret.secretType ||
        "GENERAL_SECRET"
      ).toUpperCase(),

    sourceType:
      normalizeText(
        secret.sourceType ||
        "CLUE"
      ).toUpperCase(),

    title:
      normalizeText(
        secret.title ||
        description ||
        "Unknown Secret"
      ),

    description,

    visibility:
      normalizeText(
        secret.visibility ||
        "GM_ONLY"
      ).toUpperCase(),

    secretState:
      normalizeText(
        secret.secretState ||
        "UNDISCOVERED"
      ).toUpperCase(),

    discoveredAt:
      secret.discoveredAt ?? null,

    revealedAt:
      secret.revealedAt ?? null,

    resolvedAt:
      secret.resolvedAt ?? null,

    sourceOpportunityId:
      secret.sourceOpportunityId ??
      secret.opportunityId ??
      null,

    sourceRefs:
      Array.isArray(secret.sourceRefs)
        ? [...secret.sourceRefs]
        : []
  };
}

function normalizeThreatEntry(
  threat = {}
) {
  if (
    !threat ||
    typeof threat !== "object"
  ) {
    return null;
  }

  const threatId =
    normalizeText(
      threat.threatId ||
      threat.id
    );

  const name =
    normalizeText(
      threat.name ||
      threat.title ||
      threat.description ||
      "Unknown Threat"
    );

  return {
    ...structuredClone(threat),

    id:
      threatId ||
      normalizeText(threat.id),

    threatId:
      threatId ||
      normalizeText(threat.id),

    threatType:
      normalizeText(
        threat.threatType ||
        threat.category ||
        "GENERAL_THREAT"
      ).toUpperCase(),

    name,

    description:
      normalizeText(
        threat.description ||
        name
      ),

    severity:
      normalizeText(
        threat.severity ||
        "MEDIUM"
      ).toUpperCase(),

    visibility:
      normalizeText(
        threat.visibility ||
        "VISIBLE"
      ).toUpperCase(),

    threatState:
      normalizeText(
        threat.threatState ||
        "ACTIVE"
      ).toUpperCase(),

    identifiedAt:
      threat.identifiedAt ?? null,

    defeatedAt:
      threat.defeatedAt ?? null,

    resolvedAt:
      threat.resolvedAt ?? null,

    sourceOpportunityId:
      threat.sourceOpportunityId ??
      threat.opportunityId ??
      null,

    sourceRefs:
      Array.isArray(threat.sourceRefs)
        ? [...threat.sourceRefs]
        : [],

    entityPlanningRequired:
      threat.entityPlanningRequired !==
      false
  };
}

function normalizeRewardEntry(
  reward = {}
) {

  if (!reward || typeof reward !== "object") {
    return null;
  }

  return {

    ...structuredClone(reward),

    systemType:
      String(
        reward.systemType ||
        "NARRATIVE_ONLY"
      ),

    rewardState:
      reward.rewardState ||
      "UNDISCOVERED",

    revealed:
      reward.revealed === true,

    claimed:
      reward.claimed === true,

    discoveredAt:
      reward.discoveredAt || null,

    claimedAt:
      reward.claimedAt || null,

    resolvedAt:
      reward.resolvedAt || null,

    placementType:
      reward.placementType ?? null,

    placementSectorId:
      reward.placementSectorId ?? null,

    placementReason:
      reward.placementReason ?? null

  };

}

function inferSectorType(sector = {}) {
  const explicit = normalizeText(sector.sectorType || "").toUpperCase();
  if (explicit) return explicit;
  const purpose = normalizeText(sector.purpose || sector.roomType || sector.name || "").toUpperCase();
  const openAreaTerms = ["COURTYARD", "BAILEY", "YARD", "ROAD", "PATH", "MARKET", "WELL", "GARDEN", "FIELD", "OPEN"];
  if (openAreaTerms.some(term => purpose.includes(term))) return "OPEN_AREA";
  if (purpose.includes("STAIR") || purpose.includes("ELEVATOR") || purpose.includes("LADDER")) return "VERTICAL_ACCESS";
  return "ROOM";
}

function inferAreaState(sector = {}, manifestData = {}) {
  const explicit = normalizeText(sector.areaState || "").toUpperCase();
  if (explicit) return explicit;
  const occupancyState = normalizeText(manifestData.occupancyState || manifestData.occupancy || "").toUpperCase();
  if (occupancyState.includes("ABANDONED")) return "ABANDONED";
  if (occupancyState.includes("RUIN")) return "RUINED";
  if (occupancyState.includes("LIVING") || occupancyState.includes("OCCUPIED")) return "ACTIVE";
  return "UNKNOWN";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSectorListSectionHtml(title, entries, textAccessor) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return "";
  }

  const items = entries
    .map(entry => textAccessor(entry))
    .filter(Boolean)
    .map(text => `<li>${escapeHtml(text)}</li>`)
    .join("");

  if (!items) {
    return "";
  }

  return `<div class="ai-director-sector-content-section"><h4>${escapeHtml(title)}</h4><ul>${items}</ul></div>`;
}

function buildRewardsSectionHtml(rewards = [], { viewMode = "gm" } = {}) {
  const visibleRewards =
    viewMode === "player"
      ? (Array.isArray(rewards)
          ? rewards.filter(entry => {
              const state = entry?.rewardState || entry?.reward?.rewardState;
              return state && state !== "UNDISCOVERED";
            })
          : [])
      : rewards;

  if (!Array.isArray(visibleRewards) || visibleRewards.length === 0) {
    return "";
  }

  const items = visibleRewards
    .map(entry => {
      const title = entry?.reward?.title || entry?.title;
      if (!title) return "";

      const rewardType = entry?.reward?.rewardType || entry?.rewardType || "";
      const valueTier = entry?.reward?.valueTier || entry?.valueTier || "";
      const meta = [rewardType, valueTier].filter(Boolean).join(" · ");

      return `<li><strong>${escapeHtml(title)}</strong>${meta ? ` — ${escapeHtml(meta)}` : ""}</li>`;
    })
    .filter(Boolean)
    .join("");

  if (!items) {
    return "";
  }

  return `<div class="ai-director-sector-content-section"><h4>Rewards</h4><ul>${items}</ul></div>`;
}

export function getRewardStats(rewards = []) {

  return {

    totalRewards:
      rewards.length,

    discoveredRewards:
      rewards.filter(
        r => r.revealed
      ).length,

    undiscoveredRewards:
      rewards.filter(
        r => !r.revealed
      ).length

  };

}

export function evolveThreatState(
  threat,
  state
) {

  threat.threatState =
    state;

  if (
    state === "DEFEATED"
  ) {
    threat.defeatedAt =
      Date.now();
  }

  return threat;
}

function visibleCluesForView(
  clues = [],
  viewMode = "gm"
) {
  if (viewMode !== "player") {
    return clues;
  }

  return clues.filter(clue =>
    clue?.visibility === "VISIBLE" ||
    clue?.clueState === "DISCOVERED" ||
    clue?.clueState === "RESOLVED"
  );
}

function visibleSecretsForView(
  secrets = [],
  viewMode = "gm"
) {
  if (viewMode !== "player") {
    return secrets;
  }

  return secrets.filter(secret =>
    secret?.visibility === "REVEALED" ||
    secret?.secretState === "REVEALED" ||
    secret?.secretState === "RESOLVED"
  );
}

function visibleThreatsForView(
  threats = [],
  viewMode = "gm"
) {
  if (viewMode !== "player") {
    return threats;
  }

  return threats.filter(threat =>
    threat?.visibility === "VISIBLE" ||
    threat?.threatState === "IDENTIFIED" ||
    threat?.threatState === "ACTIVE" ||
    threat?.threatState === "DEFEATED" ||
    threat?.threatState === "RESOLVED"
  );
}

export function buildSectorContentSectionsHtml(
  sector = {},
  {
    viewMode = "gm"
  } = {}
) {
  const visibleClues =
    visibleCluesForView(
      sector.clues || [],
      viewMode
    );

  const visibleThreats =
    visibleThreatsForView(
      sector.threats || [],
      viewMode
    );

  const visibleSecrets =
    visibleSecretsForView(
      sector.secrets || [],
      viewMode
    );

  const sections = [
    buildSectorListSectionHtml(
      "Clues",
      visibleClues,
      clue =>
        clue?.title ||
        clue?.description ||
        clue?.text
    ),

    buildSectorListSectionHtml(
      "Threats",
      visibleThreats,
      threat =>
        threat?.name ||
        threat?.description
    ),

    buildSectorListSectionHtml(
      "Traps",
      sector.traps,
      trap =>
        trap?.title ||
        trap?.description
    ),

    buildSectorListSectionHtml(
      "Secrets",
      visibleSecrets,
      secret =>
        secret?.title ||
        secret?.description
    ),

    buildSectorListSectionHtml(
      "Loot",
      sector.loot,
      loot =>
        loot?.name ||
        loot?.description
    ),

    buildRewardsSectionHtml(
      sector.rewards,
      {
        viewMode
      }
    ),

    buildSectorListSectionHtml(
      "Interactables",
      sector.interactables,
      interactable =>
        interactable?.title ||
        interactable?.description
    )
  ].filter(Boolean);

  if (!sections.length) {
    return "";
  }

  return `
<div class="ai-director-sector-content">
${sections.join("")}
</div>
`.trim();
}

export function normalizeSectorSceneRecord(sector = {}, options = {}) {
  const name = normalizeText(sector.name || sector.displayName || "Unnamed Sector");
  const sensoryDescription = normalizeText(sector.sensoryDescription || "");
  const legacyMapPrompt = normalizeText(sector.mapPrompt || "");
  const tacticalMapPrompt = normalizeText(sector.tacticalMapPrompt || legacyMapPrompt || "");

  const inhabitants = normalizeSceneRecordEntities(sector.inhabitants, `${sector.sectorId || "sector"}-inhabitant`);
  const monsters = normalizeSceneRecordEntities(sector.monsters, `${sector.sectorId || "sector"}-monster`);
  const npcs = normalizeSceneRecordEntities(sector.npcs, `${sector.sectorId || "sector"}-npc`);

  const playerViewPrompt = normalizeText(
    sector.playerViewPrompt ||
    (
      sensoryDescription
        ? `Eye-level player view inside ${name}: ${sensoryDescription}`
        : `Eye-level player view inside ${name}.`
    )
  );

  const output = {
    ...structuredClone(sector),
    displayName: normalizeText(sector.displayName || name),
    sectorType: inferSectorType(sector),
    areaState: inferAreaState(sector, options.manifestData || {}),
    mundaneAllowed: sector.mundaneAllowed === true,
    sensoryDescription,
    playerViewPrompt,
    tacticalMapPrompt,
    mapPrompt: legacyMapPrompt || tacticalMapPrompt,
    inhabitants,
    monsters,
    npcs,
    traps:
      normalizeSceneRecordDetails(
        sector.traps,
        `${sector.sectorId || "sector"}-trap`
      )
        .map(normalizeHazardEntry)
        .filter(Boolean),
    threats:
      normalizeSceneRecordDetails(
        sector.threats,
        `${sector.sectorId || "sector"}-threat`
      )
        .map(normalizeThreatEntry)
        .filter(Boolean),

    secrets:
      normalizeSceneRecordDetails(
        sector.secrets,
        `${sector.sectorId || "sector"}-secret`
      )
        .map(normalizeSecretEntry)
        .filter(Boolean),

    clues:
      normalizeSceneRecordDetails(
        sector.clues,
        `${sector.sectorId || "sector"}-clue`
      )
        .map(normalizeClueEntry)
        .filter(Boolean),
    loot: normalizeSceneRecordDetails(sector.loot, `${sector.sectorId || "sector"}-loot`),
    rewards:
      normalizeSceneRecordArray(
        sector.rewards
      )
        .map(normalizeRewardEntry)
        .filter(Boolean),

    rewardPlacements:
      Array.isArray(
        sector.rewardPlacements
      )
        ? structuredClone(
            sector.rewardPlacements
          )
        : [],

    interactables: normalizeSceneRecordDetails(sector.interactables, `${sector.sectorId || "sector"}-interactable`),
    gmNotes: normalizeText(sector.gmNotes || "")
  };

  // Normalize rewards at sector root level if present
  if (Array.isArray(output.rewards)) {
    output.rewards = output.rewards.map(normalizeRewardEntry).filter(Boolean);
  }

  // Ensure sector flags object structure exists and store synthesized prompt
  output.flags = output.flags || {};
  output.flags.world = output.flags.world || {};
  output.flags.world.playerViewPrompt = playerViewPrompt;

  // Ensure optional text fields always exist as strings
  for (const field of SCENE_RECORD_TEXT_FIELDS) {
    output[field] = normalizeText(output[field] || "");
  }

  // Ensure optional content arrays always exist
  for (const field of SCENE_RECORD_ARRAY_FIELDS) {
    if (!Array.isArray(output[field])) output[field] = [];
  }

  output.contentSectionsHtml = buildSectorContentSectionsHtml(output, { viewMode: "gm" });
  output.playerContentSectionsHtml = buildSectorContentSectionsHtml(output, { viewMode: "player" });

  return output;
}

if (typeof window !== "undefined") {
  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .normalizeSectorSceneRecord =
      normalizeSectorSceneRecord;
}