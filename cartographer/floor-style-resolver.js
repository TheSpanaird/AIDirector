// modules/ai-director/scripts/cartographer/floor-style-resolver.js
// AI Director Cartographer Phase 5
// Resolves genre-aware and layout-profile-aware floor presentation.

import { MODULE_ID }
  from "/modules/ai-director/scripts/settings.js";
import { CartographerFloorLibrary }
  from "/modules/ai-director/scripts/cartographer/cartographer-floor-library.js";

export class FloorStyleResolver {
  static GENRE_SETTING = "cartographerGenre";
  static PRESET_SETTING = "cartographerFloorPreset";
  static SCALE_SETTING = "cartographerTextureScale";
  static OUTLINE_SETTING = "cartographerRoomOutline";
  static OUTLINE_COLOR_SETTING = "cartographerOutlineColor";
  static OUTLINE_WIDTH_SETTING = "cartographerOutlineWidth";

  static STRICT_PROFILE_PRESETS = Object.freeze({
    MINE: "stone-cave-floor",
    CAVE: "stone-cave-floor"
  });

  static PROFILE_ENVIRONMENTS = Object.freeze({
    MINE: ["mine", "underground", "cave", "dungeon"],
    CAVE: ["cave", "underground", "dungeon"],
    HOUSE: ["residential", "interior", "house"],
    MANOR: ["manor", "residential", "interior", "lobby"],
    BAR: ["bar", "interior", "commercial"],
    CLUB: ["club", "interior", "commercial"],
    TAVERN: ["tavern", "interior", "commercial"],
    HIDEOUT: ["hideout", "underground", "interior"],
    SAFEHOUSE: ["safehouse", "residential", "interior"],
    SECRET_BASE: ["facility", "underground", "industrial"],
    CASTLE: ["castle", "dungeon", "temple"],
    FORT: ["fort", "dungeon", "industrial"],
    FORTRESS: ["fortress", "dungeon", "industrial"],
    OUTPOST: ["outpost", "industrial", "interior"],
    FACILITY: ["facility", "industrial", "lab"],
    SPACESHIP: ["ship", "facility", "station"],
    SPACE_STATION: ["station", "facility", "industrial"]
  });

  static PROFILE_FALLBACK_PRESETS = Object.freeze({
    MINE: "stone-cave-floor",
    CAVE: "stone-cave-floor",
    HOUSE: "old-wooden-plank",
    MANOR: "marble-tiles",
    BAR: "old-wooden-plank",
    CLUB: "white-tile",
    TAVERN: "old-wooden-plank",
    HIDEOUT: "stone-cave-floor",
    SAFEHOUSE: "old-wooden-plank",
    SECRET_BASE: "arc-pavement",
    CASTLE: "stylized-stone",
    FORT: "cobblestone",
    FORTRESS: "stylized-stone",
    OUTPOST: "cobblestone",
    FACILITY: "arc-pavement",
    SPACESHIP: "sci-fi-floor-002",
    SPACE_STATION: "sci-fi-floor-002"
  });

  static DEFAULTS = Object.freeze({
    genre: "auto",
    preset: "auto",
    mode: "TEXTURE",
    textureScale: 1,
    tileSize: null,
    roomTexture: null,
    corridorTexture: null,
    outlineEnabled: true,
    outlineColor: "#4a4a4a",
    outlineWidth: 3,
    fillColor: "#d1d1d1",
    fillAlpha: 0.35,
    minimumRecommendedScore: 2,
    assignmentMode: "AUTOMATIC"
  });

