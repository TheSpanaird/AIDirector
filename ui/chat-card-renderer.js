// modules/ai-director/ui/chat-card-renderer.js

/**
 * Generates the native Foundry-styled HTML string for the AI Director chat message.
 * @param {Object} analysis - The raw JSON metadata payload returned from classifyPlayerIntent.
 * @param {string} shortNarration - A snippet of narrative flavor text from the LLM or raw input.
 * @param {string} actorName - The name of the character executing the action.
 * @param {string|null} messageId - PHASE 3: The unique database ID of this parent chat message card.
 * @returns {string} Fully compiled HTML card layout.
 */
export function generateDirectorCardHtml(analysis, shortNarration = "", actorName = "The Player", messageId = null) {
    const systemId = game?.system?.id || "cpr";
    const skillName = analysis.skill || "Perception";
    const statName = analysis.stat || "INT";
    const targetValue = analysis.suggestedDV || analysis.suggestedDC || 13;
    
    // Prioritize the clean player action text without forcing the actor name inside the quotes
    const flavorText = shortNarration || 'The current tactical assessment requires immediate physical interaction...';

    const checkType = analysis.checkType || "STANDARD"; 
    const opposingSkill = analysis.opposingSkill || "Evasion";

    const isCPR = systemId.includes("cyberpunk-red") || systemId === "cpr";
    const metricLabel = isCPR ? "Target DV" : "Target DC";
    const systemLabel = isCPR ? "Cyberpunk RED" : (systemId === "sw5e" ? "Star Wars 5e" : "D&D 5th Edition");

    // PHASE 3: Prepare the tracking attribute string if a valid messageId exists
    const trackingAttr = messageId ? `data-correlation-id="${messageId}"` : "";

    let subPanelHtml = `
        <div style="background: rgba(0, 0, 0, 0.08); border-radius: 3px; padding: 6px; margin-bottom: 10px; border-left: 3px solid var(--color-border-highlight);">
            <div style="font-size: 0.85em; margin-bottom: 2px;">
                <strong>Intent Frame:</strong> ${analysis.reasoning || "Action Resolution"}
            </div>
            <div style="font-size: 0.85em;">
                <strong>Required Check:</strong> <span style="font-weight: 600;">${skillName} (${statName})</span>
            </div>
        </div>
        <button class="ai-director-roll-action-btn" 
                ${trackingAttr}
                data-check-type="STANDARD"
                data-skill="${skillName}" 
                data-stat="${statName}" 
                data-target="${targetValue}"
                style="width: 100%; font-family: var(--font-primary); font-weight: bold; background: #2b7a3e; color: #ffffff; border: 1px solid #1e542b; padding: 6px; border-radius: 3px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.2); text-shadow: 1px 1px 0px rgba(0,0,0,0.4);">
            Execute Prompt Roll (${metricLabel} ${targetValue})
        </button>
    `;

    if (checkType === "CONTESTED") {
        subPanelHtml = `
        <div style="display: flex; gap: 8px; margin-bottom: 10px;">
            <div style="flex: 1; background: rgba(43, 122, 62, 0.1); border-radius: 3px; padding: 6px; border-left: 3px solid #2b7a3e;">
                <div style="font-size: 0.75em; text-transform: uppercase; opacity: 0.8; font-weight: bold;">Player Check</div>
                <div style="font-size: 0.9em; font-weight: bold; margin-top: 2px;">${skillName}</div>
                <div style="font-size: 0.75em; opacity: 0.7;">Base Stat: ${statName}</div>
            </div>
            <div style="flex: 1; background: rgba(186, 45, 45, 0.1); border-radius: 3px; padding: 6px; border-left: 3px solid #ba2d2d;">
                <div style="font-size: 0.75em; text-transform: uppercase; opacity: 0.8; font-weight: bold;">NPC Opponent</div>
                <div style="font-size: 0.9em; font-weight: bold; margin-top: 2px;">${opposingSkill}</div>
                <div style="font-size: 0.75em; color: #ba2d2d; font-weight: bold; margin-top: 1px;"><i class="fas fa-eye-slash"></i> Roll Hidden</div>
            </div>
        </div>
        <button class="ai-director-roll-action-btn" 
                ${trackingAttr}
                data-check-type="CONTESTED"
                data-skill="${skillName}" 
                data-stat="${statName}" 
                data-opposing-skill="${opposingSkill}"
                data-target="${targetValue}"
                style="width: 100%; font-family: var(--font-primary); font-weight: bold; background: #a67c1e; color: #ffffff; border: 1px solid #7a5b13; padding: 6px; border-radius: 3px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.2); text-shadow: 1px 1px 0px rgba(0,0,0,0.4);">
            Face Contested Challenge
        </button>
        `;
    }

    return `
    <div class="ai-director-chat-card system-${systemId}" 
         ${messageId ? `data-correlation-id="${messageId}"` : ""}
         style="border: 1px solid var(--color-border-dark); background: var(--color-bg); color: var(--color-text-dark); font-family: var(--font-primary); border-radius: 4px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.25);">
        
        <div style="background: rgba(0, 0, 0, 0.15); padding: 6px 10px; border-bottom: 1px solid var(--color-border-light-darker); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: bold; font-size: 0.95em; letter-spacing: 0.3px; color: var(--color-text-hyperlink);">${systemLabel.toUpperCase()} ${checkType}</span>
            <span class="ai-director-actor-badge" style="font-size: 0.8em; opacity: 0.7; font-family: monospace; background: rgba(0,0,0,0.2); padding: 1px 5px; border-radius: 3px;">${actorName}</span>
        </div>
        
        <div style="padding: 10px;">
            <div style="margin-bottom: 8px; font-size: 0.9em; line-height: 1.35; color: var(--color-text-dark);">
                <em>"${flavorText}"</em>
            </div>
            ${subPanelHtml}
        </div>
    </div>
    `;
}

