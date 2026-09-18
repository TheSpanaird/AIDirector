// modules/ai-director/scripts/journal/journal-publisher.js

import { getOrCreateActiveVolumePage } from "/modules/ai-director/scripts/journal/volume-helper.js";
import {
  buildSectorContentSectionsHtml
} from "/modules/ai-director/scripts/data/scene-record-builder.js";

/**
 * Creates or updates a page inside a specific structural folder using Volume management
 * @param {string} folderName
 * @param {string} title
 * @param {string} content
 */
export async function writeToFolderJournal(folderName, title, content) {
  return await getOrCreateActiveVolumePage(folderName, title, content);
}

/**
 * Helper to build GM-Facing HTML for AI Director Memory.
 * @param {Object} manifest
 * @returns {string}
 */
export function formatManifestToMemoryHtml(manifest) {
  if (!manifest || !manifest.sectors) return "";

  let html = `<h2 style="color: #ffffff; border-bottom: 2px solid #e67e22; padding-bottom: 4px; margin-bottom: 8px;">${manifest.dungeonTitle || "Dungeon Manifest"}</h2>`;
  if (manifest.overallGoal) {
    html += `<p style="color: #00ffd5; font-weight: bold; font-size: 1.05rem; margin-bottom: 4px;"><strong>Primary Objective:</strong> ${manifest.overallGoal}</p>`;
  }
  html += `<p style="color: #aaaaaa; font-size: 0.9rem; margin-top: 0; margin-bottom: 16px;"><strong>Total Sectors:</strong> ${manifest.totalSectors || manifest.sectors.length}</p>`;

  manifest.sectors.forEach((sec, idx) => {
    const adjText = Array.isArray(sec.connections) && sec.connections.length
      ? sec.connections.map(c => `<code>${c.to}</code> (${c.doorType || "door"})`).join(", ")
      : "None";

    const floorInfo = sec.floor ? `Floor: ${sec.floor} | ` : "";
    const colInfo = sec.gridPosition?.col !== undefined ? `Col ${sec.gridPosition.col}` : "0";
    const rowInfo = sec.gridPosition?.row !== undefined ? `Row ${sec.gridPosition.row}` : "0";

    const contentSections =
      sec.contentSectionsHtml ||
      buildSectorContentSectionsHtml(sec);

    const trapSummary =
      Array.isArray(sec.traps) &&
      sec.traps.length
        ? sec.traps
            .map(t =>
              t.title ||
              t.description ||
              t.hazardType ||
              "Trap"
            )
            .join(", ")
        : "None";

    html += `
      <div class="sector-memory-block" style="margin-bottom: 20px; padding: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px;">
        <h4 style="color: #f39c12; font-size: 1.15rem; font-weight: bold; margin: 0 0 6px 0; text-transform: uppercase;">
          Sector ${idx + 1}: ${sec.name} <span style="color: #999; font-size: 0.85rem; font-weight: normal; text-transform: none;">(${sec.sectorId})</span>
        </h4>

        <p style="margin: 0 0 8px 0; color: #aaa; font-size: 0.85rem;"><strong>${floorInfo}Grid Position:</strong> ${colInfo}, ${rowInfo}</p>
        
        <p style="margin: 4px 0 6px 0; color: #e0e0e0; font-size: 0.95rem;"><strong>Sensory Description / Atmosphere:</strong><br><em style="color: #ccc;">${sec.sensoryDescription || "N/A"}</em></p>
        
        ${contentSections}

        <p style="margin: 4px 0 6px 0; color: #e0e0e0; font-size: 0.95rem;"><strong>Traps & Secret DCs:</strong><br>${trapSummary}</p>

        <p style="margin: 4px 0 8px 0; color: #e0e0e0; font-size: 0.95rem;"><strong>Exits / Connections:</strong><br>${adjText}</p>

        <div style="margin-top: 8px; padding: 8px 12px; background: rgba(0, 0, 0, 0.5); border-left: 3px solid #38bdf8; border-radius: 4px; font-size: 0.88rem; color: #d0d0d0; word-break: break-word; white-space: normal; line-height: 1.4;">
          <strong style="color: #ffffff; display: block; margin-bottom: 2px;">
            Player-view Panorama Prompt:
          </strong>
          ${sec.playerViewPrompt || "N/A"}
        </div>

        <div style="margin-top: 8px; padding: 8px 12px; background: rgba(0, 0, 0, 0.5); border-left: 3px solid #f39c12; border-radius: 4px; font-size: 0.88rem; color: #d0d0d0; word-break: break-word; white-space: normal; line-height: 1.4;">
          <strong style="color: #ffffff; display: block; margin-bottom: 2px;">
            Tactical Map Prompt:
          </strong>
          ${sec.tacticalMapPrompt || sec.mapPrompt || "N/A"}
        </div>
      </div>
    `;
  });

  return html;
}

/**
 * Helper to build Player-Facing HTML for AI Director Canon.
 * @param {Object} manifest
 * @returns {string}
 */
export function formatManifestToCanonHtml(manifest) {
  if (!manifest || !manifest.sectors) return "";
  const entrySector = manifest.sectors[0] || {};
  
  return `
    <h2 style="margin-top:0;">${manifest.dungeonTitle || "Uncharted Region"}</h2>
    <div class="canon-narrative-block" style="font-size: 1rem; line-height: 1.6; color: #e0e0e0; font-style: italic;">
      <p>${entrySector.sensoryDescription || "The party steps forward into uncharted territory..."}</p>
    </div>
  `;
}