  static resolve(options = {}) {
    const scene = options.scene || globalThis.canvas?.scene || null;
    const merged = {
      ...this.DEFAULTS,
      ...this._readWorldStyle(),
      ...this._readSceneStyle(scene),
      ...this._compact(options)
    };
    const systemGenre = CartographerFloorLibrary.resolveSystemGenre(
      options.systemId || globalThis.game?.system?.id
    );
    const requestedGenre = String(merged.genre || "auto").toLowerCase();
    const genre = requestedGenre === "auto"
      ? systemGenre
      : CartographerFloorLibrary.normalizeGenre(requestedGenre);
    const requestedPreset = String(merged.preset || "auto").trim();
    const selectedTile = this._resolveTile({
      preset: requestedPreset,
      genre,
      environment: merged.environment,
      minimumScore: merged.minimumRecommendedScore
    });
    const requestedMode = ["plain", "none"].includes(
      requestedPreset.toLowerCase()
    )
      ? "PLAIN"
      : selectedTile
        ? "TEXTURE"
        : this._normalizeMode(merged.mode, selectedTile);
    const gridSize = this._positiveNumber(
      options.gridSize || scene?.grid?.size,
      100
    );
    const textureScale = this._positiveNumber(merged.textureScale, 1);
    const tileSize = this._positiveNumber(merged.tileSize, gridSize);
    const texturePath = requestedMode === "TEXTURE"
      ? selectedTile?.path || null
      : null;

    return Object.freeze({
      genre,
      genreSource: requestedGenre === "auto" ? "system" : "override",
      systemGenre,
      preset: selectedTile?.id || "plain",
      presetSource: requestedPreset === "auto" ? "automatic" : "override",
      mode: texturePath ? "TEXTURE" : "PLAIN",
      tile: selectedTile,
      texturePath,
      roomTexture: merged.roomTexture || texturePath,
      corridorTexture: merged.corridorTexture || texturePath,
      gridSize,
      tileSize,
      textureScale,
      texturePixelSize: tileSize * textureScale,
      outlineEnabled: this._boolean(merged.outlineEnabled, true),
      outlineColor: this._color(merged.outlineColor, "#4a4a4a"),
      outlineWidth: this._nonNegativeNumber(merged.outlineWidth, 3),
      fillColor: this._color(merged.fillColor, "#d1d1d1"),
      fillAlpha: this._clamp(Number(merged.fillAlpha), 0, 1, 0.35),
      environment: merged.environment || null,
      layoutProfile: merged.layoutProfile || null,
      assignmentMode: this.normalizeAssignmentMode(merged.assignmentMode)
    });
  }

  static resolveRoomStyle(sector = {}, mapStyle = {}, options = {}) {
    const assignmentMode = this.normalizeAssignmentMode(
      options.assignmentMode || mapStyle.assignmentMode || "AUTOMATIC"
    );
    const storedOverride = sector.floorStyle &&
      typeof sector.floorStyle === "object"
        ? structuredClone(sector.floorStyle)
        : {};
    const locked = storedOverride.locked === true;
    const useStoredOverride = locked || assignmentMode === "MANUAL";
    const roomOverride = useStoredOverride ? storedOverride : {};
    const layoutProfile = String(
      options.layoutProfile ||
      options.layoutProfileId ||
      mapStyle.layoutProfile ||
      mapStyle.layoutProfileId ||
      ""
    ).trim().toUpperCase();

    let preset = useStoredOverride
      ? roomOverride.preset || mapStyle.preset || "auto"
      : "auto";
    const environment =
      roomOverride.environment ||
      sector.environment ||
      sector.roomType ||
      sector.locationType ||
      this._profileEnvironment(layoutProfile) ||
      this._environmentForRole(sector.graphRole);

    if (assignmentMode === "UNIFORM" && !locked) {
      preset = mapStyle.preset || "auto";
    } else if (assignmentMode === "AUTOMATIC" && !locked) {
      preset = this._automaticRoomPreset(
        sector,
        mapStyle,
        environment,
        layoutProfile
      );
    }

    const requestedMode = useStoredOverride
      ? roomOverride.mode
      : mapStyle.preset === "plain"
        ? "PLAIN"
        : "TEXTURE";
    const resolved = this.resolve({
      ...mapStyle,
      ...roomOverride,
      ...options,
      genre: roomOverride.genre || mapStyle.genre || "auto",
      preset,
      mode: requestedMode,
      environment,
      layoutProfile,
      // A room-specific preset must use its own resolved texture. Do not
      // inherit the map/corridor texture path from mapStyle.
      roomTexture: useStoredOverride
        ? roomOverride.roomTexture || null
        : null,
      corridorTexture: null,
      textureScale:
        roomOverride.textureScale ?? mapStyle.textureScale ?? 1,
      outlineEnabled:
        roomOverride.outlineEnabled ?? mapStyle.outlineEnabled ?? true,
      outlineColor: roomOverride.outlineColor || mapStyle.outlineColor,
      outlineWidth:
        roomOverride.outlineWidth ?? mapStyle.outlineWidth,
      scene: options.scene,
      gridSize: options.gridSize || mapStyle.gridSize
    });

    return Object.freeze({
      ...resolved,
      sectorId: sector.sectorId || null,
      layoutProfile: layoutProfile || null,
      assignmentMode,
      source: locked
        ? "LOCKED"
        : assignmentMode === "MANUAL"
          ? "MANUAL"
          : assignmentMode === "UNIFORM"
            ? "MAP_DEFAULT"
            : "AUTOMATIC",
      locked
    });
  }