/**
 * Legacy architecture entry point hook running inside browser module cache routing.
 * Automatically adapts inbound execution payloads straight to the new advanced layout engine.
 */
export function renderChatCard(data, input) {
    const adaptedAnalysis = {
        skill: data.skill || "Perception",
        stat: data.stat || (data.skill?.toLowerCase() === "stealth" ? "REF" : "INT"),
        suggestedDV: data.targetValue,
        suggestedDC: data.targetValue,
        checkType: data.type?.toUpperCase() === "CONTESTED" ? "CONTESTED" : "STANDARD",
        opposingSkill: data.opposingSkill || "Evasion",
        reasoning: data.reasoning || "Action Evaluation"
    };

    const targetFlavor = input || data.actionDescription;
    const targetedActor = data.actorName || "The Player";
    const transactionId = data.id || data.messageId || null;

    return generateDirectorCardHtml(adaptedAnalysis, targetFlavor, targetedActor, transactionId);
}

/**
 * Attaches event listeners to the chat log to capture button interactions on AI Director cards.
 * @param {HTMLElement} html - The chat log HTML element framework provided by Foundry.
 */
export function activateChatListeners(html) {
    // Standard JQuery/Native adapter support for older chat rendering hooks safely
    const root = html instanceof HTMLElement ? html : html[0];
    if (!root) return;

    root.addEventListener("click", async (event) => {
        const button = event.target.closest(".ai-director-roll-action-btn");
        if (!button) return;

        event.preventDefault();
        
        // Extract interaction details directly from card datasets
        const checkType = button.dataset.checkType;
        const skill = button.dataset.skill;
        const stat = button.dataset.stat;
        const target = parseInt(button.dataset.target || "13", 10);
        const opposingSkill = button.dataset.opposingSkill;

        // Pull the active actor assignment
        const actor = canvas.tokens?.controlled[0]?.actor || game.user.character;
        if (!actor) {
            ui.notifications.warn("AI Director | You must have a character assigned or token controlled to roll.");
            return;
        }

        ui.notifications.info(`AI Director | Initiating ${skill} check resolution...`);

        try {
            // Handle cross-system roll executions dynamically based on system ID
            const systemId = game?.system?.id;
            
            if (systemId === "cpr" || systemId.includes("cyberpunk-red")) {
                // Cyberpunk RED native roll execution call
                if (checkType === "CONTESTED") {
                    await actor.rollSkillContested?.(skill, opposingSkill);
                } else {
                    await actor.rollSkill?.(skill, target);
                }
            } else if (systemId === "sw5e" || systemId === "dnd5e") {
                // 5e systems check processing mechanics
                const abilityKey = stat?.toLowerCase().substring(0, 3) || "int";
                if (skill) {
                    await actor.rollSkill?.(skill.toLowerCase(), { targetValue: target });
                } else {
                    await actor.rollAbilityCheck?.(abilityKey, { targetValue: target });
                }
            } else {
                // Fallback universal dice roll if system wrappers aren't explicitly caught
                const roll = await new Roll("1d20").evaluate();
                await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
            }
        } catch (err) {
            console.error("AI Director | Dice execution handler failed:", err);
        }
    });
}