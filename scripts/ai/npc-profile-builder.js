// modules/ai-director/scripts/ai/npc-profile-builder.js

import {
  OllamaClient
}
from "../api/ollama-client.js";

/**
 * Initializes and builds a clean database profile data payload structure.
 */
export function buildDefaultNPCProfile(actor, analyzedTraits = null) {
  const standardTraits = analyzedTraits || {
    dominance: 5,
    restraint: 5,
    secrecy: 5,
    volatility: 5,
    opportunism: 5,
    openness: 3,
    conscientiousness: 2,
    extraversion: 3,
    agreeableness: 2,
    neuroticism: 3
  };

  return {
    name: actor?.name || "Unknown NPC", 
    importance: 5,

    lastReferenced: "",
    lastPromoted: "",

    factionId: null, // ✅ NEW: Parent faction tracker key (defaults to unaffiliated)
    traits: standardTraits,
    speechStyle: {
      tone: analyzedTraits ? "Analyzed" : "Neutral",
      sentenceLength: "Medium",
      vocabulary: "Standard",
      quirks: "None"
    },
    relationships: {
      party: {
        disposition: "Neutral",
        trust: 5, 
        historyLog: "No prior significant interactions recorded with the party."
      }
    },

    memory: {
      facts: [],
      obligations: [],
      importantEvents: [],
      knownLocations: [],

      metadata: {
        lastUpdated: "",
        memoryVersion: 1
      }
    }
  };
}

/**
 * Leverages the local LLM to run a semantic analysis on an NPC's biography text.
 */
async function generateTraitsFromDescription(biographyText) {
  if (!biographyText || biographyText.trim().length < 10) {
    console.warn("AI Director | Biography text too short to profile.");
    return null;
  }

  const prompt = [
    "You are an expert tabletop game design system analyzer. Your task is to analyze the character biography below and translate their narrative lore into specific, numerical personality metrics.",
    "",
    "CHARACTER BIOGRAPHY:",
    `"${biographyText}"`,
    "",
    "Output ONLY a valid, minified raw JSON object matching this structure exactly, with no markdown code blocks, headers, or conversation:",
    '{"dominance":5,"restraint":5,"secrecy":5,"volatility":5,"opportunism":5,"openness":3,"conscientiousness":2,"extraversion":3,"agreeableness":2,"neuroticism":3}'
  ].join("\n");

  try {
    console.log("AI Director | Dispatching payload to local Ollama instance...");

    const response =
      await OllamaClient.generate(
        prompt,
        "",
        {
          temperature: 0.1
        }
      );

    const parsedTraits =
      JSON.parse(
        response
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim()
      );

    console.log("AI Director | Successfully parsed structural traits object:", parsedTraits);
    return parsedTraits;

  } catch (e) {
    console.error("AI Director | Failed to semantically analyze NPC traits from description:", e);
    ui.notifications.error("AI Director: Local AI connection failed. Defaulting to flat parameters.");
    return null;
  }
}

/**
 * Safely fetches an actor's profile flags, forcing structural upgrades if properties are missing.
 */
export async function getOrInitializeProfile(actor) {
  if (!actor) return null;
  
  let currentProfile = actor.getFlag("ai-director", "profile");
  
  if (!currentProfile) {
    // Dynamic schema path mapping for Cyberpunk Red actor information block integration
    const rawBioHtml = actor.system?.information?.notes || 
                       actor.system?.details?.biography?.value || 
                       actor.system?.biography || "";
                       
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = rawBioHtml;
    const cleanBioText = tempDiv.textContent || tempDiv.innerText || "";

    let analyzedTraits = null;
    if (cleanBioText.trim().length > 10) {
      ui.notifications.info(`AI Director | Semantically profiling personality for ${actor.name}...`);
      analyzedTraits = await generateTraitsFromDescription(cleanBioText);
    }

    currentProfile = buildDefaultNPCProfile(actor, analyzedTraits);
    await actor.setFlag("ai-director", "profile", currentProfile);
    return currentProfile;
  }
  
  let structuralChange = false;

  if (
    currentProfile.importance ===
    undefined
  ) {
    currentProfile.importance = 5;
    structuralChange = true;
  }

  // ✅ NEW: Auto-upgrade existing profiles to support faction alignments safely
  if (currentProfile.factionId === undefined) {
    currentProfile.factionId = null;
    structuralChange = true;
  }

  if (
    currentProfile.lastReferenced ===
    undefined
  ) {
    currentProfile.lastReferenced = "";
    structuralChange = true;
  }

  if (
    currentProfile.lastPromoted ===
    undefined
  ) {
    currentProfile.lastPromoted = "";
    structuralChange = true;
  }
  
  if (currentProfile.dialogueTraits && !currentProfile.traits) {
    currentProfile.traits = {
      dominance: currentProfile.dialogueTraits.dominance ?? 5,
      restraint: currentProfile.dialogueTraits.restraint ?? 5,
      secrecy: currentProfile.dialogueTraits.secrecy ?? 5,
      volatility: currentProfile.dialogueTraits.volatility ?? 5,
      opportunism: 5, 
      openness: 3,
      conscientiousness: 2,
      extraversion: 3,
      agreeableness: 2,
      neuroticism: 3
    };
    delete currentProfile.dialogueTraits;
    structuralChange = true;
  }
  
  if (!currentProfile.memory) {
    currentProfile.memory = {
      facts: [],
      obligations: [],
      importantEvents: [],
      knownLocations: [],

      metadata: {
        lastUpdated: "",
        memoryVersion: 1
      }
    };

    structuralChange = true;
  }
  
  if (!currentProfile.relationships || !currentProfile.relationships.party) {
    currentProfile.relationships = {
      party: {
        disposition: "Neutral",
        trust: 5,
        historyLog: "No prior significant interactions recorded with the party."
      }
    };
    structuralChange = true;
  }
  
  if (currentProfile.traits) {
    const defaultOCEAN = { opportunism: 5, openness: 3, conscientiousness: 2, extraversion: 3, agreeableness: 2, neuroticism: 3 };
    for (const [key, value] of Object.entries(defaultOCEAN)) {
      if (currentProfile.traits[key] === undefined) {
        currentProfile.traits[key] = value;
        structuralChange = true;
      }
    }
  }
  
  if (structuralChange) {
    await actor.setFlag("ai-director", "profile", currentProfile);
  }
  
  return currentProfile;
}

