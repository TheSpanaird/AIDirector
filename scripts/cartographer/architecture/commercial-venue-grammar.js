import { ProgrammaticBuildingGrammar } from "./programmatic-building-grammar.js";

export class CommercialVenueGrammar {
  static GRAMMAR_ID = "COMMERCIAL_VENUE_DISTINCT_V3";
  static CONFIGURATIONS = {
    BAR: ["NEIGHBORHOOD_BAR", "LOUNGE_BAR"],
    TAVERN: ["OPEN_ALEHOUSE", "CITY_TAVERN", "TAVERN_INN"],
    CLUB: ["DANCE_HALL", "VIP_NIGHTCLUB"]
  };

  static build(roomProgram = {}, options = {}) {
    const subtype = this._subtype(options.structureType || roomProgram.structureType || options.layoutProfile);
    const floor = Math.max(1, Number(options.floor || 1));
    const totalLevels = Math.max(1, Number(options.totalLevels || roomProgram.totalLevels || (subtype === "TAVERN" ? 2 : 1)));
    const seed = String(options.layoutSeed || roomProgram.layoutSeed || `${subtype.toLowerCase()}-001`);
    const configuration = this._configuration(subtype, options.venueConfiguration || roomProgram.venueConfiguration, seed);
    const template = floor > 1 ? this._upperTemplate(subtype, configuration, floor) : this._groundTemplates()[configuration];
    if (!template) throw new Error(`Missing commercial venue template ${configuration}.`);

    const result = ProgrammaticBuildingGrammar.build({
      grammarId: this.GRAMMAR_ID,
      profileId: subtype,
      width: template.width,
      height: template.height,
      variants: [`${configuration}_F${floor}_STANDARD`, `${configuration}_F${floor}_MIRRORED`],
      entryId: floor === 1 ? "entry" : null,
      entryFace: template.entryFace || "SOUTH",
      zoneOrder: template.zoneOrder,
      definitions: template.definitions,
      cells: template.cells,
      pairs: template.pairs
    }, roomProgram, {
      ...options,
      floor,
      structureType: subtype,
      layoutSeed: `${seed}-${configuration}-floor-${floor}`
    });

    if (floor === 1) {
      const serviceRoom = result.sectors.find(room =>
        ["kitchen", "drink-prep", "storage", "beverage-store", "barrel-store"].includes(room.sectorId)
      );
      if (!serviceRoom) throw new Error(`${configuration} has no room suitable for a service entrance.`);
      const openingId = `${configuration.toLowerCase()}-service-entry`;
      const serviceFace = this._exteriorFace(serviceRoom, result.envelope);
      result.openings.push(ProgrammaticBuildingGrammar.exteriorOpening(
        serviceRoom,
        serviceFace,
        Number(options.gridSize) || 100,
        { id: openingId, doorType: "LOCKED", connectionType: "SERVICE_DOOR", width: Number(options.gridSize) || 100 }
      ));
      result.openingPlan = { openings: result.openings };
      result.serviceEntrance = { sectorId: serviceRoom.sectorId, openingId };
    }

    result.venueSubtype = subtype;
    result.venueConfiguration = configuration;
    result.floorRole = template.floorRole;
    result.totalLevels = totalLevels;
    result.verticalConnector = {
      connectionId: `${subtype.toLowerCase()}-main-stair`,
      connectionType: "STAIR",
      sectorId: "stair",
      floor,
      anchorId: `${subtype.toLowerCase()}-main-stair-anchor`
    };
    return result;
  }

  static _subtype(value) {
    const subtype = String(value || "BAR").toUpperCase();
    return ["BAR", "TAVERN", "CLUB"].includes(subtype) ? subtype : "BAR";
  }

  static _configuration(subtype, requested, seed) {
    const choices = this.CONFIGURATIONS[subtype];
    const normalized = String(requested || "").toUpperCase();
    return choices.includes(normalized) ? normalized : choices[this._hash(seed) % choices.length];
  }

