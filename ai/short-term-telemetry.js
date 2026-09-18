// modules/ai-director/scripts/ai/short-term-telemetry.js

import { OllamaClient } from "../api/ollama-client.js";
import { MODULE_ID } from "../settings.js";

/**
 * Highly Robust RAG Retrieval Engine
 * Scores and extracts only the most relevant snippets from your campaign journals
 * based on keyword frequency and semantic matching against the user's prompt.
 */
export function retrieveRelevantContext(userPrompt, rawJournalText, maxChunks = 3) {
  if (!rawJournalText) return "None";

  // 1. Split the massive journal archive into distinct informational chunks
  const chunks = rawJournalText
    .split(/\n|◄|•|-|--- JOURNAL ENTRY ---/) // Splits by common bullet markers or headers
    .map(c => c.trim())
    .filter(c => c.length > 20); // Filter out empty or uninformative lines

  if (chunks.length <= maxChunks) return chunks.join("\n");

  // 2. Tokenize the user's prompt into search keywords (ignoring common stop words)
  const stopWords = new Set(["the", "a", "and", "is", "of", "to", "in", "i", "you", "he", "she", "they", "we", "it", "on", "at", "for", "with", "what", "how", "where"]);
  const keywords = userPrompt
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Fallback if the user typed something incredibly short or generic
  if (keywords.length === 0) return chunks.slice(-maxChunks).join("\n");

  // 3. Score every chunk based on keyword matches
  const scoredChunks = chunks.map(chunk => {
    const lowerChunk = chunk.toLowerCase();
    let score = 0;

    keywords.forEach(keyword => {
      // Reward multiple occurrences of highly specific campaign words
      const regex = new RegExp(`\\b${keyword}\\b`, "g");
      const matches = lowerChunk.match(regex);
      if (matches) {
        score += matches.length * 2; // Give heavy weight to direct matches
      } else if (lowerChunk.includes(keyword)) {
        score += 0.5; // Partial or substring matches get minor weight
      }
    });

    return { chunk, score };
  });

  // 4. Sort by highest score first and grab the top results
  const topResults = scoredChunks
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)
    .map(item => item.chunk);

  // FIXED FALLBACK: Prevents blind text slicing that causes hallucinations when data doesn't exist
  if (topResults.length === 0) {
    return "NO_MATCHING_CANON_DATA_FOUND";
  }

  return topResults.join("\n");
}

export const getOrCreateMemoryJournal = async () => {
  let journal = game.journal?.contents?.find(j => j.name === "AI Director Memory");

  if (!journal) {
    journal = await JournalEntry.create({
      name: "AI Director Memory"
    });
  }

  let page = journal.pages.contents[0];

  if (!page) {
    const createdPages = await journal.createEmbeddedDocuments("JournalEntryPage", [
      {
        name: "Memory",
        type: "text",
        text: { content: "" }
      }
    ]);
    page = createdPages[0];
  }

  return { journal, page };
};

export const getJournalMemory = async () => {
  const { page } = await getOrCreateMemoryJournal();
  return page?.text?.content || "";
};

export const setJournalMemory = async (text) => {
  const { page } = await getOrCreateMemoryJournal();
  await page.update(
    { text: { content: text } },
    { noHook: true, render: false } // SAFE GUARD: Prevent recursive webhook updates
  );
};

export const getMemory = () => {
  try {
    return game.settings.get(MODULE_ID, "storyMemory") || "";
  } catch (err) {
    return "";
  }
};

export const setMemory = async (text) => {
  try {
    await game.settings.set(MODULE_ID, "storyMemory", text);
    await setJournalMemory(text);
  } catch (err) {
    console.warn("AI Director storyMemory setting is not registered.", err);
  }
};

/**
 * Searches specific journal folders by name to find the newest text data
 */
export function getLatestJournalEntry(folderName) {
  const folder = game.folders.contents.find(f => f.name === folderName && f.type === "JournalEntry");
  if (!folder) return "";

  const entries = game.journal.contents
    .filter(j => j.folder?.id === folder.id)
    .sort((a, b) => (b._stats?.createdTime || 0) - (a._stats?.createdTime || 0));

  if (!entries.length) return "";
  const entry = entries[0];

  const pages = entry.pages?.contents || [];
  return pages
    .filter(p => p.type === "text")
    .map(p => p.text?.content || "")
    .join("\n");
}