/**
 * Translates numerical core traits into descriptive behavioral directives for the LLM.
 * @param {Object} traits - The NPC's personality metrics object.
 * @returns {string} Textual behavior profile instructions.
 */
export function getBehaviorModifiers(traits) {
  if (!traits) return "Act as a standard, neutral individual.";

  const directives = [];

  if (traits.dominance >= 7) directives.push("Speak with absolute authority, take control of the conversation, and do not tolerate disrespect.");
  if (traits.dominance <= 3) directives.push("Be submissive, hesitant, and easily swayed or intimidated by others.");

  if (traits.restraint >= 7) directives.push("Keep your emotions heavily guarded, speak deliberately, and do not reveal outbursts.");
  if (traits.restraint <= 3) directives.push("Be volatile, reactive, and let your immediate feelings dictate your tone.");

  if (traits.secrecy >= 7) directives.push("Be extremely vague, evasive, and actively conceal critical details or motivations.");
  if (traits.secrecy <= 3) directives.push("Be transparent, candid, and share information relatively freely.");

  return directives.length > 0 
    ? directives.join(" ") 
    : "Maintain a balanced, standard conversational tone.";
}

/**
 * Translates relationship metrics and trust scores into conversational stance directives.
 * @param {Object} relationships - The NPC's relationship tracking data.
 * @returns {string} Textual stance guidance.
 */
export function getRelationshipDirectives(relationships) {
  const partyContext = relationships?.party;
  if (!partyContext) return "Treat the party as complete strangers.";

  const trust = partyContext.trust ?? 5;
  const disposition = partyContext.disposition || "Neutral";

  let stance = `Your current baseline attitude toward the party is ${disposition}. `;

  if (trust >= 7) {
    stance += "You trust them deeply. You are inclined to believe their claims, cooperate with their plans, and confide personal information.";
  } else if (trust <= 3) {
    stance += "You are highly suspicious of them. You suspect ulterior motives, double-check their statements, and guard your interests fiercely.";
  } else {
    stance += "Your trust is conditional and transactional. You cooperate only as far as mutual benefit extends.";
  }

  return stance;
}

/**
 * RESTORED BRIDGE: Executes simulated headless NPC profile structural parsing for testing sequences.
 * @param {Object} context - The mock context parameters sent by headless-tester.js
 * @returns {Promise<Object>} Fully compiled mock target dataset payload.
 */
export async function generateHeadlessNPC(context) {
  console.log("AI Director | Restoring decoupled headless parsing pipeline for:", context.npcName);
  
  const descriptionBlock = `Name: ${context.npcName}. Role: ${context.npcRole}. Species: ${context.species}. Background Context: ${context.parentScene}`;
  const analyzedTraits = await generateTraitsFromDescription(descriptionBlock);
  
  const mockActor = { name: context.npcName };
  const headlessProfile = buildDefaultNPCProfile(mockActor, analyzedTraits);
  
  console.log("AI Director | Headless payload assembled:", headlessProfile);
  return headlessProfile;
}

