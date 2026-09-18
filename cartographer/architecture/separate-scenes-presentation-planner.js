// separate-scenes-presentation-planner.js
// Converts coordinated floor results into one scene plan per floor.

export class SeparateScenesPresentationPlanner {
  static plan(coordinated = {}, options = {}) {
    const floors = Array.isArray(coordinated.floors) ? coordinated.floors : [];
    if (!floors.length) {
      throw new Error("SeparateScenesPresentationPlanner requires coordinated floors.");
    }

    const gridSize = Math.max(1, Number(options.gridSize) || 100);
    const margin = Math.max(gridSize, Number(options.margin) || gridSize * 4);
    const structureId = String(
      options.structureId || coordinated.structureId || `structure-${Date.now()}`
    ).trim();
    const structureName = String(
      options.structureName || coordinated.structureName || "Multi-Level Structure"
    ).trim();

    const scenePlans = floors.map(item => {
      const dx = margin - item.bounds.x;
      const dy = margin - item.bounds.y;
      const result = this._translateResult(item.result, dx, dy);
      const contentBounds = {
        x: margin,
        y: margin,
        width: item.bounds.width,
        height: item.bounds.height
      };

      return {
        structureId,
        structureName,
        floorPresentation: "SEPARATE_SCENES",
        floor: item.floor,
        floorName: item.floorDefinition?.name || `Floor ${item.floor}`,
        floorRole: item.floorDefinition?.role || "GENERAL",
        sceneName: `${structureName} | ${item.floorDefinition?.name || `Floor ${item.floor}`}`,
        translation: { dx, dy },
        contentBounds,
        scene: {
          width: Math.ceil(item.bounds.width + margin * 2),
          height: Math.ceil(item.bounds.height + margin * 2),
          padding: Number(options.padding ?? 0.02),
          gridSize
        },
        result,
        verticalAnchors: result.verticalAnchors || []
      };
    });

    return {
      floorPresentation: "SEPARATE_SCENES",
      structureId,
      structureName,
      scenes: scenePlans,
      verticalConnections: structuredClone(coordinated.verticalConnections || []),
      metrics: {
        sceneCount: scenePlans.length,
        floorCount: scenePlans.length,
        sectorCount: scenePlans.reduce(
          (sum, plan) => sum + plan.result.sectors.length,
          0
        )
      }
    };
  }

  static _translateResult(result, dx, dy) {
    const translatePoint = point => ({
      ...point,
      x: Number(point.x) + dx,
      y: Number(point.y) + dy
    });

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
    const rectangles = (result.normalizedTopology?.rectangles || []).map(rectangle => ({
      ...rectangle,
      x: Number(rectangle.x) + dx,
      y: Number(rectangle.y) + dy
    }));
    const junctions = (result.normalizedTopology?.junctions || []).map(junction => ({
      ...junction,
      x: Number(junction.x) + dx,
      y: Number(junction.y) + dy
    }));

    return {
      ...result,
      sectors,
      openings,
      openingPlan: { openings },
      verticalAnchors,
      normalizedTopology: {
        ...(result.normalizedTopology || {}),
        rectangles,
        junctions
      },
      floors: {
        [result.floor]: {
          floor: result.floor,
          sectors
        }
      }
    };
  }
}
