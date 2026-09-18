// modules/ai-director/scripts/ai/journal-compiler.js

/**
 * Agnostic Campaign Ledger Engine
 * Compiles context vectors from any tabletop system into stylized journal chronologies.
 */
export async function compileNarrativeEvent(hookId, actorName, cleanDialogue = "") {
  if (typeof game === "undefined") return;

  console.log(`AI Director | Journal Compiler: Building universal timeline record for hook: "${hookId}"`);

  // 1. Gather agnostic environmental context vectors
  const currentScene = game.scenes?.active?.name || "Uncharted Sector";
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // 🛠️ FIXED: Safe check to handle optional or undefined dialogue inputs
  const dialogString = cleanDialogue || "Transmission details encrypted or spoken in confidence.";
  const truncatedSpeech = dialogString.length > 180 
    ? `"${dialogString.substring(0, 175)}..."` 
    : `"${dialogString}"`;

  // 2. Locate or auto-create the Master Campaign Chronicle
  let masterChronicle = game.journal.find(j => j.name === "The Director's Chronicles");
  if (!masterChronicle) {
    if (!game.user.isGM) {
      // If a player triggers this, request the GM client to initialize the journal via socket
      game.socket.emit("module.ai-director", { action: "initializeChronicle" });
      return;
    }
    masterChronicle = await JournalEntry.create({
      name: "The Director's Chronicles",
      "ownership.default": CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
    });
  }

  // 3. Build a universal, system-agnostic HTML Component block
  const entryHtml = `
    <div class="ai-director-ledger-entry" style="border-left: 3px solid var(--color-border-accent, #ffaa00); padding-left: 10px; margin-bottom: 15px;">
      <span class="ledger-meta" style="font-size: 0.85em; opacity: 0.7; display: block;">
        🕒 <strong>${timestamp}</strong> | 📍 <em>${currentScene}</em>
      </span>
      <p class="ledger-trigger" style="margin: 4px 0;">
        🚨 <strong>Transmission / Clue Discovered:</strong> <code>${hookId}</code>
      </p>
      <blockquote class="ledger-quote" style="font-style: italic; font-size: 0.95em; margin: 5px 0; opacity: 0.85;">
        <strong>${actorName}</strong>: ${truncatedSpeech}
      </blockquote>
    </div>
  `;

  // 4. Inject entry into the first text page of our Chronicle Document safely
  try {
    let targetPage = masterChronicle.pages.contents[0];
    
    if (!targetPage) {
      // Initialize the primary text canvas page if it is empty
      targetPage = await masterChronicle.createEmbeddedDocuments("JournalEntryPage", [{
        name: "Timeline Logs",
        type: "text",
        text: { content: `<h2>Campaign Log Entries</h2>\n${entryHtml}`, format: CONST.JOURNAL_PAGE_FORMATS.HTML }
      }]);
    } else {
      // Append the new ledger piece seamlessly onto the existing runtime text stream
      const originalContent = targetPage.text?.content || "";
      const updatedContent = originalContent.replace("</h2>", `</h2>\n${entryHtml}`);
      
      await targetPage.update({ "text.content": updatedContent });
    }
    console.log(`AI Director | Journal Compiler: Successfully appended event metadata to timeline.`);
  } catch (error) {
    console.error(`AI Director | Journal Compiler Error: Failed to append text data onto ledger page.`, error);
  }
}