/**
 * Main orchestration function triggered by the AI Director to manifest an NPC.
 * Decouples calculation from system-specific implementation rulesets.
 * 
 * @param {Actor} actor - The Foundry Actor document being updated
 */
export async function processAiDirectorHandoff(actor) {
  const activeSystem = game.system.id;
  
  // 1. Fetch the profile state we verified via flags
  // Assumes getOrInitializeProfile(actor) exists in this file scope
  let profile = await getOrInitializeProfile(actor);
  if (!profile) {
    console.error("[AI Director] Failed to retrieve or initialize actor profile flags.");
    return;
  }

  // 2. Route dynamically depending on the system ruleset active in the world
  if (activeSystem === "cyberpunk-red-core") {
    console.log(`[AI Director] Routing ${actor.name} to CPR Ollama Importer...`);
    
    // Construct the explicit narrative context string for hermes3
    const roleGuess = profile.traits?.dominance > 6 ? "Solo/Enforcer" : "Tech/Fixer";
    const narrativeContext = `Name: ${actor.name}. Role: ${roleGuess}. Personality: ${profile.speechStyle?.tone || "Pragmatic street-op."} Behavioral Quirks: ${profile.speechStyle?.quirks || ""}`;
    
    await handoffToCprOllama(narrativeContext);

  } else if (activeSystem === "dnd5e" || activeSystem === "sw5e") {
    console.log(`[AI Director] Routing ${actor.name} to 5e Clipboard Generator...`);
    await handoffToTextStatblock(actor.name, profile);
  }
}

/**
 * SYSTEM INTEGRATION HANDOFF: Cyberpunk RED -> CPR Ollama NPC Importer module
 */
async function handoffToCprOllama(narrativeContext) {
  if (typeof globalThis.generateNPC !== "function") {
    ui.notifications.error("AI Director: 'CPR Ollama NPC Importer' module is not active or global mapping is missing.");
    return;
  }

  // Fire the importer modal layout setup
  await globalThis.generateNPC();

  // Wait for Dialog DOM injection frame to catch up, then auto-fill and auto-submit
  setTimeout(() => {
    const modalTextArea = document.getElementById("npc-desc");
    if (modalTextArea) {
      modalTextArea.value = narrativeContext;
      
      // Force change/input event propagation so UI models don't miss data states
      modalTextArea.dispatchEvent(new Event("input", { bubbles: true }));
      modalTextArea.dispatchEvent(new Event("change", { bubbles: true }));

      // Find and click the submission engine button safely
      const dialogButtons = Array.from(document.querySelectorAll(".dialog-button, .dialog-buttons button"));
      const goButton = dialogButtons.find(btn => 
        /manifest|combat|go|ok|confirm/i.test(btn.innerText || "")
      );

      if (goButton) {
        ui.notifications.info("AI Director: Triggering automated engine manifest...");
        goButton.click();
      } else {
        console.warn("[AI Director] Automated setup failed: Engine button not found in current DOM frame.");
      }
    }
  }, 250);
}

/**
 * SYSTEM INTEGRATION HANDOFF: D&D 5e / SW5e -> Text-Based Clipboard String Builder
 */
async function handoffToTextStatblock(npcName, profile) {
  const isCombatant = (profile.traits?.dominance ?? 5) > 5;
  
  const textStatblock = `${npcName.toUpperCase()}
Medium humanoid, any alignment
Armor Class: ${isCombatant ? "15 (Combat Suit)" : "11 (Slick Clothes)"}
Hit Points: 32 (5d8 + 10)
Speed: 30 ft.
STR      DEX      CON      INT      WIS      CHA
10 (+0)  ${isCombatant ? "16 (+3)" : "12 (+1)"}  14 (+2)  14 (+2)  12 (+1)  ${(profile.traits?.extraversion ?? 5) > 5 ? "15 (+2)" : "9 (-1)"}

Behavioral Profile (AI Director Overlay):
- Tone: ${profile.speechStyle?.tone || "Standard"}
- Style: ${profile.speechStyle?.sentenceLength || "Medium"} sentences, using ${profile.speechStyle?.vocabulary || "Standard"} vocabulary.
- Tactical Metrics: Dominance ${profile.traits?.dominance || 5}/10, Secrecy ${profile.traits?.secrecy || 5}/10.

ACTIONS
Primary Weapon. Ranged Weapon Attack: +5 to hit, range 60/120 ft., one target. Hit: 7 (1d8 + 3) damage.
`;

  try {
    await navigator.clipboard.writeText(textStatblock);
    ui.notifications.info(`[AI Director] Statblock for ${npcName} copied to clipboard! Paste directly into your 5e Importer tool.`);
  } catch (err) {
    console.error("[AI Director] Failed to copy text to clipboard: ", err);
    ui.notifications.error("Clipboard permission issue encountered.");
  }
}