/**
 * Formats plain text markdown strings safely into HTML tags for standard Foundry Journal layouts
 */
function formatForJournal(text) {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\//g, "<strong>$1</strong>") // Safe bolding
    .split(/\n\s*\n/)
    .map(p => `<p>${p.trim()}</p>`)
    .join("")
    .replace(/\n/g, "<br>");
}

/**
 * Creates a brand new individual journal asset inside a specific Folder
 */
async function writeToJournal(folderName, title, content) {
  let folder = game.folders.contents.find(f => f.name === folderName && f.type === "JournalEntry");
  if (!folder) folder = await Folder.create({ name: folderName, type: "JournalEntry" });

  await JournalEntry.create({
    name: title,
    folder: folder.id,
    pages: [{ name: "Recap", type: "text", text: { content: formatForJournal(content) } }]
  }, { renderHook: false });
}

/**
 * Overwrites or creates a master single state tracking entry page
 */
async function upsertJournalEntry(folderName, title, content) {
  let folder = game.folders.contents.find(f => f.name === folderName && f.type === "JournalEntry");
  if (!folder) folder = await Folder.create({ name: folderName, type: "JournalEntry" });

  let entry = game.journal.contents.find(j => j.folder?.id === folder.id && j.name === title);
  if (!entry) {
    await JournalEntry.create({
      name: title,
      folder: folder.id,
      pages: [{ name: "Memory", type: "text", text: { content: content } }]
    }, { renderHook: false });
    return;
  }

  const textPage = entry.pages.find(p => p.type === "text");
  if (textPage) {
    await textPage.update(
      { "text.content": content },
      { noHook: true, render: false }
    );
  }
}

/**
 * Stage 2: Dispatches old and new elements to local Ollama instance to deduce a clean deduplicated summary
 */
async function mergeMemoryWithAI(oldMemory, newMemory) {
  if (!oldMemory) return newMemory;
  if (!newMemory) return oldMemory;

  const prompt = `Merge OLD and NEW memory bullet lists cleanly. Remove contradictions and keep it concise.\n\nOLD:\n${oldMemory}\n\nNEW:\n${newMemory}`;
  const activeModel = game.settings.get(MODULE_ID, "defaultModel") || "hermes3";

  // Safe offload to centralized client gateway execution architecture
  const response = await OllamaClient.generate(prompt, { model: activeModel });
  return response || newMemory;
}

/**
 * Existing incremental short-term updates
 */
export const updateStoryMemory = async (sourceText, buildPrompt) => {
  try {
    const existingMemory = getMemory();
    const journalText = await getJournalMemory();

    const memoryPrompt = await buildPrompt(`
You are maintaining persistent RPG campaign memory.

CRITICAL CANON DATA:
${journalText}

EXISTING MEMORY:
${existingMemory}

NEW MATERIAL:
${sourceText}

Return ONLY updated bullet points.
`);

    const activeModel = game.settings.get(MODULE_ID, "defaultModel") || "hermes3";
    const response = await OllamaClient.generate(memoryPrompt.user, {
      model: activeModel,
      system: memoryPrompt.system || "",
      options: { temperature: 0.2, num_predict: 120 }
    });

    if (response) {
      await setMemory(response);
    }
  } catch (err) {
    console.warn("ai-director | Short term incremental tracking failure", err);
  }
};

/**
 * Logs a social interaction to the persistent AI memory
 * Ensures trust shifts are recorded in the campaign canon
 */
export async function logSocialInteraction(actorName, sentimentModifier) {
  try {
    const currentMemory = await getJournalMemory();
    const timestamp = new Date().toLocaleTimeString();
    const sentimentLabel = sentimentModifier > 0 ? "Positive" : "Negative";
    
    // Create a concise log entry
    const interactionLog = `• [${timestamp}] Social interaction with ${actorName}: ${sentimentLabel} shift (${sentimentModifier > 0 ? '+' : ''}${sentimentModifier}).`;
    
    // Update the journal memory
    const updatedMemory = currentMemory ? `${currentMemory}\n${interactionLog}` : interactionLog;
    await setMemory(updatedMemory);
    
    console.log(`AI Director | Logged social interaction for ${actorName} to memory.`);
  } catch (err) {
    console.warn("ai-director | Failed to log social interaction to memory", err);
  }
}