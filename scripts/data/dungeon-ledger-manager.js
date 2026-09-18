// modules/ai-director/scripts/data/dungeon-ledger-manager.js
// PASS 5 UPDATED: Scene Record ledger reading, rendering, and inline edit persistence.
import { renderManifestMemoryHtml } from "./dungeon-sync.js";
import { AtmosphereEngine } from "../engines/atmosphere-engine.js";
import { MODULE_ID } from "../settings.js";
import { RewardStateManager } from "./reward-state-manager.js";
import {
  EventLedgerManager
}
from "../runtime/event-ledger-manager.js";

import {
  WorldStateEvolutionManager
}
from
"../memory/world-state-evolution-manager.js";

const ARRAY_FIELDS = new Set([
  "encounters",
  "npcs",
  "inhabitants",
  "monsters",
  "traps",
  "secrets",
  "clues",
  "loot",
  "interactables"
]);

const BOOLEAN_FIELDS = new Set(["mundaneAllowed"]);

const EDITABLE_FIELDS = new Set([
  "name",
  "displayName",
  "sectorType",
  "areaState",
  "mundaneAllowed",
  "sensoryDescription",
  "playerViewPrompt",
  "tacticalMapPrompt",
  "mapPrompt",
  "encounters",
  "npcs",
  "inhabitants",
  "monsters",
  "traps",
  "secrets",
  "clues",
  "loot",
  "interactables",
  "trapsAndSecrets",
  "gmNotes"
]);

const GEOMETRY_FIELDS = new Set([
  "sectorId",
  "connections",
  "adjacentSectors",
  "gridPosition",
  "gridDimensions",
  "shapePrimitive",
  "bounds",
  "pixelBounds",
  "center",
  "floor"
]);

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function stripLedgerRuntimeFields(manifest) {
  const output = clone(manifest);
  delete output.pageId;
  delete output.journalId;
  delete output.pageName;
  delete output.journalName;
  output.sectors = Array.isArray(output.sectors)
    ? output.sectors.map(sector => {
        const clean = clone(sector);
        delete clean.__ledgerFields;
        return clean;
      })
    : [];
  return output;
}

