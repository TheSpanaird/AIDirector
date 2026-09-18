// floor-layout-coordinator.js
// Runs one grammar per floor and validates approximate vertical alignment.

export class FloorLayoutCoordinator {
  static coordinate(manifest = {}, grammar, options = {}) {
    if (!grammar || typeof grammar.build !== "function") {
      throw new Error("FloorLayoutCoordinator requires a grammar with build().");
    }

    const floors = Array.isArray(manifest.floors) ? [...manifest.floors] : [];
    const sectors = Array.isArray(manifest.sectors) ? manifest.sectors : [];
    const connections = Array.isArray(manifest.verticalConnections)
      ? manifest.verticalConnections
      : [];

    if (!floors.length) throw new Error("No floors were declared.");

    const gridSize = Math.max(1, Number(options.gridSize) || 100);
    const localOrigin = {
      x: Number(options.originX) || 0,
      y: Number(options.originY) || 0
    };
    const defaultTolerance = Math.max(
      0,
      Number(options.verticalAlignmentTolerance) || gridSize * 3
    );

    const constraints = this._buildAnchorConstraints(
      connections,
      sectors,
      gridSize,
      defaultTolerance,
      options.verticalAnchorDefaults || {}
    );

    const results = floors
      .sort((a, b) => Number(a.floor) - Number(b.floor))
      .map(floorDefinition => {
        const floor = Number(floorDefinition.floor);
        const floorSectors = sectors.filter(
          sector => Number(sector.floor) === floor
        );
        if (!floorSectors.length) throw new Error(`Floor ${floor} has no sectors.`);

        const floorConstraints = constraints.filter(
          constraint => Number(constraint.floor) === floor
        );
        const floorManifest = {
          ...structuredClone(manifest),
          floorCount: 1,
          floors: [structuredClone(floorDefinition)],
          sectors: structuredClone(floorSectors),
          verticalConnections: structuredClone(
            connections.filter(connection =>
              Number(connection.from?.floor) === floor ||
              Number(connection.to?.floor) === floor
            )
          ),
          verticalAnchorConstraints: structuredClone(floorConstraints)
        };

        const result = grammar.build(floorManifest, {
          ...options,
          floor,
          floorDefinition: structuredClone(floorDefinition),
          verticalAnchorConstraints: structuredClone(floorConstraints),
          layoutSeed: `${manifest.layoutSeed || "multi-level"}-floor-${floor}`
        });
        if (!result?.sectors?.length) {
          throw new Error(`Grammar returned no sectors for floor ${floor}.`);
        }

        const bounds = this._bounds(result.sectors);
        const verticalAnchors = this._resolveAnchors(
          floor,
          result.sectors,
          floorConstraints,
          localOrigin
        );

        return {
          floor,
          floorDefinition: structuredClone(floorDefinition),
          manifest: floorManifest,
          bounds,
          verticalAnchors,
          result: { ...result, floor, verticalAnchors }
        };
      });

    const anchorAlignment = this.validateAnchorAlignment(
      results,
      connections,
      defaultTolerance
    );

    return {
      floorPresentation: manifest.floorPresentation || "STACKED_CANVAS",
      floors: results,
      verticalConnections: structuredClone(connections),
      verticalAnchorConstraints: constraints,
      localOrigin,
      anchorAlignment,
      combinedBounds: this._combine(results.map(item => item.bounds)),
      metrics: {
        floorCount: results.length,
        sectorCount: results.reduce(
          (sum, item) => sum + item.result.sectors.length,
          0
        ),
        verticalAnchorCount: results.reduce(
          (sum, item) => sum + item.verticalAnchors.length,
          0
        ),
        verticalAlignmentTolerance: defaultTolerance
      }
    };
  }