  static _groundTemplates() {
    return {
      NEIGHBORHOOD_BAR: {
        floorRole: "PUBLIC_BAR_SERVICE", width: 20, height: 14, entryFace: "SOUTH",
        zoneOrder: ["PUBLIC", "BAR", "SERVICE", "PRIVATE", "VERTICAL"],
        definitions: [
          ["entry", "Street Entry", "ENTRY", "ENTRY"], ["taproom", "Taproom", "PUBLIC_ROOM", "HUB"],
          ["bar", "Long Bar", "BAR", "OBJECTIVE"], ["kitchen", "Small Kitchen", "KITCHEN", "OPTIONAL"],
          ["beverage-store", "Beverage Storage", "STORAGE", "OPTIONAL"], ["office", "Manager Office", "OFFICE", "OPTIONAL"],
          ["restroom", "Restrooms", "RESTROOM", "OPTIONAL"], ["stair", "Service Stair", "VERTICAL_ACCESS", "CONNECTOR"]
        ],
        cells: {
          entry:{col:8,row:12,w:4,h:2,zone:"PUBLIC"}, taproom:{col:0,row:4,w:12,h:8,zone:"PUBLIC",shapeType:"PLUS"},
          bar:{col:12,row:4,w:4,h:8,zone:"BAR"}, kitchen:{col:16,row:4,w:4,h:5,zone:"SERVICE"},
          "beverage-store":{col:16,row:9,w:4,h:3,zone:"SERVICE"}, office:{col:12,row:0,w:4,h:4,zone:"PRIVATE"},
          restroom:{col:16,row:0,w:4,h:4,zone:"PUBLIC"}, stair:{col:8,row:0,w:4,h:4,zone:"VERTICAL"}
        },
        pairs:[["entry","taproom"],["taproom","bar"],["bar","kitchen"],["kitchen","beverage-store"],["bar","office"],["office","restroom"],["taproom","stair"]]
      },

      LOUNGE_BAR: {
        floorRole:"LOUNGE_PERFORMANCE_SERVICE", width:24, height:16, entryFace:"SOUTH",
        zoneOrder:["ENTRY","LOUNGE","PERFORMANCE","BAR","SERVICE","PRIVATE"],
        definitions:[
          ["entry","Garden Entry","ENTRY","ENTRY"],["main-lounge","Main Lounge","PUBLIC_ROOM","HUB"],
          ["fireplace-lounge","Fireplace Lounge","LOUNGE","OPTIONAL"],["performance","Performance Corner","STAGE","OBJECTIVE"],
          ["bar","Curved Bar","BAR","OBJECTIVE"],["kitchen","Preparation Kitchen","KITCHEN","OPTIONAL"],
          ["private-room","Private Room","PRIVATE_ROOM","OPTIONAL"],["patio","Covered Patio","PATIO","OPTIONAL"],
          ["restroom","Restrooms","RESTROOM","OPTIONAL"],["stair","Upper Stair","VERTICAL_ACCESS","CONNECTOR"]
        ],
        cells:{
          entry:{col:10,row:14,w:4,h:2,zone:"ENTRY"}, "main-lounge":{col:6,row:5,w:10,h:9,zone:"LOUNGE",shapeType:"OCTAGON"},
          "fireplace-lounge":{col:0,row:5,w:6,h:5,zone:"LOUNGE",shapeType:"CIRCLE"}, performance:{col:0,row:10,w:6,h:4,zone:"PERFORMANCE"},
          bar:{col:16,row:5,w:4,h:9,zone:"BAR"}, kitchen:{col:20,row:5,w:4,h:5,zone:"SERVICE"},
          "private-room":{col:16,row:0,w:8,h:5,zone:"PRIVATE"}, patio:{col:0,row:0,w:10,h:5,zone:"PATIO",shapeType:"PLUS"},
          restroom:{col:20,row:10,w:4,h:4,zone:"PUBLIC"}, stair:{col:10,row:0,w:6,h:5,zone:"VERTICAL"}
        },
        pairs:[["entry","main-lounge"],["main-lounge","fireplace-lounge"],["fireplace-lounge","performance"],["main-lounge","bar"],["bar","kitchen"],["bar","private-room"],["private-room","stair"],["stair","patio"],["kitchen","restroom"]]
      },

      OPEN_ALEHOUSE: {
        floorRole:"OPEN_COMMON_ROOM_SERVICE", width:22, height:16, entryFace:"SOUTH",
        zoneOrder:["ENTRY","PUBLIC","BAR","SERVICE","STORAGE","VERTICAL"],
        definitions:[
          ["entry","Front Entry","ENTRY","ENTRY"],["common-room","Great Common Room","PUBLIC_ROOM","HUB"],
          ["bar","Ale Counter","BAR","OBJECTIVE"],["kitchen","Kitchen","KITCHEN","OPTIONAL"],
          ["pantry","Pantry","STORAGE","OPTIONAL"],["barrel-store","Barrel Store","STORAGE","OPTIONAL"],
          ["restroom","Privies","RESTROOM","OPTIONAL"],["stair","Inn Stair","VERTICAL_ACCESS","CONNECTOR"]
        ],
        cells:{
          entry:{col:8,row:14,w:4,h:2,zone:"ENTRY"}, "common-room":{col:0,row:5,w:14,h:9,zone:"PUBLIC",shapeType:"PLUS"},
          bar:{col:14,row:5,w:4,h:9,zone:"BAR"}, kitchen:{col:14,row:0,w:8,h:5,zone:"SERVICE"},
          pantry:{col:18,row:5,w:4,h:4,zone:"STORAGE"}, "barrel-store":{col:18,row:9,w:4,h:5,zone:"STORAGE"},
          restroom:{col:0,row:0,w:4,h:5,zone:"PUBLIC"}, stair:{col:4,row:0,w:5,h:5,zone:"VERTICAL"}
        },
        pairs:[["entry","common-room"],["common-room","bar"],["bar","kitchen"],["kitchen","pantry"],["pantry","barrel-store"],["common-room","restroom"],["restroom","stair"]]
      },

      CITY_TAVERN: {
        floorRole:"CITY_DINING_GAMING_SERVICE", width:26, height:18, entryFace:"SOUTH",
        zoneOrder:["ENTRY","PUBLIC","PRIVATE_PUBLIC","BAR","SERVICE","VERTICAL"],
        definitions:[
          ["entry","Street Entry","ENTRY","ENTRY"],["taproom","Main Taproom","PUBLIC_ROOM","HUB"],
          ["gaming-room","Gaming Room","GAMING","OPTIONAL"],["private-dining","Private Dining","DINING","OPTIONAL"],
          ["bar","Service Bar","BAR","OBJECTIVE"],["kitchen","Stone Kitchen","KITCHEN","OBJECTIVE"],
          ["pantry","Pantry","STORAGE","OPTIONAL"],["cellar","Cellar Access","STORAGE","OPTIONAL"],
          ["office","Innkeeper Office","OFFICE","OPTIONAL"],["stair","Guest Stair","VERTICAL_ACCESS","CONNECTOR"]
        ],
        cells:{
          entry:{col:9,row:16,w:4,h:2,zone:"ENTRY"}, taproom:{col:0,row:6,w:14,h:10,zone:"PUBLIC",shapeType:"PLUS"},
          "gaming-room":{col:0,row:0,w:7,h:6,zone:"PRIVATE_PUBLIC"}, "private-dining":{col:7,row:0,w:7,h:6,zone:"PRIVATE_PUBLIC",shapeType:"OCTAGON"},
          bar:{col:14,row:6,w:4,h:10,zone:"BAR"}, kitchen:{col:18,row:0,w:8,h:7,zone:"SERVICE"},
          pantry:{col:18,row:7,w:4,h:4,zone:"SERVICE"}, cellar:{col:22,row:7,w:4,h:4,zone:"SERVICE"},
          office:{col:18,row:11,w:4,h:5,zone:"PRIVATE"}, stair:{col:22,row:11,w:4,h:5,zone:"VERTICAL"}
        },
        pairs:[["entry","taproom"],["taproom","gaming-room"],["gaming-room","private-dining"],["taproom","bar"],["bar","kitchen"],["kitchen","pantry"],["pantry","cellar"],["bar","office"],["office","stair"]]
      },

      TAVERN_INN: {
        floorRole:"INN_PUBLIC_SERVICE", width:24, height:18, entryFace:"SOUTH",
        zoneOrder:["ENTRY","PUBLIC","BAR","SERVICE","PRIVATE","VERTICAL"],
        definitions:[
          ["entry","Inn Entry","ENTRY","ENTRY"],["common-room","Inn Common Room","PUBLIC_ROOM","HUB"],
          ["bar","Inn Bar","BAR","OBJECTIVE"],["kitchen","Inn Kitchen","KITCHEN","OBJECTIVE"],
          ["pantry","Pantry","STORAGE","OPTIONAL"],["private-parlor","Private Parlor","PRIVATE_ROOM","OPTIONAL"],
          ["office","Innkeeper Office","OFFICE","OPTIONAL"],["stair","Guest Stair","VERTICAL_ACCESS","CONNECTOR"]
        ],
        cells:{
          entry:{col:8,row:16,w:4,h:2,zone:"ENTRY"}, "common-room":{col:0,row:6,w:14,h:10,zone:"PUBLIC",shapeType:"PLUS"},
          bar:{col:14,row:6,w:4,h:10,zone:"BAR"}, kitchen:{col:18,row:6,w:6,h:6,zone:"SERVICE"},
          pantry:{col:18,row:12,w:6,h:4,zone:"SERVICE"}, "private-parlor":{col:0,row:0,w:8,h:6,zone:"PRIVATE",shapeType:"OCTAGON"},
          office:{col:8,row:0,w:6,h:6,zone:"PRIVATE"}, stair:{col:14,row:0,w:4,h:6,zone:"VERTICAL"}
        },
        pairs:[["entry","common-room"],["common-room","bar"],["bar","kitchen"],["kitchen","pantry"],["common-room","private-parlor"],["private-parlor","office"],["office","stair"]]
      },

      DANCE_HALL: {
        floorRole:"OPEN_DANCE_PERFORMANCE_SERVICE", width:30, height:22, entryFace:"SOUTH",
        zoneOrder:["ENTRY","SECURITY","OPEN_PUBLIC","PERFORMANCE","BAR","SERVICE"],
        definitions:[
          ["entry","Club Entry","ENTRY","ENTRY"],["security","Open Security Lobby","SECURITY","HUB"],
          ["dance-floor","Open Dance Hall","DANCE_FLOOR","OBJECTIVE"],["dj-booth","DJ Booth","STAGE","OBJECTIVE"],
          ["main-bar","Main Bar","BAR","OBJECTIVE"],["lounge","Open Lounge","LOUNGE","OPTIONAL"],
          ["coat-check","Coat Check","SERVICE","OPTIONAL"],["restrooms","Restrooms","RESTROOM","OPTIONAL"],
          ["storage","Club Storage","STORAGE","OPTIONAL"],["stair","Balcony Stair","VERTICAL_ACCESS","CONNECTOR"]
        ],
        cells:{
          entry:{col:12,row:20,w:6,h:2,zone:"ENTRY"}, security:{col:9,row:17,w:12,h:3,zone:"SECURITY"},
          "dance-floor":{col:5,row:5,w:20,h:12,zone:"OPEN_PUBLIC",shapeType:"PLUS"}, "dj-booth":{col:10,row:2,w:10,h:3,zone:"PERFORMANCE"},
          "main-bar":{col:25,row:5,w:5,h:12,zone:"BAR"}, lounge:{col:0,row:5,w:5,h:12,zone:"OPEN_PUBLIC",shapeType:"CIRCLE"},
          "coat-check":{col:5,row:17,w:4,h:3,zone:"SERVICE"}, restrooms:{col:21,row:17,w:9,h:3,zone:"PUBLIC"},
          storage:{col:20,row:0,w:10,h:5,zone:"SERVICE"}, stair:{col:0,row:0,w:10,h:5,zone:"VERTICAL"}
        },
        pairs:[["entry","security"],["security","dance-floor"],["dance-floor","dj-booth"],["dance-floor","main-bar"],["dance-floor","lounge"],["security","coat-check"],["security","restrooms"],["main-bar","storage"],["dj-booth","stair"]]
      },

      VIP_NIGHTCLUB: {
        floorRole:"VIP_DANCE_SECURITY", width:30, height:20, entryFace:"SOUTH",
        zoneOrder:["ENTRY","SECURITY","DANCE","BAR","VIP","SERVICE","VERTICAL"],
        definitions:[
          ["entry","Nightclub Entry","ENTRY","ENTRY"],["security","Security Lobby","SECURITY","HUB"],
          ["dance-floor","Main Dance Floor","DANCE_FLOOR","OBJECTIVE"],["main-bar","Main Bar","BAR","OBJECTIVE"],
          ["vip-lounge","VIP Lounge","VIP","OBJECTIVE"],["private-booths","Private Booths","LOUNGE","OPTIONAL"],
          ["staff-room","Staff Room","SERVICE","OPTIONAL"],["drink-prep","Drink Preparation","KITCHEN","OPTIONAL"],
          ["restrooms","Restrooms","RESTROOM","OPTIONAL"],["office","Club Office","OFFICE","OPTIONAL"],
          ["stair","VIP Balcony Stair","VERTICAL_ACCESS","CONNECTOR"]
        ],
        cells:{
          entry:{col:12,row:18,w:6,h:2,zone:"ENTRY"}, security:{col:10,row:14,w:10,h:4,zone:"SECURITY"},
          "dance-floor":{col:8,row:5,w:14,h:9,zone:"DANCE",shapeType:"PLUS"}, "main-bar":{col:22,row:5,w:4,h:9,zone:"BAR"},
          "vip-lounge":{col:0,row:5,w:8,h:9,zone:"VIP",shapeType:"OCTAGON"}, "private-booths":{col:0,row:0,w:10,h:5,zone:"VIP"},
          "staff-room":{col:26,row:5,w:4,h:5,zone:"SERVICE"}, "drink-prep":{col:26,row:10,w:4,h:4,zone:"SERVICE"},
          restrooms:{col:20,row:14,w:10,h:4,zone:"PUBLIC"}, office:{col:22,row:0,w:8,h:5,zone:"PRIVATE"},
          stair:{col:10,row:0,w:12,h:5,zone:"VERTICAL",shapeType:"CIRCLE"}
        },
        pairs:[["entry","security"],["security","dance-floor"],["dance-floor","main-bar"],["dance-floor","vip-lounge"],["vip-lounge","private-booths"],["main-bar","staff-room"],["staff-room","drink-prep"],["security","restrooms"],["main-bar","office"],["office","stair"]]
      }
    };
  }

