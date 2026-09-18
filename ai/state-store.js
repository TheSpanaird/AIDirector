// modules/ai-director/scripts/ai/state-store.js

export const AIState = {
    shortTerm: [], // Array holding volatile short-term event strings
    lastActivity: Date.now() // Track the last interaction time for conversational pacing
};

/**
 * Pushes a fresh event vector onto the short-term volatile memory queue
 * and auto-trims to prevent conversational context bloating.
 */
export function pushEvent(e) {
    if (!e) return;
    
    AIState.shortTerm.push(e);
    
    // Keep short-term memory concise to protect local prompt horizons
    if (AIState.shortTerm.length > 10) {
        AIState.shortTerm.shift();
    }
    
    // Reset activity timer whenever a new event comes in to track conversation gaps
    AIState.lastActivity = Date.now();
}

/**
 * Returns how many seconds have passed since the last tracked interaction.
 * Crucial for conversational idle prompts or interruption loops.
 */
export function getSecondsSinceActivity() {
    return (Date.now() - AIState.lastActivity) / 1000;
}

/**
 * Generates a standard NPC trait profile combining Tactical variables and OCEAN traits.
 * Used as a fallback seed layout when an actor profile does not yet exist.
 */
export function generateRandomTraits() {
    const getRandom = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    return {
        // Tactical Traits (Clamped 1-9 scale matching your state-manager logic)
        dominance: getRandom(1, 9),
        restraint: getRandom(1, 9),
        volatility: getRandom(1, 9),
        secrecy: getRandom(1, 9),
        opportunism: getRandom(1, 9),
        
        // OCEAN Behavioral Framework Weights
        openness: getRandom(1, 5),
        conscientiousness: getRandom(1, 3),
        extraversion: getRandom(1, 5),
        agreeableness: getRandom(1, 4),
        neuroticism: getRandom(1, 5)
    };
}