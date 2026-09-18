// modules/ai-director/scripts/engines/sector-spawn-planner.js
// PASS 7D / 7J: Dry-run & Real Execution Sector Spawn Planner
// Plans structured actor resolution, identity application, and token placement previews.

import { collectSectorSpawnRequests } from "/modules/ai-director/scripts/engines/sector-entity-collector.js";
import { buildEntityPlans } from "/modules/ai-director/scripts/engines/entity-plan-manager.js";
import { planSectorActorResolution } from "/modules/ai-director/scripts/engines/actor-identity-resolver.js";
import { applyActorResolutionPlan } from "/modules/ai-director/scripts/engines/actor-resolution-applier.js";

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeUpper(value, fallback = "UNKNOWN") {
  const output = cleanText(value, fallback).toUpperCase();
  return output || fallback;
}

function padIndex(index) {
  return String(index + 1).padStart(3, "0");
}

function sectorBounds(sector = {}) {
  return sector.bounds || sector.pixelBounds || {
    x: 0,
    y: 0,
    width: Number(sector.gridDimensions?.w || 10) * 100,
    height: Number(sector.gridDimensions?.h || 10) * 100
  };
}

/**
 * Ensures sector objects normalize entity payloads (extracting flags.ai-director.profile, identityKey, targetCR)
 * before passing them to the identity collector pipeline.
 */
function normalizeSectorInput(sector = {}) {
  const rawEntities = sector.npcs || sector.entities || sector.requests || [];
  if (!Array.isArray(rawEntities) || rawEntities.length === 0) {
    return sector;
  }

  const normalizedNpcs = rawEntities.map((ent, idx) => {
    const identityKey = ent.identityKey || ent.identity || ent.stableId || ent.name || `entity_${idx}`;
    const profile = ent.profile || ent.flags?.["ai-director"]?.profile || ent.flags?.aiDirector?.profile || null;

    return {
      ...ent,
      stableId: ent.stableId || identityKey,
      identityKey,
      identity: identityKey,
      targetCR: ent.targetCR ?? ent.cr ?? ent.level ?? 1,
      name: ent.name || "Unnamed Entity",
      role: ent.role || "NPC",
      count: ent.count ?? 1,
      requiresToken: ent.requiresToken !== false,
      visibility: ent.visibility || "VISIBLE",
      disposition: ent.disposition || "HOSTILE",
      flags: {
        ...(ent.flags || {}),
        "ai-director": {
          ...(ent.flags?.["ai-director"] || {}),
          identityKey,
          profile
        }
      }
    };
  });

  return {
    ...sector,
    npcs: normalizedNpcs
  };
}

function normalizeEntityPlanAsRequest(
  plan = {}
) {
  const identityKey =
    plan.archetype ||
    plan.name ||
    plan.identityKey ||
    plan.stableId ||
    "unknown";
  return {
    stableId:
      plan.stableId ||
      identityKey,
    identityKey,
    identity: identityKey,
    name:
      plan.archetype ||
      plan.name ||
      identityKey,
    role:
      plan.category ||
      "NPC",
    archetype:
      plan.archetype ||
      plan.name,
    targetCR:
      plan.targetCR || 1,
    count:
      plan.count || 1,
    disposition:
      plan.disposition ||
      "HOSTILE",
    visibility:
      plan.visibility ||
      "VISIBLE",
    generationNeeds:
      Array.isArray(plan.generationNeeds)
        ? [...plan.generationNeeds]
        : [],
    requiresActor:
      true,
    requiresToken:
      true,
    sectorId:
      plan.sectorId || null,
    sourceField:
      "entity-plan",
    currentActivity:
      null,
    spatialAnchor:
      null,
    profile:
      null,
    flags: {
      "ai-director": {}
    }
  };
}

function relationshipOffset(bounds, relationship = "IN_FRONT", index = 0, gridSize = 100) {
  const rel = normalizeUpper(relationship, "IN_FRONT");
  const lane = Math.floor(index / 2) + 1;
  const side = index % 2 === 0 ? -1 : 1;

  if (rel === "ON_TOP") {
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }
  if (rel === "BEHIND") {
    return { x: bounds.x + bounds.width / 2 + side * lane * gridSize * 0.35, y: Math.max(0, bounds.y - gridSize) };
  }
  if (rel === "SEATED_AT") {
    return { x: bounds.x + bounds.width / 2 + side * lane * gridSize * 0.35, y: bounds.y + bounds.height };
  }
  if (rel === "FLANKING") {
    return {
      x: side < 0 ? bounds.x - lane * gridSize : bounds.x + bounds.width + (lane - 1) * gridSize,
      y: bounds.y + bounds.height / 2
    };
  }
  return { x: bounds.x + bounds.width / 2 + side * lane * gridSize * 0.35, y: bounds.y + bounds.height + gridSize / 2 };
}