  static _upperTemplate(subtype, configuration, floor) {
    if (subtype === "TAVERN") return this._tavernUpper(configuration, floor);
    if (subtype === "CLUB") return this._clubUpper();
    return this._barUpper();
  }

  static _tavernUpper(configuration, floor) {
    const roomCount = configuration === "TAVERN_INN" ? 6 : 4;
    const definitions = [
      ["stair","Guest Stair","VERTICAL_ACCESS","CONNECTOR"],
      ["hall-main","Guest Hall","CORRIDOR","HUB"],
      ["hall-west","West Guest Hall","CORRIDOR","CONNECTOR"],
      ["hall-east","East Guest Hall","CORRIDOR","CONNECTOR"],
      ...Array.from({length:roomCount},(_,i)=>[`guest-${i+1}`,`Guest Bedroom ${i+1}`,"BEDROOM","OPTIONAL"]),
      ["washroom","Shared Washroom","RESTROOM","OPTIONAL"],
      ["linen","Linen Storage","STORAGE","OPTIONAL"],
      ["innkeeper","Innkeeper Quarters","CREW_QUARTERS","OPTIONAL"]
    ];
    const cells = {
      stair:{col:18,row:5,w:4,h:4,zone:"VERTICAL"},
      "hall-main":{col:6,row:5,w:10,h:5,zone:"HALL",shapeType:"PLUS"},
      "hall-west":{col:4,row:3,w:2,h:9,zone:"HALL"},
      "hall-east":{col:16,row:3,w:2,h:9,zone:"HALL"},
      "guest-1":{col:6,row:0,w:5,h:5,zone:"GUEST"},
      "guest-2":{col:11,row:0,w:5,h:5,zone:"GUEST"},
      "guest-3":{col:0,row:3,w:4,h:4,zone:"GUEST"},
      "guest-4":{col:0,row:7,w:4,h:5,zone:"GUEST"},
      "guest-5":{col:6,row:10,w:5,h:5,zone:"GUEST"},
      "guest-6":{col:11,row:10,w:5,h:5,zone:"GUEST"},
      washroom:{col:18,row:9,w:4,h:3,zone:"SERVICE"},
      linen:{col:16,row:12,w:6,h:3,zone:"SERVICE"},
      innkeeper:{col:16,row:0,w:6,h:3,zone:"PRIVATE",shapeType:"OCTAGON"}
    };
    const active = new Set(definitions.map(item=>item[0]));
    const pairs = [
      ["stair","hall-east"],["hall-east","hall-main"],["hall-main","hall-west"],
      ["hall-main","guest-1"],["hall-main","guest-2"],["hall-west","guest-3"],["hall-west","guest-4"],
      ["hall-main","guest-5"],["hall-main","guest-6"],["hall-east","washroom"],["hall-east","linen"],["hall-east","innkeeper"]
    ].filter(([a,b])=>active.has(a)&&active.has(b));
    return {
      floorRole:floor===2?"GUEST_ROOMS":"PRIVATE_GUEST_ROOMS", width:22, height:15, entryFace:"EAST",
      zoneOrder:["VERTICAL","HALL","GUEST","SERVICE","PRIVATE"], definitions,
      cells:Object.fromEntries(Object.entries(cells).filter(([id])=>active.has(id))), pairs
    };
  }

