// modules/ai-director/scripts/engines/npc-generator.js
// PASS 7F: Controlled real actor/token creation gate.
// PASS 7J: Mechanical variant creation & CR/level identity divergence workflows.
// PASS 7K-D: D&D5e Statblock Importer Integration Helpers.
// Default sector spawning remains dry-run. Real creation requires explicit allow* flags.

import { planSectorSpawn } from "/modules/ai-director/scripts/engines/sector-spawn-planner.js";
import { applyActorResolutionPlan } from "/modules/ai-director/scripts/engines/actor-resolution-applier.js";

const MODULE_ID = "ai-director";

/**
 * Normalizes OCEAN (1-5) and Tactical Behavioral Traits (1-9)
 * Maps 0-100 percentage inputs safely into UI slider-compatible bounds.
 */
export function normalizeProfile(profile = {}) {
  const rawOcean = profile.ocean || {};
  const rawTraits = profile.traits || {};

  const scaleTo5 = (val, fallback = 3) => {
    if (val === undefined || val === null) return fallback;
    if (val <= 5) return Math.max(1, Math.min(5, Math.round(val)));
    return Math.max(1, Math.min(5, Math.round((val / 100) * 4 + 1)));
  };

  const scaleTo9 = (val, fallback = 5) => {
    if (val === undefined || val === null) return fallback;
    if (val <= 9) return Math.max(1, Math.min(9, Math.round(val)));
    return Math.max(1, Math.min(9, Math.round((val / 100) * 8 + 1)));
  };

  return {
    ocean: {
      openness: scaleTo5(rawOcean.openness, 3),
      conscientiousness: scaleTo5(rawOcean.conscientiousness, 3),
      extraversion: scaleTo5(rawOcean.extraversion, 3),
      agreeableness: scaleTo5(rawOcean.agreeableness, 3),
      neuroticism: scaleTo5(rawOcean.neuroticism, 3)
    },
    traits: {
      dominance: scaleTo9(rawTraits.dominance, 5),
      restraint: scaleTo9(rawTraits.restraint, 5),
      secrecy: scaleTo9(rawTraits.secrecy, 5),
      volatility: scaleTo9(rawTraits.volatility, 5),
      opportunism: scaleTo9(rawTraits.opportunism, 5)
    },
    behaviorFlags: Array.isArray(profile.behaviorFlags) ? [...profile.behaviorFlags] : []
  };
}

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function getActiveSystemId() {
  return cleanText(globalThis.game?.system?.id || "unknown").toLowerCase() || "unknown";
}

function actorTypeForSystem(systemId = getActiveSystemId()) {
  if (systemId === "cyberpunk-red-core") return "mook";
  return "npc";
}

function getOrFindNpcFolder() {
  return globalThis.game?.folders?.contents?.find(folder =>
    folder.name === "AI Generated NPCs" && folder.type === "Actor"
  ) || null;
}

export async function getOrCreateSceneNpcFolder(sceneName) {
  const cleanSceneName = cleanText(sceneName || "Unknown Scene");

  let rootFolder = globalThis.game?.folders?.contents?.find(
    folder => folder.type === "Actor" && folder.name === "AI Generated NPCs"
  );

  if (!rootFolder) {
    rootFolder = await Folder.create({
      name: "AI Generated NPCs",
      type: "Actor"
    });
  }

  let sceneFolder = globalThis.game?.folders?.contents?.find(
    folder =>
      folder.type === "Actor" &&
      folder.name === cleanSceneName &&
      folder.folder?.id === rootFolder.id
  );

  if (!sceneFolder) {
    sceneFolder = await Folder.create({
      name: cleanSceneName,
      type: "Actor",
      folder: rootFolder.id
    });
    ui.actors?.render?.(true);
  }

  return sceneFolder;
}

export async function importDnd5eStatblockActor(
  statblockText,
  sceneName,
  metadata = {}
) {
  if (getActiveSystemId() !== "dnd5e") return null;

  const importer = globalThis.game?.modules?.get("5e-statblock-importer")?.api;
  if (!importer) {
    throw new Error("5e Statblock Importer is not active.");
  }

  const folder = await getOrCreateSceneNpcFolder(sceneName);
  const result = await importer.import(statblockText, folder.id);

  ui.actors?.render?.(true);
  const actor = result?.actor5e || null;
  if (!actor) return null;

  await actor.update({
    flags: {
      [MODULE_ID]: {
        generationMethod: "STATBLOCK_IMPORTER",
        sourceScene: sceneName,
        sourceSector: metadata.sectorId || null,
        stableId: metadata.stableId || null,
        generatedAt: Date.now()
      }
    }
  });

  return actor;
}

