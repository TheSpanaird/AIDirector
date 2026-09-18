// modules/ai-director/scripts/runtime/combat-state-resolver.js
// EN-18: System-aware defeat detection.

export class CombatStateResolver {

  static isDefeated(actor) {

    if (!actor) {
      return false;
    }

    const systemId =
      game.system?.id ?? "";

    switch (systemId) {

      case "dnd5e":
      case "shadowdark":

        return (
          Number(
            actor.system?.attributes?.hp?.value
          ) <= 0
        );

      case "cpr":

        return (
          Number(
            actor.system?.health?.value
          ) <= 0
        );

      default: {

        const hp =
          actor.system?.attributes?.hp?.value ??
          actor.system?.health?.value;

        return (
          Number(hp) <= 0
        );
      }
    }
  }
}

if (typeof window !== "undefined") {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .CombatStateResolver =
      CombatStateResolver;
}