  static normalizeAssignmentMode(value) {
    const mode = String(value || "AUTOMATIC").trim().toUpperCase();
    return ["AUTOMATIC", "UNIFORM", "MANUAL"].includes(mode)
      ? mode
      : "AUTOMATIC";
  }

  static _automaticRoomPreset(
    sector,
    mapStyle,
    environment,
    layoutProfile = ""
  ) {
    const role = String(sector.graphRole || "OPTIONAL")
      .trim()
      .toUpperCase();
    const genre = mapStyle.genre || "auto";
    const resolvedGenre = genre === "auto"
      ? CartographerFloorLibrary.resolveSystemGenre()
      : genre;
    const profile = String(layoutProfile || "").toUpperCase();

    // Strict natural profiles must not be overridden by generic room-role
    // defaults such as OPTIONAL -> old-wooden-plank.
    const strictPreset = this.STRICT_PROFILE_PRESETS[profile];
    if (
      strictPreset &&
      CartographerFloorLibrary.get(strictPreset) &&
      CartographerFloorLibrary.score(strictPreset, resolvedGenre) > 0
    ) {
      return strictPreset;
    }

    const preferredEnvironments = [
      ...(this.PROFILE_ENVIRONMENTS[profile] || []),
      environment,
      this._environmentForRole(role)
    ].filter(Boolean);

    for (const candidate of preferredEnvironments) {
      const match = CartographerFloorLibrary.bestMatch(
        resolvedGenre,
        {
          assetClass: "FLOOR",
          environment: candidate,
          minimumScore: 1
        }
      );
      if (match) return match.id;
    }

    const profileFallback = this.PROFILE_FALLBACK_PRESETS[profile];
    if (
      profileFallback &&
      CartographerFloorLibrary.get(profileFallback) &&
      CartographerFloorLibrary.score(profileFallback, resolvedGenre) > 0
    ) {
      return profileFallback;
    }

    const roleDefaults = {
      ENTRY: "cobblestone",
      HUB: "marble-tiles",
      OBJECTIVE: "marble-tiles",
      OPTIONAL: "old-wooden-plank",
      SECRET: "stone-cave-floor",
      EXIT: "cobblestone"
    };
    const candidate = roleDefaults[role];
    if (
      candidate &&
      CartographerFloorLibrary.score(candidate, resolvedGenre) > 0
    ) {
      return candidate;
    }
    return mapStyle.preset || "auto";
  }

  static _profileEnvironment(layoutProfile) {
    return this.PROFILE_ENVIRONMENTS[
      String(layoutProfile || "").toUpperCase()
    ]?.[0] || null;
  }

  static _environmentForRole(graphRole) {
    return {
      ENTRY: "dungeon",
      HUB: "lobby",
      OBJECTIVE: "temple",
      OPTIONAL: "interior",
      SECRET: "underground",
      EXIT: "dungeon"
    }[String(graphRole || "OPTIONAL").toUpperCase()] || null;
  }

  static listPresets(options = {}) {
    const genre = options.genre === "auto" || !options.genre
      ? CartographerFloorLibrary.resolveSystemGenre(
          options.systemId || globalThis.game?.system?.id
        )
      : CartographerFloorLibrary.normalizeGenre(options.genre);
    const minimumScore = options.showAll
      ? 0
      : options.minimumScore ?? 1;
    return CartographerFloorLibrary.list({
      assetClass: "FLOOR",
      genre,
      minimumScore,
      environment: options.environment || null
    }).map(tile => ({
      ...tile,
      score: CartographerFloorLibrary.score(tile, genre),
      recommended: CartographerFloorLibrary.score(tile, genre) >= 2
    }));
  }

