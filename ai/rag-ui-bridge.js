// modules/ai-director/scripts/ai/rag-ui-bridge.js

import { getRelevantContext } from "./rag-engine.js";

/**
 * PURE READ-ONLY HARVESTER FOR THE UI
 * Completely isolated from core game loops.
 * Gathers tracking metrics and formats payloads natively for partial template data loops.
 */
export async function getLiveUIContext() {
  const journalEntries = [];
  let ragChunks = [];

  try {
    // 1. Gather targeted journal folder metadata safely
    const targetFolders = ["AI Director Memory", "AI Director Canon"];
    const folders = game.folders.contents.filter(f => targetFolders.includes(f.name) && f.type === "JournalEntry");
    
    for (const folder of folders) {
      const entries = game.journal.contents.filter(j => j.folder?.id === folder.id);
      for (const entry of entries) {
        // Formatted specifically to match the properties handled by journal-log.hbs
        journalEntries.push({
          id: entry.id,
          timestamp: folder.name, // Display folder grouping context as the timestamp header
          content: `${entry.name} (${entry.pages.size} pages)`
        });
      }
    }

    // 2. Call existing RAG engine using a safe default query vector
    const defaultContext = await getRelevantContext("current location status");
    
    if (defaultContext && defaultContext !== "NO_MATCHING_CANON_DATA_FOUND") {
      const rawBlocks = defaultContext.split("\n\n").slice(0, 5);
      
      // Formatted specifically to match the properties handled by rag-library.hbs
      ragChunks = rawBlocks.map((chunk, idx) => {
        // Extract the first bullet line or title text if available
        const lines = chunk.split("\n").filter(l => l.trim().length > 0);
        const titleText = lines[0] ? lines[0].replace(/[•\-*]/g, "").trim() : "Semantic Vector Chunk";
        
        return {
          id: `vector-${idx}`,
          title: titleText,
          score: "0.85 (Cached Baseline)",
          timestamp: new Date().toLocaleTimeString()
        };
      });
    } else {
      ragChunks = [{
        id: "vector-idle",
        title: "System Idle",
        score: "0.00",
        timestamp: new Date().toLocaleTimeString()
      }];
    }

  } catch (err) {
    console.warn("AI Director UI Bridge | Safe context harvesting encountered an error:", err);
  }

  return {
    journalEntries,
    ragChunks
  };
}