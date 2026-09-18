// grammar-contract.js
// Shared standalone contract for architectural grammar prototypes.

export class GrammarContract {
  static validate(result = {}) {
    const problems = [];
    if (!result.grammarId) problems.push("Missing grammarId.");
    if (!result.variantId) problems.push("Missing variantId.");
    if (!result.envelope) problems.push("Missing envelope.");
    if (!Array.isArray(result.sectors) || !result.sectors.length) {
      problems.push("No sectors were produced.");
    }
    if (!Array.isArray(result.openings)) problems.push("Missing openings array.");
    return { valid: problems.length === 0, problems };
  }

  static hash(value) {
    let hash = 2166136261;
    for (const character of String(value || "")) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}