  static _clubUpper() {
    return {
      floorRole:"VIP_BALCONY", width:18, height:12, entryFace:"WEST",
      zoneOrder:["VERTICAL","VIP","BAR","PRIVATE","SERVICE"],
      definitions:[
        ["stair","VIP Stair","VERTICAL_ACCESS","CONNECTOR"],["balcony","Dance Floor Balcony","VIP","HUB"],
        ["vip-lounge","Upper VIP Lounge","VIP","OBJECTIVE"],["private-booths","Private Booths","LOUNGE","OPTIONAL"],
        ["upper-bar","Upper Bar","BAR","OPTIONAL"],["office","Promoter Office","OFFICE","OPTIONAL"],
        ["restroom","VIP Restroom","RESTROOM","OPTIONAL"]
      ],
      cells:{
        stair:{col:0,row:4,w:3,h:4,zone:"VERTICAL"}, balcony:{col:3,row:3,w:7,h:6,zone:"VIP",shapeType:"PLUS"},
        "vip-lounge":{col:3,row:0,w:7,h:3,zone:"VIP"}, "private-booths":{col:10,row:0,w:8,h:4,zone:"VIP",shapeType:"OCTAGON"},
        "upper-bar":{col:10,row:4,w:4,h:5,zone:"BAR"}, restroom:{col:14,row:4,w:4,h:5,zone:"PUBLIC"},
        office:{col:3,row:9,w:7,h:3,zone:"PRIVATE"}
      },
      pairs:[["stair","balcony"],["balcony","vip-lounge"],["vip-lounge","private-booths"],["balcony","upper-bar"],["upper-bar","restroom"],["balcony","office"]]
    };
  }

