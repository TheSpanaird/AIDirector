import { ProgrammaticBuildingGrammar } from "./programmatic-building-grammar.js";
export class ManorGrammar {
  static GRAMMAR_ID = "MANOR_CENTRAL_HALL_V1";
  static build(roomProgram = {}, options = {}) {
    return ProgrammaticBuildingGrammar.build({
      grammarId: this.GRAMMAR_ID, profileId: "MANOR", width: 18, height: 14,
      variants: ["STANDARD", "MIRRORED", "ROTATED"], entryId: "entry", entryFace: "WEST",
      zoneOrder: ["PUBLIC", "PRIVATE", "SERVICE"],
      definitions: [
        ["entry","Grand Entry","ENTRY","ENTRY"],["great-hall","Great Hall","HALL","HUB"],
        ["drawing-room","Drawing Room","LIVING","OPTIONAL"],["dining-room","Dining Room","DINING","OBJECTIVE"],
        ["library","Library","OFFICE","OPTIONAL"],["private-hall","Private Hall","HALL","OPTIONAL"],
        ["bedroom-suite","Bedroom Suite","BEDROOM","OBJECTIVE"],["guest-room","Guest Room","BEDROOM","OPTIONAL"],
        ["kitchen","Kitchen","KITCHEN","OPTIONAL"],["pantry","Pantry","STORAGE","OPTIONAL"],
        ["servants-hall","Servants Hall","SERVICE","OPTIONAL"]
      ],
      cells: {
        entry:{col:0,row:4,w:3,h:4,zone:"PUBLIC"}, "great-hall":{col:3,row:3,w:6,h:6,zone:"PUBLIC"},
        "drawing-room":{col:3,row:0,w:6,h:3,zone:"PUBLIC"}, "dining-room":{col:9,row:0,w:5,h:5,zone:"PUBLIC"},
        library:{col:14,row:0,w:4,h:5,zone:"PRIVATE"}, "private-hall":{col:9,row:5,w:2,h:9,zone:"PRIVATE"},
        "bedroom-suite":{col:11,row:5,w:7,h:5,zone:"PRIVATE"}, "guest-room":{col:11,row:10,w:7,h:4,zone:"PRIVATE"},
        kitchen:{col:3,row:9,w:6,h:5,zone:"SERVICE"}, pantry:{col:0,row:8,w:3,h:3,zone:"SERVICE"},
        "servants-hall":{col:0,row:11,w:3,h:3,zone:"SERVICE"}
      },
      pairs: [["entry","great-hall"],["great-hall","drawing-room"],["great-hall","dining-room"],["dining-room","library"],
        ["dining-room","private-hall"],["private-hall","bedroom-suite"],["private-hall","guest-room"],["great-hall","kitchen"],
        ["kitchen","pantry"],["pantry","servants-hall"]]
    }, roomProgram, options);
  }
}