  static _buildAnchorConstraints(
    connections,
    sectors,
    gridSize,
    defaultTolerance,
    defaults
  ) {
    const sectorIds = new Set(sectors.map(sector => sector.sectorId));
    return connections.flatMap((connection, index) => {
      const localGrid = connection.localGrid || {
        col: Number(defaults.col ?? 10),
        row: Number(defaults.row ?? 3 + index * 4)
      };
      const tolerance = Math.max(
        0,
        Number(connection.alignmentTolerance ?? defaultTolerance)
      );

      return [connection.from, connection.to].map(endpoint => {
        if (!sectorIds.has(endpoint?.sectorId)) {
          throw new Error(
            `Connector ${connection.connectionId} references missing sector ${endpoint?.sectorId}.`
          );
        }
        return {
          connectionId: connection.connectionId,
          connectionType: connection.connectionType,
          anchorId: endpoint.anchorId,
          sectorId: endpoint.sectorId,
          floor: Number(endpoint.floor),
          localGrid: {
            col: Number(localGrid.col),
            row: Number(localGrid.row)
          },
          desiredLocalLocation: {
            x: Number(localGrid.col) * gridSize,
            y: Number(localGrid.row) * gridSize
          },
          tolerance
        };
      });
    });
  }

  static _resolveAnchors(floor, sectors, constraints, localOrigin) {
    const byId = new Map(sectors.map(sector => [sector.sectorId, sector]));
    return constraints.map(constraint => {
      const sector = byId.get(constraint.sectorId);
      if (!sector) {
        throw new Error(
          `Missing anchor sector ${constraint.sectorId} on floor ${floor}.`
        );
      }
      const bounds = sector.bounds || sector.pixelBounds;
      const location = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2
      };
      return {
        ...constraint,
        floor,
        location,
        localLocation: {
          x: location.x - localOrigin.x,
          y: location.y - localOrigin.y
        }
      };
    });
  }

  static validateAnchorAlignment(results, connections, defaultTolerance = 300) {
    const anchors = results.flatMap(item => item.verticalAnchors);
    const problems = [];
    const measurements = [];

    for (const connection of connections) {
      const pair = anchors.filter(
        anchor => anchor.connectionId === connection.connectionId
      );
      if (pair.length !== 2) {
        problems.push({
          connectionId: connection.connectionId,
          problem: "connector-does-not-have-two-anchors"
        });
        continue;
      }

      const dx = Math.abs(
        pair[0].localLocation.x - pair[1].localLocation.x
      );
      const dy = Math.abs(
        pair[0].localLocation.y - pair[1].localLocation.y
      );
      const distance = Math.hypot(dx, dy);
      const tolerance = Math.min(
        pair[0].tolerance ?? defaultTolerance,
        pair[1].tolerance ?? defaultTolerance
      );
      const aligned = dx <= tolerance && dy <= tolerance;

      measurements.push({
        connectionId: connection.connectionId,
        dx,
        dy,
        distance,
        tolerance,
        aligned
      });

      if (!aligned) {
        problems.push({
          connectionId: connection.connectionId,
          dx,
          dy,
          distance,
          tolerance,
          problem: "vertical-anchors-outside-tolerance"
        });
      }
    }

    return {
      valid: problems.length === 0,
      problems,
      measurements
    };
  }

  static _bounds(sectors) {
    const values = sectors.map(
      sector => sector.bounds || sector.pixelBounds
    );
    const x = Math.min(...values.map(value => value.x));
    const y = Math.min(...values.map(value => value.y));
    const right = Math.max(...values.map(value => value.x + value.width));
    const bottom = Math.max(...values.map(value => value.y + value.height));
    return { x, y, width: right - x, height: bottom - y };
  }

  static _combine(values) {
    const x = Math.min(...values.map(value => value.x));
    const y = Math.min(...values.map(value => value.y));
    const right = Math.max(...values.map(value => value.x + value.width));
    const bottom = Math.max(...values.map(value => value.y + value.height));
    return { x, y, width: right - x, height: bottom - y };
  }
}
