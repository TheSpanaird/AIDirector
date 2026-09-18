// modules/ai-director/scripts/engines/actor-identity-resolver.js
// PASS 7J: Actor Identity & Resolution Planner

/**
 * Single request identity resolution handler.
 * @param {Object} request - Individual entity spawn request
 * @returns {Promise<Object>} Resolution result object
 */
export async function resolveActorRequest(request = {}) {
  const activeSystem = globalThis.game?.system?.id || "unknown";
  const { identityKey, targetCR, systemType = activeSystem } = request;

  const baseActor = await ActorIdentityResolver.findIdentityMatch(identityKey);

  // Case A: No existing match -> Generate fallback
  if (!baseActor) {
    return {
      action: "GENERATE_FALLBACK",
      decision: "GENERATE_FALLBACK",
      baseActor: null,
      identityKey: identityKey || "unknown",
      targetCR: ActorIdentityResolver.normalizeCR(targetCR),
      profile: ActorIdentityResolver.getDefaultProfile()
    };
  }

  const profile = ActorIdentityResolver.extractProfile(baseActor);
  const baseCR = ActorIdentityResolver.getActorCR(baseActor, systemType);
  const normalizedTargetCR = ActorIdentityResolver.normalizeCR(targetCR);

  const isDivergent = ActorIdentityResolver.evaluateCRDivergence(baseCR, normalizedTargetCR);

  // Case B: CR/Level divergence detected -> Create Variant
  if (isDivergent) {
    const resolvedIdentityKey = baseActor.getFlag?.("ai-director", "identityKey") || baseActor.name;
    return {
      action: "CREATE_VARIANT",
      decision: "CREATE_VARIANT_FROM_WORLD_ACTOR",
      baseActor,
      identityKey: resolvedIdentityKey,
      baseCR,
      targetCR: normalizedTargetCR,
      profile
    };
  }

  // Case C: Exact match -> Re-use existing
  const resolvedIdentityKey = baseActor.getFlag?.("ai-director", "identityKey") || baseActor.name;
  return {
    action: "USE_EXISTING",
    decision: "USE_WORLD_ACTOR",
    baseActor,
    identityKey: resolvedIdentityKey,
    targetCR: baseCR,
    profile
  };
}

/**
 * Multi-request sector identity batch planner required by sector-spawn-planner.js.
 * @param {Array<Object>} requests - List of collected spawn requests
 * @param {Object} options - Resolution options
 * @returns {Promise<Object>} Batch resolution plan payload
 */
export async function planSectorActorResolution(requests = [], options = {}) {
  const plans = [];

  for (const request of requests) {
    const resolution = await resolveActorRequest(request);
    
    plans.push({
      identityKey: resolution.identityKey,
      action: resolution.action,
      decision: resolution.decision,
      targetCR: resolution.targetCR,
      profile: resolution.profile,
      matches: {
        world: resolution.baseActor ? { actor: resolution.baseActor, reason: "matched-identity-key" } : null,
        compendium: null
      },
      classification: {
        identityStableId: resolution.identityKey,
        actorVariantId: resolution.baseActor ? `${resolution.baseActor.id}_cr${resolution.targetCR}` : null
      },
      baseActor: resolution.baseActor,
      fallback: resolution.action === "GENERATE_FALLBACK" ? {
        action: "GENERATE_FALLBACK",
        systemId: options.systemId || globalThis.game?.system?.id || "unknown",
        reason: "No actor matching identity key found"
      } : null
    });
  }

  return {
    systemId: options.systemId || globalThis.game?.system?.id || "unknown",
    totalRequests: requests.length,
    plans
  };
}

/**
 * ActorIdentityResolver Class
 * Preserves all original static methods and helper routines.
 */
export class ActorIdentityResolver {

  static async resolveActorRequest(request) {
    return resolveActorRequest(request);
  }

  static async findIdentityMatch(identityKey) {
    if (!identityKey) return null;

    const gameRef = globalThis.game;
    if (!gameRef) return null;

    // 1. Search World Actors by flag, then by name
    const worldActors = gameRef.actors?.contents || Array.from(gameRef.actors || []);
    const worldActor = worldActors.find(a => 
      a.getFlag?.("ai-director", "identityKey") === identityKey || a.name === identityKey
    );
    if (worldActor) return worldActor;

    // 2. Search Actor Compendiums if not in world
    const packs = gameRef.packs ? Array.from(gameRef.packs.values()) : [];
    for (const pack of packs.filter(p => p.documentName === "Actor")) {
      try {
        const index = await pack.getIndex({ fields: ["flags.ai-director.identityKey", "name"] });
        const entry = Array.from(index).find(e => 
          e.flags?.["ai-director"]?.identityKey === identityKey || e.name === identityKey
        );
        if (entry) {
          return await pack.getDocument(entry._id);
        }
      } catch (error) {
        console.warn(`[AI Director] Failed inspecting pack ${pack.collection}:`, error);
      }
    }

    return null;
  }

  static evaluateCRDivergence(baseCR, targetCR) {
    if (targetCR === null || targetCR === undefined) return false;
    return Math.abs(baseCR - targetCR) > 0.001;
  }

  static getActorCR(actor, systemType) {
    if (!actor?.system) return 0;

    if (systemType === "dnd5e") {
      const crVal = actor.system.details?.cr;
      return this.normalizeCR(crVal);
    }
    if (systemType === "cpr" || systemType === "cyberpunk-red-core") {
      return actor.system.derivedStats?.threatLevel || 1;
    }
    return actor.system.cr || actor.system.level || 0;
  }

  static normalizeCR(cr) {
    if (typeof cr === "number") return cr;
    if (!cr) return 0;
    
    if (typeof cr === "string") {
      if (cr.includes("/")) {
        const [num, den] = cr.split("/").map(Number);
        return num && den ? num / den : 0;
      }
      return parseFloat(cr) || 0;
    }
    return 0;
  }

  static extractProfile(actor) {
    const profile = actor?.getFlag?.("ai-director", "profile");
    if (profile && typeof profile === "object") {
      return globalThis.foundry?.utils?.deepClone 
        ? globalThis.foundry.utils.deepClone(profile) 
        : JSON.parse(JSON.stringify(profile));
    }
    return this.getDefaultProfile();
  }

  static getDefaultProfile() {
    return {
      traits: [],
      ocean: {
        openness: 0.5,
        conscientiousness: 0.5,
        extraversion: 0.5,
        agreeableness: 0.5,
        neuroticism: 0.5
      },
      behaviorFlags: []
    };
  }
}