function normalizeActorName(value) {
  return cleanText(value).toLowerCase();
}

function dispositionConstant(disposition) {
  const normalized = String(disposition || "NEUTRAL").toUpperCase();
  const values = globalThis.CONST?.TOKEN_DISPOSITIONS || {};
  if (normalized === "HOSTILE") return values.HOSTILE ?? -1;
  if (normalized === "FRIENDLY") return values.FRIENDLY ?? 1;
  return values.NEUTRAL ?? 0;
}

function tokenDataFromPreview(actor, tokenPreview, options = {}) {
  const gridSize = Math.max(1, Number(options.gridSize || globalThis.canvas?.grid?.size || 100));
  const prototype = actor?.prototypeToken?.toObject ? actor.prototypeToken.toObject() : {};
  return {
    ...prototype,
    name: tokenPreview.name || actor?.name || "AI Director Token",
    actorId: actor?.id,
    x: tokenPreview.x,
    y: tokenPreview.y,
    width: Number(prototype.width || 1),
    height: Number(prototype.height || 1),
    hidden: tokenPreview.hidden === true,
    disposition: dispositionConstant(tokenPreview.disposition),
    flags: {
      ...(prototype.flags || {}),
      ...(tokenPreview.flagsPreview || {}),
      [MODULE_ID]: {
        ...(prototype.flags?.[MODULE_ID] || {}),
        ...(tokenPreview.flagsPreview?.[MODULE_ID] || {}),
        tokenSpawn: {
          ...(tokenPreview.flagsPreview?.[MODULE_ID]?.tokenSpawn || {}),
          createdAt: Date.now(),
          gridSize
        }
      }
    }
  };
}

function gateStatus(options = {}) {
  const dryRun = options.dryRun !== false;
  return {
    dryRun,
    allowActorCreation: options.allowActorCreation === true,
    allowTokenCreation: options.allowTokenCreation === true,
    allowCompendiumImport: options.allowCompendiumImport === true,
    allowVariantCreation: options.allowVariantCreation === true,
    allowExistingActorUpdate: options.allowExistingActorUpdate === true,
    allRealCreationGatesOpen:
      dryRun === false &&
      options.allowActorCreation === true &&
      options.allowTokenCreation === true
  };
}

/**
 * PASS 7J: Derives a new Actor document payload by scaling mechanics 
 * while normalizing profile values to 1-5 (OCEAN) and 1-9 (Traits).
 */
export async function deriveMechanicalVariant(baseActor, targetCR, options = {}) {
  if (!baseActor) throw new Error("[AI Director] Cannot derive variant from null baseActor.");

  const systemId = getActiveSystemId();
  const rawProfile = options.profile || baseActor.getFlag(MODULE_ID, "profile") || {};
  const normalizedProfile = normalizeProfile(rawProfile);
  const identityKey = baseActor.getFlag(MODULE_ID, "identityKey") || baseActor.name;

  const targetFolder = options.folder || getOrFindNpcFolder();
  const actorData = foundry.utils.duplicate(baseActor.toObject());

  delete actorData._id;
  actorData.name = `${baseActor.name} (Variant CR ${targetCR})`;
  actorData.folder = targetFolder ? targetFolder.id : null;

  // Mechanical Scaling according to System
  if (systemId === "dnd5e") {
    const crNum = Number(targetCR) || 1;
    actorData.system.details = actorData.system.details || {};
    actorData.system.details.cr = crNum;

    const hpMultiplier = Math.max(0.5, crNum);
    if (actorData.system.attributes?.hp?.max) {
      const newHp = Math.round(actorData.system.attributes.hp.max * hpMultiplier);
      actorData.system.attributes.hp.max = newHp;
      actorData.system.attributes.hp.value = newHp;
    }
  } else if (systemId === "cyberpunk-red-core") {
    actorData.system.derivedStats = actorData.system.derivedStats || {};
    actorData.system.derivedStats.threatLevel = Number(targetCR) || 1;
  }

  // Assign normalized profile flags cleanly
  actorData.flags = actorData.flags || {};
  actorData.flags[MODULE_ID] = {
    ...(actorData.flags[MODULE_ID] || {}),
    identityKey: identityKey,
    derivedFromActorId: baseActor.id,
    derivedAtCR: targetCR,
    profile: normalizedProfile,
    generationMethod: "CR_VARIANT_DERIVATION",
    generatedAt: Date.now()
  };

  if (options.dryRun !== false) {
    return actorData;
  }

  const variantActor = await Actor.create(actorData);
  console.log(`[AI Director PASS 7J] Created mechanical variant "${variantActor.name}" (CR ${targetCR}) derived from "${baseActor.name}" (${baseActor.id}). Profile normalized & preserved.`);
  return variantActor;
}

