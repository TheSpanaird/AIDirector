// modules/ai-director/scripts/cartographer/cartographer-floor-library.js
// AI Director Cartographer Phase 4.5
// Shared, weighted, multi-genre catalog for floor, outdoor, and feature tiles.

export class CartographerFloorLibrary {
  static ASSET_CLASSES = Object.freeze({
    FLOOR: "FLOOR",
    OUTDOOR_SURFACE: "OUTDOOR_SURFACE",
    ROOM_CONTENT: "ROOM_CONTENT"
  });

  static GENRES = Object.freeze({
    FANTASY: "fantasy",
    SCIFI: "scifi",
    CYBERPUNK: "cyberpunk",
    UNIVERSAL: "universal"
  });

  static SYSTEM_GENRES = Object.freeze({
    dnd5e: "fantasy",
    sw5e: "scifi",
    cpr: "cyberpunk",
    cpred: "cyberpunk",
    "cyberpunk-red-core": "cyberpunk"
  });

  static BASE_PATH =
    "modules/ai-director/assets/cartographer/tiles";

  static TILES = Object.freeze([
    this._tile({
      id: "arc-pavement",
      label: "Arc Pavement",
      file: "arc-pavement.jpg",
      assetClass: "FLOOR",
      genres: { fantasy: 1 },
      environments: ["street", "industrial", "courtyard"]
    }),
    this._tile({
      id: "cobblestone",
      label: "Cobblestone",
      file: "cobblestone.jpg",
      assetClass: "FLOOR",
      genres: { fantasy: 3, scifi: 1, cyberpunk: 1 },
      environments: ["dungeon", "castle", "village", "ruin"]
    }),
    this._tile({
      id: "marble-tiles",
      label: "Marble Tiles",
      file: "marble-tiles.jpg",
      assetClass: "FLOOR",
      genres: { fantasy: 3, scifi: 2, cyberpunk: 2 },
      environments: ["palace", "temple", "corporate", "luxury", "lobby"]
    }),
    this._tile({
      id: "old-wooden-plank",
      label: "Old Wooden Plank",
      file: "old-wooden-plank.jpg",
      assetClass: "FLOOR",
      genres: { fantasy: 3, scifi: 1, cyberpunk: 2 },
      environments: ["tavern", "house", "warehouse", "ship"]
    }),
    this._tile({
      id: "rocks-hexagons",
      label: "Rocks Hexagons",
      file: "rocks-hexagons.jpg",
      assetClass: "FLOOR",
      genres: { fantasy: 1, scifi: 3, cyberpunk: 3 },
      environments: ["alien", "industrial", "facility", "underground"]
    }),
    this._tile({
      id: "sci-fi-texture-150",
      label: "Sci-fi Texture 150",
      file: "sci-fi-texture-150.png",
      assetClass: "FLOOR",
      genres: { scifi: 3, cyberpunk: 2 },
      environments: ["starship", "station", "facility", "hangar"]
    }),
    this._tile({
      id: "sci-fi-texture-212",
      label: "Sci-fi Texture 212",
      file: "sci-fi-texture-212.png",
      assetClass: "FLOOR",
      genres: { scifi: 3, cyberpunk: 2 },
      environments: ["starship", "station", "facility", "lab"]
    }),
    this._tile({
      id: "sci-fi-floor-002",
      label: "Sci-fi Floor 002",
      file: "sci-fi-floor-002.jpg",
      assetClass: "FLOOR",
      genres: { scifi: 3, cyberpunk: 2 },
      environments: ["starship", "facility", "hangar", "station"]
    }),
    this._tile({
      id: "stone-cave-floor",
      label: "Stone or Cave Floor",
      file: "stone-cave-floor.jpg",
      assetClass: "FLOOR",
      genres: { fantasy: 3, scifi: 1, cyberpunk: 1 },
      environments: ["cave", "mine", "crypt", "ruin", "underground"]
    }),
    this._tile({
      id: "stylized-stone",
      label: "Stylized Stone",
      file: "stylized-stone.jpg",
      assetClass: "FLOOR",
      genres: { fantasy: 3, scifi: 1, cyberpunk: 1 },
      environments: ["dungeon", "temple", "ruin", "castle"]
    }),
    this._tile({
      id: "white-tile",
      label: "White Tile",
      file: "white-tile.jpg",
      assetClass: "FLOOR",
      genres: { fantasy: 1, scifi: 3, cyberpunk: 3 },
      environments: ["lab", "clinic", "corporate", "temple", "facility"]
    }),
    this._tile({
      id: "outdoor-stone-pavement",
      label: "Outdoor Stone Pavement",
      file: "outdoor-stone-pavement.jpg",
      assetClass: "OUTDOOR_SURFACE",
      genres: { fantasy: 3, scifi: 1, cyberpunk: 2 },
      environments: ["courtyard", "street", "settlement", "road"]
    }),
    this._tile({
      id: "grass",
      label: "Grass",
      file: "grass.jpg",
      assetClass: "OUTDOOR_SURFACE",
      genres: { fantasy: 3, scifi: 1, cyberpunk: 1 },
      environments: ["field", "forest", "settlement", "park"]
    }),
    this._tile({
      id: "ground-dirt",
      label: "Ground Dirt",
      file: "ground-dirt.jpg",
      assetClass: "OUTDOOR_SURFACE",
      genres: { fantasy: 3, scifi: 1, cyberpunk: 1 },
      environments: ["road", "wilderness", "cave", "settlement"]
    }),
    this._tile({
      id: "fabric-rug",
      label: "Fabric Rug",
      file: "fabric-rug.jpg",
      assetClass: "ROOM_CONTENT",
      genres: { fantasy: 3, scifi: 1, cyberpunk: 2 },
      environments: ["interior", "palace", "apartment", "lounge"]
    }),
    this._tile({
      id: "lava",
      label: "Lava",
      file: "lava.jpg",
      assetClass: "ROOM_CONTENT",
      genres: { fantasy: 3, scifi: 2, cyberpunk: 1 },
      environments: ["volcanic", "hazard", "forge", "industrial"]
    }),
    this._tile({
      id: "water",
      label: "Water",
      file: "water.jpg",
      assetClass: "ROOM_CONTENT",
      genres: { fantasy: 3, scifi: 2, cyberpunk: 2 },
      environments: ["pool", "river", "flooded", "sewer", "reservoir"]
    })
  ]);

