// modules/ai-director/services/lock-service.js

import { FlagFactory } from "../core/flag-factory.js";

/**
 * Ephemeral memory map tracking operational states on the local client instance.
 * Keys are typically correlationIds or Document IDs; values are active timestamp locks.
 * @type {Map<string, number>}
 */
const _localProcessingLocks = new Map();

/**
 * Maximum lifespan of a single processing transaction lock (in milliseconds).
 * Prevents the system from permanently freezing if a network request drops or errors out.
 */
const LOCK_TIMEOUT_MS = 12000;

/**
 * LOCK SERVICE: Stateless synchronization layer for the AI Director module.
 * Protects local LLM generation loops from race conditions, overlapping player dice inputs,
 * and double-processing chat messages.
 */
export function acquireLock(challengeCard = null, correlationId = null) {
    if (!game.user.isGM) return false;

    const now = Date.now();
    const token = correlationId || challengeCard?.id || "global-director-lock";

    // 1. Check & Clean Ephemeral Local Client Lock
    if (_localProcessingLocks.has(token)) {
        const lockTime = _localProcessingLocks.get(token);
        if (now - lockTime < LOCK_TIMEOUT_MS) {
            console.warn(`🛑 AI Director Lock | Local execution request rejected. Lock [${token}] is already held.`);
            return false;
        }
        // Lock has exceeded timeout threshold; clear it out cleanly
        _localProcessingLocks.delete(token);
    }

    // 2. Check Database Document Persistent Lock (Multi-GM/Client Synchronization)
    if (challengeCard && typeof challengeCard.getFlag === "function") {
        const { context } = FlagFactory.getFlags(challengeCard);
        if (context?.status === "processing" || context?.status === "resolved") {
            const flagTimestamp = challengeCard.flags?.["ai-director"]?.routing?.timestamp || 0;
            if (now - flagTimestamp < LOCK_TIMEOUT_MS && context?.status !== "resolved") {
                console.warn(`🛑 AI Director Lock | DB Document check rejected. Document [${challengeCard.id}] is currently being processed by another worker.`);
                return false;
            }
        }
    }

    // 3. Commit and Secure Lock State
    _localProcessingLocks.set(token, now);

    if (challengeCard && typeof challengeCard.setFlag === "function") {
        // Optimistically tag the document status to notify other clients immediately
        const existingFlags = FlagFactory.getFlags(challengeCard);
        const processingFlags = FlagFactory.createFlags({
            isAi: existingFlags.routing.isAiGenerated,
            processType: existingFlags.routing.process,
            correlationId: token,
            context: {
                ...existingFlags.context,
                status: "processing"
            }
        });
        
        // Fire updates unawaited to avoid blocking the main execution path
        challengeCard.update({ flags: processingFlags });
    }

    console.log(`🔒 AI Director Lock | Successfully acquired lock for transaction: [${token}]`);
    return true;
}

/**
 * Releases an active processing lock across both local memory maps and remote client database flags.
 * @param {Object|null} challengeCard - Optional native Foundry ChatMessage document instance.
 * @param {string|null} correlationId - Unique transaction identity token.
 */
export function releaseLock(challengeCard = null, correlationId = null) {
    if (!game.user.isGM) return;

    const token = correlationId || challengeCard?.id || "global-director-lock";
    
    // Clear ephemeral tracking cache
    const deleted = _localProcessingLocks.delete(token);

    if (challengeCard && typeof challengeCard.setFlag === "function") {
        const existingFlags = FlagFactory.getFlags(challengeCard);
        
        // If the state was not advanced to a resolved completion code, return it to initialized
        const targetStatus = existingFlags.context.status === "resolved" ? "resolved" : "initialized";

        const releaseFlags = FlagFactory.createFlags({
            isAi: existingFlags.routing.isAiGenerated,
            processType: existingFlags.routing.process,
            correlationId: token,
            context: {
                ...existingFlags.context,
                status: targetStatus
            }
        });

        challengeCard.update({ flags: releaseFlags });
    }

    if (deleted) {
        console.log(`🔓 AI Director Lock | Released lock for transaction: [${token}]`);
    }
}

/**
 * Utility to explicitly check if a transaction ID is currently processing.
 * @param {string} token - The correlationId or Document ID to inspect.
 * @returns {boolean} True if the token is actively locked.
 */
export function isLocked(token) {
    if (!_localProcessingLocks.has(token)) return false;
    
    const lockTime = _localProcessingLocks.get(token);
    if (Date.now() - lockTime > LOCK_TIMEOUT_MS) {
        _localProcessingLocks.delete(token);
        return false;
    }
    return true;
}