// modules/ai-director/scripts/ai/panorama-forge.js

import { MODULE_ID } from "../settings.js";

export class AIDirectorPanoramaForge {

  /**
   * Resolves system-specific visual parameters for positive and negative prompt framing.
   * Maps active system manifests to distinct lighting, architectural, and equipment styling.
   *
   * @param {string} [systemType=game.system.id] - Active game system ID ('dnd5e', 'cpr', 'sw5e').
   * @returns {Object} Object containing system positive and negative prompt modifiers.
   */
  static getSystemStyleModifiers(systemType = game.system.id) {
    switch (systemType) {
      case "cpr":
        return {
          positive: "cyberpunk aesthetic, high-tech low-life, dark futuristic city, neon light shafts, wet reflective metal surfaces, chrome details, harsh shadows, volumetric smog, tactical street gear",
          negative: "medieval armor, tunic, chainmail, sword, fantasy, high fantasy, rustic wood, cobblestone"
        };
      case "sw5e":
        return {
          positive: "star wars aesthetic, gritty sci-fi environment, futuristic space opera, durasteel paneling, industrial greebling, atmospheric haze, wide imperial architecture, durasteel armor",
          negative: "modern military, 21st century clothes, medieval plate armor, high fantasy, magical runes"
        };
      case "dnd5e":
      default:
        return {
          positive: "dark fantasy aesthetic, high fantasy environment, D&D character art, medieval stonework, weathered leather, chainmail, rustic ironmongery, medieval plate armor, warm torchlight and ambient shadow",
          negative: "modern clothing, tactical vest, hoodie, backpack straps, modern jacket, zippers, tactical gear, modern military, 21st century, mandalorian, sci-fi helmet, futuristic visor, star wars"
        };
    }
  }

  /**
   * Predictably computes the standardized WebP asset path for a specific sector visual render.
   * Format: modules/{MODULE_ID}/assets/panoramas/{sceneId}_{sectorId}.webp
   *
   * @param {string} sceneId - Target scene ID.
   * @param {string} sectorId - Unique sector ID key.
   * @returns {string} Standardized web-accessible asset path.
   */
  static getSectorAssetPath(sceneId, sectorId) {
    const cleanScene = (sceneId || "global").replace(/[^a-z0-9_-]/gi, "_");
    const cleanSector = (sectorId || "sector").replace(/[^a-z0-9_-]/gi, "_");
    return `modules/${MODULE_ID}/assets/panoramas/${cleanScene}_${cleanSector}.webp`;
  }

  /**
   * Fast lookup logic to retrieve a pre-rendered sector panorama if it exists on disk.
   *
   * @param {string} sceneId - Target scene ID.
   * @param {string} sectorId - Unique sector ID key.
   * @returns {Promise<string|null>} The web-accessible image path if cached, or null if generation is needed.
   */
  static async getCachedPanorama(sceneId, sectorId) {
    const targetFolder = `modules/${MODULE_ID}/assets/panoramas`;
    const targetPath = this.getSectorAssetPath(sceneId, sectorId);
    const fileName = targetPath.split("/").pop();

    try {
      const browseResults = await FilePicker.browse("data", targetFolder);
      if (browseResults.files && browseResults.files.includes(targetPath)) {
        return targetPath;
      }
      // Alternative matching in case browse returns absolute or relative paths
      const match = browseResults.files?.find(f => f.endsWith(fileName));
      return match || null;
    } catch (err) {
      // Folder may not exist on initial run prior to first save
      return null;
    }
  }

