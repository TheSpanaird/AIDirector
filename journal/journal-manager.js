// modules/ai-director/scripts/journal/journal-manager.js

import { buildPrompt } from "../ai/prompt-builder.js"; 
import { OllamaClient } from "../api/ollama-client.js"; 
import { MODULE_ID } from "../settings.js";

/**
 * Ensures the minimum folder infrastructure exists in the world database
 * so the AI engine has documents to read and write to from day one.
 */
export async function ensureJournalInfrastructure() {
  const foldersToCreate = ["AI Director Canon", "AI Director Memory", "Session Reports"];
  
  for (const folderName of foldersToCreate) {
    let folder = game.folders.contents.find(f => f.name === folderName && f.type === "JournalEntry");
    if (!folder) {
      await Folder.create({ name: folderName, type: "JournalEntry" });
      console.log(`AI Director | Created missing structural folder: ${folderName}`);
    }
  }
}

/**
 * Compiles active chat session context, requests a structured historical chronicle from the AI Director,
 * and commits the result cleanly into a designated Foundry VTT Campaign Log Journal Entry.
 * @param {Object} contextOptions - Active session tokens, chat tracking logs, and active system settings.
 */
export async function autoLogSceneToJournal(contextOptions = {}) {
  // Enforce structural folder presence before conducting read/write queries
  await ensureJournalInfrastructure();

  // 1. Enforce Journal Generation mode parameters
  contextOptions.mode = "journal_generation";
  contextOptions.systemSetting = contextOptions.systemSetting || game.settings.get(MODULE_ID, "systemType") || "generic";

  console.log("AI Director | AUTOMATED LOG SEQUENCE TRIGGERED");

  // Helper: get latest entry text from a folder name (Preserved core memory functionality)
  function getLatestJournalEntry(folderName) {
    const folder = game.folders.contents.find(f =>
      f.name === folderName && f.type === "JournalEntry"
    );

    if (!folder) return "";

    const entries = game.journal.contents
      .filter(j => j.folder?.id === folder.id)
      .sort((a, b) => b._stats.createdTime - a._stats.createdTime);

    if (!entries.length) return "";

    const entry = entries[0];

    // Extract all text pages
    const pages = entry.pages?.contents || [];
    return pages
      .filter(p => p.type === "text")
      .map(p => p.text?.content || "")
      .join("\n");
  }

  // Pull both memory sources dynamically to inject directly into the contextual workspace
  let aiMemoryText = getLatestJournalEntry("AI Director Memory");
  let playerJournalText = getLatestJournalEntry("Session Reports");

  // Gather current chat history text buffer if not explicitly passed, utilizing strict DOM parsing
  if (!contextOptions.chatHistoryText) {
    const maxMessages = 300; // Scaled to capture rich context matching manual execution
    const messages = game.messages.contents.slice(-maxMessages);
    
    contextOptions.chatHistoryText = messages
      .map(m => {
        const user = m.speaker.alias || m.author?.name || "Unknown";
        const div = document.createElement("div");
        div.innerHTML = m.content ?? "";
        const text = (div.textContent || "").trim();

        // Strip UI/system automation lines from polluting engine updates
        if (
          text.match(/Humanity Loss/i) ||
          text.match(/^Initiative/i) ||
          text.match(/Total Mods/i)
        ) return null;

        if (text.length < 6) return null;
        return `${user}: ${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  // 2. Generate the exact prompt instructions using strict output rule mapping
  const promptData = `
You are summarizing a session using provided sources.

CRITICAL RULES:
- ONLY use information explicitly present in the inputs
- DO NOT invent events, characters, or details
- Prefer AI Director Memory over Player Journal if there is a conflict
- Maintain continuity between previous session and current events
- If something is unclear, omit it
- You MAY summarize or interpret actions into narrative, but do NOT add anything not explicitly supported by the inputs

AI DIRECTOR MEMORY (PRIMARY CANON):
${aiMemoryText || "None"}

PLAYER SESSION REPORT (SECONDARY):
${playerJournalText || "None"}

CURRENT SESSION CHAT:
${contextOptions.chatHistoryText}

OUTPUT FORMAT (MANDATORY):

You MUST include EXACTLY TWO sections in this order.

PLAYER RECAP:
- Write a narrative retelling of the session
- Do NOT use bullet points
- Do NOT create summaries or lists
- Present events as a flowing story
- Include important actions, dialogue context, and turning points
- Use prior session context only to maintain continuity
- Do NOT invent events or details

AI MEMORY:
- List ONLY confirmed facts from the current session
- Use concise bullet points
- Include outcomes, NPC state changes, and world changes

IMPORTANT:
- Do NOT create any additional sections
- Do NOT repeat the recap in multiple formats
- Do NOT include headers other than "PLAYER RECAP" and "AI MEMORY"
- If a section has no data, write: None
`;

  ui.notifications.info("AI Director is compiling scene timeline adjustments...");
  
  // 🛠️ FIXED: Await the asynchronous buildPrompt wrapper
  const promptPayload = await buildPrompt("Generate log entry based on this scene interaction.", contextOptions);
  
  // 🛠️ REFACTORED: Unified Ollama Client gateway executing your strict structural rules
  const activeModel = game.settings.get(MODULE_ID, "defaultModel") || "llama3";
  const rawLogOutput = await OllamaClient.generate(promptData, {
    model: activeModel,
    system: promptPayload.system
  });

  if (!rawLogOutput) {
    ui.notifications.error("Failed to generate journal update from the local AI module.");
    return;
  }

  // 4. Split response into discrete pipeline components using original regex architecture
  let playerRecap = "";
  let aiMemory = "";

  let playerMatch = rawLogOutput.match(/PLAYER RECAP[:\s]*([\s\S]*?)AI MEMORY[:\s]*/i);
  let memoryMatch = rawLogOutput.match(/AI MEMORY[:\s]*([\s\S]*)/i);

  if (playerMatch && memoryMatch) {
    playerRecap = playerMatch[1].trim();
    aiMemory = memoryMatch[1].trim();
  } else {
    console.warn("⚠️ Could not split recap output properly; reverting to full response layout fallback.");
    playerRecap = rawLogOutput;
    aiMemory = "";
  }

  // Helpers for structural database output formatting
  function formatForJournal(text) {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\//g, "$1") // Preserved structural cleanup
      .split(/\n\s*\n/)
      .map(p => `<p>${p.trim()}</p>`)
      .join("")
      .replace(/\n/g, "<br>");
  }

  async function writeToJournal(folderName, title, content) {
    let folder = game.folders.contents.find(f =>
      f.name === folderName && f.type === "JournalEntry"
    );

    if (!folder) {
      folder = await Folder.create({
        name: folderName,
        type: "JournalEntry"
      });
    }

    // 🛠️ RESTORED: Matches the VTT database architecture from your original spec
    await JournalEntry.create({
      name: title,
      folder: folder.id,
      pages: [
        {
          name: "Recap",
          type: "text",
          text: {
            content: content,
            format: CONST.JOURNAL_PAGE_FORMATS.HTML
          }
        }
      ]
    });
  }

  console.log("PLAYER RECAP:", playerRecap);
  console.log("AI MEMORY:", aiMemory);

  // 5. WRITEBACK TO STANDALONE TIMELINE JOURNALS
  const timestamp = new Date().toLocaleString();

  if (playerRecap) {
    await writeToJournal(
      "AI Director Canon",
      `Session Recap - ${timestamp}`,
      formatForJournal(playerRecap)
    );
  }

  if (aiMemory) {
    await writeToJournal(
      "AI Director Memory",
      `Memory Update - ${timestamp}`,
      `<pre>${aiMemory}</pre>`
    );
  }

  ui.notifications.info(`Successfully processed automated sequence update at ${timestamp}!`);
}