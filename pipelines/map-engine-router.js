// modules/ai-director/scripts/pipelines/map-engine-router.js
import { MODULE_ID } from "../settings.js";

/**
 * Handles image generation requests sent to ComfyUI and automatically
 * provisions top-down orthographic scenes within Foundry VTT v13.
 */
export class MapEngineRouter {

    /**
     * Standard orthographic perspective keywords forced onto all map prompts
     */
    static POSITIVE_PERSPECTIVE_PREFIX = "top-down orthographic view, 2D battlemap, overhead floorplan, flat tactical grid perspective, clean architectural layout";
    static NEGATIVE_PERSPECTIVE = "3d rendering, perspective angle, isometric, tilt-shift, humans, characters, tokens, text, watermark, signature, car, vehicle, shield";

    /**
     * Primary route to trigger a map generation pipeline.
     * @param {Object} options Options payload for map generation.
     * @param {string} options.prompt Core description of the scene/location.
     * @param {string} [options.sceneName] Desired name for the created Foundry scene.
     * @param {number} [options.width=2048] Image resolution width.
     * @param {number} [options.height=2048] Image resolution height.
     * @param {number} [options.gridSize=100] Grid size per square in pixels for the created scene.
     * @returns {Promise<Scene|null>} The generated Foundry VTT Scene Document.
     */
    static async generateMap({ prompt, sceneName = "Generated Tactical Map", width = 2048, height = 2048, gridSize = 100 }) {
        const comfyUrl = game.settings.get(MODULE_ID, "comfyUrl");
        if (!comfyUrl) {
            ui.notifications.error("AI Director: ComfyUI Server URL is not configured in settings.");
            return null;
        }

        ui.notifications.info(`AI Director: Initializing map generation for "${sceneName}"...`);

        try {
            // 1. Build and sanitize prompts
            const formattedPositive = `${this.POSITIVE_PERSPECTIVE_PREFIX}, ${prompt}`;
            const formattedNegative = this.NEGATIVE_PERSPECTIVE;

            // 2. Construct API-format ComfyUI payload
            const workflowPayload = this._buildComfyPayload({
                positivePrompt: formattedPositive,
                negativePrompt: formattedNegative,
                width,
                height
            });

            // 3. Prompt execution endpoint request
            const response = await fetch(`${comfyUrl}/prompt`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: workflowPayload })
            });

            if (!response.ok) {
                throw new Error(`ComfyUI Endpoint error: ${response.statusText}`);
            }

            const data = await response.json();
            const promptId = data.prompt_id;

            // 4. Poll until processing completes
            const imageInfo = await this._pollForCompletion(comfyUrl, promptId);
            if (!imageInfo) {
                throw new Error("Failed to retrieve generated map image from ComfyUI response.");
            }

            // 5. Construct direct image URL from output data
            const imageUrl = `${comfyUrl}/view?filename=${encodeURIComponent(imageInfo.filename)}&subfolder=${encodeURIComponent(imageInfo.subfolder)}&type=${encodeURIComponent(imageInfo.type)}`;

            // 6. Automatically provision top-down orthographic scene in Foundry VTT
            const scene = await this._createFoundryScene({
                name: sceneName,
                imgUrl: imageUrl,
                width,
                height,
                gridSize
            });

            ui.notifications.info(`AI Director: Successfully generated and rendered scene "${sceneName}"!`);
            return scene;

        } catch (error) {
            console.error("AI Director | MapEngineRouter Error:", error);
            ui.notifications.error(`AI Director: Map generation failed. ${error.message}`);
            return null;
        }
    }

    /**
     * Generates standard SDXL Text-to-Image ComfyUI execution graph.
     * @private
     */
    static _buildComfyPayload({ positivePrompt, negativePrompt, width, height }) {
        const seed = Math.floor(Math.random() * 1000000000000000);

        return {
            "3": {
                "inputs": {
                    "seed": seed,
                    "steps": 30,
                    "cfg": 7.5,
                    "sampler_name": "euler_ancestral",
                    "scheduler": "normal",
                    "denoise": 1,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["5", 0]
                },
                "class_type": "KSampler"
            },
            "4": {
                "inputs": { "ckpt_name": "sd_xl_base_1.0.safetensors" },
                "class_type": "CheckpointLoaderSimple"
            },
            "5": {
                "inputs": { "width": width, "height": height, "batch_size": 1 },
                "class_type": "EmptyLatentImage"
            },
            "6": {
                "inputs": { "text": positivePrompt, "clip": ["4", 1] },
                "class_type": "CLIPTextEncode"
            },
            "7": {
                "inputs": { "text": negativePrompt, "clip": ["4", 1] },
                "class_type": "CLIPTextEncode"
            },
            "8": {
                "inputs": { "samples": ["3", 0], "vae": ["4", 2] },
                "class_type": "VAEDecode"
            },
            "9": {
                "inputs": { "filename_prefix": "AIDirector_Map", "images": ["8", 0] },
                "class_type": "SaveImage"
            }
        };
    }

    /**
     * Polls the ComfyUI history queue endpoint for prompt completion.
     * @private
     */
    static async _pollForCompletion(comfyUrl, promptId, maxAttempts = 60, intervalMs = 2000) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));

            const response = await fetch(`${comfyUrl}/history/${promptId}`);
            if (!response.ok) continue;

            const history = await response.json();
            if (history[promptId] && history[promptId].outputs) {
                const outputs = history[promptId].outputs;
                for (const nodeId in outputs) {
                    if (outputs[nodeId].images && outputs[nodeId].images.length > 0) {
                        return outputs[nodeId].images[0];
                    }
                }
            }
        }
        return null;
    }

    /**
     * Programmatically creates a new Scene Document in Foundry VTT.
     * @private
     */
    static async _createFoundryScene({ name, imgUrl, width, height, gridSize }) {
        const sceneData = {
            name: name,
            background: {
                src: imgUrl
            },
            width: width,
            height: height,
            grid: {
                size: gridSize,
                type: CONST.GRID_TYPES.SQUARE,
                color: "#000000",
                alpha: 0.2
            },
            navigation: true
        };

        return await Scene.create(sceneData);
    }
}