async function applyRealActorPlans(preview, options = {}) {
  const actorsByStableId = new Map();
  const actorResults = [];
  const requests = preview.requests || [];
  const plans = preview.actorResolution?.plans || [];

  for (let index = 0; index < plans.length; index++) {
    const plan = plans[index];
    const request = requests[index];
    if (!request) continue;

    const decision = String(plan.decision || "");
    const isCompendiumImport = decision === "USE_COMPENDIUM_ACTOR";
    const isVariantCreation = decision === "CREATE_VARIANT_FROM_WORLD_ACTOR" || decision === "CREATE_VARIANT";
    const isExistingUpdate = decision === "UPDATE_EXISTING_ACTOR_BY_POLICY";
    const isWorldUse = decision === "USE_WORLD_ACTOR";

    if (isCompendiumImport && options.allowCompendiumImport !== true) {
      actorResults.push({ stableId: request.stableId, skipped: true, decision, reason: "allowCompendiumImport not enabled" });
      continue;
    }
    if (isVariantCreation && options.allowVariantCreation !== true) {
      actorResults.push({ stableId: request.stableId, skipped: true, decision, reason: "allowVariantCreation not enabled" });
      continue;
    }
    if (isExistingUpdate && options.allowExistingActorUpdate !== true) {
      actorResults.push({ stableId: request.stableId, skipped: true, decision, reason: "allowExistingActorUpdate not enabled" });
      continue;
    }
    if (decision.startsWith("FALLBACK_")) {
      actorResults.push({ stableId: request.stableId, skipped: true, decision, reason: "system-specific fallback creation is not enabled in Pass 7F" });
      continue;
    }

    if (isWorldUse) {
      const actor = plan.matches?.world?.actor || null;
      if (actor) actorsByStableId.set(request.stableId, actor);
      if (options.allowExistingActorUpdate !== true) {
        actorResults.push({
          stableId: request.stableId,
          decision,
          usedExistingActor: true,
          updated: false,
          actorId: actor?.id || null,
          actorName: actor?.name || null,
          reason: "Existing world actor reused without modifying actor flags because allowExistingActorUpdate is not enabled."
        });
        continue;
      }
    }

    // Pass 7J Handoff for Variant Derivation Execution
    if (isVariantCreation && plan.baseActor) {
      const variantActor = await deriveMechanicalVariant(plan.baseActor, request.targetCR || plan.targetCR, {
        dryRun: false,
        profile: request.profile || plan.profile,
        folder: await getOrCreateSceneNpcFolder(options.sceneName || "Spawned Variants")
      });
      actorsByStableId.set(request.stableId, variantActor);
      actorResults.push({ stableId: request.stableId, decision, createdVariant: true, actorId: variantActor.id });
      continue;
    }

    const result = await applyActorResolutionPlan(plan, { entity: request, dryRun: false });
    actorResults.push({ stableId: request.stableId, decision, result });

    const actor = result.actor || result.steps?.find(step => step.actor)?.actor || plan.matches?.world?.actor || null;
    if (actor) actorsByStableId.set(request.stableId, actor);
  }

  return { actorsByStableId, actorResults };
}

async function createTokensFromPreview(preview, actorsByStableId, options = {}) {
  const scene = options.scene || globalThis.canvas?.scene;
  if (!scene) return { created: [], skipped: [], reason: "missing-scene" };

  const tokenData = [];
  const skipped = [];
  for (const tokenPreview of preview.tokenPreviews || []) {
    const actor = actorsByStableId.get(tokenPreview.stableId) || null;
    if (!actor) {
      skipped.push({ tokenInstanceId: tokenPreview.tokenInstanceId, stableId: tokenPreview.stableId, reason: "missing-resolved-actor" });
      continue;
    }
    tokenData.push(tokenDataFromPreview(actor, tokenPreview, options));
  }

  if (!tokenData.length) return { created: [], skipped };
  const created = await scene.createEmbeddedDocuments("Token", tokenData);
  return { created, skipped };
}

