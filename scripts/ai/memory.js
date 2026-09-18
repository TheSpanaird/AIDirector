// modules/ai-director/scripts/ai/memory.js

import { AIState } from "./state-store.js";

/**
 * Maps the short-term transactional event queue to build summary packets.
 * Preserves the exact array tracking structure for active session turns.
 */
export function buildMemorySummary() {
  const events = AIState.shortTerm.map(e => e.text);

  return {
    recentEvents: events,
    lastEvent: events.length ? events[events.length - 1] : null
  };
}