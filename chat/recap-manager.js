import { buildRecapPrompt } from "/modules/ai-director/scripts/ai/prompt-recap.js";
// 🛡️ RECONSTRUCTION CONTRACT: Reusing the verified 3-journal database logging engine
import { autoLogSceneToJournal } from "/modules/ai-director/scripts/journal/journal-manager.js";
// 📘 VOLUME CHRONICLE INTEGRATION: Imports the 20-page auto-incrementing engine
import { getOrCreateActiveVolumePage } from "../journal/volume-helper.js";

/**
 * Orchestrator for compiling and committing session summaries.
 * Scrapes campaign records, invokes local LLM via Ollama, and distributes logs.
 */
export async function executeSessionRecap() {
  ui.notifications.info("AI Director: Compiling session timeline logs...");

  // 1. Scrape the last 150 chat log entries as context
  const recentChatLog = game.messages.contents
    .slice(-150)
    .map(m => `[${m.alias || m.user?.name}]: ${m.content}`)
    .join("\n");

  // 2. Locate master campaign memory state journal entries
  const memoryJournal = game.journal.find(j => j.name === "Current Memory State");
  const currentMemoryState = memoryJournal ? memoryJournal.pages.contents[0]?.text?.content || "" : "";

  // 3. Gather historical logs from the archives folder
  const archiveFolder = game.folders.find(f => f.name === "Session Recaps" && f.type === "JournalEntry");
  const campaignArchives = archiveFolder 
    ? game.journal.contents
        .filter(j => j.folder?.id === archiveFolder.id)
        .map(j => j.name + "\n" + (j.pages.contents[0]?.text?.content || ""))
        .join("\n\n")
    : "";

  // 4. Build prompt via our prompt file
  const { system, user } = buildRecapPrompt(currentMemoryState, campaignArchives, recentChatLog);

  // 5. Query local AI service (Ollama)
  try {
    // 🛠️ RECONSTRUCTION CONTRACT: Bumped num_predict to 4000 to maximize storytelling detail and prevent truncation
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "hermes3",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        options: { temperature: 0.3, num_predict: 4000 },
        stream: false
      })
    });

    if (!response.ok) throw new Error(`Inference Generation Failure: ${response.statusText}`);
    const data = await response.json();
    const rawAiResponse = data.message?.content || "";

    // 6. Parse out the XML blocks
    const playerRecap = rawAiResponse.match(/<PLAYER_RECAP>([\s\S]*?)<\/PLAYER_RECAP>/)?.[1]?.trim() || "";
    const gmNotes = rawAiResponse.match(/<GM_NOTES>([\s\S]*?)<\/GM_NOTES>/)?.[1]?.trim() || "";
    const cumulativeBullets = rawAiResponse.match(/<CUMULATIVE_BULLETS>([\s\S]*?)<\/CUMULATIVE_BULLETS>/)?.[1]?.trim() || "";

    // 7. Commit the updated state back into your Master Memory log
    // [PRESERVED IMMUTABLE]: This remains untouched to secure the current active short-term memory loop!
    if (cumulativeBullets && memoryJournal) {
      const targetPage = memoryJournal.pages.contents[0];
      if (targetPage) {
        await targetPage.update({ "text.content": `<ul>${cumulativeBullets.split("\n").map(b => `<li>${b.replace(/^-\s*/, "")}</li>`).join("")}</ul>` });
      }
    }

    // 8. Output the narrative chronicle directly to the game chat for your players
    if (playerRecap) {
      await ChatMessage.create({
        speaker: { alias: "Campaign Archivist" },
        content: `<h3>Session Chronicle Summary</h3>\n${playerRecap}`,
        whisper: []
      });
    }

    // 9. 🛠️ INTEGRATION STEP: Direct the data vectors to write to the 3 distinct volume journals
    const timestamp = new Date().toLocaleString();
    const formattedTimestamp = new Date().toLocaleDateString();
    
    // Helper formatter to convert raw text paragraphs neatly into HTML for Foundry pages
    const formatHTML = (text) => text.split(/\n\s*\n/).map(p => `<p>${p.trim()}</p>`).join("").replace(/\n/g, "<br>");

    // Save to AI Director Canon Volume
    if (playerRecap) {
      await getOrCreateActiveVolumePage(
        "AI Director Canon",
        `Session Recap - ${formattedTimestamp}`,
        formatHTML(playerRecap)
      );
    }

    // Save to AI Director Memory Volume
    if (gmNotes) {
      await getOrCreateActiveVolumePage(
        "AI Director Memory",
        `AI Memory Delta - ${formattedTimestamp}`,
        formatHTML(gmNotes)
      );
    }

    // Save to Session Reports Volume
    if (cumulativeBullets) {
      const bulletListHtml = `<ul>${cumulativeBullets.split("\n").map(b => `<li>${b.replace(/^-\s*/, "")}</li>`).join("")}</ul>`;
      await getOrCreateActiveVolumePage(
        "Session Reports",
        `Timeline State - ${formattedTimestamp}`,
        bulletListHtml
      );
    }

    ui.notifications.info("AI Director: Session recap successfully compiled and synced to Volume Chronicles.");
    return { playerRecap, gmNotes, cumulativeBullets };

  } catch (error) {
    console.error("AI Director | Session Recap Pipeline Error:", error);
    ui.notifications.error("AI Director: Failed to execute session recap inference cycle.");
    throw error;
  }
}