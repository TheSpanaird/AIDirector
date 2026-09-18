// modules/ai-director/scripts/listeners/production-button-listener.js

import { FlagFactory, PROCESS_TYPES } from "../../core/flag-factory.js";
import { DirectorActions } from "../../apps/director-actions.js";
import { executeSceneGeneration, executeDungeonConversion } from "/modules/ai-director/scripts/data/scene-manager.js";
import { MapForge } from "/modules/ai-director/scripts/ai/map-forge.js";

/**
 * Registers the production asset button interaction hooks.
 * Insulates core chatter by performing fail-fast flag matching.
 */
export function registerProductionButtonListener() {
  Hooks.on("renderChatMessage", (message, html, data) => {
    // 1. Fail-Fast Guardrails: Ensure this is a valid document with our flags
    if (!message?.flags || !Object.prototype.hasOwnProperty.call(message.flags, "ai-director")) {
      return;
    }

    // 2. Extract and match process type via FlagFactory boundary
    const { routing, context } = FlagFactory.getFlags(message);
    if (routing.process !== PROCESS_TYPES.SCENE_PRODUCTION) {
      return;
    }

    // 3. Find our specific action container in the rendered HTML matrix
    const root = html instanceof HTMLElement ? html : html[0];
    const buttonContainer = root?.querySelector(".ai-director-production-controls");
    if (!buttonContainer) return;

    // 4. GM Execution Guard: Eliminate duplicate execution on player clients
    if (!game.user.isGM) {
      buttonContainer.querySelectorAll("button.director-forge-btn").forEach(btn => btn.style.display = "none");
      return;
    }

    // 5. Asynchronous Multi-Client Race Lock Binding
    buttonContainer.querySelectorAll("button.director-forge-btn").forEach(button => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const forgeType = button.dataset.forgeType;
        const { sceneName, playerScene, manifest, dungeonTitle } = context;

        // Circuit Protection: Visually lock down button to block rapid double-clicks
        button.disabled = true;
        button.style.opacity = "0.5";

        try {
          if (forgeType === "map") {
            if (!playerScene || !sceneName) {
              ui.notifications.error("AI Director | Asset context missing from chat message metadata flags.");
              return;
            }
            await DirectorActions.executeBackgroundMapForge(playerScene, sceneName);
          } else if (forgeType === "panorama") {
            if (!playerScene || !sceneName) {
              ui.notifications.error("AI Director | Asset context missing from chat message metadata flags.");
              return;
            }
            await DirectorActions.executeBackgroundPanoramaForge(playerScene, sceneName);
          } else if (forgeType === "expand-dungeon") {
            if (!playerScene) {
              ui.notifications.error("AI Director | Single-scene text context missing for dungeon expansion.");
              return;
            }
            // Dedicated conversion route bypasses standard text card renderer
            await executeDungeonConversion(playerScene, 0.5);
          } else if (forgeType === "dungeon-map") {
            ui.notifications.info("AI Director | Dispatching multi-sector layout to ComfyUI map generator...");
            
            // Build aggregated sector layout description or use primary map prompt from sector 1
            const targetTitle = dungeonTitle || sceneName || "Multi-Sector Facility";
            let mapContext = playerScene || "";
            
            if (manifest?.sectors?.length) {
              mapContext = manifest.sectors.map(s => `${s.name}: ${s.mapPrompt || s.sensoryDescription}`).join(" | ");
            }

            if (manifest?.sectors?.length) {
              console.log("AI Director | Chat action routing manifest to Cartographer.");
              await MapForge.buildConnectedDungeonLayout(manifest, {
                scene: canvas.scene,
                clearExisting: true,
                renderVentilation: true,
                layoutProfile: manifest.layoutProfile || null,
                genre: manifest.genre || "auto"
              });
            } else {
              await DirectorActions.executeBackgroundMapForge(mapContext, targetTitle);
            }
          }
        } catch (err) {
          console.error(`AI Director | Error executing asset forge for ${forgeType}:`, err);
          ui.notifications.error(`AI Director | Action failed: ${err.message}`);
        } finally {
          // Re-enable button after processing loop clears
          button.disabled = false;
          button.style.opacity = "1.0";
        }
      });
    });
  });
}