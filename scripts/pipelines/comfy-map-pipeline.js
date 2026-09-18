import { VisionParser } from "../api/vision-parser.js";
import { VisionWallPlacer } from "../engines/vision-wall-placer.js";

/**
 * ComfyUI Single-Canvas Map Generation & Vision Parsing Pipeline
 */
export class ComfyMapPipeline {
  static COMFY_API_URL = "http://127.0.0.1:8188";
  static MAP_STORAGE_FOLDER = "uploaded-maps";

  /**
   * Builds the ComfyUI API prompt graph based on the target workflow node structure.
   */
  static buildPromptGraph(mapPrompt, width = 2048, height = 2048) {
    // ENHANCED: Enforced flat 2D orthographic constraints while removing 'bird-eye' perspective ambiguity
    const positivePrompt = `tactical battlemap, 2D orthographic view, direct 90-degree overhead angle, top-down omniscient perspective, flat ground floor blueprint, completely gridless, seamless environment textures, high quality, crisp detail, ${mapPrompt}`;
    const negativePrompt = "bird-eye view, isometric perspective, oblique angle, side-view, 3D render, 3D wall heights, perspective distortion, perspective vanishing point, forced perspective, tilt-shift, depth of field, walls with grids, pre-rendered gridlines, hex pattern, human, characters, text, watermarks, map legend, compass, UI, status icons, mini-map, blurry, low resolution";
    const detectionTargets = "wall, interior wall, doorway, door, entrance, archway, throne, bar counter, table, chair, water pool, pillar, sofa, crate, light source, torch, window, entrance";

    return {
      "3": {
        "inputs": { "ckpt_name": "sdxl_lightning_4step.safetensors" },
        "class_type": "CheckpointLoaderSimple"
      },
      "5": {
        "inputs": { "width": width, "height": height, "batch_size": 1 },
        "class_type": "EmptyLatentImage"
      },
      "10": {
        "inputs": {
          "lora_name": "mapcraft_anima_v1.safetensors",
          "strength_model": 1.0,
          "strength_clip": 1.0,
          "model": ["3", 0],
          "clip": ["3", 1]
        },
        "class_type": "LoraLoader"
      },
      "6": {
        "inputs": { "text": positivePrompt, "clip": ["10", 1] },
        "class_type": "CLIPTextEncode"
      },
      "7": {
        "inputs": { "text": negativePrompt, "clip": ["10", 1] },
        "class_type": "CLIPTextEncode"
      },
      "4": {
        "inputs": {
          "seed": Math.floor(Math.random() * 100000000000000),
          "steps": 4,
          "cfg": 1,
          "sampler_name": "euler",
          "scheduler": "sgm_uniform",
          "denoise": 1,
          "model": ["10", 0],
          "positive": ["6", 0],
          "negative": ["7", 0],
          "latent_image": ["5", 0]
        },
        "class_type": "KSampler"
      },
      "8": {
        "inputs": { "samples": ["4", 0], "vae": ["3", 2] },
        "class_type": "VAEDecode"
      },
      "9": {
        "inputs": { "filename_prefix": "AI_Director_Map", "images": ["8", 0] },
        "class_type": "SaveImage"
      },
      "11": {
        "inputs": {
          "model": "Florence-2-base",
          "precision": "fp16",
          "attention": "sdpa"
        },
        "class_type": "Florence2ModelLoader"
      },
      "12": {
        "inputs": {
          "text_input": detectionTargets,
          "task": "caption_to_phrase_grounding",
          "fill_mask": false,
          "keep_model_loaded": false,
          "max_new_tokens": 1024,
          "num_beams": 3,
          "do_sample": true,
          "output_mask_select": "",
          "seed": Math.floor(Math.random() * 100000000000000),
          "image": ["8", 0],
          "florence2_model": ["11", 0]
        },
        "class_type": "Florence2Run"
      },
      "18": {
        "inputs": {
          "text": ["12", 2],        // Connected to slot index 2 (STRING output)
          "filename_prefix": "AI_Director_Vision",
          "file_extension": "txt",
          "format": "txt"
        },
        "class_type": "SaveText"
      }
    };
  }

