import { HouseGrammar } from "./house-grammar.js";
import { FreighterGrammar } from "./freighter-grammar.js";
import { GunshipGrammar } from "./gunship-grammar.js";
import { ResearchVesselGrammar } from "./research-vessel-grammar.js";
import { SkydockHangarGrammar } from "./skydock-hangar-grammar.js";
import { ManorGrammar } from "./manor-grammar.js";
import { CommercialVenueGrammar } from "./commercial-venue-grammar.js";
import { CovertSiteGrammar } from "./covert-site-grammar.js";
import { FortifiedSiteGrammar } from "./fortified-site-grammar.js";
import { FacilityGrammar } from "./facility-grammar.js";
import { SpaceStationGrammar } from "./space-station-grammar.js";

export class ArchitecturalGrammarRegistry {
  static GRAMMARS = new Map([
    ["HOUSE", HouseGrammar],
    ["MANOR", ManorGrammar],
    ["BAR", CommercialVenueGrammar],
    ["TAVERN", CommercialVenueGrammar],
    ["CLUB", CommercialVenueGrammar],
    ["HIDEOUT", CovertSiteGrammar],
    ["SAFEHOUSE", CovertSiteGrammar],
    ["SECRET_BASE", CovertSiteGrammar],
    ["FORT", FortifiedSiteGrammar],
    ["OUTPOST", FortifiedSiteGrammar],
    ["CASTLE", FortifiedSiteGrammar],
    ["FORTRESS", FortifiedSiteGrammar],
    ["FACILITY", FacilityGrammar],
    ["SPACE_STATION", SpaceStationGrammar],
    ["FREIGHTER", FreighterGrammar],
    ["GUNSHIP", GunshipGrammar],
    ["RESEARCH_VESSEL", ResearchVesselGrammar],
    ["SKYDOCK_HANGAR", SkydockHangarGrammar],
    ["FLOOR_12_SKYDOCK", SkydockHangarGrammar]
  ]);

  static resolve(structureType) {
    return this.GRAMMARS.get(String(structureType || "").toUpperCase()) || null;
  }

  static build(structureType, roomProgram = {}, options = {}) {
    const grammar = this.resolve(structureType);
    if (!grammar) throw new Error(`No architectural grammar registered for ${structureType}.`);
    return grammar.build(roomProgram, { ...options, structureType });
  }
}
