// modules/ai-director/scripts/cartographer/layout-profile-resolver.js
import { LayoutProfileLibrary } 
from "/modules/ai-director/scripts/cartographer/layout-profile-library.js";

export class LayoutProfileResolver {
  static DEFAULT_PROFILE = LayoutProfileLibrary.DEFAULT_PROFILE;
  static SOURCE = Object.freeze({
    EXPLICIT: "EXPLICIT",
    MANIFEST: "MANIFEST",
    CONTEXT: "CONTEXT",
    FAMILY: "FAMILY",
    FALLBACK: "FALLBACK",
    CUSTOM: "CUSTOM"
  });
  static PROFILE_ALIASES = Object.freeze({
    HOME: "HOUSE",
    RESIDENCE: "HOUSE",
    MANSION: "MANOR",
    PUB: "BAR",
    NIGHTCLUB: "CLUB",
    NIGHT_CLUB: "CLUB",
    SPEAKEASY: "BAR",
    LAIR: "HIDEOUT",
    BASE: "SECRET_BASE",
    BUNKER: "SECRET_BASE",
    KEEP: "CASTLE",
    CITADEL: "FORTRESS",
    GARRISON: "FORT",
    WATCHPOST: "OUTPOST",
    WATCH_POST: "OUTPOST",
    LAB: "FACILITY",
    LABORATORY: "FACILITY",
    WAREHOUSE: "FACILITY",
    SHIP: "SPACESHIP",
    STARSHIP: "SPACESHIP",
    STATION: "SPACE_STATION",
    MINE_SHAFT: "MINE",
    CAVERN: "CAVE"
  });
  static FAMILY_DEFAULTS = Object.freeze({
    NATURAL: "MINE",
    RESIDENTIAL: "HOUSE",
    COMMERCIAL: "BAR",
    COVERT: "HIDEOUT",
    FORTIFIED: "FORT",
    TECHNICAL: "FACILITY"
  });
  static resolve(manifest = {}, options = {}) {
    const explicitProfile =
      options.layoutProfile ||
      options.profileId ||
      options.profile ||
      options.structureType ||
      manifest.structureType ||
      null;
    const manifestProfile =
      manifest.layoutProfile ||
      manifest.profileId ||
      manifest.architecture?.layoutProfile ||
      manifest.architecture?.profileId ||
      manifest.metadata?.layoutProfile ||
      null;
    const rawRequestedDesign = this._resolveRequestedDesign(manifest, options, explicitProfile, manifestProfile);
    const requestedDesign = rawRequestedDesign ? this._normalizeProfile(rawRequestedDesign) : null;
    // Resolve directly from a recognized profile name or alias.
    // Prevents valid requests like HOUSE from falling to DEFAULT_PROFILE.
    if (
      requestedDesign &&
      LayoutProfileLibrary.has(requestedDesign)
    ) {
      return this._finalize(
        {
          profile: LayoutProfileLibrary.get(requestedDesign),
          source: this.SOURCE.CONTEXT,
          matchedValue: rawRequestedDesign,
          matchedTerm: requestedDesign
        },
        manifest,
        options,
        requestedDesign
      );
    }
    const explicitResult = this._resolveKnownProfile(explicitProfile, this.SOURCE.EXPLICIT);
    if (explicitResult) return this._finalize(explicitResult, manifest, options, requestedDesign);
    const manifestResult = this._resolveKnownProfile(manifestProfile, this.SOURCE.MANIFEST);
    if (manifestResult) return this._finalize(manifestResult, manifest, options, requestedDesign);
    if (rawRequestedDesign && !this._isKnownProfile(rawRequestedDesign)) {
      const familyResult = this._resolveFromFamily(
        options.layoutFamily || manifest.layoutFamily ||
        manifest.architecture?.layoutFamily || manifest.metadata?.layoutFamily
      );
      if (familyResult) {
        return this._finalize(
          { ...familyResult, source: this.SOURCE.CUSTOM, matchedValue: rawRequestedDesign },
          manifest,
          options,
          rawRequestedDesign
        );
      }
    }
    const familyResult = this._resolveFromFamily(
      options.layoutFamily || manifest.layoutFamily ||
      manifest.architecture?.layoutFamily || manifest.metadata?.layoutFamily
    );
    if (familyResult) return this._finalize(familyResult, manifest, options, requestedDesign);
    const fallback = options.fallbackProfile || manifest.fallbackLayoutProfile || this.DEFAULT_PROFILE;
    return this._finalize({
      profile: LayoutProfileLibrary.resolve(fallback, this.DEFAULT_PROFILE),
      source: this.SOURCE.FALLBACK,
      matchedValue: fallback,
      matchedTerm: null
    }, manifest, options, requestedDesign);
  }
  static resolveProfileId(manifest = {}, options = {}) {
    return this.resolve(manifest, options).profileId;
  }
  static explain(manifest = {}, options = {}) {
    const result = this.resolve(manifest, options);
    return {
      profileId: result.profileId,
      family: result.layoutFamily,
      source: result.source,
      matchedValue: result.matchedValue,
      matchedTerm: result.matchedTerm,
      customFootprintType: result.customFootprintType,
      dynamicFootprint: result.dynamicFootprint,
      description: result.description
    };
  }
  static validateResult(result) {
    const problems = [];
    if (!result || typeof result !== "object") {
      return { valid: false, problems: ["Missing layout-profile resolution result."] };
    }
    if (!LayoutProfileLibrary.has(result.profileId)) {
      problems.push(`Unknown layout profile: ${result.profileId}`);
    }
    if (!Object.values(LayoutProfileLibrary.FAMILIES).includes(result.layoutFamily)) {
      problems.push(`Unknown layout family: ${result.layoutFamily}`);
    }
    if (!Number.isFinite(result.roomGap) || result.roomGap < 0) {
      problems.push("Room gap must be a non-negative number.");
    }
    if (!Array.isArray(result.secondaryNetworks)) {
      problems.push("Secondary networks must be an array.");
    }
    return { valid: problems.length === 0, problems };
  }
  static toMetadata(result) {
    if (!result) return null;
    return {
      profileId: result.profileId,
      layoutFamily: result.layoutFamily,
      source: result.source,
      matchedValue: result.matchedValue,
      matchedTerm: result.matchedTerm,
      customFootprintType: result.customFootprintType || null,
      dynamicFootprint: result.dynamicFootprint === true,
      roomGap: result.roomGap,
      packingDensity: result.packingDensity,
      sharedWallPreference: result.sharedWallPreference,
      corridorPattern: result.corridorPattern,
      footprintShape: result.footprintShape,
      symmetry: result.symmetry,
      entranceCount: result.entranceCount,
      emergencyExitCount: result.emergencyExitCount,
      floorRange: [...(result.floorRange || [1, 1])],
      stairWidth: result.stairWidth,
      stairHeight: result.stairHeight,
      hallwayWeight: result.hallwayWeight,
      directDoorLimit: result.directDoorLimit,
      courtyardAllowed: result.courtyardAllowed,
      defensivePerimeter: result.defensivePerimeter,
      chokePointPreference: result.chokePointPreference,
      secondaryNetworks: [...result.secondaryNetworks]
    };
  }
  static _resolveRequestedDesign(
    manifest,
    options,
    explicitProfile,
    manifestProfile
  ) {
    const value =
      options.structureType ||
      explicitProfile ||
      options.customFootprintType ||
      options.designType ||
      options.buildingType ||
      manifest.structureType ||
      manifest.customFootprintType ||
      manifest.designType ||
      manifest.buildingType ||
      manifest.title ||
      manifest.premise ||
      manifest.summary ||
      manifest.context ||
      manifest.dungeonTitle ||
      manifest.architecture?.structureType ||
      manifest.architecture?.customFootprintType ||
      manifest.architecture?.designType ||
      manifest.architecture?.buildingType ||
      manifestProfile ||
      null;
    return value
      ? LayoutProfileLibrary.normalizeProfileId(value)
      : null;
  }
  static _isKnownProfile(value) {
    if (!value) return false;
    const normalized = this._normalizeProfile(value);
    return LayoutProfileLibrary.has(normalized);
  }
  static _resolveKnownProfile(value, source) {
    if (!value) return null;
    const normalized = this._normalizeProfile(value);
    const profile = LayoutProfileLibrary.get(normalized);
    if (!profile) return null;
    return { profile, source, matchedValue: value, matchedTerm: null };
  }
  static _resolveFromFamily(value) {
    if (!value) return null;
    const family = LayoutProfileLibrary.normalizeFamily(value);
    const profileId = this.FAMILY_DEFAULTS[family];
    const profile = profileId ? LayoutProfileLibrary.get(profileId) : null;
    if (!profile) return null;
    return { profile, source: this.SOURCE.FAMILY, matchedValue: value, matchedTerm: family };
  }
  static _normalizeProfile(value) {
    const normalized = LayoutProfileLibrary.normalizeProfileId(value);
    return this.PROFILE_ALIASES[normalized] || normalized;
  }
  static _finalize(resolution, manifest, options, requestedDesign = null) {
    const profile = resolution.profile;
    const manifestOverrides = manifest.architecture && typeof manifest.architecture === "object"
      ? manifest.architecture
      : {};
    const optionOverrides = options.architecture && typeof options.architecture === "object"
      ? options.architecture
      : {};
    const layoutConfig = LayoutProfileLibrary.toLayoutConfig(profile.id, {
      ...this._compactArchitecture(manifestOverrides),
      ...this._compactArchitecture(optionOverrides)
    });
    const isCustom = requestedDesign && !this._isKnownProfile(requestedDesign);
    const customFootprintType = isCustom
      ? requestedDesign
      : options.customFootprintType || manifest.customFootprintType || null;
    return Object.freeze({
      ...layoutConfig,
      source: resolution.source,
      matchedValue: resolution.matchedValue || null,
      matchedTerm: resolution.matchedTerm || null,
      customFootprintType,
      dynamicFootprint: Boolean(customFootprintType && isCustom),
      description: profile.description,
      requiredPurposes: [...profile.requiredPurposes],
      preferredPurposes: [...profile.preferredPurposes]
    });
  }
  static _compactArchitecture(value = {}) {
    const allowed = new Set([
      "roomGap", "packingDensity", "sharedWallPreference",
      "corridorPattern", "footprintShape", "symmetry",
      "entranceCount", "emergencyExitCount", "floorRange",
      "stairWidth", "stairHeight", "hallwayWeight", "directDoorLimit",
      "courtyardAllowed", "defensivePerimeter",
      "chokePointPreference", "secondaryNetworks"
    ]);
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key, item]) => allowed.has(key) && item !== undefined)
        .map(([key, item]) => [key, Array.isArray(item) ? structuredClone(item) : item])
    );
  }
}