function toLedgerText(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function withLedgerFields(manifest) {
  const output = clone(manifest);
  output.sectors = Array.isArray(output.sectors)
    ? output.sectors.map(sector => ({
        ...sector,
        adjacentSectors: Array.isArray(sector.adjacentSectors)
          ? sector.adjacentSectors
          : (Array.isArray(sector.connections)
              ? sector.connections.map(connection => typeof connection === "string" ? connection : connection?.to).filter(Boolean)
              : []),
        __ledgerFields: {
          encounters: toLedgerText(sector.encounters || []),
          npcs: toLedgerText(sector.npcs || []),
          inhabitants: toLedgerText(sector.inhabitants || []),
          monsters: toLedgerText(sector.monsters || []),
          traps: toLedgerText(sector.traps || []),
          secrets: toLedgerText(sector.secrets || []),
          clues: toLedgerText(sector.clues || []),
          loot: toLedgerText(sector.loot || []),
          interactables: toLedgerText(sector.interactables || [])
        }
      }))
    : [];
  return output;
}

function parseArrayField(value) {
  if (Array.isArray(value)) return clone(value);
  const text = String(value ?? "").trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (_error) {
    return text
      .split(/\r?\n|;/)
      .map(item => item.trim())
      .filter(Boolean);
  }
}

function parseFieldValue(fieldName, value) {
  if (ARRAY_FIELDS.has(fieldName)) return parseArrayField(value);
  if (BOOLEAN_FIELDS.has(fieldName)) {
    if (typeof value === "boolean") return value;
    return ["true", "yes", "1", "on"].includes(String(value ?? "").trim().toLowerCase());
  }
  return String(value ?? "");
}

function pageTimestamp(page) {
  return Number(page?._stats?.modifiedTime || page?._stats?.createdTime || 0);
}

/**
 * DungeonLedgerManager
 * Reads, validates, auto-heals, and live-edits active multi-sector dungeon manifests
 * stored in AI Director Memory.
 */
export class DungeonLedgerManager {
  /**
   * Reads and parses the most recent Dungeon Manifest stored in AI Director Memory.
   * @returns {Object|null} Active validated manifest object or null if not found.
   */
  static getActiveManifest() {
    const folder = game.folders.contents.find(f => f.name === "AI Director Memory" && f.type === "JournalEntry");
    if (!folder) return null;

    const candidatePages = game.journal.contents
      .filter(journal => journal.folder?.id === folder.id)
      .flatMap(journal => journal.pages.contents
        .filter(page => page.type === "text" && String(page.text?.content || "").includes("data-manifest-json"))
        .map(page => ({ journal, page })))
      .sort((a, b) => pageTimestamp(b.page) - pageTimestamp(a.page));

    for (const { journal, page } of candidatePages) {
      const parsed = this._parseManifestFromHtml(page.text?.content || "", page.id, journal.id);
      if (parsed) {
        parsed.pageName = page.name;
        parsed.journalName = journal.name;
        return withLedgerFields(this.validateAndRepairGraph(parsed));
      }
    }

    return null;
  }

  static async replaceActiveManifest(manifest) {
    if (
      !manifest ||
      !manifest.pageId ||
      !manifest.journalId
    ) {
      return false;
    }

    const cleanManifest =
      stripLedgerRuntimeFields(
        manifest
      );

    const journal =
      game.journal.get(
        manifest.journalId
      );

    const page =
      journal?.pages?.get(
        manifest.pageId
      );

    if (!journal || !page) {
      return false;
    }

    const html =
      this._renderManifestToHtml(
        cleanManifest
      );

    await page.update({
      "text.content": html
    });

    return true;
  }

  static async _updateRewardInManifest(manifest, sectorId, rewardId, transitionFn) {
    if (!manifest || !manifest.pageId || !manifest.journalId) return false;

    const sector = (manifest.sectors || []).find(s => s.sectorId === sectorId);
    if (!sector || !Array.isArray(sector.rewards)) return false;

    let targetReward = null;
    for (const entry of sector.rewards) {
      const rewardObj = entry.reward || entry;
      if (rewardObj.rewardId === rewardId) {
        targetReward = rewardObj;
        break;
      }
    }

    if (!targetReward) return false;

    transitionFn(targetReward);

    const cleanManifest = stripLedgerRuntimeFields(manifest);
    const journal = game.journal.get(manifest.journalId);
    const page = journal?.pages?.get(manifest.pageId);
    if (!journal || !page) return false;

    const html = this._renderManifestToHtml(cleanManifest);
    await page.update({ "text.content": html });
    return true;
  }

  static async discoverReward(manifest, sectorId, rewardId) {
    return this._updateRewardInManifest(manifest, sectorId, rewardId, reward => {
      RewardStateManager.discoverReward(reward);
    });
  }

  static async claimReward(manifest, sectorId, rewardId) {
    return this._updateRewardInManifest(manifest, sectorId, rewardId, reward => {
      RewardStateManager.claimReward(reward);
    });
  }

  static async resolveReward(manifest, sectorId, rewardId) {
    return this._updateRewardInManifest(manifest, sectorId, rewardId, reward => {
      RewardStateManager.resolveReward(reward);
    });
  }

  static async applyPendingEvents(
    manifest
  ) {

    const ledger =
      EventLedgerManager.getAll();

    let updated =
      structuredClone(manifest);

    for (
      const event of ledger
    ) {

      updated =
        WorldStateEvolutionManager
        .applyEvent(
          updated,
          event
        );
    }

    return updated;
  }

  /**
   * Validates reachability via BFS and repairs isolated sectors by connecting them to the first reachable sector.
   * @param {Object} manifest
   * @returns {Object}
   */
  static validateAndRepairGraph(manifest) {
    if (!manifest || !Array.isArray(manifest.sectors) || manifest.sectors.length === 0) return manifest;

    const output = clone(manifest);
    const sectorMap = new Map(output.sectors.map(sector => [sector.sectorId, sector]));
    const startId = output.sectors[0]?.sectorId;
    const reachable = this._getReachableSectors(startId, sectorMap);

    if (reachable.size === output.sectors.length) return output;

    const anchorId = startId;
    for (const sector of output.sectors) {
      if (reachable.has(sector.sectorId) || sector.sectorId === anchorId) continue;
      sector.connections = Array.isArray(sector.connections) ? sector.connections : [];
      if (!sector.connections.some(connection => (typeof connection === "string" ? connection : connection?.to) === anchorId)) {
        sector.connections.push({ to: anchorId, connectionType: "AUTO_REPAIR", required: false });
      }
      const anchor = sectorMap.get(anchorId);
      anchor.connections = Array.isArray(anchor.connections) ? anchor.connections : [];
      if (!anchor.connections.some(connection => (typeof connection === "string" ? connection : connection?.to) === sector.sectorId)) {
        anchor.connections.push({ to: sector.sectorId, connectionType: "AUTO_REPAIR", required: false });
      }
    }

    return output;
  }

  /**
   * Performs an undirected BFS traversal.
   * @private
   */
  static _getReachableSectors(startId, sectorMap) {
    if (!sectorMap.has(startId)) return new Set();

    const visited = new Set([startId]);
    const queue = [startId];

    while (queue.length) {
      const currentId = queue.shift();
      const current = sectorMap.get(currentId);
      const neighbors = new Set();

      for (const connection of current.connections || []) {
        const to = typeof connection === "string" ? connection : connection?.to;
        if (to) neighbors.add(to);
      }

      for (const [candidateId, candidate] of sectorMap.entries()) {
        if (candidateId === currentId) continue;
        if ((candidate.connections || []).some(connection => (typeof connection === "string" ? connection : connection?.to) === currentId)) {
          neighbors.add(candidateId);
        }
      }

      for (const nextId of neighbors) {
        if (!sectorMap.has(nextId) || visited.has(nextId)) continue;
        visited.add(nextId);
        queue.push(nextId);
      }
    }

    return visited;
  }

  static _sectorsAreConnected(firstId, secondId, sectorMap) {
    const first = sectorMap.get(firstId);
    const second = sectorMap.get(secondId);
    if (!first || !second) return false;
    return [first, second].some((sector, idx) => {
      const target = idx === 0 ? secondId : firstId;
      return (sector.connections || []).some(connection => (typeof connection === "string" ? connection : connection?.to) === target);
    });
  }

  /**
   * Live-updates a specific editable field of a sector inside the active journal manifest page.
   */
  static async updateSectorField(sectorId, fieldName, newValue) {
    const active = this.getActiveManifest();
    if (!active || !active.pageId || !active.journalId) return false;
    if (!EDITABLE_FIELDS.has(fieldName) || GEOMETRY_FIELDS.has(fieldName)) {
      ui.notifications?.warn?.(`AI Director | Field "${fieldName}" is not ledger-editable.`);
      return false;
    }

    const manifest = stripLedgerRuntimeFields(active);
    const sector = manifest.sectors.find(item => item.sectorId === sectorId);
    if (!sector) {
      ui.notifications?.warn?.(`AI Director | Sector "${sectorId}" was not found.`);
      return false;
    }

    sector[fieldName] = parseFieldValue(fieldName, newValue);

    sector.promptMetadata =
      sector.promptMetadata &&
      typeof sector.promptMetadata === "object"
        ? sector.promptMetadata
        : {};

    if (fieldName === "playerViewPrompt") {
      sector.promptMetadata
        .playerViewPromptSource =
          "MANUAL";
    }

    if (fieldName === "tacticalMapPrompt") {
      sector.mapPrompt =
        sector.tacticalMapPrompt;

      sector.promptMetadata
        .tacticalMapPromptSource =
          "MANUAL";
    }

    if (fieldName === "mapPrompt") {
      sector.tacticalMapPrompt =
        sector.mapPrompt;

      sector.promptMetadata
        .tacticalMapPromptSource =
          "MANUAL";
    }

    if (
      fieldName === "displayName" &&
      !sector.name
    ) {
      sector.name =
        sector.displayName;
    }

    const journal = game.journal.get(active.journalId);
    const page = journal?.pages?.get(active.pageId);
    if (!journal || !page) return false;

    const html = this._renderManifestToHtml(manifest);
    await page.update({ "text.content": html });

    const activeScene = canvas?.scene;
    if (activeScene?.getFlag?.(MODULE_ID, "sectorId") === sectorId) {
      await AtmosphereEngine.applyAtmosphereToScene(activeScene, sector);
    }

    ui.notifications?.info?.(`AI Director | Updated ${fieldName} for ${sector.displayName || sector.name || sectorId}.`);
    return true;
  }

  static _parseManifestFromHtml(html, pageId, journalId) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const manifestRoot = doc.querySelector("[data-manifest-json]");
    if (manifestRoot?.dataset?.manifestJson) {
      try {
        const parsed = JSON.parse(manifestRoot.dataset.manifestJson);
        if (parsed && Array.isArray(parsed.sectors)) return { ...parsed, pageId, journalId };
      } catch (error) {
        console.warn("AI Director | Embedded manifest JSON could not be parsed.", error);
      }
    }
    return null;
  }

  static _renderManifestToHtml(manifest) {
    return renderManifestMemoryHtml(stripLedgerRuntimeFields(manifest));
  }
}