  static validateResolvedStyle(style) {
    const problems = [];
    if (!style || typeof style !== "object") {
      return { valid: false, problems: ["Missing resolved floor style."] };
    }
    if (!["PLAIN", "TEXTURE"].includes(style.mode)) {
      problems.push(`Unsupported floor mode: ${style.mode}`);
    }
    if (style.mode === "TEXTURE" && !style.texturePath) {
      problems.push("Texture mode requires a texture path.");
    }
    if (!(style.texturePixelSize > 0)) {
      problems.push("Texture pixel size must be greater than zero.");
    }
    if (!(style.outlineWidth >= 0)) {
      problems.push("Outline width cannot be negative.");
    }
    if (!(style.fillAlpha >= 0 && style.fillAlpha <= 1)) {
      problems.push("Fill alpha must be between zero and one.");
    }
    return { valid: problems.length === 0, problems };
  }

  static toMetadata(style) {
    if (!style) return null;
    return {
      genre: style.genre,
      genreSource: style.genreSource,
      systemGenre: style.systemGenre,
      preset: style.preset,
      presetSource: style.presetSource,
      mode: style.mode,
      texturePath: style.texturePath,
      roomTexture: style.roomTexture,
      corridorTexture: style.corridorTexture,
      gridSize: style.gridSize,
      tileSize: style.tileSize,
      textureScale: style.textureScale,
      texturePixelSize: style.texturePixelSize,
      outlineEnabled: style.outlineEnabled,
      outlineColor: style.outlineColor,
      outlineWidth: style.outlineWidth,
      fillColor: style.fillColor,
      fillAlpha: style.fillAlpha,
      environment: style.environment,
      layoutProfile: style.layoutProfile || null,
      assignmentMode: this.normalizeAssignmentMode(style.assignmentMode)
    };
  }

  static _resolveTile({ preset, genre, environment, minimumScore }) {
    if (
      preset &&
      !["auto", "plain", "none"].includes(preset.toLowerCase())
    ) {
      return CartographerFloorLibrary.get(preset);
    }
    if (["plain", "none"].includes(String(preset).toLowerCase())) {
      return null;
    }
    return CartographerFloorLibrary.bestMatch(genre, {
      assetClass: "FLOOR",
      environment: environment || null,
      minimumScore: minimumScore ?? 2
    });
  }

  static _readWorldStyle() {
    return {
      genre: this._setting(this.GENRE_SETTING, this.DEFAULTS.genre),
      preset: this._setting(this.PRESET_SETTING, this.DEFAULTS.preset),
      textureScale: this._setting(
        this.SCALE_SETTING,
        this.DEFAULTS.textureScale
      ),
      outlineEnabled: this._setting(
        this.OUTLINE_SETTING,
        this.DEFAULTS.outlineEnabled
      ),
      outlineColor: this._setting(
        this.OUTLINE_COLOR_SETTING,
        this.DEFAULTS.outlineColor
      ),
      outlineWidth: this._setting(
        this.OUTLINE_WIDTH_SETTING,
        this.DEFAULTS.outlineWidth
      )
    };
  }

  static _readSceneStyle(scene) {
    const style = scene?.flags?.[MODULE_ID]?.cartographer?.floorStyle;
    return style && typeof style === "object"
      ? structuredClone(style)
      : {};
  }

  static _setting(key, fallback) {
    try {
      const settings = globalThis.game?.settings;
      if (!settings?.get) return fallback;
      return settings.get(MODULE_ID, key) ?? fallback;
    } catch (_error) {
      return fallback;
    }
  }

  static _normalizeMode(value, tile) {
    const mode = String(value || "TEXTURE").trim().toUpperCase();
    if (mode === "PLAIN" || !tile) return "PLAIN";
    return "TEXTURE";
  }

  static _compact(object = {}) {
    return Object.fromEntries(
      Object.entries(object).filter(([, value]) => value !== undefined)
    );
  }

  static _boolean(value, fallback) {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === 1 || value === "1") return true;
    if (value === "false" || value === 0 || value === "0") return false;
    return fallback;
  }

  static _positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  static _nonNegativeNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  static _clamp(value, minimum, maximum, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(maximum, Math.max(minimum, value));
  }

  static _color(value, fallback) {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
  }
}
