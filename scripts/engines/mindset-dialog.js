// modules/ai-director/scripts/apps/mindset-dialog.js

/**
 * UI Component: Mindset Adjustment Dialog
 * Renders a clean, comprehensive configuration console for an NPC's full profile matrix.
 */
export async function renderMindsetDialog(actor) {
  if (!actor) return ui.notifications.warn("AI Director: No valid Actor document provided.");

  // 1. Run through your verified profile retrofitting toolkit
  const { getOrInitializeProfile } = await import("../ai/npc-profile-builder.js");
  const profile = await getOrInitializeProfile(actor);
  if (!profile) return console.error("ai-director | Failed to initialize NPC profile.");

  // 2. Build a stylized, highly readable HTML layout
  const htmlContent = `
    <form class="ai-director-dialog" style="padding: 12px; display: flex; flex-direction: column; gap: 14px; height: 100%; box-sizing: border-box;">
      <h2 style="color: #ffb400; border-bottom: 2px solid #ffb400; padding-bottom: 5px; margin: 0 0 5px 0; font-size: 1.6rem;">
        AI Director Matrix: ${profile.name || actor.name}
      </h2>
      
      <fieldset style="border: 1px solid #555; padding: 12px; border-radius: 5px; background: rgba(0,0,0,0.15);">
        <legend style="color: #ffb400; font-weight: bold; padding: 0 8px; font-size: 1.1rem;">Tactical Behavioral Traits (1-9)</legend>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 5px;">
          ${[['dominance', 'Dominance / Aggression'], ['restraint', 'Restraint / Control'], ['secrecy', 'Secrecy / Guardedness'], ['volatility', 'Volatility / Instability'], ['opportunism', 'Opportunism']].map(([key, label]) => `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 15px;">
              <span style="flex: 1; font-weight: 500; font-size: 0.95rem;">${label}</span>
              <span id="val-${key}" style="color: #ffb400; font-weight: bold; width: 20px; text-align: right;">${profile.traits?.[key] ?? 5}</span>
              <input type="range" name="traits.${key}" min="1" max="9" value="${profile.traits?.[key] ?? 5}" 
                     style="flex: 1.5; margin: 0; cursor: pointer;" oninput="document.getElementById('val-${key}').innerText=this.value">
            </div>
          `).join('')}
        </div>
      </fieldset>

      <fieldset style="border: 1px solid #555; padding: 12px; border-radius: 5px; background: rgba(0,0,0,0.15);">
        <legend style="color: #ffb400; font-weight: bold; padding: 0 8px; font-size: 1.1rem;">OCEAN Core Biases (1-5)</legend>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 5px;">
          ${[['openness', 'Openness'], ['conscientiousness', 'Conscientiousness'], ['extraversion', 'Extraversion'], ['agreeableness', 'Agreeableness'], ['neuroticism', 'Neuroticism']].map(([key, label]) => `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 15px;">
              <span style="flex: 1; font-weight: 500; font-size: 0.95rem;">${label}</span>
              <span id="val-${key}" style="color: #ffb400; font-weight: bold; width: 20px; text-align: right;">${profile.traits?.[key] ?? 3}</span>
              <input type="range" name="traits.${key}" min="1" max="5" value="${profile.traits?.[key] ?? 3}" 
                     style="flex: 1.5; margin: 0; cursor: pointer;" oninput="document.getElementById('val-${key}').innerText=this.value">
            </div>
          `).join('')}
        </div>
      </fieldset>

      <fieldset style="border: 1px solid #555; padding: 12px; border-radius: 5px; background: rgba(0,0,0,0.15);">
        <legend style="color: #ffb400; font-weight: bold; padding: 0 8px; font-size: 1.1rem;">Party Relationship Tracker</legend>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 5px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 15px;">
            <div style="flex: 1; display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 500; font-size: 0.95rem; white-space: nowrap;">Disposition:</span>
              <select name="relationships.party.disposition" style="flex: 1; height: 26px;">
                ${['Neutral', 'Friendly', 'Hostile', 'Suspicious', 'Loyal'].map(status => `
                  <option value="${status}" ${profile.relationships?.party?.disposition === status ? 'selected' : ''}>${status}</option>
                `).join('')}
              </select>
            </div>
            <div style="flex: 1.2; display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 500; font-size: 0.95rem; white-space: nowrap;">Trust Pool:</span>
              <span id="val-trust" style="color: #ffb400; font-weight: bold; min-width: 12px;">${profile.relationships?.party?.trust ?? 5}</span>
              <input type="range" name="relationships.party.trust" min="1" max="9" value="${profile.relationships?.party?.trust ?? 5}" 
                     style="flex: 1; margin: 0; cursor: pointer;" oninput="document.getElementById('val-trust').innerText=this.value">
            </div>
          </div>
          <div>
            <span style="font-weight: 500; font-size: 0.95rem; display: block; margin-bottom: 4px;">Interaction History Log:</span>
            <textarea name="relationships.party.historyLog" rows="2" style="width: 100%; font-family: monospace; font-size: 0.85rem; padding: 4px; box-sizing: border-box; resize: vertical;">${profile.relationships?.party?.historyLog || ''}</textarea>
          </div>
        </div>
      </fieldset>

      <fieldset style="border: 1px solid #555; padding: 12px; border-radius: 5px; background: rgba(0,0,0,0.15); margin-bottom: 5px;">
        <legend style="color: #ffb400; font-weight: bold; padding: 0 8px; font-size: 1.1rem;">Linguistic Syntax Overrides</legend>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 5px;">
          <div>
            <span style="font-weight: 500; font-size: 0.9rem; display: block; margin-bottom: 3px;">Tone Bias:</span>
            <input type="text" name="speechStyle.tone" value="${profile.speechStyle?.tone || 'Neutral'}" style="width: 100%; height: 26px;">
          </div>
          <div>
            <span style="font-weight: 500; font-size: 0.9rem; display: block; margin-bottom: 3px;">Sentence Length:</span>
            <input type="text" name="speechStyle.sentenceLength" value="${profile.speechStyle?.sentenceLength || 'Medium'}" style="width: 100%; height: 26px;">
          </div>
          <div>
            <span style="font-weight: 500; font-size: 0.9rem; display: block; margin-bottom: 3px;">Vocabulary Range:</span>
            <input type="text" name="speechStyle.vocabulary" value="${profile.speechStyle?.vocabulary || 'Standard'}" style="width: 100%; height: 26px;">
          </div>
          <div>
            <span style="font-weight: 500; font-size: 0.9rem; display: block; margin-bottom: 3px;">Speech Quirks:</span>
            <input type="text" name="speechStyle.quirks" value="${profile.speechStyle?.quirks || 'None'}" style="width: 100%; height: 26px;">
          </div>
        </div>
      </fieldset>
    </form>
  `;

  // 3. Render Dialog and supply explicit configuration dimensions alongside resizable properties
  return new Dialog({
    title: "AI Director: Diagnostic Configuration Console",
    content: htmlContent,
    buttons: {
      commit: {
        icon: '<i class="fas fa-save"></i>',
        label: "Commit Adjustments",
        callback: async (html) => {
          const formElement = html.find('form')[0];
          const formDataExtended = new FormDataExtended(formElement);
          
          // Expand dot-notation objects and cleanly cast numeric strings back to true numbers
          const expandedData = foundry.utils.expandObject(formDataExtended.object);
          
          if (expandedData.traits) {
            for (let t in expandedData.traits) {
              expandedData.traits[t] = Number(expandedData.traits[t]);
            }
          }
          if (expandedData.relationships?.party) {
            expandedData.relationships.party.trust = Number(expandedData.relationships.party.trust);
          }

          // Merge clean dataset into the actor's flags
          await actor.setFlag("ai-director", "profile", expandedData);
          ui.notifications.info(`AI Director: Updated profile data matrix for ${actor.name}`);
        }
      },
      abort: {
        icon: '<i class="fas fa-times"></i>',
        label: "Abort Changes",
        callback: () => ui.notifications.info("Adjustments reverted.")
      }
    },
    default: "commit"
  }, { 
    width: 540, 
    height: 740, 
    resizable: true 
  }).render(true);
}