  /**
   * Triggers generation in ComfyUI and returns the output prompt_id
   */
  static async generateMapImage(mapPrompt, width = 2048, height = 2048) {
    if (!game.user.isGM) return;

    ui.notifications.info("🎨 Requesting map generation & vision analysis from ComfyUI...");
    const promptPayload = this.buildPromptGraph(mapPrompt, width, height);

    try {
      const response = await fetch(`${this.COMFY_API_URL}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptPayload, client_id: "foundry-ai-director" })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: Failed to accept prompt graph`);
      }

      const data = await response.json();
      ui.notifications.info(`⏳ Workflow queued (Prompt ID: ${data.prompt_id})`);
      
      return data.prompt_id;
    } catch (err) {
      ui.notifications.error(`❌ ComfyUI Error: ${err.message}`);
      console.error("ComfyMapPipeline Error:", err);
      return null;
    }
  }

  /**
   * Polls ComfyUI history, downloads image asset, and reads the generated text file.
   */
  static async waitForAndSaveAssets(promptId, pollInterval = 2000, timeout = 120000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const res = await fetch(`${this.COMFY_API_URL}/history/${promptId}`);
        if (res.ok) {
          const historyData = await res.json();
          if (historyData && historyData[promptId]) {
            const outputs = historyData[promptId].outputs;
            
            if (outputs && outputs["9"] && outputs["9"].images) {
              const imgData = outputs["9"].images[0];
              const viewImageUrl = `${this.COMFY_API_URL}/view?filename=${imgData.filename}&subfolder=${imgData.subfolder || ""}&type=${imgData.type || "output"}`;

              // 1. Download raw image blob
              const imageRes = await fetch(viewImageUrl);
              if (!imageRes.ok) throw new Error(`Failed to download image from ComfyUI: ${imageRes.statusText}`);
              const blob = await imageRes.blob();

              // 2. Read saved text payload file from ComfyUI output directory dynamically
              let visionPayloadRaw = "";

              // Inspect history output keys dynamically
              for (const nodeId in outputs) {
                const nodeOutput = outputs[nodeId];
                if (nodeOutput.text) {
                  const candidate = Array.isArray(nodeOutput.text) ? nodeOutput.text[0] : nodeOutput.text;
                  // If history provided a filename reference, fetch its contents
                  if (typeof candidate === "string" && candidate.endsWith(".txt")) {
                    const textRes = await fetch(`${this.COMFY_API_URL}/view?filename=${candidate}&type=output`);
                    if (textRes.ok) visionPayloadRaw = await textRes.text();
                  } else {
                    // Direct string output from node
                    visionPayloadRaw = candidate;
                  }
                }
              }

              // Fallback fetch if history output didn't yield text payload directly
              if (!visionPayloadRaw) {
                const fallbackRes = await fetch(`${this.COMFY_API_URL}/view?filename=AI_Director_Vision_00001_.txt&type=output`);
                if (fallbackRes.ok) visionPayloadRaw = await fallbackRes.text();
              }

              console.log("👁️ [AI-Director] Live Florence-2 Vision Payload Extracted:", visionPayloadRaw);

              // 3. Upload map image locally to Foundry storage
              const fileName = `generated_map_${Date.now()}.png`;
              const file = new File([blob], fileName, { type: "image/png" });

              const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
              await FP.createDirectory("data", this.MAP_STORAGE_FOLDER).catch(() => {});

              const uploadResult = await FP.upload("data", this.MAP_STORAGE_FOLDER, file, {});
              
              return {
                localFilePath: uploadResult.path,
                visionPayloadRaw
              };
            }
          }
        }
      } catch (err) {
        console.warn("AI Director | Polling ComfyUI history...", err);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`ComfyUI map generation timed out after ${timeout / 1000} seconds.`);
  }

  /**
   * Main pipeline runner: generates assets, sets scene canvas, and applies vision walls/lights.
   */
  static async generateAndApplyMap(mapPrompt, scene = canvas.scene, width = 2048, height = 2048) {
    if (!game.user.isGM || !scene) return;

    const promptId = await this.generateMapImage(mapPrompt, width, height);
    if (!promptId) return;

    ui.notifications.info("⌛ Rendering map textures & analyzing tactical vision layout...");
    
    try {
      const assetData = await this.waitForAndSaveAssets(promptId);
      if (assetData?.localFilePath) {
        // 1. Update scene background image
        await this.applyMapToScene(scene, assetData.localFilePath, width, height);

        // 2. Parse vision detection payload to create scene walls & lights
        if (assetData.visionPayloadRaw) {
          ui.notifications.info("🔍 Auto-placing walls, lights, and environment anchors...");
          const parsedObjects = VisionParser.parseBoundingBoxes(assetData.visionPayloadRaw, scene);
          await VisionWallPlacer.applyVisionObjectsToScene(parsedObjects, scene);
        } else {
          console.warn("⚠️ [AI-Director] Vision payload was empty, skipping wall placement.");
        }
      }
    } catch (err) {
      ui.notifications.error(`❌ Map Application Failed: ${err.message}`);
      console.error("ComfyMapPipeline Error:", err);
    }
  }

  /**
   * Sets canvas dimensions and applies image path to active scene
   */
  static async applyMapToScene(scene, localFilePath, imageWidth = 2048, imageHeight = 2048, pixelsPerGrid = 100) {
    if (!game.user.isGM) return;

    const gridWidthUnits = Math.round(imageWidth / pixelsPerGrid);
    const gridHeightUnits = Math.round(imageHeight / pixelsPerGrid);

    await scene.update({
      "background.src": localFilePath,
      "width": imageWidth,
      "height": imageHeight,
      "grid.size": pixelsPerGrid,
      "grid.type": CONST.GRID_TYPES.SQUARE,
      "padding": 0.05
    });

    ui.notifications.info(`✅ Map applied to ${scene.name}! Canvas size: ${gridWidthUnits}x${gridHeightUnits} grid units.`);
  }
}

// Bind directly to global scope for DevTools console execution
window.ComfyMapPipeline = ComfyMapPipeline;