import { ComfyMapPipeline } from "../pipelines/comfy-map-pipeline.js";
import { VisionParser } from "../api/vision-parser.js";
import { VisionWallPlacer } from "../engines/vision-wall-placer.js";
import { SpatialAnchorEngine } from "../engines/spatial-anchor-engine.js";
import { AtmosphereEngine } from "../engines/atmosphere-engine.js";
import { spawnSectorContents } from "../engines/npc-generator.js";
import { MODULE_ID } from "../settings.js";

/**
 * ScenePrepPipeline
 * Master orchestrator class for AI Director Phase 4:
 * Coordinates Map Generation (4A), Vision Wall Parsing (4B), Anchor Spawning (4C), 
 * and Atmosphere / PC Staging (4D).
 */
export class ScenePrepPipeline {

  /**
   * Executes the end-to-end scene generation, vision processing, and token staging pipeline.
   * 
   * @param {Object} sector - Sector manifest object from DungeonLedgerManager
   * @param {Object} [options={}] - Override options (e.g. custom map prompt)
   * @returns {Promise<Scene>} Fully prepped Foundry Scene
   */
  static async prepareSectorScene(sector, options = {}) {
    if (!game.user.isGM || !sector) return null;

    console.log(`[AI Director Phase 4] Beginning Scene Prep Pipeline for: "${sector.name}"`);
    ui.notifications.info(`⚙️ Preparing scene for ${sector.name}...`);

    // ------------------------------------------------------------------
    // STEP 1: Scene Retrieval or Instantiation
    // ------------------------------------------------------------------
    const sceneName = `${sector.floor ? `F${sector.floor} - ` : ""}${sector.name}`;
    let scene = game.scenes.find(s => s.name === sceneName || s.flags?.[MODULE_ID]?.sectorId === sector.sectorId);

    if (!scene) {
      scene = await Scene.create({
        name: sceneName,
        grid: { size: 100, type: CONST.GRID_TYPES.SQUARE },
        width: 2048,
        height: 2048,
        padding: 0.1,
        flags: {
          [MODULE_ID]: {
            sectorId: sector.sectorId,
            floor: sector.floor
          }
        }
      });
    }

    // ------------------------------------------------------------------
    // PHASE 4A: Map Texture Generation & Vision Extraction (ComfyUI)
    // ------------------------------------------------------------------
    const mapPrompt = options.mapPrompt || sector.mapPrompt;
    let localImagePath = null;
    let rawVisionPayload = "";

    if (mapPrompt) {
      ui.notifications.info("🎨 Phase 4A: Generating map texture & vision analysis via ComfyUI...");
      
      const promptId = await ComfyMapPipeline.generateMapImage(mapPrompt, 2048, 2048);
      if (promptId) {
        const assets = await ComfyMapPipeline.waitForAndSaveAssets(promptId);
        if (assets) {
          localImagePath = assets.localFilePath;
          rawVisionPayload = assets.visionPayloadRaw;
        }
      }
    }

    if (localImagePath) {
      await scene.update({ "background.src": localImagePath });
    }

    // View scene to force canvas rendering context
    if (canvas.scene?.id !== scene.id) {
      await scene.view();
      await new Promise(r => setTimeout(r, 400));
    }

    // ------------------------------------------------------------------
    // PHASE 4B: Vision Parser & Automatic Geometry / Wall Placement
    // ------------------------------------------------------------------
    let detectedObjects = [];

    if (rawVisionPayload) {
      ui.notifications.info("👁️ Phase 4B: Parsing Florence-2 Vision Payload...");
      
      try {
        const parser = typeof VisionParser !== "undefined" ? VisionParser : window.VisionParser;
        const wallPlacer = typeof VisionWallPlacer !== "undefined" ? VisionWallPlacer : window.VisionWallPlacer;

        if (parser && wallPlacer) {
          detectedObjects = parser.parseBoundingBoxes(rawVisionPayload, scene);
          if (detectedObjects.length > 0) {
            await wallPlacer.applyVisionObjectsToScene(detectedObjects, scene);
          } else {
            console.warn("AI Director | Vision payload returned 0 detected objects.");
          }
        } else {
          console.warn("AI Director | VisionParser or VisionWallPlacer not found. Skipping wall placement.");
        }
      } catch (err) {
        console.error("AI Director | Phase 4B Error (Skipping wall parsing and continuing pipeline):", err);
      }
    } else {
      console.warn("⚠️ AI Director | No vision payload received from ComfyUI during Phase 4A.");
    }

    // ------------------------------------------------------------------
    // PHASE 4C: Anchor-Aware NPC Spawning
    // ------------------------------------------------------------------
    ui.notifications.info("⚔️ Phase 4C: Spawning sector NPCs at spatial anchors...");
    await spawnSectorContents(sector, sector.npcs || [], detectedObjects);

    // ------------------------------------------------------------------
    // PHASE 4D: Party Staging & Environmental Atmosphere
    // ------------------------------------------------------------------
    ui.notifications.info("🌙 Phase 4D: Staging party and applying scene atmosphere...");
    
    await this.stagePartyAtEntrance(scene, detectedObjects);
    await AtmosphereEngine.applyAtmosphereToScene(scene, sector);

    // Enable Vision & Fog of War
    await scene.update({
      tokenVision: true,
      fog: { exploration: true }
    });

    ui.notifications.info(`✅ AI Director: Scene "${scene.name}" fully prepped and live!`);
    return scene;
  }

  /**
   * Helper: Positions player-owned tokens in a formation near a detected door or canvas entry point.
   */
  static async stagePartyAtEntrance(scene, detectedObjects = []) {
    const pcTokens = canvas.tokens.placeables.filter(t => t.actor?.hasPlayerOwner);
    if (!pcTokens.length) return;

    const dim = scene.dimensions;
    const gridSize = dim.size || 100;

    // Locate explicit door anchor or fall back to bottom-center of the map
    const entryAnchor = detectedObjects.find(o => o.category === "DOOR_ENTRY");
    const entryX = entryAnchor ? entryAnchor.center.x : dim.sceneX + (dim.sceneWidth / 2);
    const entryY = entryAnchor ? entryAnchor.bounds.y : dim.sceneY + dim.sceneHeight - (gridSize * 2);

    let col = 0;
    let row = 0;
    const updates = [];

    for (const token of pcTokens) {
      updates.push({
        _id: token.id,
        x: entryX + (col * gridSize) - (gridSize / 2),
        y: entryY + (row * gridSize)
      });

      col++;
      if (col >= 2) {
        col = 0;
        row++;
      }
    }

    if (updates.length > 0) {
      await scene.updateEmbeddedDocuments("Token", updates);
    }
  }
}