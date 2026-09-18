// modules/ai-director/scripts/settings.js

export const MODULE_ID = "ai-director";

export function getActiveModel() {
  return (
    game.settings.get(
      MODULE_ID,
      "modelName"
    ) || "hermes3"
  );
}

export function getOllamaHost() {
  return game.settings.get(
    MODULE_ID,
    "ollamaHost"
  ) || "http://localhost:11434";
}

/**
 * Registers all module settings.
 * This is called once during the 'init' hook.
 */
export function registerSettings() {
    
    // 1. Default Model (Key unified to match Orchestrator expectations)
    game.settings.register(MODULE_ID, "modelName", {
        name: "Default AI Model",
        hint: "The local AI model identifier to use for generation (e.g., hermes3).",
        scope: "world",
        config: true,
        type: String,
        default: "hermes3"
    });

    // 2. Chaos Factor
    game.settings.register(MODULE_ID, "chaosFactor", {
        name: "Chaos Factor",
        hint: "Determines the unpredictability of the AI Director.",
        scope: "world",
        config: true,
        type: Number,
        default: 5
    });

    // 3. System Type
    game.settings.register(MODULE_ID, "systemType", {
        name: "AI Director Game System",
        hint: "Select which game system profile the AI should use.",
        scope: "world",
        config: true,
        type: String,
        choices: { 
            "generic": "Generic Sandbox", 
            "cyberpunk": "Cyberpunk RED", 
            "sw5e": "Star Wars 5E", 
            "dnd5e": "D&D 5e" 
        },
        default: "generic"
    });

    // 4. Tactical Map Renderer Engine
    game.settings.register(MODULE_ID, "mapEngine", {
        name: "Tactical Map Renderer",
        hint: "Choose the active tactical-map generation pipeline.",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "cartographer": "Cartographer (Native Vector Layout)",
            "comfyUI": "ComfyUI (SDXL Diffusion Rendering)"
        },
        default: "cartographer"
    });

    // 5. Enable/Disable ComfyUI Generation Toggle
    game.settings.register(MODULE_ID, "enableComfyUI", {
        name: "Enable ComfyUI Generation",
        hint: "Uncheck to disable local diffusion calls and route map forging through Cartographer.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    // 6. Story Memory (Internal)
    game.settings.register(MODULE_ID, "storyMemory", {
        name: "Story Memory",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    // 7. Persistent Tab Memory (Internal)
    game.settings.register(MODULE_ID, "lastActiveTab", {
        name: "Last Active Tab",
        scope: "client", // Client-specific to remember the user's last view
        config: false,
        type: String,
        default: "dashboard"
    });

    // 8. Global Faction Tracking Database (Internal Framework Array)
    game.settings.register(MODULE_ID, "faction-registry", {
        name: "Global Faction Tracking Database",
        hint: "Internal framework array storing system-agnostic data points for world simulation updates.",
        scope: "world",
        config: false, // Internal backend data storage array
        type: Array,
        default: []
    });

    // 9. Ollama API Host Gateway Link
    game.settings.register(MODULE_ID, "ollamaHost", {
        name: "Ollama Server URL",
        hint: "The network host address serving the local AI engine pipeline.",
        scope: "world",
        config: true,
        type: String,
        default: "http://localhost:11434"
    });

    // 10. API Endpoint Link (Bridges the orchestrator query gap seamlessly)
    game.settings.register(MODULE_ID, "apiUrl", {
        name: "AI Generation API Endpoint Route",
        scope: "world",
        config: false, // Internal layout reference key; derived implicitly from settings cache
        type: String,
        default: "http://localhost:11434/api/generate"
    });

    // 11. Autonomous Director Toggle State
    game.settings.register(MODULE_ID, "autonomousDirector", {
        name: "Autonomous Director Enabled",
        hint: "Controls whether the AI Director actively interjects and processes autonomous narrative beats.",
        scope: "world",
        config: false,
        type: Boolean,
        default: true
    });

    // 12. ComfyUI Server URL
    game.settings.register(MODULE_ID, "comfyUrl", {
        name: "ComfyUI Server URL",
        hint: "Local or remote endpoint for ComfyUI API generation.",
        scope: "world",
        config: true,
        type: String,
        default: "http://127.0.0.1:8188"
    });

  // 13. Cartographer genre resolver
  game.settings.register(
    MODULE_ID,
    "cartographerGenre",
    {
      name: "Cartographer Genre",
      hint: "Select the visual genre used to recommend floor textures. Automatic uses the active Foundry game system.",
      scope: "world",
      config: true,
      type: String,
      choices: {
        auto: "Automatic",
        fantasy: "Fantasy",
        scifi: "Science Fiction",
        cyberpunk: "Cyberpunk",
        universal: "Universal"
      },
      default: "auto"
    }
  );

  // 14. Cartographer floor preset
  game.settings.register(
    MODULE_ID,
    "cartographerFloorPreset",
    {
      name: "Cartographer Floor Preset",
      hint: "Choose the default floor texture. Automatic selects a recommended texture for the resolved genre.",
      scope: "world",
      config: true,
      type: String,
      choices: {
        auto: "Automatic",
        plain: "Plain Color",
        "arc-pavement": "Arc Pavement",
        cobblestone: "Cobblestone",
        "marble-tiles": "Marble Tiles",
        "old-wooden-plank": "Old Wooden Plank",
        "rocks-hexagons": "Rocks Hexagons",
        "sci-fi-floor-002": "Sci-fi Floor 002",
        "sci-fi-texture-150": "Sci-fi Texture 150",
        "sci-fi-texture-212": "Sci-fi Texture 212",
        "stone-cave-floor": "Stone or Cave Floor",
        "stylized-stone": "Stylized Stone",
        "white-tile": "White Tile"
      },
      default: "auto"
    }
  );

  // 15. Texture scale, where 1 equals one image per scene grid square
  game.settings.register(
    MODULE_ID,
    "cartographerTextureScale",
    {
      name: "Cartographer Texture Scale",
      hint: "Texture scale relative to one scene grid square. A value of 1 displays one source image per grid square.",
      scope: "world",
      config: true,
      type: Number,
      range: {
        min: 0.25,
        max: 4,
        step: 0.25
      },
      default: 1
    }
  );

  // 16. Room and corridor outline toggle
  game.settings.register(
    MODULE_ID,
    "cartographerRoomOutline",
    {
      name: "Cartographer Floor Outlines",
      hint: "Draw visible outlines around generated room, corridor, and junction floor geometry.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true
    }
  );

  // 17. Floor outline color
  game.settings.register(
    MODULE_ID,
    "cartographerOutlineColor",
    {
      name: "Cartographer Outline Color",
      hint: "Six-digit hexadecimal color used for room and corridor floor outlines.",
      scope: "world",
      config: true,
      type: String,
      default: "#4a4a4a"
    }
  );

  // 18. Floor outline width
  game.settings.register(
    MODULE_ID,
    "cartographerOutlineWidth",
    {
      name: "Cartographer Outline Width",
      hint: "Pixel width of generated room and corridor floor outlines.",
      scope: "world",
      config: true,
      type: Number,
      range: {
        min: 0,
        max: 12,
        step: 1
      },
      default: 3
    }
  );

game.settings.register(
  "ai-director",
  "arcRegistry",
  {
    name: "Arc Registry",
    scope: "world",
    config: false,
    type: Array,
    default: []
  }
);

game.settings.register(
  "ai-director",
  "activeNarrativeState",
  {
    name: "Active Narrative State",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  }
);

game.settings.register(
  "ai-director",
  "faction-memory-registry",
  {
    name: "Faction Memory Registry",
    scope: "world",
    config: false,
    type: Array,
    default: []
  }
);

game.settings.register(
  "ai-director",
  "location-memory-registry",
  {
    name: "Location Memory Registry",
    scope: "world",
    config: false,
    type: Array,
    default: []
  }
);

game.settings.register(
  "ai-director",
  "eventLedger",
  {
    name: "Event Ledger",
    scope: "world",
    config: false,
    type: Array,
    default: []
  }
);
}