function findDetectedAnchor(spatialAnchor, detectedVisionObjects = []) {
  if (!spatialAnchor?.targetObject || !Array.isArray(detectedVisionObjects)) return null;
  const query = cleanText(spatialAnchor.targetObject).toLowerCase();
  if (!query) return null;
  return detectedVisionObjects.find(object => {
    const label = cleanText(object.label || object.name || object.type).toLowerCase();
    return label && (label.includes(query) || query.includes(label));
  }) || null;
}

function terrainPreviewLocation(request, sector = {}, index = 0, gridSize = 100) {
  const bounds = sectorBounds(sector);
  const name = cleanText(request.name).toLowerCase();
  const role = cleanText(request.role).toLowerCase();
  const terrainZones = Array.isArray(sector.terrainZones) ? sector.terrainZones : [];

  const wantsWater = ["water", "swimmer", "ambusher", "aquatic"].some(term => name.includes(term) || role.includes(term));
  if (wantsWater) {
    const water = terrainZones.find(zone => zone.type === "waterZone");
    if (water?.bounds) {
      return {
        x: bounds.x + water.bounds.x + water.bounds.width / 2 + index * gridSize * 0.25,
        y: bounds.y + water.bounds.y + water.bounds.height / 2,
        placementReason: "terrain-water-zone"
      };
    }
  }

  return null;
}

export function planTokenPreviewLocation(request, sector = {}, tokenIndex = 0, options = {}) {
  const gridSize = Math.max(1, Number(options.gridSize || globalThis.canvas?.grid?.size || 100));
  const detectedVisionObjects = options.detectedVisionObjects || [];
  const bounds = sectorBounds(sector);

  const detected = findDetectedAnchor(request.spatialAnchor, detectedVisionObjects);
  if (detected?.bounds) {
    const point = relationshipOffset(detected.bounds, request.spatialAnchor?.relationship, tokenIndex, gridSize);
    return {
      x: Math.round(point.x),
      y: Math.round(point.y),
      placementReason: "spatial-anchor-detected-object",
      anchor: request.spatialAnchor,
      detectedObject: detected.label || detected.name || detected.type || null
    };
  }

  const terrain = terrainPreviewLocation(request, sector, tokenIndex, gridSize);
  if (terrain) {
    return { ...terrain, x: Math.round(terrain.x), y: Math.round(terrain.y), anchor: request.spatialAnchor || null };
  }

  const cols = Math.max(1, Math.floor((Number(bounds.width || gridSize * 3) - gridSize * 2) / gridSize));
  const startX = Number(bounds.x || 0) + gridSize;
  const startY = Number(bounds.y || 0) + gridSize;
  const col = tokenIndex % cols;
  const row = Math.floor(tokenIndex / cols);

  return {
    x: Math.round(startX + col * gridSize),
    y: Math.round(startY + row * gridSize),
    placementReason: "sector-grid-fallback",
    anchor: request.spatialAnchor || null
  };
}

export function tokenVisibilityForRequest(request = {}, options = {}) {
  const visibility = normalizeUpper(request.visibility, "VISIBLE");
  if (options.forceVisible === true) return { hidden: false, visibility, reason: "force-visible" };
  if (visibility === "HIDDEN") return { hidden: true, visibility, reason: "hidden-entity" };
  if (visibility === "GM_ONLY") return { hidden: true, visibility, reason: "gm-only-entity" };
  if (visibility === "CONDITIONAL") return { hidden: true, visibility, reason: "conditional-default-hidden" };
  return { hidden: false, visibility, reason: "visible-entity" };
}

export function tokenDispositionForRequest(request = {}) {
  const disposition = normalizeUpper(request.disposition, "UNKNOWN");
  if (disposition.includes("HOSTILE") || disposition.includes("ENEMY") || disposition.includes("THREAT")) return "HOSTILE";
  if (disposition.includes("FRIENDLY") || disposition.includes("ALLY")) return "FRIENDLY";
  return "NEUTRAL";
}

function actorReferenceFromPlan(plan = {}) {
  if (plan.matches?.world?.actor) {
    return {
      source: "WORLD",
      actorId: plan.matches.world.actor.id || null,
      actorName: plan.matches.world.actor.name || null,
      reason: plan.matches.world.reason || null
    };
  }
  if (plan.matches?.compendium) {
    return {
      source: "COMPENDIUM",
      uuid: plan.matches.compendium.uuid || null,
      actorName: plan.matches.compendium.entry?.name || null,
      pack: plan.matches.compendium.pack?.collection || null,
      reason: plan.matches.compendium.reason || null
    };
  }
  if (plan.fallback) {
    return {
      source: "FALLBACK",
      action: plan.fallback.action,
      systemId: plan.fallback.systemId,
      reason: plan.fallback.reason
    };
  }
  return { source: "UNRESOLVED" };
}