  /**
   * Sector-aware entrypoint that checks local cache before running full ComfyUI render pipeline.
   *
   * @param {Object} sector - The sector manifest object containing sectorId and playerViewPrompt.
   * @param {Scene} [scene=canvas.scene] - Target scene reference.
   * @param {string} [systemType=game.system.id] - Active game system ID.
   * @returns {Promise<string|null>} The asset path of the cached or newly forged image.
   */
  static async forgeSectorPanorama(sector, scene = canvas.scene, systemType = game.system.id) {
    if (!sector || !sector.sectorId) {
      console.warn("AI Director | Panorama Forge: Invalid sector payload provided.");
      return null;
    }

    const sceneId = scene?.id || "global";
    const sectorId = sector.sectorId;

    // 1. Fast Cache Lookup
    const cachedPath = await this.getCachedPanorama(sceneId, sectorId);
    if (cachedPath) {
      console.log(`AI Director | Serving cached panorama for Sector "${sectorId}": ${cachedPath}`);
      return cachedPath;
    }

    // 2. Fallback to Full ComfyUI Forge Pipeline using synthesized prompt
    const promptText = sector.flags?.world?.playerViewPrompt || sector.playerViewPrompt || sector.name;
    const title = `${scene?.name || "Scene"} - ${sector.name || sectorId}`;
    const targetPath = this.getSectorAssetPath(sceneId, sectorId);

    return await this.forgeScenePanorama(systemType, promptText, false, title, targetPath);
  }

