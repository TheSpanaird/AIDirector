// modules/ai-director/scripts/data/dungeon-sync.js
// PASS 4 UPDATED: Scene Record journal/chat export helpers.
import { getOrCreateActiveVolumePage } from "../journal/volume-helper.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function textOrNone(value) {
  const text = String(value ?? "").trim();
  return text ? escapeHtml(text) : "None";
}

function visibilityOf(item) {
  return String(item?.visibility || "VISIBLE").trim().toUpperCase();
}

function isPlayerVisible(item) {
  const visibility = visibilityOf(item);
  return visibility !== "GM_ONLY" && visibility !== "HIDDEN";
}

function itemLabel(item) {
  if (typeof item === "string") return item;
  return item?.name || item?.archetype || item?.id || item?.stableId || item?.description || "Unnamed";
}

function itemDescription(item) {
  if (typeof item === "string") return "";
  return item?.description || item?.role || item?.currentActivity || item?.notes || "";
}

function renderList(items, { empty = "None", playerVisibleOnly = false, includeVisibility = true } = {}) {
  const source = asArray(items).filter(item => !playerVisibleOnly || isPlayerVisible(item));
  if (!source.length) return `<p>${escapeHtml(empty)}</p>`;

  const rows = source.map(item => {
    const label = itemLabel(item);
    const description = itemDescription(item);
    const count = typeof item === "object" && item?.count ? ` x${Number(item.count) || 1}` : "";
    const visibility = includeVisibility && typeof item === "object" && item?.visibility
      ? ` <em>(${escapeHtml(visibilityOf(item))})</em>`
      : "";
    const dc = typeof item === "object" && item?.dc !== undefined && item?.dc !== null
      ? ` <em>(DC ${escapeHtml(item.dc)})</em>`
      : "";
    const detail = description ? `: ${escapeHtml(description)}` : "";
    return `<li><strong>${escapeHtml(label)}${count}</strong>${visibility}${dc}${detail}</li>`;
  }).join("");

  return `<ul>${rows}</ul>`;
}

function renderConnections(connections) {
  const source = asArray(connections);
  if (!source.length) return "None";
  return source.map(connection => {
    if (typeof connection === "string") return `<code>${escapeHtml(connection)}</code>`;
    const label = connection?.to || "unknown";
    const details = [connection?.wallSide, connection?.doorType, connection?.connectionType]
      .filter(Boolean)
      .map(escapeHtml)
      .join(", ");
    return `<code>${escapeHtml(label)}</code>${details ? ` (${details})` : ""}`;
  }).join(", ");
}

function visibleThreatSummary(sector) {
  const visibleMonsters = asArray(sector.monsters).filter(isPlayerVisible);
  const visibleNpcThreats = asArray(sector.npcs).filter(item => {
    const disposition = String(item?.disposition || item?.role || "").toUpperCase();
    return isPlayerVisible(item) && (disposition.includes("HOSTILE") || disposition.includes("THREAT") || disposition.includes("COMBAT"));
  });
  return [...visibleMonsters, ...visibleNpcThreats];
}

function visibleOccupantSummary(sector) {
  const inhabitants = asArray(sector.inhabitants).filter(isPlayerVisible);
  const nonHostileNpcs = asArray(sector.npcs).filter(item => {
    const disposition = String(item?.disposition || item?.role || "").toUpperCase();
    return isPlayerVisible(item) && !disposition.includes("HOSTILE") && !disposition.includes("THREAT") && !disposition.includes("COMBAT");
  });
  return [...inhabitants, ...nonHostileNpcs];
}

function visibleDetailSummary(sector) {
  return [
    ...asArray(sector.clues).filter(isPlayerVisible),
    ...asArray(sector.interactables).filter(isPlayerVisible),
    ...asArray(sector.loot).filter(isPlayerVisible)
  ];
}

export function renderSectorMemoryHtml(sector, index = 0) {
  const title = sector.displayName || sector.name || `Sector ${index + 1}`;
  const floor = sector.floor ?? 1;
  return `
<section class="ai-director-sector-record" data-sector-id="${escapeAttribute(sector.sectorId || "")}">
  <h4>Sector ${index + 1}: ${escapeHtml(title)} <small>[ID: ${escapeHtml(sector.sectorId || "unknown")}]</small></h4>
  <p><strong>Type:</strong> ${textOrNone(sector.sectorType)} | <strong>State:</strong> ${textOrNone(sector.areaState)} | <strong>Mundane Allowed:</strong> ${sector.mundaneAllowed === true ? "Yes" : "No"} | <strong>Floor:</strong> ${escapeHtml(floor)}</p>
  <p><strong>Adjacent Sectors:</strong> ${renderConnections(sector.connections)}</p>
  <h5>What the players see</h5>
  <p>${textOrNone(sector.sensoryDescription)}</p>
  <h5>Player-view panorama prompt</h5>
  <p>${textOrNone(sector.playerViewPrompt)}</p>
  <h5>Tactical map prompt</h5>
  <p>${textOrNone(sector.tacticalMapPrompt || sector.mapPrompt)}</p>
  <h5>Inhabitants</h5>${renderList(sector.inhabitants)}
  <h5>Monsters</h5>${renderList(sector.monsters)}
  <h5>Legacy NPCs / Encounters</h5>${renderList(sector.npcs)}${renderList(asArray(sector.encounters), { includeVisibility: false })}
  <h5>Traps</h5>${renderList(sector.traps)}
  <h5>Secrets</h5>${renderList(sector.secrets)}
  <h5>Clues</h5>${renderList(sector.clues)}
  <h5>Loot</h5>${renderList(sector.loot)}
  <h5>Interactables</h5>${renderList(sector.interactables)}
  <h5>Legacy traps and secrets</h5><p>${textOrNone(sector.trapsAndSecrets)}</p>
  <h5>GM Notes</h5><p>${textOrNone(sector.gmNotes)}</p>
</section>`;
}

