// footprint-design-engine.js
import { FootprintDesignLibrary }
  from "/modules/ai-director/scripts/cartographer/footprint-design-library.js";

export class FootprintDesignEngine {
  static design(sectors = [], profile = {}, config = {}, manifest = {}) {
    const contract = FootprintDesignLibrary.resolve(profile, manifest, sectors);
    if (!sectors.length || contract.archetype === "NATURAL_BRANCHING") {
      return { sectors, contract, skeleton: [], envelope: null };
    }

    const architecturalSectors = sectors.map(sector =>
      this._applyArchitecturalShapePolicy(sector, contract)
    );

    const gap = Math.max(2, Math.round((Number(config.corridorWidth) || 200) / (Number(config.gridSize) || 100)));
    const methods = {
      FORTIFIED_COURTYARD: "_fortifiedCourtyard",
      LAYERED_FORTRESS: "_fortifiedCourtyard",
      COURTYARD_HOUSE: "_courtyard",
      AISLE_BUILDING: "_aisle",
      PUBLIC_SERVICE_BUILDING: "_publicService",
      RESIDENTIAL_BLOCK: "_zonedBlock",
      MODULAR_BLOCK: "_zonedBlock",
      MODULAR_HUB: "_zonedBlock",
      LINEAR_HULL: "_aisle",
      ZONED_BLOCK: "_zonedBlock"
    };
    const method = methods[contract.archetype] || "_zonedBlock";
    return {
      ...this[method](architecturalSectors, contract, gap),
      contract
    };
  }

  static _fortifiedCourtyard(sectors, contract, gap) {
    const towers = sectors.filter(sector => this._purpose(sector).includes("TOWER"));
    const courtyard = sectors.find(sector => this._zone(sector, contract) === "CORE");
    const entry = sectors.find(sector => this._zone(sector, contract) === "ENTRY");
    const others = sectors.filter(sector => !towers.includes(sector) && sector !== courtyard && sector !== entry);
    const maxW = Math.max(...sectors.map(sector => sector.gridDimensions.w), 6);
    const maxH = Math.max(...sectors.map(sector => sector.gridDimensions.h), 6);
    const courtW = Math.max(courtyard?.gridDimensions.w || 0, maxW * 2);
    const courtH = Math.max(courtyard?.gridDimensions.h || 0, maxH * 2);
    const left = maxW;
    const top = maxH;
    const right = left + courtW + gap * 2;
    const bottom = top + courtH + gap * 2;
    const output = [];
    if (courtyard) output.push(this._place(courtyard, left + gap, top + gap, "CORE"));
    const corners = { NW: [0, 0], NE: [right, 0], SW: [0, bottom], SE: [right, bottom] };
    const unused = ["NW", "NE", "SW", "SE"];
    for (const tower of towers) {
      const text = `${tower.sectorId} ${tower.name}`.toUpperCase();
      let compass = ["NW", "NE", "SW", "SE"].find(value => text.includes(value)) ||
        (text.includes("NORTHWEST") ? "NW" : text.includes("NORTHEAST") ? "NE" : text.includes("SOUTHWEST") ? "SW" : text.includes("SOUTHEAST") ? "SE" : unused[0]);
      if (!unused.includes(compass)) compass = unused[0] || compass;
      unused.splice(unused.indexOf(compass), 1);
      output.push({ ...this._place(tower, corners[compass][0], corners[compass][1], "PERIMETER"), compassPosition: compass, shapeType: tower.shapeType || "TOWER_SQUARE" });
    }
    if (entry) output.push(this._place(entry, left + Math.max(0, Math.floor((courtW - entry.gridDimensions.w) / 2)), bottom, "ENTRY"));
    const offsets = { NORTH: left, SOUTH: left, WEST: top, EAST: top };
    for (const sector of others) {
      const zone = this._zone(sector, contract);
      const side = zone === "RESTRICTED" || zone === "CORE" ? "NORTH" : zone === "SERVICE" ? "WEST" : zone === "PUBLIC" ? "SOUTH" : "EAST";
      const { w, h } = sector.gridDimensions;
      let col, row;
      if (side === "NORTH") { col = offsets.NORTH; row = Math.max(0, top - h); offsets.NORTH += w; }
      else if (side === "SOUTH") { col = offsets.SOUTH; row = bottom; offsets.SOUTH += w; }
      else if (side === "WEST") { col = Math.max(0, left - w); row = offsets.WEST; offsets.WEST += h; }
      else { col = right; row = offsets.EAST; offsets.EAST += h; }
      output.push(this._place(sector, col, row, zone));
    }
    return { sectors: this._normalize(output), skeleton: this._ring(left + gap, top, right, bottom), envelope: { left: 0, top: 0, right: right + maxW, bottom: bottom + maxH } };
  }

  static _courtyard(sectors, contract, gap) {
    return this._fortifiedCourtyard(sectors, contract, gap);
  }

