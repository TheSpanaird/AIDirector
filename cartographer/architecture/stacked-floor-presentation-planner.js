// stacked-floor-presentation-planner.js
// Presents floors using one shared building-local reference frame.

export class StackedFloorPresentationPlanner {
  static plan(coordinated = {}, options = {}) {
    const floors = Array.isArray(coordinated.floors)
      ? coordinated.floors
      : [];
    if (!floors.length) throw new Error("No coordinated floors were supplied.");

    const margin = Math.max(0, Number(options.margin) || 300);
    const gutter = Math.max(200, Number(options.gutter) || 600);
    const labelBand = Math.max(80, Number(options.labelBand) || 160);
    const isolationClearance = Math.max(
      50,
      Number(options.isolationClearance) || 100
    );
    const layout = String(options.layout || "VERTICAL").toUpperCase();

    const sharedOrigin = {
      x: Math.min(...floors.map(item => item.bounds.x)),
      y: Math.min(...floors.map(item => item.bounds.y))
    };
    const sharedRight = Math.max(
      ...floors.map(item => item.bounds.x + item.bounds.width)
    );
    const sharedBottom = Math.max(
      ...floors.map(item => item.bounds.y + item.bounds.height)
    );
    const sharedWidth = sharedRight - sharedOrigin.x;
    const sharedHeight = sharedBottom - sharedOrigin.y;

    let cursorX = margin;
    let cursorY = margin;
    let sceneRight = 0;
    let sceneBottom = 0;

    const plannedFloors = floors.map(item => {
      const frameX = cursorX;
      const frameY = cursorY + labelBand;
      const dx = frameX - sharedOrigin.x;
      const dy = frameY - sharedOrigin.y;
      const result = this._translateResult(item.result, dx, dy);

      const bounds = {
        x: item.bounds.x + dx,
        y: item.bounds.y + dy,
        width: item.bounds.width,
        height: item.bounds.height
      };
      const sharedFrameBounds = {
        x: frameX,
        y: frameY,
        width: sharedWidth,
        height: sharedHeight
      };
      const sectionBounds = {
        x: sharedFrameBounds.x - isolationClearance,
        y: sharedFrameBounds.y - isolationClearance,
        width: sharedFrameBounds.width + isolationClearance * 2,
        height: sharedFrameBounds.height + isolationClearance * 2
      };

      const planned = {
        ...item,
        translation: { dx, dy },
        sharedOrigin: { ...sharedOrigin },
        result,
        bounds,
        sharedFrameBounds,
        sectionBounds,
        label: {
          floor: item.floor,
          text: item.floorDefinition.name || `Floor ${item.floor}`,
          role: item.floorDefinition.role || "GENERAL",
          x: sectionBounds.x,
          y: cursorY + 20,
          width: sectionBounds.width,
          height: 70
        },
        isolationSegments: this._rectangleSegments(
          sectionBounds,
          item.floor
        )
      };

      sceneRight = Math.max(
        sceneRight,
        sectionBounds.x + sectionBounds.width
      );
      sceneBottom = Math.max(
        sceneBottom,
        sectionBounds.y + sectionBounds.height
      );

      if (layout === "HORIZONTAL") {
        cursorX = sectionBounds.x + sectionBounds.width + gutter;
      } else {
        cursorY = sectionBounds.y + sectionBounds.height + gutter;
      }
      return planned;
    });

    const width = Math.ceil(sceneRight + margin);
    const height = Math.ceil(sceneBottom + margin);

    return {
      floorPresentation: "STACKED_CANVAS",
      layout,
      floors: plannedFloors,
      scene: {
        width,
        height,
        padding: Number(options.padding ?? 0.02)
      },
      combinedBounds: { x: 0, y: 0, width, height },
      sharedBuildingFrame: {
        origin: sharedOrigin,
        width: sharedWidth,
        height: sharedHeight
      },
      isolation: {
        technical: true,
        clearance: isolationClearance
      },
      valid: !this._hasOverlap(plannedFloors),
      metrics: {
        floors: plannedFloors.length,
        gutter,
        margin,
        labelBand,
        isolationClearance,
        sharedWidth,
        sharedHeight
      }
    };
  }

  static _translateResult(result, dx, dy) {
    const sectors = result.sectors.map(sector => {
      const source = sector.bounds || sector.pixelBounds;
      const bounds = {
        x: source.x + dx,
        y: source.y + dy,
        width: source.width,
        height: source.height
      };
      return {
        ...sector,
        bounds: { ...bounds },
        pixelBounds: { ...bounds },
        center: {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2
        }
      };
    });

    const translatePoint = value => ({
      ...value,
      x: value.x + dx,
      y: value.y + dy
    });
    const openings = (result.openings || []).map(opening => ({
      ...opening,
      location: translatePoint(opening.location),
      requestedLocation: opening.requestedLocation
        ? translatePoint(opening.requestedLocation)
        : undefined
    }));
    const verticalAnchors = (result.verticalAnchors || []).map(anchor => ({
      ...anchor,
      location: translatePoint(anchor.location)
    }));

    return {
      ...result,
      sectors,
      openings,
      openingPlan: { openings },
      verticalAnchors,
      floors: {
        [result.floor]: {
          floor: result.floor,
          sectors
        }
      }
    };
  }

  static _rectangleSegments(bounds, floor) {
    const x1 = bounds.x;
    const y1 = bounds.y;
    const x2 = bounds.x + bounds.width;
    const y2 = bounds.y + bounds.height;
    return [
      [x1, y1, x2, y1],
      [x2, y1, x2, y2],
      [x2, y2, x1, y2],
      [x1, y2, x1, y1]
    ].map((coordinates, segmentIndex) => ({
      floor,
      segmentIndex,
      x1: coordinates[0],
      y1: coordinates[1],
      x2: coordinates[2],
      y2: coordinates[3],
      source: "STACKED_FLOOR_TECHNICAL_ISOLATION"
    }));
  }

  static _hasOverlap(floors) {
    for (let i = 0; i < floors.length; i++) {
      for (let j = i + 1; j < floors.length; j++) {
        const a = floors[i].sectionBounds;
        const b = floors[j].sectionBounds;
        if (!(
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y
        )) return true;
      }
    }
    return false;
  }
}
