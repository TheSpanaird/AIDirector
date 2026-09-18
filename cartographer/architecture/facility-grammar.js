import { ProgrammaticBuildingGrammar } from "./programmatic-building-grammar.js";
export class FacilityGrammar {
  static GRAMMAR_ID = "FACILITY_SERVICE_SPINE_V1";
  static build(roomProgram = {}, options = {}) {
    const result=ProgrammaticBuildingGrammar.build({
      grammarId:this.GRAMMAR_ID,profileId:"FACILITY",width:22,height:14,variants:["STANDARD","MIRRORED"],entryId:"entry",entryFace:"WEST",
      zoneOrder:["ACCESS","ADMIN","OPERATIONS","SERVICE","SECURE"],
      definitions:[["entry","Main Entry","ENTRY","ENTRY"],["security","Security","SECURITY","OPTIONAL"],
        ["service-spine","Service Spine","HALL","HUB"],["work-area","Primary Work Area","WORK_AREA","OBJECTIVE"],
        ["laboratory","Laboratory","LABORATORY","OPTIONAL"],["storage","Storage","STORAGE","OBJECTIVE"],
        ["office","Administration","OFFICE","OPTIONAL"],["utility","Utility","UTILITY","OPTIONAL"],
        ["maintenance","Maintenance","MAINTENANCE","OPTIONAL"],["secure-room","Secure Room","SECURE_HOLDING","OPTIONAL"]],
      cells:{entry:{col:0,row:5,w:3,h:4,zone:"ACCESS"},security:{col:3,row:5,w:3,h:4,zone:"ACCESS"},
        "service-spine":{col:6,row:5,w:10,h:4,zone:"CIRCULATION"},"work-area":{col:6,row:0,w:6,h:5,zone:"OPERATIONS"},
        laboratory:{col:12,row:0,w:4,h:5,zone:"OPERATIONS"},storage:{col:16,row:0,w:6,h:5,zone:"SERVICE"},
        office:{col:3,row:0,w:3,h:5,zone:"ADMIN"},utility:{col:6,row:9,w:4,h:5,zone:"SERVICE"},
        maintenance:{col:10,row:9,w:6,h:5,zone:"SERVICE"},"secure-room":{col:16,row:9,w:6,h:5,zone:"SECURE"}},
      pairs:[["entry","security"],["security","service-spine"],["service-spine","work-area"],["service-spine","laboratory"],
        ["laboratory","storage"],["security","office"],["service-spine","utility"],["service-spine","maintenance"],
        ["maintenance","secure-room",{doorType:"LOCKED",connectionType:"LOCKED_DOOR"}]]
    },roomProgram,options);
    result.ventilation={enabled:true,networkType:"AIR_DUCT",visibility:"HIDDEN",elevationBottom:10,elevationTop:15,
      connections:["work-area","laboratory","storage","maintenance","secure-room"].map((to,index)=>({from:"utility",to,accessType:"VENT_GRATE",size:index<2?"MEDIUM":"SMALL"}))};
    return result;
  }
}
