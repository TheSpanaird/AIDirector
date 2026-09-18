// modules/ai-director/scripts/data/sight-inspector-hud.js

import { MODULE_ID } from "../settings.js";
import { PanoramaForge } from "../ai/panorama-forge.js";

export class SightInspectorHUD extends Application {

  constructor(options = {}) {
    super(options);
    this.selectedMode = "room"; // View Modes: 'room', 'window', 'vent'
    this.selectedSectorId = null;
    this.visibleSectors = [];
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "ai-director-sight-inspector",
      title: "Line-of-Sight Inspector",
      template: `modules/${MODULE_ID}/templates/sight-inspector-hud.hbs`,
      width: 420,
      height: "auto",
      resizable: true,
      minimizable: true,
      popOut: true
    });
  }

  /**
   * Evaluates active canvas scene sectors against controlled token line-of-sight
   * using Foundry V13's vision testing engine.
   *
   * @returns {Array<Object>} Array of sector manifests visible to the active token.
   */
  getVisibleSectors() {
    const controlledToken = canvas.tokens.controlled[0] || canvas.tokens.hasSight[0];
    const activeScene = canvas.scene;
    if (!activeScene) return [];

    // Retrieve stored sector manifest from scene world flags
    const sectors = activeScene.flags?.[MODULE_ID]?.sectors || [];
    const validVisible = [];

    for (const sector of sectors) {
      if (!sector.bounds && !sector.center) continue;

      // Determine sector test target point
      const testPoint = sector.center 
        ? { x: sector.center.x, y: sector.center.y } 
        : { x: sector.bounds.x + (sector.bounds.width / 2), y: sector.bounds.y + (sector.bounds.height / 2) };

      // Ray-trace vision check via Foundry V13 testVisibility API
      const isVisible = controlledToken 
        ? canvas.effects.visibility.testVisibility(testPoint, { object: controlledToken, tolerance: 2 })
        : false;

      // Allow GMs to view all sectors if no token is currently selected
      if (isVisible || game.user.isGM) {
        validVisible.push(sector);
      }
    }

    return validVisible;
  }

  /**
   * Prepares context data payload passed into the Handlebars UI template.
   */
  async getData(options = {}) {
    this.visibleSectors = this.getVisibleSectors();
    
    // Default selection to first visible sector
    if (!this.selectedSectorId && this.visibleSectors.length > 0) {
      this.selectedSectorId = this.visibleSectors[0].sectorId;
    }

    const currentSector = this.visibleSectors.find(s => s.sectorId === this.selectedSectorId);
    let activeImagePath = null;

    if (currentSector) {
      // Fast cache lookup falling back to standard predictable path
      activeImagePath = await PanoramaForge.getCachedPanorama(canvas.scene.id, currentSector.sectorId) 
        || PanoramaForge.getSectorAssetPath(canvas.scene.id, currentSector.sectorId);
    }

    return {
      modes: [
        { key: "room", label: "Standard Room View", icon: "fa-eye" },
        { key: "window", label: "Window Ray Penetration", icon: "fa-border-all" },
        { key: "vent", label: "Vent / Grate Louver", icon: "fa-bars" }
      ],
      selectedMode: this.selectedMode,
      visibleSectors: this.visibleSectors,
      selectedSectorId: this.selectedSectorId,
      activeImagePath: activeImagePath,
      hasSectors: this.visibleSectors.length > 0
    };
  }

  /**
   * DOM event listeners for dropdown changes and forge actions.
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Sight Mode Selection
    html.find("#ai-director-mode-select").on("change", (e) => {
      this.selectedMode = e.target.value;
      this.render(false);
    });

    // Target Sector Selection
    html.find("#ai-director-sector-select").on("change", (e) => {
      this.selectedSectorId = e.target.value;
      this.render(false);
    });

    // Manual Re-render/Forge Trigger
    html.find(".ai-director-forge-btn").on("click", async (e) => {
      e.preventDefault();
      const currentSector = this.visibleSectors.find(s => s.sectorId === this.selectedSectorId);
      if (!currentSector) return;

      ui.notifications.info(`AI Director | Requesting panorama forge for ${currentSector.name}...`);
      const resultPath = await PanoramaForge.forgeSectorPanorama(currentSector, canvas.scene);
      if (resultPath) this.render(false);
    });

    // Native Image Popout Trigger
    html.find(".ai-director-popout-trigger").on("click", (e) => {
      const src = $(e.currentTarget).data("src");
      if (!src) return;
      new ImagePopout(src, { title: `POV - ${this.selectedSectorId}`, shareable: true }).render(true);
    });
  }
}