  static get(id) {
    return this.TILES.find(tile => tile.id === id) || null;
  }

  static list({
    assetClass = "FLOOR",
    genre = null,
    minimumScore = 0,
    environment = null
  } = {}) {
    const normalizedClass = String(assetClass || "FLOOR").toUpperCase();
    const normalizedGenre = genre ? this.normalizeGenre(genre) : null;
    const normalizedEnvironment = environment
      ? String(environment).trim().toLowerCase()
      : null;

    return this.TILES
      .filter(tile => tile.assetClass === normalizedClass)
      .filter(tile => {
        if (!normalizedGenre) return true;
        return this.score(tile, normalizedGenre) >= minimumScore;
      })
      .filter(tile => {
        if (!normalizedEnvironment) return true;
        return tile.environments.includes(normalizedEnvironment);
      })
      .sort((left, right) => {
        if (normalizedGenre) {
          const scoreDifference =
            this.score(right, normalizedGenre) -
            this.score(left, normalizedGenre);
          if (scoreDifference) return scoreDifference;
        }
        return left.label.localeCompare(right.label);
      });
  }

  static recommended(genre, options = {}) {
    return this.list({
      ...options,
      assetClass: options.assetClass || "FLOOR",
      genre,
      minimumScore: options.minimumScore ?? 2
    });
  }

  static bestMatch(genre, options = {}) {
    return this.recommended(genre, options)[0] ||
      this.list({
        ...options,
        assetClass: options.assetClass || "FLOOR"
      })[0] ||
      null;
  }

  static score(tileOrId, genre) {
    const tile = typeof tileOrId === "string"
      ? this.get(tileOrId)
      : tileOrId;
    if (!tile) return 0;

    const normalizedGenre = this.normalizeGenre(genre);
    return Number(tile.genres?.[normalizedGenre]) || 0;
  }

  static resolveSystemGenre(systemId = globalThis.game?.system?.id) {
    return this.SYSTEM_GENRES[String(systemId || "").toLowerCase()] ||
      this.GENRES.UNIVERSAL;
  }

  static normalizeGenre(value) {
    const genre = String(value || "universal")
      .trim()
      .toLowerCase()
      .replaceAll("-", "");

    if (["fantasy", "dnd", "dnd5e"].includes(genre)) return "fantasy";
    if (["scifi", "sciencefiction", "sw5e", "starwars"].includes(genre)) return "scifi";
    if (["cyberpunk", "cpr", "cpred", "cyberpunkredcore"].includes(genre)) return "cyberpunk";
    return "universal";
  }

  static validate() {
    const ids = new Set();
    const problems = [];

    for (const tile of this.TILES) {
      if (ids.has(tile.id)) problems.push(`Duplicate tile id: ${tile.id}`);
      ids.add(tile.id);

      if (!Object.values(this.ASSET_CLASSES).includes(tile.assetClass)) {
        problems.push(`Invalid asset class for ${tile.id}: ${tile.assetClass}`);
      }

      for (const [genre, score] of Object.entries(tile.genres || {})) {
        if (!["fantasy", "scifi", "cyberpunk", "universal"].includes(genre)) {
          problems.push(`Invalid genre for ${tile.id}: ${genre}`);
        }
        if (![1, 2, 3].includes(Number(score))) {
          problems.push(`Invalid genre score for ${tile.id}/${genre}: ${score}`);
        }
      }
    }

    return {
      valid: problems.length === 0,
      problems,
      tileCount: this.TILES.length
    };
  }

  static _tile({
    id,
    label,
    file,
    assetClass,
    genres = {},
    environments = []
  }) {
    const normalizedClass = String(assetClass || "FLOOR").toUpperCase();
    const folder = normalizedClass === "FLOOR"
      ? "floors"
      : normalizedClass === "OUTDOOR_SURFACE"
        ? "outdoor"
        : "features";

    return Object.freeze({
      id,
      label,
      file,
      path: `${this.BASE_PATH}/${folder}/${file}`,
      assetClass: normalizedClass,
      genres: Object.freeze({ ...genres }),
      environments: Object.freeze(
        environments.map(value => String(value).toLowerCase())
      )
    });
  }
}
