// modules/ai-director/scripts/data/sector-prompt-enrichment-manager.js
// EN-16: Deterministic sector-specific prompt enrichment.

const PLACEHOLDER_VALUES = new Set([
  "",
  "none",
  "n/a",
  "unknown",
  "unknown clue",
  "unknown secret",
  "unknown threat",
  "unknown hazard",
  "unnamed",
  "unnamed entity"
]);

const REVEALED_STATES = new Set([
  "DISCOVERED",
  "IDENTIFIED",
  "REVEALED",
  "DISABLED",
  "TRIGGERED",
  "DEFEATED",
  "CLAIMED",
  "RESOLVED"
]);

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function cleanText(value, fallback = "") {
  return String(value ?? fallback)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUpper(value, fallback = "") {
  return cleanText(value, fallback).toUpperCase();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isUsableText(value) {
  const text = cleanText(value).toLowerCase();

  return Boolean(text) &&
    !PLACEHOLDER_VALUES.has(text);
}

function firstUsableText(...values) {
  return values
    .map(value => cleanText(value))
    .find(isUsableText) || "";
}

function itemLabel(item) {
  if (typeof item === "string") {
    return isUsableText(item)
      ? cleanText(item)
      : "";
  }

  if (!item || typeof item !== "object") {
    return "";
  }

  return firstUsableText(
    item.title,
    item.name,
    item.archetype,
    item.description,
    item.text,
    item.role
  );
}

function itemDescription(item) {
  if (typeof item === "string") {
    return isUsableText(item)
      ? cleanText(item)
      : "";
  }

  if (!item || typeof item !== "object") {
    return "";
  }

  return firstUsableText(
    item.description,
    item.text,
    item.currentActivity,
    item.role,
    item.title,
    item.name,
    item.archetype
  );
}

function visibilityOf(item, fallback = "VISIBLE") {
  return normalizeUpper(
    item?.visibility,
    fallback
  );
}

function lifecycleStateOf(item) {
  return normalizeUpper(
    item?.clueState ||
    item?.secretState ||
    item?.threatState ||
    item?.hazardState ||
    item?.rewardState ||
    item?.reward?.rewardState,
    ""
  );
}

function isPlayerVisible(item) {
  if (!item || typeof item !== "object") {
    return true;
  }

  const visibility = visibilityOf(item);
  const state = lifecycleStateOf(item);

  if (
    visibility === "GM_ONLY" ||
    visibility === "HIDDEN" ||
    visibility === "CONCEALED" ||
    visibility === "CONDITIONAL" ||
    visibility === "UNKNOWN"
  ) {
    return REVEALED_STATES.has(state);
  }

  return visibility === "VISIBLE" ||
    visibility === "REVEALED";
}

function isPlayerVisibleReward(entry) {
  const state = normalizeUpper(
    entry?.rewardState ||
    entry?.reward?.rewardState,
    "UNDISCOVERED"
  );

  return entry?.revealed === true ||
    entry?.reward?.revealed === true ||
    [
      "DISCOVERED",
      "CLAIMED",
      "RESOLVED"
    ].includes(state);
}

function isPhysicalInteractable(item) {
  const category = normalizeUpper(
    item?.category ||
    item?.type
  );

  return !(
    category.includes("OBJECTIVE") ||
    category.includes("QUEST") ||
    category.includes("MISSION") ||
    category.includes("GOAL") ||
    category.includes("NARRATIVE")
  );
}

function describeEntity(entity) {
  const name = itemLabel(entity);

  if (!name) {
    return "";
  }

  const count = Math.max(
    1,
    Number(entity?.count) || 1
  );

  const role = cleanText(entity?.role);
  const activity = cleanText(
    entity?.currentActivity
  );

  return [
    count > 1
      ? `${count} ${name}`
      : name,
    role &&
    role.toLowerCase() !== name.toLowerCase()
      ? `serving as ${role}`
      : "",
    activity
      ? `currently ${activity}`
      : ""
  ]
    .filter(Boolean)
    .join(", ");
}

function describePhysicalDetail(item) {
  const label = itemLabel(item);
  const description = itemDescription(item);

  if (!label && !description) {
    return "";
  }

  if (!label) {
    return description;
  }

  if (
    !description ||
    description.toLowerCase() ===
      label.toLowerCase()
  ) {
    return label;
  }

  const normalizedLabel =
    label
      .replace(/...$/, "")
      .toLowerCase()
      .trim();
  const normalizedDescription =
    description
      .toLowerCase()
      .trim();
  if (
    normalizedDescription.startsWith(
      normalizedLabel
    )
  ) {
    return description;
  }

  return `${label}: ${description}`;
}

function describeReward(entry) {
  const reward = entry?.reward || entry;

  return firstUsableText(
    reward?.description,
    reward?.title
  );
}

function describeConnection(connection) {
  if (typeof connection === "string") {
    return cleanText(connection);
  }

  if (
    !connection ||
    typeof connection !== "object"
  ) {
    return "";
  }

  const destination = cleanText(
    connection.to
  );

  if (!destination) {
    return "";
  }

  const connectionType = firstUsableText(
    connection.connectionType,
    connection.doorType
  );

  const side = cleanText(
    connection.wallSide
  );

  return [
    connectionType || "access",
    `to ${destination}`,
    side
      ? `on the ${side} side`
      : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function describeSpatialAnchor(entity) {
  const anchor = entity?.spatialAnchor;

  if (
    !anchor ||
    typeof anchor !== "object" ||
    !isUsableText(anchor.targetObject)
  ) {
    return "";
  }

  const entityName = itemLabel(entity);

  if (!entityName) {
    return "";
  }

  const relationship = cleanText(
    anchor.relationship,
    "near"
  )
    .toLowerCase()
    .replace(/_/g, " ");

  return [
    entityName,
    relationship,
    cleanText(anchor.targetObject)
  ].join(" ");
}

function inferEnvironmentType(sector) {
  const sectorType = normalizeUpper(
    sector.sectorType ||
    sector.purpose,
    "ROOM"
  );

  if (
    sectorType.includes("OPEN") ||
    sectorType.includes("COURTYARD") ||
    sectorType.includes("GARDEN") ||
    sectorType.includes("ROAD") ||
    sectorType.includes("FIELD")
  ) {
    return "open environment";
  }

  if (
    sectorType.includes("TRANSITION") ||
    sectorType.includes("PASSAGE") ||
    sectorType.includes("CORRIDOR")
  ) {
    return "connecting passage";
  }

  if (sectorType.includes("VERTICAL")) {
    return "vertical access space";
  }

  return "interior environment";
}

function buildPlayerViewPrompt(
  sector,
  manifest = {}
) {
  const name = firstUsableText(
    sector.displayName,
    sector.name,
    "Unnamed Sector"
  );

  const environmentType =
    inferEnvironmentType(sector);

  const areaState = cleanText(
    sector.areaState ||
    manifest.occupancyState ||
    manifest.occupancy
  )
    .replace(/_/g, " ")
    .toLowerCase();

  const sensory = cleanText(
    sector.sensoryDescription
  );

  const visibleInhabitants =
    asArray(sector.inhabitants)
      .filter(isPlayerVisible)
      .map(describeEntity)
      .filter(Boolean);

  const visibleMonsters =
    asArray(sector.monsters)
      .filter(isPlayerVisible)
      .map(describeEntity)
      .filter(Boolean);

  const visibleThreats =
    asArray(sector.threats)
      .filter(isPlayerVisible)
      .map(describePhysicalDetail)
      .filter(Boolean);

  const visibleHazards =
    asArray(sector.traps)
      .filter(isPlayerVisible)
      .map(describePhysicalDetail)
      .filter(Boolean);

  const visibleClues =
    asArray(sector.clues)
      .filter(isPlayerVisible)
      .map(describePhysicalDetail)
      .filter(Boolean);

  const revealedSecrets =
    asArray(sector.secrets)
      .filter(isPlayerVisible)
      .map(describePhysicalDetail)
      .filter(Boolean);

  const visibleInteractables =
    asArray(sector.interactables)
      .filter(isPhysicalInteractable)
      .filter(isPlayerVisible)
      .map(describePhysicalDetail)
      .filter(Boolean);

  const visibleLoot =
    asArray(sector.loot)
      .filter(isPlayerVisible)
      .map(describePhysicalDetail)
      .filter(Boolean);

  const visibleRewards =
    asArray(sector.rewards)
      .filter(isPlayerVisibleReward)
      .map(describeReward)
      .filter(Boolean);

  return [
    `Eye-level cinematic player viewpoint inside ${name}, shown as an immersive ${environmentType}.`,
    areaState
      ? `The area appears ${areaState}.`
      : "",
    sensory,
    visibleInhabitants.length
      ? `Visible inhabitants: ${visibleInhabitants.join("; ")}.`
      : "",
    visibleMonsters.length
      ? `Visible creatures: ${visibleMonsters.join("; ")}.`
      : "",
    visibleThreats.length
      ? `Obvious threats: ${visibleThreats.join("; ")}.`
      : "",
    visibleHazards.length
      ? `Visible environmental hazards: ${visibleHazards.join("; ")}.`
      : "",
    visibleClues.length
      ? `Observable clues: ${visibleClues.join("; ")}.`
      : "",
    revealedSecrets.length
      ? `Revealed hidden features: ${revealedSecrets.join("; ")}.`
      : "",
    visibleInteractables.length
      ? `Prominent interactive features: ${visibleInteractables.join("; ")}.`
      : "",
    visibleLoot.length
      ? `Visible objects of value: ${visibleLoot.join("; ")}.`
      : "",
    visibleRewards.length
      ? `Visible discovered outcomes: ${visibleRewards.join("; ")}.`
      : "",
    "Environment-focused composition, natural spatial depth, atmospheric lighting, detailed surfaces, no interface elements."
  ]
    .filter(Boolean)
    .join(" ");
}

function buildTacticalMapPrompt(
  sector,
  manifest = {}
) {
  const name = firstUsableText(
    sector.displayName,
    sector.name,
    "Unnamed Sector"
  );

  const purpose = cleanText(
    sector.purpose ||
    sector.sectorType,
    "general area"
  )
    .replace(/_/g, " ")
    .toLowerCase();

  const areaState = cleanText(
    sector.areaState ||
    manifest.occupancyState ||
    manifest.occupancy
  )
    .replace(/_/g, " ")
    .toLowerCase();

  const shape = cleanText(
    sector.shapePrimitive
  )
    .replace(/_/g, " ")
    .toLowerCase();

  const sizeClass = cleanText(
    sector.sizeClass
  )
    .replace(/_/g, " ")
    .toLowerCase();

  const connections =
    asArray(sector.connections)
      .map(describeConnection)
      .filter(Boolean);

  const terrain =
    asArray(sector.terrainZones)
      .map(describePhysicalDetail)
      .filter(Boolean);

  const hazards =
    asArray(sector.traps)
      .map(describePhysicalDetail)
      .filter(Boolean);

  const threats =
    asArray(sector.threats)
      .map(describePhysicalDetail)
      .filter(Boolean);

  const inhabitants =
    asArray(sector.inhabitants)
      .map(describeEntity)
      .filter(Boolean);

  const monsters =
    asArray(sector.monsters)
      .map(describeEntity)
      .filter(Boolean);

  const interactables =
    asArray(sector.interactables)
      .filter(isPhysicalInteractable)
      .map(describePhysicalDetail)
      .filter(Boolean);

  const anchors = [
    ...asArray(sector.inhabitants),
    ...asArray(sector.monsters),
    ...asArray(sector.npcs)
  ]
    .map(describeSpatialAnchor)
    .filter(Boolean);

  return [
    `Direct 90-degree overhead orthographic gridless tactical battlemap of ${name}.`,
    `Sector purpose: ${purpose}.`,
    areaState
      ? `Physical state: ${areaState}.`
      : "",
    sizeClass
      ? `Scale: ${sizeClass}.`
      : "",
    shape
      ? `Suggested footprint: ${shape}.`
      : "",
    connections.length
      ? `Access and connections: ${connections.join("; ")}.`
      : "",
    terrain.length
      ? `Terrain zones: ${terrain.join("; ")}.`
      : "",
    interactables.length
      ? `Major physical features and interactables: ${interactables.join("; ")}.`
      : "",
    hazards.length
      ? `GM-known hazards and obstacles: ${hazards.join("; ")}.`
      : "",
    threats.length
      ? `GM-known tactical threats: ${threats.join("; ")}.`
      : "",
    inhabitants.length
      ? `Routine occupants: ${inhabitants.join("; ")}.`
      : "",
    monsters.length
      ? `Hostile or dangerous occupants: ${monsters.join("; ")}.`
      : "",
    anchors.length
      ? `Spatial relationships: ${anchors.join("; ")}.`
      : "",
    "Clear traversable floor space, readable entrances, usable cover, crisp environmental boundaries, no labels, no text, no grid."
  ]
    .filter(Boolean)
    .join(" ");
}

export function enrichSectorPrompts(
  sector = {},
  manifest = {},
  options = {}
) {
  const output = clone(sector);
  const force = options.force === true;

  const metadata =
    output.promptMetadata &&
    typeof output.promptMetadata === "object"
      ? clone(output.promptMetadata)
      : {};

  const preservePlayerPrompt =
    !force &&
    metadata.playerViewPromptSource === "MANUAL" &&
    isUsableText(output.playerViewPrompt);

  const preserveTacticalPrompt =
    !force &&
    metadata.tacticalMapPromptSource === "MANUAL" &&
    isUsableText(output.tacticalMapPrompt);

  if (!preservePlayerPrompt) {
    output.playerViewPrompt =
      buildPlayerViewPrompt(
        output,
        manifest
      );
  }

  if (!preserveTacticalPrompt) {
    output.tacticalMapPrompt =
      buildTacticalMapPrompt(
        output,
        manifest
      );
  }

  output.mapPrompt =
    output.tacticalMapPrompt;

  output.flags =
    output.flags || {};

  output.flags.world =
    output.flags.world || {};

  output.flags.world.playerViewPrompt =
    output.playerViewPrompt;

  output.promptMetadata = {
    ...metadata,
    version: "EN-16",
    playerViewPromptSource:
      preservePlayerPrompt
        ? "MANUAL"
        : "EN16_GENERATED",
    tacticalMapPromptSource:
      preserveTacticalPrompt
        ? "MANUAL"
        : "EN16_GENERATED"
  };

  return output;
}

export function enrichManifestPrompts(
  manifest = {},
  options = {}
) {
  if (
    !manifest ||
    !Array.isArray(manifest.sectors)
  ) {
    return manifest;
  }

  const output = clone(manifest);

  output.sectors =
    output.sectors.map(sector =>
      enrichSectorPrompts(
        sector,
        output,
        options
      )
    );

  return output;
}

export const SectorPromptEnrichmentManager =
  Object.freeze({
    enrichSectorPrompts,
    enrichManifestPrompts
  });

if (typeof window !== "undefined") {
  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .SectorPromptEnrichmentManager =
      SectorPromptEnrichmentManager;
}