export function renderSectorChatHtml(sector, index = 0) {
  const title = sector.displayName || sector.name || `Sector ${index + 1}`;
  return `
<section class="ai-director-sector-chat" data-sector-id="${escapeAttribute(sector.sectorId || "")}">
  <h4>${escapeHtml(title)}</h4>
  <p>${textOrNone(sector.sensoryDescription)}</p>
  <p><strong>Visible occupants:</strong> ${renderList(visibleOccupantSummary(sector), { playerVisibleOnly: true, includeVisibility: false })}</p>
  <p><strong>Obvious threats:</strong> ${renderList(visibleThreatSummary(sector), { playerVisibleOnly: true, includeVisibility: false })}</p>
  <p><strong>Notable visible details:</strong> ${renderList(visibleDetailSummary(sector), { playerVisibleOnly: true, includeVisibility: false })}</p>
</section>`;
}

export function renderManifestMemoryHtml(manifest) {
  const formattedDate = new Date().toLocaleDateString();
  const manifestJson = escapeAttribute(JSON.stringify(manifest));
  const sectors = asArray(manifest?.sectors);
  const sectorsHtml = sectors.map((sector, index) => renderSectorMemoryHtml(sector, index)).join("\n");
  const ventilation = manifest?.ventilation && typeof manifest.ventilation === "object" ? manifest.ventilation : null;
  const ventilationHtml = ventilation ? `
<section class="ai-director-ventilation-record">
  <h4>Ventilation Network</h4>
  <p><strong>Enabled:</strong> ${ventilation.enabled === true ? "Yes" : "No"}</p>
  <p><strong>Type:</strong> ${textOrNone(ventilation.networkType || "AIR_DUCT")}</p>
  <p><strong>Visibility:</strong> ${textOrNone(ventilation.visibility || "HIDDEN")}</p>
  <p><strong>Connections:</strong> ${textOrNone(asArray(ventilation.connections).map(link => `${link.from} -> ${link.to} (${link.accessType || "VENT_GRATE"}, ${link.size || "SMALL"})`).join("; "))}</p>
</section>` : "";

  return `
<div class="ai-director-manifest-record" data-manifest-json="${manifestJson}">
  <h3>DUNGEON: ${escapeHtml(manifest?.dungeonTitle || "Dungeon Manifest")} (${escapeHtml(formattedDate)})</h3>
  <p><strong>Overall Goal:</strong> ${textOrNone(manifest?.overallGoal || "Explore and secure the facility.")}</p>
  <p><strong>Total Sectors:</strong> ${escapeHtml(manifest?.totalSectors || sectors.length)}</p>
  <p><strong>Structure:</strong> ${textOrNone(manifest?.structureType)} | <strong>Archetype:</strong> ${textOrNone(manifest?.sceneArchetype)} | <strong>Occupancy:</strong> ${textOrNone(manifest?.occupancyState || manifest?.occupancy)}</p>
  <h3>Sector Manifest</h3>
  ${sectorsHtml}
  ${ventilationHtml}
</div>`;
}

export function renderManifestChatSummaryHtml(manifest, { maxSectors = 3 } = {}) {
  const sectors = asArray(manifest?.sectors).slice(0, maxSectors);
  const sectorsHtml = sectors.map((sector, index) => renderSectorChatHtml(sector, index)).join("\n");
  const hiddenCount = Math.max(0, asArray(manifest?.sectors).length - sectors.length);
  return `
<div class="ai-director-manifest-chat-summary">
  <h3>${escapeHtml(manifest?.dungeonTitle || "Generated Scene")}</h3>
  <p><strong>Objective:</strong> ${textOrNone(manifest?.overallGoal)}</p>
  ${sectorsHtml}
  ${hiddenCount ? `<p><em>${hiddenCount} additional sector(s) recorded in the GM journal.</em></p>` : ""}
</div>`;
}

export async function syncDungeonManifestToMemory(manifest) {
  if (!manifest || !manifest.dungeonTitle) {
    console.error("AI Director | Invalid manifest payload provided to sync layer.");
    return null;
  }

  const formattedDate = new Date().toLocaleDateString();
  const pageTitle = `Dungeon: ${manifest.dungeonTitle} (${formattedDate})`;
  const fullContentHtml = renderManifestMemoryHtml(manifest);

  const createdPage = await getOrCreateActiveVolumePage(
    "AI Director Memory",
    pageTitle,
    fullContentHtml
  );

  ui.notifications.info(`AI Director | Synchronized "${manifest.dungeonTitle}" into AI Director Memory ledger.`);
  return createdPage;
}
