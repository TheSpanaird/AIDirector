// dynamic-footprint-composer.js
// Procedurally derives a footprint contract from building context and room inventory.
export class DynamicFootprintComposer {
  static compose(manifest = {}, sectors = [], profile = {}) {
    const context = this._context(manifest, sectors);
    const family = String(profile.layoutFamily || profile.family || "").toUpperCase();
    const purposes = sectors.map(sector => this._purpose(sector));
    const has = value => purposes.some(purpose => purpose.includes(value));

    let archetype = "ZONED_BLOCK";
    let circulation = "ORTHOGONAL_SPINE";
    let enclosure = "CONTINUOUS";

    if (family === "NATURAL" || /cave|cavern|mine|tunnel|burrow|grotto/.test(context)) {
      archetype = "NATURAL_BRANCHING";
      circulation = "BRANCHING_PASSAGES";
      enclosure = "NATURAL";
    } else if (
      has("TOWER") || has("GATEHOUSE") || has("COURTYARD") ||
      /castle|fort|citadel|stronghold|keep|stockade/.test(context)
    ) {
      archetype = "FORTIFIED_COURTYARD";
      circulation = "COURTYARD_RING";
      enclosure = "FORTIFIED";
    } else if (
      has("STALL") || has("HAY") || has("LOFT") || has("TACK") ||
      /barn|stable|hangar|shed|longhouse/.test(context)
    ) {
      archetype = "AISLE_BUILDING";
      circulation = "CENTRAL_AISLE";
    } else if (
      has("STAGE") || has("PUBLIC_ROOM") || has("BAR") ||
      /theater|theatre|club|tavern|inn|restaurant|bakery|shop|market/.test(context)
    ) {
      archetype = "PUBLIC_SERVICE_BUILDING";
      circulation = "PUBLIC_SERVICE_SPINE";
    } else if (
      has("BEDROOM") || has("LIVING") || has("KITCHEN") ||
      /house|home|cottage|villa|residence|apartment/.test(context)
    ) {
      archetype = has("COURTYARD") ? "COURTYARD_HOUSE" : "RESIDENTIAL_BLOCK";
      circulation = has("HALL") ? "SHORT_HALL" : "ROOM_ADJACENCY";
    } else if (
      family === "TECHNICAL" || has("REACTOR") || has("LAB") || has("WORKSHOP") ||
      /factory|facility|laboratory|warehouse|plant|station/.test(context)
    ) {
      archetype = "MODULAR_BLOCK";
      circulation = "ORTHOGONAL_SPINE";
    } else if (/ship|vessel|spacecraft|submarine|train/.test(context)) {
      archetype = "LINEAR_HULL";
      circulation = "DECK_SPINE";
      enclosure = "HULL";
    }

    const zones = sectors.map(sector => ({
      sectorId: sector.sectorId,
      zone: this._zoneFor(sector),
      exteriorAccess: this._purpose(sector).includes("ENTRY") ||
        this._purpose(sector).includes("GATE") ||
        String(sector.graphRole || "").toUpperCase() === "ENTRY"
    }));

    return {
      id: "DYNAMIC",
      source: "DYNAMIC_COMPOSITION",
      archetype,
      circulation,
      enclosure,
      zones,
      entranceCount: Math.max(1, zones.filter(zone => zone.exteriorAccess).length),
      symmetry: family === "FORTIFIED" ? "MEDIUM" : "LOW"
    };
  }

  static _zoneFor(sector) {
    const purpose = this._purpose(sector);
    const role = String(sector.graphRole || "").toUpperCase();
    if (purpose.includes("ENTRY") || purpose.includes("GATE") || role === "ENTRY") return "ENTRY";
    if (["PUBLIC", "LOBBY", "HALL", "DINING", "STAGE", "SHOP", "TAPROOM"].some(value => purpose.includes(value))) return "PUBLIC";
    if (["KITCHEN", "STORAGE", "UTILITY", "WORKSHOP", "SERVICE", "TACK", "FEED"].some(value => purpose.includes(value))) return "SERVICE";
    if (["COMMAND", "SECURITY", "REACTOR", "LAB", "OFFICE", "PRIVATE", "BEDROOM"].some(value => purpose.includes(value))) return "RESTRICTED";
    if (["COURTYARD", "GARDEN", "YARD", "HANGAR", "PUBLIC_ROOM"].some(value => purpose.includes(value))) return "CORE";
    if (purpose.includes("TOWER")) return "PERIMETER";
    return role === "OBJECTIVE" ? "CORE" : "GENERAL";
  }

  static _context(manifest, sectors) {
    return [
      manifest.layoutProfile,
      manifest.layoutFamily,
      manifest.locationType,
      manifest.sceneType,
      manifest.type,
      manifest.dungeonTitle,
      manifest.title,
      manifest.name,
      manifest.description,
      manifest.summary,
      manifest.architecture?.type,
      manifest.architecture?.description,
      ...sectors.flatMap(sector => [sector.name, sector.purpose, sector.roomType, sector.description])
    ].filter(Boolean).join(" ").toLowerCase();
  }

  static _purpose(sector) {
    return String(
      sector.purpose || sector.sectorPurpose || sector.roomType || sector.name || "ROOM"
    ).toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  }
}
