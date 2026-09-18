// modules/ai-director/scripts/journal/volume-helper.js

/**
 * Dynamic Volume & Page Manager for AI Director Journals
 * Enforces a strict limit of 20 pages per Volume, auto-incrementing when full.
 */
export async function getOrCreateActiveVolumePage(folderName, pageTitle, htmlContent) {
  // 1. Locate or create the target parent directory folder
  let folder = game.folders.contents.find(f => f.name === folderName && f.type === "JournalEntry");
  if (!folder) {
    folder = await Folder.create({ name: folderName, type: "JournalEntry" });
  }

  // 2. Find all existing volumes in this folder, sorted by their volume number
  const volumePrefix = `${folderName} (Vol.`;
  const volumes = game.journal.contents
    .filter(j => j.folder?.id === folder.id && j.name.startsWith(volumePrefix))
    .sort((a, b) => {
      const volA = parseInt(a.name.match(/\(Vol\.\s*(\d+)\)/)?.[1] || "1", 10);
      const volB = parseInt(b.name.match(/\(Vol\.\s*(\d+)\)/)?.[1] || "1", 10);
      return volA - volB;
    });

  let targetVolume = null;
  let currentVolNum = 1;

  if (volumes.length > 0) {
    // Check the latest active volume
    const latestVolume = volumes[volumes.length - 1];
    const pageCount = latestVolume.pages?.size || 0;

    if (pageCount < 20) {
      targetVolume = latestVolume;
    } else {
      // Current volume is capped at 20 pages! Increment and prepare to spawn next volume.
      const lastVolNum = parseInt(latestVolume.name.match(/\(Vol\.\s*(\d+)\)/)?.[1] || "1", 10);
      currentVolNum = lastVolNum + 1;
    }
  }

  // 3. If no active volume exists under the 20-page threshold, spawn the next volume
  if (!targetVolume) {
    const newVolumeName = `${folderName} (Vol. ${currentVolNum})`;
    targetVolume = await JournalEntry.create({
      name: newVolumeName,
      folder: folder.id,
      pages: []
    }, { renderHook: false });
    
    console.log(`AI Director | Spawned a new campaign ledger: "${newVolumeName}"`);
  }

  // 4. Append the beautifully titled page to the active volume
  const createdPages = await targetVolume.createEmbeddedDocuments("JournalEntryPage", [{
    name: pageTitle,
    type: "text",
    text: {
      content: htmlContent,
      format: 1 // V13 Standard integer assignment for clean HTML
    }
  }], { renderHook: false });

  return createdPages[0];
}