export async function testDnd5eImporter(sceneName = "Test Scene") {
  const TEST_STATBLOCK = `
Ash Revenant
Medium Undead, Neutral Evil

Armor Class 15
Hit Points 85 (10d8 + 40)
Speed 30 ft.

STR DEX CON INT WIS CHA
18 (+4) 12 (+1) 18 (+4) 8 (-1) 10 (+0) 6 (-2)

Saving Throws Con +7
Damage Resistances necrotic

Challenge 5 (1,800 XP)

Actions

Multiattack.
The ash revenant makes two Slam attacks.

Slam.
Melee Weapon Attack: +7 to hit, reach 5 ft., one target.
Hit: 12 (2d6 + 5) bludgeoning damage.
`;

  return importDnd5eStatblockActor(TEST_STATBLOCK, sceneName, {
    stableId: "test-ash-revenant"
  });
}

export async function generateHeadlessNPC(autoContext = null) {
  if (!globalThis.game?.user?.isGM) return null;

  const systemId = getActiveSystemId();
  const npcName = cleanText(autoContext?.npcName || autoContext?.name || "Generated NPC");
  const npcRole = cleanText(autoContext?.npcRole || autoContext?.role || "Generic Encounter NPC");
  const species = cleanText(autoContext?.species || "Human");

  const existingActor = globalThis.game?.actors?.contents?.find(actor =>
    normalizeActorName(actor.name) === normalizeActorName(npcName)
  );
  if (existingActor) {
    console.log(`[AI Director] NPC "${npcName}" already exists. Reusing actor ${existingActor.id}.`);
    return existingActor;
  }

  const targetFolder = getOrFindNpcFolder();
  const templatePayload = {
    name: npcName,
    type: actorTypeForSystem(systemId),
    folder: targetFolder ? targetFolder.id : null,
    img: "icons/svg/mystery-man.svg",
    system: {},
    flags: {
      [MODULE_ID]: {
        legacyHeadlessGeneration: {
          npcRole,
          species,
          systemId,
          generatedAt: Date.now()
        }
      }
    }
  };

  try {
    const actorAsset = await Actor.create(templatePayload);
    console.log(`[AI Director] Actor created successfully. ID: ${actorAsset.id}`);

    if (systemId === "cyberpunk-red-core") {
      const cprModule = globalThis.game?.modules?.get?.("cpr-ollama-importer");
      if (cprModule?.api?.generateNPC) {
        console.log("[AI Director] CPR NPC generator/importer is available; legacy UI launch is left to explicit user action.");
      }
    }

    return actorAsset;
  } catch (error) {
    console.error("[AI Director] Actor creation failed:", error);
    return null;
  }
}

export async function findOrFetchActor(entityName) {
  const cleanName = normalizeActorName(entityName);
  if (!cleanName) return null;

  const worldMatch = globalThis.game?.actors?.contents?.find(actor =>
    normalizeActorName(actor.name) === cleanName
  );
  if (worldMatch) {
    console.log(`[AI Director Phase 7] Located existing world Actor: "${worldMatch.name}"`);
    return worldMatch;
  }

  for (const pack of globalThis.game?.packs || []) {
    if (pack.documentName !== "Actor") continue;
    try {
      const index = await pack.getIndex({ fields: ["name", "type"] });
      const match = [...index].find(entry => normalizeActorName(entry.name) === cleanName);
      if (match) {
        console.log(`[AI Director Phase 7] Located compendium Actor index match: "${match.name}" in ${pack.collection}`);
        return {
          compendium: true,
          pack,
          entry: match,
          uuid: `Compendium.${pack.collection}.${match._id}`,
          name: match.name
        };
      }
    } catch (error) {
      console.warn(`[AI Director Phase 7] Failed to inspect Actor pack ${pack.collection}:`, error);
    }
  }

  return null;
}

