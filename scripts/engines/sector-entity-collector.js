// modules/ai-director/scripts/engines/sector-entity-collector.js
// PASS 7A: Structured sector entity collector.
// Non-destructive helper: does not create actors or tokens.
// Canonical sources are sector.monsters[] and sector.inhabitants[]. Legacy npcs[] / encounters[] are fallback only.

const CANONICAL_FIELDS = Object.freeze(["monsters", "inhabitants"]);
const LEGACY_FIELDS = Object.freeze(["npcs", "encounters"]);
const DEFAULT_VISIBLE = "VISIBLE";
const DEFAULT_DISPOSITION = "UNKNOWN";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function stableSlug(value, fallback = "entity") {
  const slug = cleanText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function normalizeUpper(value, fallback) {
  const text = cleanText(value, fallback).toUpperCase();
  return text || fallback;
}

export function normalizeGenerationNeeds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map(item => cleanText(item).toUpperCase())
      .filter(Boolean)
  )];
}

export function entityRequestsActor(entity) {
  return normalizeGenerationNeeds(entity?.generationNeeds).includes("ACTOR");
}

export function entityRequestsToken(entity) {
  return normalizeGenerationNeeds(entity?.generationNeeds).includes("TOKEN");
}

export function normalizeEntitySpawnRequest(entity, context = {}) {
  const {
    sourceField = "unknown",
    sector = {},
    index = 0,
    legacy = false
  } = context;

  const sectorId = cleanText(sector.sectorId || sector.id || "unknown-sector");
  const sectorName = cleanText(sector.displayName || sector.name || sectorId);
  const fallbackPrefix = `${stableSlug(sectorId)}-${stableSlug(sourceField)}`;

  let raw = entity;
  if (typeof entity === "string") {
    raw = {
      name: entity,
      role: sourceField === "encounters" ? "Encounter" : "UNSPECIFIED",
      count: 1,
      disposition: sourceField === "monsters" || sourceField === "encounters" ? "HOSTILE" : DEFAULT_DISPOSITION,
      visibility: DEFAULT_VISIBLE,
      generationNeeds: []
    };
  }

  if (!raw || typeof raw !== "object") return null;

  const name = cleanText(raw.name || raw.npcName || raw.archetype || raw.label || raw.id || raw.stableId || "Unnamed Entity");
  const stableId = cleanText(raw.stableId || raw.id || `${fallbackPrefix}-${index + 1}`);
  const generationNeeds = normalizeGenerationNeeds(raw.generationNeeds);
  const disposition = normalizeUpper(raw.disposition || raw.alignment || raw.attitude || raw.role, DEFAULT_DISPOSITION);
  const visibility = normalizeUpper(raw.visibility, DEFAULT_VISIBLE);
  const count = Math.max(1, Number(raw.count ?? raw.quantity ?? 1) || 1);
  const role = cleanText(raw.role || raw.npcRole || raw.type || "UNSPECIFIED");
  const currentActivity = cleanText(raw.currentActivity || raw.activity || raw.description || "");

  return {
    stableId,
    sourceField,
    legacy: legacy === true,
    sectorId,
    sectorName,
    name,
    archetype: cleanText(raw.archetype || raw.name || name),
    role,
    species: cleanText(raw.species || raw.creatureType || raw.race || ""),
    count,
    disposition,
    visibility,
    currentActivity,
    generationNeeds,
    requiresActor: generationNeeds.includes("ACTOR"),
    requiresToken: generationNeeds.includes("TOKEN"),
    spatialAnchor: raw.spatialAnchor && typeof raw.spatialAnchor === "object"
      ? structuredClone(raw.spatialAnchor)
      : null,
    actorSearchTerms: [...new Set([
      cleanText(raw.actorName || raw.name || raw.archetype),
      cleanText(raw.archetype),
      cleanText(raw.name),
      cleanText(raw.role)
    ].filter(Boolean))],
    raw: structuredClone(raw)
  };
}

export function collectSectorSpawnRequests(sector = {}, options = {}) {
  const includeLegacy = options.includeLegacy !== false;
  const includeLegacyWithCanonical = options.includeLegacyWithCanonical === true;
  const spawnOnly = options.spawnOnly === true;
  const includeHidden = options.includeHidden !== false;
  const includeGmOnly = options.includeGmOnly !== false;

  const canonical = [];
  for (const field of CANONICAL_FIELDS) {
    for (const [index, entity] of asArray(sector[field]).entries()) {
      const request = normalizeEntitySpawnRequest(entity, {
        sourceField: field,
        sector,
        index,
        legacy: false
      });
      if (request) canonical.push(request);
    }
  }

  const useLegacy = includeLegacy && (includeLegacyWithCanonical || canonical.length === 0);
  const legacy = [];
  if (useLegacy) {
    for (const field of LEGACY_FIELDS) {
      for (const [index, entity] of asArray(sector[field]).entries()) {
        const request = normalizeEntitySpawnRequest(entity, {
          sourceField: field,
          sector,
          index,
          legacy: true
        });
        if (request) legacy.push(request);
      }
    }
  }

  return [...canonical, ...legacy].filter(request => {
    if (spawnOnly && !request.requiresActor && !request.requiresToken) return false;
    if (!includeHidden && request.visibility === "HIDDEN") return false;
    if (!includeGmOnly && request.visibility === "GM_ONLY") return false;
    return true;
  });
}

export function summarizeSectorSpawnRequests(sector = {}, options = {}) {
  const requests = collectSectorSpawnRequests(sector, options);
  return {
    sectorId: sector.sectorId || null,
    total: requests.length,
    canonical: requests.filter(request => !request.legacy).length,
    legacy: requests.filter(request => request.legacy).length,
    actorRequests: requests.filter(request => request.requiresActor).length,
    tokenRequests: requests.filter(request => request.requiresToken).length,
    journalOnly: requests.filter(request => !request.requiresActor && !request.requiresToken).length,
    hidden: requests.filter(request => request.visibility === "HIDDEN").length,
    gmOnly: requests.filter(request => request.visibility === "GM_ONLY").length,
    bySourceField: requests.reduce((output, request) => {
      output[request.sourceField] = (output[request.sourceField] || 0) + 1;
      return output;
    }, {})
  };
}

export const SectorEntityCollector = Object.freeze({
  collectSectorSpawnRequests,
  normalizeEntitySpawnRequest,
  normalizeGenerationNeeds,
  entityRequestsActor,
  entityRequestsToken,
  summarizeSectorSpawnRequests
});
