import { ProgrammaticBuildingGrammar } from "./programmatic-building-grammar.js";

export class CovertSiteGrammar {
  static GRAMMAR_ID = "COVERT_SITE_LAYERED_V2";
  static build(roomProgram = {}, options = {}) {
    const subtype = String(options.structureType || roomProgram.structureType || options.layoutProfile || "HIDEOUT").toUpperCase();
    const base = ProgrammaticBuildingGrammar.build({
      grammarId: this.GRAMMAR_ID, profileId: subtype, width: 18, height: 12, variants: ["STANDARD", "MIRRORED"],
      zoneOrder: ["COVER", "SECURITY", "OPERATIONS", "ESCAPE"],
      definitions: [["concealed-entry", "Concealed Entry", "ENTRY", "ENTRY"], ["front-room", "Cover Room", "LIVING", "OPTIONAL"],
        ["security", "Security Checkpoint", "SECURITY", "HUB"], ["operations", "Operations Room", "COMMAND", "OBJECTIVE"],
        ["workshop", "Workshop", "WORKSHOP", "OPTIONAL"], ["storage", "Secure Storage", "STORAGE", "OBJECTIVE"],
        ["quarters", "Quarters", "LIVING", "OPTIONAL"], ["secret-room", "Secret Room", "SECRET", "SECRET"], ["escape", "Escape Exit", "ESCAPE_ROUTE", "EXIT"]],
      cells: { "concealed-entry": { col: 0, row: 4, w: 3, h: 4, zone: "COVER" }, "front-room": { col: 3, row: 2, w: 4, h: 6, zone: "COVER" },
        security: { col: 7, row: 3, w: 3, h: 4, zone: "SECURITY" }, operations: { col: 10, row: 1, w: 5, h: 6, zone: "OPERATIONS", shapeType: "L_SHAPE" },
        workshop: { col: 10, row: 7, w: 5, h: 5, zone: "SERVICE" }, storage: { col: 15, row: 1, w: 3, h: 4, zone: "SECURE" },
        quarters: { col: 7, row: 7, w: 3, h: 5, zone: "PRIVATE" }, "secret-room": { col: 15, row: 5, w: 3, h: 4, zone: "SECRET" }, escape: { col: 15, row: 9, w: 3, h: 3, zone: "ESCAPE" } },
      pairs: [["concealed-entry", "front-room"], ["front-room", "security"], ["security", "operations", { doorType: "LOCKED", connectionType: "LOCKED_DOOR" }],
        ["operations", "workshop"], ["operations", "storage"], ["security", "quarters"], ["storage", "secret-room", { doorType: "SECRET", connectionType: "SECRET_DOOR" }], ["secret-room", "escape"]],
      exteriorOpenings: [
        { sectorId: "concealed-entry", face: "WEST", id: "concealed-entry", accessRole: "PRIMARY" },
        { sectorId: "escape", face: "SOUTH", id: "escape-exit", accessRole: "ESCAPE", doorType: "SECRET", connectionType: "SECRET_DOOR" }
      ]
    }, roomProgram, { ...options, structureType: subtype });
    base.secondaryNetworks = ["ESCAPE_ROUTE", ...(subtype === "SECRET_BASE" ? ["VENTILATION", "SERVICE_ACCESS"] : [])];
    return base;
  }
}