export async function planSectorSpawn(sector = {}, options = {}) {
  const dryRun = options.dryRun !== false;
  const normalizedSector = normalizeSectorInput(sector);

  let requests = collectSectorSpawnRequests(normalizedSector, {
    spawnOnly: true,
    includeLegacy: options.includeLegacy,
    includeLegacyWithCanonical: options.includeLegacyWithCanonical,
    includeHidden: options.includeHidden,
    includeGmOnly: options.includeGmOnly
  });

  // Fallback to direct normalized collection if downstream collector yields zero results
  if (requests.length === 0 && Array.isArray(normalizedSector.npcs)) {
    requests = normalizedSector.npcs;
  }

  // EN-15: Convert structured sector threats into EntityPlan[] before actor resolution.
  const entityPlans = buildEntityPlans([normalizedSector]);
  const plannedRequests =
    entityPlans.map(
      normalizeEntityPlanAsRequest
    );
  requests = [...requests, ...plannedRequests];

  const actorResolution = await planSectorActorResolution(requests, {
    systemId: options.systemId || globalThis.game?.system?.id || "unknown",
    searchCompendiums: options.searchCompendiums,
    policies: options.policies || {}
  });

  const applicationResults = [];
  const plansByStableId = new Map();
  for (let index = 0; index < actorResolution.plans.length; index++) {
    const plan = actorResolution.plans[index];
    const request = requests[index];
    const key = request.stableId || request.identityKey || request.identity;
    plansByStableId.set(key, plan);
    
    applicationResults.push(await applyActorResolutionPlan(plan, {
      entity: request,
      dryRun
    }));
  }

  const tokenPreviews = [];
  for (const request of requests.filter(item => item.requiresToken !== false)) {
    const key = request.stableId || request.identityKey || request.identity;
    const plan = plansByStableId.get(key) || null;
    const visibility = tokenVisibilityForRequest(request, options);
    const disposition = tokenDispositionForRequest(request);
    const count = Number(request.count || 1);

    for (let tokenIndex = 0; tokenIndex < count; tokenIndex++) {
      const position = planTokenPreviewLocation(request, normalizedSector, tokenIndex, options);
      tokenPreviews.push({
        tokenInstanceId: `${key}:${padIndex(tokenIndex)}`,
        stableId: key,
        identityStableId: plan?.classification?.identityStableId || null,
        actorVariantId: plan?.classification?.actorVariantId || null,
        sectorId: request.sectorId || normalizedSector.sectorId || null,
        sourceField: request.sourceField || "npcs",
        name: request.name,
        role: request.role,
        countIndex: tokenIndex,
        actorDecision: plan?.decision || "UNPLANNED",
        actorReference: actorReferenceFromPlan(plan || {}),
        x: position.x,
        y: position.y,
        placementReason: position.placementReason,
        hidden: visibility.hidden,
        visibility: visibility.visibility,
        visibilityReason: visibility.reason,
        disposition,
        currentActivity: request.currentActivity || null,
        flagsPreview: {
          "ai-director": {
            tokenSpawn: {
              stableId: key,
              identityStableId: plan?.classification?.identityStableId || null,
              actorVariantId: plan?.classification?.actorVariantId || null,
              sectorId: request.sectorId || normalizedSector.sectorId || null,
              sourceField: request.sourceField || "npcs",
              visibility: request.visibility,
              disposition: request.disposition,
              currentActivity: request.currentActivity || null,
              profile: request.flags?.["ai-director"]?.profile || request.profile || null
            }
          }
        }
      });
    }
  }

  return {
    dryRun,
    destructive: false,
    sectorId: normalizedSector.sectorId || null,
    sectorName: normalizedSector.displayName || normalizedSector.name || null,
    requestCount: requests.length,
    tokenPreviewCount: tokenPreviews.length,
    requests,
    actorResolution,
    actorApplications: {
      dryRun,
      total: applicationResults.length,
      results: applicationResults
    },
    tokenPreviews
  };
}

export const SectorSpawnPlanner = Object.freeze({
  planSectorSpawn,
  planTokenPreviewLocation,
  tokenVisibilityForRequest,
  tokenDispositionForRequest
});

if (typeof window !== "undefined") {
  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .SectorSpawnPlanner =
      SectorSpawnPlanner;
}