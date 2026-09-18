// modules/ai-director/scripts/listeners/sight-inspector-listener.js

import { SightInspectorHUD } from "../data/sight-inspector-hud.js";

export class SightInspectorListener {
  /**
   * Register the renderTokenHUD hook to inject the Sight Inspector button.
   */
  static register() {
    Hooks.on("renderTokenHUD", (app, html, tokenData) => {
      // 1. Create native DOM element (v13 standard)
      const button = document.createElement("div");
      button.classList.add("control-icon", "ai-director-sight-btn");
      button.title = "AI Director | Line-of-Sight Inspector";
      button.innerHTML = `<i class="fas fa-camera"></i>`;

      // 2. Attach click event listener
      button.addEventListener("click", (event) => {
        event.preventDefault();

        // Check if an instance of SightInspectorHUD is already rendered
        const existingApp = Object.values(ui.windows).find(
          (w) => w instanceof SightInspectorHUD
        );

        if (existingApp) {
          if (existingApp._minimized) existingApp.maximize();
          existingApp.bringToTop();
        } else {
          const inspector = new SightInspectorHUD();
          inspector.render(true, { focus: true });
        }
      });

      // 3. Append to HUD left column via standard DOM methods
      const leftCol = html.querySelector(".col.left");
      if (leftCol) {
        leftCol.appendChild(button);
      }
    });
  }
}