export function resolveNPCSpawnLocation(npcDef, sector, detectedVisionObjects = [], spawnIndex = 0, gridSize = 100) {
  const bounds = sector?.bounds || sector?.pixelBounds || { x: 0, y: 0, width: 1000, height: 1000 };
  const { x, y, width, height } = bounds;
  const actorName = cleanText(npcDef?.name || npcDef?.npcName || "").toLowerCase();

  const anchor = npcDef?.spatialAnchor;
  if (anchor?.targetObject && Array.isArray(detectedVisionObjects) && detectedVisionObjects.length > 0) {
    const targetQuery = cleanText(anchor.targetObject).toLowerCase();
    const matchedObject = detectedVisionObjects.find(object => {
      const label = cleanText(object.label || object.name || object.type).toLowerCase();
      return label && (label.includes(targetQuery) || targetQuery.includes(label));
    });
    if (matchedObject?.bounds) {
      return {
        posX: Math.round(matchedObject.bounds.x + matchedObject.bounds.width / 2),
        posY: Math.round(matchedObject.bounds.y + matchedObject.bounds.height / 2)
      };
    }
  }

  if (Array.isArray(sector?.terrainZones) && sector.terrainZones.length > 0) {
    const aquatic = ["water", "swimmer", "ambusher", "aquatic"].some(term => actorName.includes(term));
    if (aquatic) {
      const waterZone = sector.terrainZones.find(zone => zone.type === "waterZone");
      if (waterZone?.bounds) {
        return {
          posX: Math.round(x + waterZone.bounds.x + waterZone.bounds.width / 2 + spawnIndex * 20),
          posY: Math.round(y + waterZone.bounds.y + waterZone.bounds.height / 2)
        };
      }
    }
  }

  const cols = Math.max(1, Math.floor((width - gridSize * 2) / gridSize));
  const startX = x + gridSize;
  const startY = y + gridSize;
  const col = spawnIndex % cols;
  const row = Math.floor(spawnIndex / cols);
  return {
    posX: Math.round(startX + col * gridSize),
    posY: Math.round(startY + row * gridSize)
  };
}

export async function spawnSectorContents(sector, npcList = null, detectedVisionObjects = [], options = {}) {
  if (!globalThis.game?.user?.isGM || !globalThis.canvas?.scene) return null;
  if (!sector) {
    console.warn("[AI Director Phase 7E] Cannot spawn sector contents: missing sector.");
    return null;
  }

  const dryRun = options.dryRun !== false;
  const gridSize = Math.max(1, Number(options.gridSize || globalThis.canvas?.grid?.size || 100));
  const sectorForPlanning = structuredClone(sector);

  if (Array.isArray(npcList) && npcList.length > 0) {
    sectorForPlanning.npcs = [...(Array.isArray(sectorForPlanning.npcs) ? sectorForPlanning.npcs : []), ...npcList];
  }

  if (!sectorForPlanning.bounds && !sectorForPlanning.pixelBounds) {
    console.warn("[AI Director Phase 7E] Sector has no bounds; using planner fallback bounds for dry-run preview.", sectorForPlanning.sectorId || sectorForPlanning.name);
  }

  const preview = await planSectorSpawn(sectorForPlanning, {
    ...options,
    dryRun: true,
    gridSize,
    detectedVisionObjects,
    systemId: options.systemId || getActiveSystemId()
  });

  console.log("[AI Director Phase 7E] Structured sector spawn preview", preview);

  const gates = gateStatus(options);
  if (dryRun) {
    return { ...preview, gates };
  }

  if (!gates.allRealCreationGatesOpen) {
    ui.notifications?.warn?.("AI Director Pass 7F blocked real actor/token creation because explicit allow flags were not provided.");
    return {
      ...preview,
      dryRun: true,
      gates,
      blockedRealCreation: true,
      reason: "Real creation requires dryRun:false, allowActorCreation:true, and allowTokenCreation:true. Additional actions may require allowCompendiumImport, allowVariantCreation, or allowExistingActorUpdate."
    };
  }

  const { actorsByStableId, actorResults } = await applyRealActorPlans(preview, options);
  let tokenResults = { created: [], skipped: [], reason: "allowTokenCreation not enabled" };
  if (options.allowTokenCreation === true) {
    tokenResults = await createTokensFromPreview(preview, actorsByStableId, { ...options, gridSize });
  }

  const result = {
    ...preview,
    dryRun: false,
    gates,
    actorResults,
    tokenResults,
    createdActors: actorResults.filter(item => item.result?.created || item.result?.imported || item.createdVariant).length,
    updatedActors: actorResults.filter(item => item.result?.applied).length,
    createdTokens: tokenResults.created?.length || 0,
    skippedTokens: tokenResults.skipped || []
  };

  console.log("[AI Director Phase 7F] Structured sector spawn real-creation result", result);
  return result;
}

if (typeof window !== "undefined") {
  window.AIDirector = window.AIDirector || {};
  window.AIDirector.NPCGenerator = {
    generateHeadlessNPC,
    findOrFetchActor,
    resolveNPCSpawnLocation,
    spawnSectorContents,
    getOrCreateSceneNpcFolder,
    importDnd5eStatblockActor,
    deriveMechanicalVariant,
    normalizeProfile
  };
}