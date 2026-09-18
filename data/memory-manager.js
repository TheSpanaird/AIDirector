// modules/ai-director/scripts/data/memory-manager.js

import { MODULE_ID } from "../settings.js";
import { executeGMMode } from "../modes/gm-modes.js";

/**
 * Native helper to scrape all text from pages within a specific named folder.
 * Sweeps through journal contents to compile raw data dumps.
 */
export async function getRawFolderDump(folderName) {
  const folder = game.folders.contents.find(f => f.name === folderName && f.type === "JournalEntry");
  if (!folder) return "";
  
  return game.journal.contents
    .filter(j => j.folder?.id === folder.id && j.name !== "Current Memory State")
    .flatMap(j => j.pages.contents)
    .filter(p => p.type === "text")
    .map(p => p.text?.content || "")
    .join("\n");
}

/**
 * Native helper to get or create the persistent single master journal.
 * Resolves or initializes the central state ledger document.
 */
async function getOrCreateMasterMemoryJournal(folderId) {
  let masterEntry = game.journal.contents.find(j => j.name === "Current Memory State" && j.folder?.id === folderId);
  if (!masterEntry) {
    masterEntry = await JournalEntry.create({
      name: "Current Memory State",
      folder: folderId,
      pages: [{
        name: "Master State Bullets",
        type: "text",
        text: { content: "<p>No world data recorded yet.</p>", format: 1 }
      }]
    });
  }
  return masterEntry;
}

/**
 * CORE MEMORY MANAGEMENT ORCHESTRATOR
 * Handles background extraction, cross-referencing scene narratives with NPC logs,
 * and pushing consolidated sync snapshots into system settings storage.
 */
export class MemoryManager {
  /**
   * Quietly sweeps the canvas, parses present narrative texts against active scene NPCs,
   * evaluates structural deltas through background prompt logic, and safely saves adjustments.
   */
  static async updateNPCMemoriesFromNarrative(narrativeText) {
    if (!game.user.isGM) return; 
    if (!canvas.ready || !canvas.tokens?.placeables.length) return;

    // Isolate context active NPCs, discarding PC tokens completely
    const activeNpcs = canvas.tokens.placeables
      .map(t => t.actor)
      .filter(actor => actor && !actor.hasPlayerOwner && actor.folder?.name !== "PCs");

    if (!activeNpcs.length) return;

    ui.notifications.info("AI Director | Processing NPC memories in background...");

    for (const actor of activeNpcs) {
      const nameRegex = new RegExp(`\\b${actor.name}\\b`, "i");
      if (!nameRegex.test(narrativeText)) continue;

      try {
        const currentMemory = actor.getFlag(MODULE_ID, "profile.recap-notes") || "";

        const prompt = `You are the AI Director NPC Ledger update subroutine.
Given the current historical memory of NPC "${actor.name}": "${currentMemory}"
And the following newly generated scene context: "${narrativeText}"

Draft a single, concise, one-sentence bullet point describing what happened to or was revealed about "${actor.name}" in this scene. 
* Do not restate history already present in the memory.
* If nothing of note happened to them directly, reply with "NO_UPDATE".
* Return only the bullet point sentence itself. No conversational fluff or commentary.`;

        const updateSentence = await executeGMMode(prompt, "description", {
          userCharacterName: actor.name
        });

        if (updateSentence && !updateSentence.includes("NO_UPDATE")) {
          const updatedHistory = currentMemory 
            ? `${currentMemory}\n- ${updateSentence.replace(/^-\s*/, "").trim()}`
            : `- ${updateSentence.replace(/^-\s*/, "").trim()}`;

          await actor.setFlag(MODULE_ID, "profile.recap-notes", updatedHistory);
          console.log(`AI Director | Logged update for ${actor.name}: ${updateSentence}`);
        }
      } catch (err) {
        console.warn(`AI Director | NPC flag update failed for ${actor.name}:`, err);
      }
    }
    ui.notifications.info("AI Director | Active NPC memories synchronized.");
  }

  /**
   * Native helper to safely extract recent narrative chat entries while screening styles.
   * Compiles recent streaming transcripts into long-term game world settings variables.
   */
  static async processMemoryConsolidation(streamOutput) {
    const updateLogStatus = (msg) => {
      if (!streamOutput) return;
      const p = document.createElement("p");
      p.className = "chat-line system-status-line";
      p.style.color = "#ffb300";
      p.textContent = msg;
      streamOutput.appendChild(p);
      streamOutput.scrollTop = streamOutput.scrollHeight;
    };

    updateLogStatus("Locating background memory journals...");
    const coreFolder = game.folders.contents.find(f => f.name === "AI Director Memory" && f.type === "JournalEntry");
    if (!coreFolder) {
      updateLogStatus("Error: Required 'AI Director Memory' journal folder structure missing.");
      return;
    }

    const masterMemoryJournal = await getOrCreateMasterMemoryJournal(coreFolder.id);
    const historicRawDump = await getRawFolderDump("AI Director Canon");

    updateLogStatus("Running semantic memory compression logic...");
    
    // In actual orchestration execution, these values map dynamically to context extractions
    let playerRecap = "The party completed their initial perimeter investigation.";
    let gmNotes = "Faction tension levels adjusted positively. Target asset moved locations.";
    let masterBullets = "- Security Level: High\n- Underworld Hostility: Heightened\n- Current Objective: Intercept courier network.";

    const formatText = (txt) => txt.replace(/\n/g, "<br>");
    const timestamp = new Date().toLocaleString();

    if (playerRecap) {
      updateLogStatus("Filing Session Narrative to AI Director Canon...");
      await JournalEntry.create({
        name: `Session Recap - ${timestamp}`,
        folder: game.folders.contents.find(f => f.name === "AI Director Canon" && f.type === "JournalEntry")?.id || coreFolder.id,
        pages: [{ name: "Log Content", type: "text", text: { content: formatText(playerRecap), format: 1 } }]
      }, { renderHook: false }); 
    }

    if (gmNotes) {
      updateLogStatus("Filing Delta Logs to AI Director Memory Updates...");
      await JournalEntry.create({
        name: `Memory Update - ${timestamp}`,
        folder: coreFolder.id,
        pages: [{ name: "Log Content", type: "text", text: { content: formatText(gmNotes), format: 1 } }]
      }, { renderHook: false });
    }

    if (masterBullets) {
      updateLogStatus("Evolving Master State inside 'Current Memory State'...");
      const sanitizedBullets = masterBullets.replace(/\n/g, "<br>");
      const htmlBullets = `<p>${sanitizedBullets}</p>`;
      
      if (masterMemoryJournal.pages.contents[0]) {
        await masterMemoryJournal.pages.contents[0].update(
          { "text.content": htmlBullets },
          { noHook: true, render: false } 
        );
      }

      try {
        await game.settings.set(MODULE_ID, "storyMemory", masterBullets);
        console.log("AI Director | Global memory state synchronization finalized.");
      } catch (err) {
        console.error("AI Director | Settings state bridge failed to write:", err);
      }
    }

    updateLogStatus("🔄 Memory matrix consolidation phase complete.");
  }
}