  static _barUpper() {
    return {
      floorRole:"PRIVATE_LOUNGE_OFFICES", width:14, height:12, entryFace:"WEST",
      zoneOrder:["VERTICAL","PRIVATE","SERVICE"],
      definitions:[
        ["stair","Upper Stair","VERTICAL_ACCESS","CONNECTOR"],["landing","Upper Landing","HALL","HUB"],
        ["private-lounge","Private Lounge","LOUNGE","OBJECTIVE"],["office","Owner Office","OFFICE","OPTIONAL"],
        ["storage","Upper Storage","STORAGE","OPTIONAL"],["restroom","Private Restroom","RESTROOM","OPTIONAL"]
      ],
      cells:{
        stair:{col:0,row:4,w:3,h:4,zone:"VERTICAL"}, landing:{col:3,row:3,w:5,h:6,zone:"PRIVATE",shapeType:"PLUS"},
        "private-lounge":{col:3,row:0,w:7,h:3,zone:"PRIVATE",shapeType:"OCTAGON"}, office:{col:8,row:3,w:6,h:4,zone:"PRIVATE"},
        restroom:{col:8,row:7,w:3,h:3,zone:"SERVICE"}, storage:{col:11,row:7,w:3,h:3,zone:"SERVICE"}
      },
      pairs:[["stair","landing"],["landing","private-lounge"],["landing","office"],["office","restroom"],["restroom","storage"]]
    };
  }

  static _exteriorFace(room, envelope) {
    const b = room.bounds || room.pixelBounds;
    const e = envelope;
    const tolerance = 0.01;
    const candidates = [];
    if (Math.abs(b.x - e.x) <= tolerance) candidates.push("WEST");
    if (Math.abs((b.x + b.width) - (e.x + e.width)) <= tolerance) candidates.push("EAST");
    if (Math.abs(b.y - e.y) <= tolerance) candidates.push("NORTH");
    if (Math.abs((b.y + b.height) - (e.y + e.height)) <= tolerance) candidates.push("SOUTH");
    if (!candidates.length) throw new Error(`Service room ${room.sectorId} does not touch the exterior envelope.`);
    return candidates.includes("EAST") ? "EAST" : candidates[0];
  }

  static _hash(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}
