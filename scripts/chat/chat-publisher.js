// modules/ai-director/scripts/chat/chat-publisher.js

import {
  FlagFactory,
  PROCESS_TYPES
} from "/modules/ai-director/core/flag-factory.js";

function getMessageStyle() {
  return (
    typeof CONST !== "undefined" &&
    CONST.CHAT_MESSAGE_STYLES?.OTHER !== undefined
  )
    ? CONST.CHAT_MESSAGE_STYLES.OTHER
    : 0;
}

function buildProductionControls(isMultiSector) {
  if (isMultiSector) {
    return `
      <div class="ai-director-production-controls"
           style="display: flex; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.15);">

        <button type="button"
                class="director-forge-btn"
                data-forge-type="panorama"
                style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; height: 28px; font-size: 0.75rem; cursor: pointer; background: #2b3a42; color: #fff; border: 1px solid #1a252c; border-radius: 4px;">
          <i class="fas fa-images"></i> FORGE PANORAMA
        </button>

        <button type="button"
                class="director-forge-btn"
                data-forge-type="dungeon-map"
                style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; height: 28px; font-size: 0.75rem; font-weight: bold; cursor: pointer; background: #7c2d12; color: #fff; border: 1px solid #451a03; border-radius: 4px;">
          <i class="fas fa-map"></i> FORGE MULTI-SECTOR MAP
        </button>
      </div>
    `;
  }

  return `
    <div class="ai-director-production-controls"
         style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.15);">

      <button type="button"
              class="director-forge-btn"
              data-forge-type="panorama"
              style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; height: 26px; font-size: 0.75rem; cursor: pointer; background: #2b3a42; color: #fff; border: 1px solid #1a252c; border-radius: 4px;">
        <i class="fas fa-images"></i> Forge Panorama
      </button>

      <button type="button"
              class="director-forge-btn"
              data-forge-type="map"
              style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; height: 26px; font-size: 0.75rem; cursor: pointer; background: #7c2d12; color: #fff; border: 1px solid #451a03; border-radius: 4px;">
        <i class="fas fa-map"></i> Forge Tactical Map
      </button>

      <button type="button"
              class="director-forge-btn director-convert-btn"
              data-forge-type="expand-dungeon"
              style="flex: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; height: 26px; font-size: 0.75rem; cursor: pointer; background: #4a154b; color: #fff; border: 1px solid #2e0d2f; border-radius: 4px; margin-top: 4px;">
        <i class="fas fa-door-open"></i> Expand to Multi-Room Facility
      </button>
    </div>
  `;
}

function renderStreamOutput(
  streamOutput,
  playerContent,
  gmNotes = "",
  isMultiSector = false
) {
  if (!streamOutput) return;

  const playerElement = document.createElement("p");
  playerElement.className = "chat-line director-line";
  playerElement.innerHTML =
    `<strong>Cinematic Director:</strong><br>${playerContent}`;

  streamOutput.appendChild(playerElement);

  if (gmNotes && !isMultiSector) {
    const gmElement = document.createElement("div");
    gmElement.className = "chat-line gm-secrets-line";
    gmElement.style.borderLeft = "3px solid #ff3333";
    gmElement.style.paddingLeft = "8px";
    gmElement.style.marginTop = "8px";
    gmElement.innerHTML =
      `<strong>[GM NOTES]:</strong><br>${gmNotes}`;

    streamOutput.appendChild(gmElement);
  }

  streamOutput.scrollTop = streamOutput.scrollHeight;
}

export async function publishConversionCard({
  manifest,
  sourceSceneContext = ""
} = {}) {
  if (!manifest) return null;

  const entrySector = manifest.sectors?.[0] || {};
  const entryDescription =
    entrySector.sensoryDescription ||
    sourceSceneContext;

  const flags = FlagFactory.createFlags({
    isAi: true,
    processType: PROCESS_TYPES.SCENE_PRODUCTION,
    context: {
      status: "dungeon_manifest_active",
      sceneName: manifest.dungeonTitle,
      playerScene: sourceSceneContext,
      dungeonTitle: manifest.dungeonTitle,
      manifest
    }
  });

  const content = `
    <div class="ai-director-chat-card"
         style="padding: 8px; border-left: 4px solid #4a154b; background: rgba(74, 21, 75, 0.05);">

      <h4 style="margin: 0 0 4px 0; color: #4a154b;">
        <i class="fas fa-dungeon"></i>
        Initialized: ${manifest.dungeonTitle}
      </h4>

      <div style="background: rgba(0,0,0,0.05); padding: 8px; border-radius: 4px; margin: 8px 0; font-style: italic; font-size: 0.88rem; line-height: 1.45;">
        <strong>Entry Point (${entrySector.name || "Unknown"}):</strong><br>
        ${entryDescription}
      </div>

      ${buildProductionControls(true)}
    </div>
  `;

  return ChatMessage.create({
    user: game.user.id,
    speaker: { alias: "AI Director" },
    content,
    flags,
    style: getMessageStyle()
  });
}

export async function publishSceneProduction({
  streamOutput = null,
  sceneName = "Generated Scene",
  playerContent = "",
  gmNotes = "",
  isMultiSector = false,
  manifest = null,
  dungeonTitle = null
} = {}) {
  renderStreamOutput(
    streamOutput,
    playerContent,
    gmNotes,
    isMultiSector
  );

  const controlsHtml =
    buildProductionControls(isMultiSector);

  const content = `
    <div class="ai-director-chat-card"
         data-gm-notes="${encodeURIComponent(gmNotes)}">

      <div class="card-content"
           style="padding: 5px; border-left: 3px solid ${isMultiSector ? "#4a154b" : "#ffaa00"};">

        <h4 style="margin: 0 0 5px 0; color: ${isMultiSector ? "#62a370" : "#ffaa00"}; text-transform: uppercase; font-size: 0.85rem;">
          <i class="fas ${isMultiSector ? "fa-dungeon" : "fa-theater-masks"}"></i>
          Generated Scene Context: ${sceneName}
        </h4>

        <div class="scene-narrative-text"
             style="color: #2b2b2b; line-height: 1.4;">
          ${playerContent}
        </div>

        ${controlsHtml}
      </div>
    </div>
  `;

  const flags = FlagFactory.createFlags({
    isAi: true,
    processType: PROCESS_TYPES.SCENE_PRODUCTION,
    context: {
      status: isMultiSector
        ? "dungeon_manifest_active"
        : "single_scene_active",
      sceneName,
      playerScene: playerContent,
      dungeonTitle:
        dungeonTitle ||
        manifest?.dungeonTitle ||
        sceneName,
      manifest
    }
  });

  return ChatMessage.create({
    user: game.user.id,
    speaker: { alias: "AI Director" },
    content,
    flags,
    style: getMessageStyle()
  });
}