// map-forge.js
// AI Director Map Forge
// FILE: /modules/ai-director/scripts/ai/map-forge.js
// Routes vector manifests to Cartographer and image prompts to ComfyUI.

import { MODULE_ID }
  from "/modules/ai-director/scripts/settings.js";

import { DungeonLedgerManager }
  from "/modules/ai-director/scripts/data/dungeon-ledger-manager.js";

import { ComfyMapPipeline }
  from "/modules/ai-director/scripts/pipelines/comfy-map-pipeline.js";

import { VisionParser }
  from "/modules/ai-director/scripts/api/vision-parser.js";

import { CartographerEngine }
  from "/modules/ai-director/scripts/cartographer/cartographer-engine.js";

export class AIDirectorMapForge {

  static CONFIG = {
    engine: "cartographer",
    floor: 1,
    gridSize: 100,
    corridorWidth: 200,
    doorWidth: 200,
    doorSpacing: 200,
    sharedTrunkLength: 400,
    approachLength: 200,
    clearExisting: true,
    renderRooms: true,
    renderCorridors: true,
    renderLabels: true,
    renderWalls: true,
    renderVentilation: true,
    renderVentilationWalls: true,
    renderSkydockSecurity: true,
    applyRoomWallHeight: false,
    roomWallHeightBottom: 0,
    roomWallHeightTop: 10,
    ventGrateWidth: 100,
    lockVentGrates: false,
    imageWidth: 2048,
    imageHeight: 2048
  };

  static async forgeSceneMap(
    promptOrOptions = {},
    optionsOverride = {}
  ) {
    if (!game.user?.isGM) {
      ui.notifications.warn(
        "AI Director Map Forge requires an active GM."
      );
      return null;
    }

    const request = this._normalizeRequest(
      promptOrOptions,
      optionsOverride
    );

    if (request.engine === "comfyUI") {
      return this._renderImageMap(
        request.prompt,
        request
      );
    }

    return this._renderVectorLayout(
      request.manifest,
      request
    );
  }

  static async _renderVectorLayout(
    manifestInput = null,
    options = {}
  ) {
    const manifest = this._resolveManifest(
      manifestInput
    );

    if (
      !manifest ||
      !Array.isArray(manifest.sectors)
    ) {
      throw new Error(
        "Map Forge could not resolve a valid dungeon manifest."
      );
    }

    const config = {
      ...this.CONFIG,
      ...options
    };

    return CartographerEngine.generate(
      manifest,
      {
        scene:
          config.scene ||
          canvas.scene,
        floor:
          config.floor,
        gridSize:
          config.gridSize,
        corridorWidth:
          config.corridorWidth,
        doorWidth:
          config.doorWidth,
        doorSpacing:
          config.doorSpacing,
        sharedTrunkLength:
          config.sharedTrunkLength,
        approachLength:
          config.approachLength,
        clearExisting:
          config.clearExisting,
        renderRooms:
          config.renderRooms,
        renderCorridors:
          config.renderCorridors,
        renderLabels:
          config.renderLabels,
        renderWalls:
          config.renderWalls,
        renderVentilation:
          config.renderVentilation,
        renderVentilationWalls:
          config.renderVentilationWalls,
        renderSkydockSecurity:
          config.renderSkydockSecurity,
        applyRoomWallHeight:
          config.applyRoomWallHeight,
        roomWallHeightBottom:
          config.roomWallHeightBottom,
        roomWallHeightTop:
          config.roomWallHeightTop,
        ventGrateWidth:
          config.ventGrateWidth,
        lockVentGrates:
          config.lockVentGrates,
        layoutProfile:
          config.layoutProfile,
        layoutFamily:
          config.layoutFamily,
        architecturalScale:
          config.architecturalScale,
        genre:
          config.genre
      }
    );
  }

  static async _renderImageMap(
    prompt,
    options = {}
  ) {
    const scene =
      options.scene ||
      canvas.scene;

    if (!scene) {
      throw new Error(
        "Map Forge requires an active scene for image generation."
      );
    }

    if (
      typeof prompt !== "string" ||
      !prompt.trim()
    ) {
      throw new Error(
        "Map Forge requires a non-empty prompt for ComfyUI generation."
      );
    }

    return ComfyMapPipeline.generateAndApplyMap(
      prompt.trim(),
      scene,
      options.imageWidth || this.CONFIG.imageWidth,
      options.imageHeight || this.CONFIG.imageHeight
    );
  }

  static async buildConnectedDungeonLayout(
    manifestOverride = null,
    options = {}
  ) {
    if (!game.user?.isGM) {
      return null;
    }

    return this._renderVectorLayout(
      manifestOverride,
      {
        ...this.CONFIG,
        ...options,
        engine: "cartographer"
      }
    );
  }

  static async processVisionObjectsToCanvas(
    scene,
    objects = []
  ) {
    if (
      !game.user?.isGM ||
      !scene ||
      !objects.length
    ) {
      return [];
    }

    if (
      typeof VisionParser.parseAndApplyVision ===
      "function"
    ) {
      return VisionParser.parseAndApplyVision(
        objects,
        scene
      );
    }

    return [];
  }