  /**
   * Generates a panoramic background image using ComfyUI, saves the output locally,
   * creates a Foundry Journal Entry, and broadcasts an interactive card to the chat.
   *
   * @param {string} systemType - The active system ID (e.g., 'cpr', 'dnd5e', 'sw5e').
   * @param {string} environmentalText - The refined environmental/atmospheric description prompt.
   * @param {boolean} [is360=false] - Whether to generate an equirectangular 360 view or a standard horizontal cinematic ratio.
   * @param {string} [sceneTitle="Cinematic Panorama"] - Title passed down from the director action.
   * @param {string} [overrideTargetPath=null] - Optional deterministic file save path.
   * @returns {Promise<string|null>} The web-accessible file path of the saved WebP image, or null on failure.
   */
  static async forgeScenePanorama(systemType = game.system.id, environmentalText, is360 = false, sceneTitle = "Cinematic Panorama", overrideTargetPath = null) {
    // GM Execution Guard: Prevent non-GM clients from executing network API calls
    if (!game.user.isGM) return null;

    try {
      ui.notifications.info("AI Director | Initializing Panorama Forge workflow...");

      const comfyUrl = game.settings.get(MODULE_ID, "comfyUrl") || "http://127.0.0.1:8188";
      const cleanTitle = sceneTitle ? sceneTitle.replace(/^(\[Scene\]\s*)+/i, "").trim() : "Cinematic Panorama";

      // 1. System Genre Mapping (Pass 8D System Style Modifiers)
      const styleModifiers = this.getSystemStyleModifiers(systemType);

      // 2. Detect Explicit In-Room Encounter Subjects / NPCs
      const basePositive = environmentalText;
      const hasExplicitSubjects = /(brigands|guards|bandits|monsters|goblins|cultists|enemies|figures|chest|thieves|npc|creatures|beasts|warrior|rogue|knight)/i.test(basePositive);

      // 3. Build Perspective & Ambient Scenery Modifiers
      let aspectModifier = is360 
        ? "360 degree equirectangular panorama, seamless horizon, ultra-wide ambient room view, subjective eye-level view, 8k resolution, highly detailed" 
        : "first-person view, subjective POV, looking forward facing room, cinematic establishing shot, eye-level horizontal perspective, wide-angle lens view, realistic atmospheric lighting, detailed surface textures, 8k resolution";

      // Ambient/Stealth Mode Filter: If no subjects are declared, enforce environment focus
      if (!hasExplicitSubjects) {
        aspectModifier += ", empty environmental shot, uninhabited room, mysterious atmospheric interior, focus on architecture and scenery";
      }
      
      const fullPositivePrompt = `${basePositive}, ${styleModifiers.positive}, ${aspectModifier}`;
      
      // 4. Dynamic Negative Prompting (Blocking rear perspective, third-person camera angles, and cross-genre leakage)
      let negativePrompt = `back facing, facing away, rear view, from behind, walking away, back view, third-person view, over-the-shoulder, grid, floor plan, top-down, orthographic, text, watermark, signature, map markers, UI, low quality, blurry, distorted, ${styleModifiers.negative}`;

      // Suppress arbitrary character generation for ambient/stealth sectors
      if (!hasExplicitSubjects) {
        negativePrompt += ", people, silhouettes, characters, travelers, figures, adventuring party, warrior, soldier, enemy";
      }

      // 5. Canvas Dimensions (16:9 for cinematic, 2:1 for 360 panorama)
      const imageWidth = is360 ? 2048 : 1536;
      const imageHeight = is360 ? 1024 : 864;

      // 6. Construct Workflow Payload for ComfyUI API (SDXL Lightning Setup)
      const workflow = {
        "3": {
          "inputs": {
            "seed": Math.floor(Math.random() * 1000000000),
            "steps": 4,
            "cfg": 1.0,
            "sampler_name": "euler",
            "scheduler": "sgm_uniform",
            "denoise": 1.0,
            "model": ["4", 0],
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
          },
          "class_type": "KSampler"
        },
        "4": {
          "inputs": {
            "ckpt_name": "sdxl_lightning_4step.safetensors"
          },
          "class_type": "CheckpointLoaderSimple"
        },
        "5": {
          "inputs": {
            "width": imageWidth,
            "height": imageHeight,
            "batch_size": 1
          },
          "class_type": "EmptyLatentImage"
        },
        "6": {
          "inputs": {
            "text": fullPositivePrompt,
            "clip": ["4", 1]
          },
          "class_type": "CLIPTextEncode"
        },
        "7": {
          "inputs": {
            "text": negativePrompt,
            "clip": ["4", 1]
          },
          "class_type": "CLIPTextEncode"
        },
        "8": {
          "inputs": {
            "samples": ["3", 0],
            "vae": ["4", 2]
          },
          "class_type": "VAEDecode"
        },
        "9": {
          "inputs": {
            "filename_prefix": "AIDirector_Panorama",
            "images": ["8", 0]
          },
          "class_type": "SaveImage"
        }
      };

      // 7. Submit Job to ComfyUI Queue
      const queueResponse = await fetch(`${comfyUrl}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow })
      });

      if (!queueResponse.ok) {
        throw new Error(`ComfyUI API rejected prompt queue: ${queueResponse.statusText}`);
      }

      const queueData = await queueResponse.json();
      const promptId = queueData.prompt_id;
      ui.notifications.info("AI Director | Scenery rendering queued in ComfyUI...");

      // 8. Poll HTTP endpoint for completion
      const imageInfo = await this._pollComfyCompletion(comfyUrl, promptId);
      if (!imageInfo) {
        throw new Error("ComfyUI finished job but returned no valid output image info.");
      }

      // 9. Fetch Generated Image Blob and Save Locally into User Data
      const imageFetchUrl = `${comfyUrl}/view?filename=${encodeURIComponent(imageInfo.filename)}&subfolder=${encodeURIComponent(imageInfo.subfolder || "")}&type=${encodeURIComponent(imageInfo.type || "output")}`;
      const imageBlobResponse = await fetch(imageFetchUrl);
      const imageBlob = await imageBlobResponse.blob();

      let targetFolder = `modules/${MODULE_ID}/assets/panoramas`;
      let fileName;

      if (overrideTargetPath) {
        const pathParts = overrideTargetPath.split("/");
        fileName = pathParts.pop();
        targetFolder = pathParts.join("/");
      } else {
        const timestamp = Date.now();
        const sanitizedTitle = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, "_");
        fileName = `panorama_${sanitizedTitle}_${timestamp}.webp`;
      }

      const fileObj = new File([imageBlob], fileName, { type: "image/webp" });

      // Save file via Foundry FilePicker API
      await FilePicker.upload("data", targetFolder, fileObj, {}, { notify: false });
      const finalizedPath = `${targetFolder}/${fileName}`;

      // 10. Store Asset in Foundry Journal Entry
      await this._createOrUpdateJournalEntry(cleanTitle, finalizedPath, environmentalText);

      // 11. Broadcast Interactive Chat Log Card
      const chatHtml = `
        <div class="ai-director-chat-card" style="border: 1px solid #4a6b82; border-radius: 5px; overflow: hidden; font-family: var(--font-primary);">
          <div style="background: #111; color: #fff; padding: 6px 10px; font-weight: bold; font-family: 'Signika', sans-serif;">
            <i class="fas fa-theater-masks" style="color: #4a6b82; margin-right: 6px;"></i> AI DIRECTOR | CINEMATIC SCENERY FORGED
          </div>
          <div style="padding: 0; line-height: 0;">
            <img src="${finalizedPath}" class="ai-director-image-target" style="border: none; width: 100%; height: auto; display: block; margin: 0;" />
          </div>
          <div style="background: #191919; padding: 6px 10px; display: flex; gap: 6px; align-items: center;">
            <button type="button" 
                    class="ai-director-popout-btn" 
                    data-src="${finalizedPath}"
                    style="background: #2a3e50; color: #fff; border: 1px solid #4a6b82; border-radius: 3px; padding: 5px; cursor: pointer; font-size: 11px; flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <i class="fas fa-expand"></i> Popout Panorama
            </button>
            <button type="button" 
                    class="ai-director-create-scene-btn" 
                    data-src="${finalizedPath}"
                    data-title="${cleanTitle}"
                    style="background: #2b5235; color: #fff; border: 1px solid #4a8258; border-radius: 3px; padding: 5px; cursor: pointer; font-size: 11px; flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <i class="fas fa-map"></i> Create Scene
            </button>
          </div>
        </div>
      `;

      await ChatMessage.create({
        user: game.user.id,
        content: chatHtml,
        speaker: { alias: "AI Director" },
        flags: {
          [MODULE_ID]: {
            isPanoramaCard: true,
            imagePath: finalizedPath,
            title: cleanTitle
          }
        }
      });

      return finalizedPath;

    } catch (err) {
      console.error("AI Director Panorama Forge | Critical failure during generation pipeline:", err);
      ui.notifications.error(`Panorama Forge Error: ${err.message}`);
      return null;
    }
  }

  /**
   * Helper function to poll ComfyUI history API until prompt output is available.
   * @private
   */
  static async _pollComfyCompletion(comfyUrl, promptId, maxRetries = 60, intervalMs = 2000) {
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      
      try {
        const response = await fetch(`${comfyUrl}/history/${promptId}`);
        if (!response.ok) continue;

        const historyData = await response.json();
        if (historyData[promptId] && historyData[promptId].outputs) {
          const outputs = historyData[promptId].outputs;
          for (const nodeId of Object.keys(outputs)) {
            if (outputs[nodeId].images && outputs[nodeId].images.length > 0) {
              return outputs[nodeId].images[0];
            }
          }
        }
      } catch (e) {
        // Suppress transient fetch network polling errors
      }
    }
    return null;
  }

  /**
   * Creates or updates a dedicated Journal Entry to log generated panoramas.
   * @private
   */
  static async _createOrUpdateJournalEntry(title, imagePath, promptText) {
    const journalTitle = "AI Director - Forged Panoramas";
    let journal = game.journal.find(j => j.name === journalTitle);

    if (!journal) {
      journal = await JournalEntry.create({
        name: journalTitle,
        folder: null
      });
    }

    const pageTitle = `[Panorama] ${title}`;
    const pageContent = `
      <h2>${title}</h2>
      <p><strong>Refined Environmental Context:</strong> <em>${promptText}</em></p>
      <p><img src="${imagePath}" alt="${title}" style="width: 100%; height: auto; border: 1px solid #4a6b82; border-radius: 4px;" /></p>
      <hr />
    `;

    await journal.createEmbeddedDocuments("JournalEntryPage", [{
      name: pageTitle,
      type: "text",
      text: { content: pageContent, format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML }
    }]);
  }
}

// Module and Window exports for V13 compatibility and module listeners
export const PanoramaForge = AIDirectorPanoramaForge;

if (typeof window !== "undefined") {
  window.AIDirectorPanoramaForge = AIDirectorPanoramaForge;
}