  static _aisle(sectors, contract, gap) {
    const left = [], right = [], ends = [];
    sectors.forEach(sector => {
      const zone = this._zone(sector, contract);
      if (zone === "ENTRY" || zone === "CORE") ends.push(sector);
      else (left.length <= right.length ? left : right).push(sector);
    });
    const leftW = Math.max(...left.map(sector => sector.gridDimensions.w), 4);
    const aisleX = leftW + gap;
    let leftY = 0, rightY = 0;
    const output = [];
    left.forEach(sector => { output.push(this._place(sector, 0, leftY, this._zone(sector, contract))); leftY += sector.gridDimensions.h; });
    right.forEach(sector => { output.push(this._place(sector, aisleX + gap, rightY, this._zone(sector, contract))); rightY += sector.gridDimensions.h; });
    const length = Math.max(leftY, rightY, 8);
    ends.forEach((sector, index) => output.push(this._place(sector, aisleX - Math.floor(sector.gridDimensions.w / 2), index ? length : 0, this._zone(sector, contract))));
    return { sectors: this._normalize(output), skeleton: [{ x1: aisleX, y1: 0, x2: aisleX, y2: length }], envelope: { left: 0, top: 0, right: aisleX + gap + Math.max(...right.map(sector => sector.gridDimensions.w), 4), bottom: length + Math.max(...ends.map(sector => sector.gridDimensions.h), 0) } };
  }

  static _publicService(sectors, contract, gap) {
    return this._zonedBlock(sectors, contract, gap);
  }

  static _zonedBlock(sectors, contract, gap) {
    const hallWidth = Math.max(2, gap);
    const preferredLeft = new Set(["ENTRY", "PUBLIC"]);
    const left = [];
    const right = [];
    let leftHeight = 0;
    let rightHeight = 0;

    for (const sector of sectors) {
      const zone = this._zone(sector, contract);
      const preferred = preferredLeft.has(zone) ? left : right;
      const alternate = preferred === left ? right : left;
      const preferredHeight = preferred === left ? leftHeight : rightHeight;
      const alternateHeight = preferred === left ? rightHeight : leftHeight;
      const target = preferredHeight <= alternateHeight + sector.gridDimensions.h
        ? preferred
        : alternate;
      target.push(sector);
      if (target === left) leftHeight += sector.gridDimensions.h;
      else rightHeight += sector.gridDimensions.h;
    }

    if (!left.length && right.length) left.push(right.shift());
    if (!right.length && left.length > 1) right.push(left.pop());

    const leftWidth = Math.max(...left.map(room => room.gridDimensions.w), 4);
    const rightWidth = Math.max(...right.map(room => room.gridDimensions.w), 4);
    const hallLeft = leftWidth;
    const hallCenter = hallLeft + hallWidth / 2;
    const rightX = hallLeft + hallWidth;
    const output = [];

    let y = 0;
    for (const room of left) {
      output.push(this._place(
        room,
        hallLeft - room.gridDimensions.w,
        y,
        this._zone(room, contract)
      ));
      y += room.gridDimensions.h;
    }
    leftHeight = y;

    y = 0;
    for (const room of right) {
      output.push(this._place(
        room,
        rightX,
        y,
        this._zone(room, contract)
      ));
      y += room.gridDimensions.h;
    }
    rightHeight = y;

    const height = Math.max(leftHeight, rightHeight, 8);
    return {
      sectors: this._normalize(output),
      skeleton: [{ x1: hallCenter, y1: 0, x2: hallCenter, y2: height }],
      envelope: {
        left: 0,
        top: 0,
        right: rightX + rightWidth,
        bottom: height
      },
      hall: {
        left: hallLeft,
        right: rightX,
        center: hallCenter,
        top: 0,
        bottom: height
      }
    };
  }

  static _zone(sector, contract) {
    return contract.zones?.find(zone => zone.sectorId === sector.sectorId)?.zone || "GENERAL";
  }
  static _ring(left, top, right, bottom) { return [{ x1: left, y1: top, x2: right, y2: top }, { x1: right, y1: top, x2: right, y2: bottom }, { x1: right, y1: bottom, x2: left, y2: bottom }, { x1: left, y1: bottom, x2: left, y2: top }]; }
  static _place(sector, col, row, zone) {
    return {
      ...sector,
      gridPosition: {
        col: Math.round(col),
        row: Math.round(row)
      },
      architecturalZone: zone,
      footprintZone: zone
    };
  }

  static _applyArchitecturalShapePolicy(sector, contract) {
    const purpose = this._purpose(sector);
    const currentShape = String(sector.shapeType || "").toUpperCase();
    const explicitShape = Boolean(currentShape) &&
      sector.shapeTypeSource !== "ARCHITECTURAL_DEFAULT";

    if (purpose.includes("TOWER")) {
      return {
        ...sector,
        shapeType: currentShape || "TOWER_SQUARE",
        shapeTypeSource: explicitShape
          ? "EXPLICIT"
          : "FOOTPRINT_POLICY"
      };
    }

    if (explicitShape && sector.allowComplexShape === true) {
      return {
        ...sector,
        shapeTypeSource: "EXPLICIT"
      };
    }

    return {
      ...sector,
      shapeType: "RECTANGLE",
      shapeTypeSource: "FOOTPRINT_POLICY",
      footprintArchetype: contract.archetype,
      allowComplexShape: false
    };
  }
  static _normalize(sectors) { const minCol = Math.min(...sectors.map(sector => sector.gridPosition.col)); const minRow = Math.min(...sectors.map(sector => sector.gridPosition.row)); return sectors.map(sector => ({ ...sector, gridPosition: { col: sector.gridPosition.col - minCol, row: sector.gridPosition.row - minRow } })); }
  static _purpose(sector) { return String(sector.purpose || sector.sectorPurpose || sector.roomType || sector.name || "ROOM").toUpperCase().replace(/[^A-Z0-9]+/g, "_"); }
}