  static async applyEnvironmentalLighting(
    scene,
    manifest,
    parsedObjects = []
  ) {
    if (
      !game.user?.isGM ||
      !scene
    ) {
      return null;
    }

    const tags = Array.isArray(manifest?.tags)
      ? manifest.tags.map(tag =>
          String(tag).toLowerCase()
        )
      : [];

    let darkness = 0.2;

    if (
      tags.includes("night") ||
      tags.includes("dark") ||
      tags.includes("underground")
    ) {
      darkness = 0.7;
    }

    if (
      tags.includes("bright") ||
      tags.includes("daylight")
    ) {
      darkness = 0;
    }

    await scene.update({
      darkness
    });

    return {
      darkness,
      parsedObjects
    };
  }

  static async stagePlayerCharactersAtEntry(
    scene,
    parsedObjects = []
  ) {
    if (
      !game.user?.isGM ||
      !scene
    ) {
      return [];
    }

    const gridSize =
      scene.grid?.size ||
      this.CONFIG.gridSize;

    const entryObject =
      parsedObjects.find(object =>
        object.category === "DOOR_ENTRY"
      );

    const entryDrawing =
      scene.drawings.contents.find(drawing =>
        drawing.flags?.[MODULE_ID]
          ?.graphRole === "ENTRY"
      );

    const origin =
      entryObject?.center ||
      (
        entryDrawing
          ? {
              x:
                entryDrawing.x +
                entryDrawing.shape.width / 2,
              y:
                entryDrawing.y +
                entryDrawing.shape.height / 2
            }
          : {
              x: scene.width / 2,
              y: scene.height - gridSize * 2
            }
      );

    const updates =
      scene.tokens.contents
        .filter(token =>
          token.actor?.hasPlayerOwner
        )
        .map((token, index) => ({
          _id: token.id,
          x:
            origin.x +
            (index % 3) * gridSize,
          y:
            origin.y +
            Math.floor(index / 3) * gridSize
        }));

    if (!updates.length) {
      return [];
    }

    return scene.updateEmbeddedDocuments(
      "Token",
      updates
    );
  }

  static async placeMATTTeleportTile({
    scene = canvas.scene,
    x,
    y,
    targetSceneId,
    targetX,
    targetY,
    name = "Stairs / Gateway"
  }) {
    if (
      !game.user?.isGM ||
      !scene
    ) {
      return null;
    }

    const gridSize =
      scene.grid?.size ||
      this.CONFIG.gridSize;

    const created =
      await scene.createEmbeddedDocuments(
        "Tile",
        [
          {
            x,
            y,
            width: gridSize,
            height: gridSize,
            texture: {
              src: "icons/svg/door-steel.svg"
            },
            flags: {
              [MODULE_ID]: {
                cartographerType: "gateway",
                name,
                targetSceneId,
                targetX,
                targetY
              }
            }
          }
        ]
      );

    return created[0] || null;
  }

  static _normalizeRequest(
    promptOrOptions,
    optionsOverride
  ) {
    let request = {};

    if (
      typeof promptOrOptions === "string"
    ) {
      request = {
        prompt: promptOrOptions
      };
    } else if (
      promptOrOptions &&
      typeof promptOrOptions === "object" &&
      Array.isArray(promptOrOptions.sectors)
    ) {
      request = {
        manifest: promptOrOptions,
        engine: "cartographer"
      };
    } else if (
      promptOrOptions &&
      typeof promptOrOptions === "object"
    ) {
      request = {
        ...promptOrOptions
      };
    }

    if (
      typeof optionsOverride === "string" &&
      optionsOverride.trim()
    ) {
      request.engine =
        optionsOverride.trim();
    } else if (
      optionsOverride &&
      typeof optionsOverride === "object"
    ) {
      request = {
        ...request,
        ...optionsOverride
      };
    }

    const merged = {
      ...this.CONFIG,
      ...request
    };

    merged.engine = this._normalizeEngine(
      request.engine ||
      this._getConfiguredEngine()
    );

    return merged;
  }

  static _normalizeEngine(
    engine
  ) {
    const value = String(engine || "cartographer").trim().toLowerCase();
    if (value === "comfyui" || value === "comfy" || value === "image") {
      return "comfyUI";
    }
    if (["dungeondraw", "dungeon-draw", "dungeon_draw", "vector"].includes(value)) {
      console.warn("AI Director | Legacy Dungeon Draw value detected; routing to Cartographer.");
    }
    return "cartographer";
  }

  static _getConfiguredEngine() {
    try {
      return this._normalizeEngine(game.settings.get(MODULE_ID, "mapEngine"));
    } catch (_error) {
      return "cartographer";
    }
  }

  static _resolveManifest(
    manifestInput
  ) {
    if (
      manifestInput &&
      Array.isArray(manifestInput.sectors)
    ) {
      return manifestInput;
    }

    if (
      manifestInput?.manifest &&
      Array.isArray(
        manifestInput.manifest.sectors
      )
    ) {
      return manifestInput.manifest;
    }

    if (
      typeof DungeonLedgerManager
        .getActiveManifest === "function"
    ) {
      return DungeonLedgerManager
        .getActiveManifest();
    }

    return null;
  }
}

export const MapForge =
  AIDirectorMapForge;
