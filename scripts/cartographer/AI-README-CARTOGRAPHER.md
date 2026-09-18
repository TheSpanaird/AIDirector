# AI Director Cartographer

## Project Status

Cartographer is the native AI Director geometry and vector map-rendering subsystem for Foundry VTT. The Dungeon Manifest remains the semantic source of truth.

```text
AI
↓
Dungeon Manifest
↓
Map Forge
↓
Cartographer Engine
↓
Foundry Scene
↓
GM Edits
↓
Cartographer Ledger Sync
↓
Manifest Update
↓
Topology Rebuild
↓
AI Understands Changes
```

The production pipeline supports room and corridor floors, labels, exterior walls, doors, boundary features, configurable outlines, floor styles, multi-level presentations, spaceship hulls, elevated ventilation networks, and prototype fortification perimeters. Keep and Bailey V11 now has a working visual baseline for the ground compound.

## Core Ownership Contract

### Scene Manager owns semantic intent

- Structure type
- Scene archetype or operational subtype
- Mission context
- Occupancy
- Required, preferred, optional, and forbidden room purposes
- Sector names and narrative content
- Sector-to-floor assignments
- Floor roles
- Required vertical connections
- Special operational systems
- Scene-specific feature packages

### Cartographer owns physical realization

- Building, vessel, compound, ward, and settlement envelopes
- Architectural grammar and zoning
- Room and detached-building dimensions and placement
- Required adjacency and shared boundaries
- Open circulation areas, roads, yards, wards, and courtyards
- Doors, gates, stairs, lifts, ladders, hatches, and vent grates
- Hulls, palisades, curtain walls, inner walls, and perimeter towers
- Final geometry and rendering metadata

A grammar arranges the supplied semantic program. A grammar must not replace the Scene Manager program with a generic inventory.

## Architecture Rebuild Boundary

### Frozen infrastructure

These files form the known-working baseline and should change only for an isolated, reproducible defect:

- `cartographer-engine.js`
- `corridor-router-engine.js`
- `topology-engine.js`
- `topology-normalizer.js`
- `doorway-placement-engine.js`
- `wall-renderer.js`
- `room-renderer.js`
- `corridor-renderer.js`
- `room-label-renderer.js`
- `shape-primitive-generator.js`
- `cartographer-floor-layer.js`
- `cartographer-metadata.js`
- `cartographer-ledger-sync.js`

Any exception must document the failing test, smallest required change, and regression result.

### Active rebuild scope

- Architectural profiles and grammars
- Compound, footprint, hull, and perimeter planning
- Multi-level coordination and presentation
- Scene Manager program normalization
- Schema and prompt contracts
- Acceptance rules and validators
- Elevated secondary traversal networks

## Shared Change-Control Gate

Every grammar or orchestration change must pass:

- JavaScript syntax validation
- Same-seed determinism
- Different-seed meaningful variability
- Required and forbidden room validation
- Required adjacency validation
- Envelope, hull, or perimeter containment
- Actual-opening reachability
- Exterior entry, gate, airlock, or service-door validation
- Corridor, yard, ward, and dead-end review
- Scene-archetype compliance
- Visual architectural review
- Regression against approved baselines

## Approved Baselines

### House

**Status: APPROVED**

Validated behavior includes ten rooms, a dedicated exterior entry, direct shared-wall doors, deterministic geometry, meaningful variation, full envelope utilization, privacy-path validation, and window validation.

### Shuttle V3

**Status: APPROVED PROTOTYPE BASELINE**

Compact single-deck interior, sealed airlock, vessel hull, physical hull walls, standard and mirrored variants, and separate hidden ventilation support.

### Freighter V1.3

**Status: APPROVED PROTOTYPE BASELINE**

Forward Bridge, dominant cargo hold, loading airlock, separate habitation, service, and engineering zones, hull containment, and Scene Manager program compatibility.

### Gunship V1

**Status: APPROVED PROTOTYPE BASELINE**

Compact combat deck, forward Cockpit, Weapons Control and Magazine relationship, crew and engineering cluster, sealed airlock, pointed hull, and decorative engine pods.

### Research Vessel V1.2

**Status: APPROVED PROTOTYPE BASELINE**

Approved two-deck spaceship grammar with reciprocal elevator metadata, per-deck hull containment, physical hull walls, exterior airlock projection, and dual-mode rendering.

### Space Station Creative Multi-Level V3

**Status: APPROVED PROTOTYPE BASELINE**

Approved station roles:

- Civilian
- Mining
- Military
- Manufacturing and shipyard

Approved families:

- `RADIAL_HUB`
- `FOUR_POD_CROSS`
- `RING_SPOKES`

Supports one through four purpose-built levels, stable lift identifiers, emergency ladder access, mixed Rectangle, Circle, Octagon, and Plus geometry, and boundary-preserving 1.25 scaling for the larger configurations.

### Commercial Venue Distinct V3

**Status: APPROVED PROTOTYPE BASELINE**

Approved configurations:

- Bar: `NEIGHBORHOOD_BAR`, `LOUNGE_BAR`
- Tavern: `OPEN_ALEHOUSE`, `CITY_TAVERN`, `TAVERN_INN`
- Club: `DANCE_HALL`, `VIP_NIGHTCLUB`

Commercial Venue V3 includes distinct footprints and room counts, Tavern Inn guest hallways, no bedroom-to-bedroom access, open dance-floor layouts, public entrances, and exterior-envelope-aware service entrances.

### Keep and Bailey V11 Ground Compound

**Status: WORKING VISUAL BASELINE**

The Keep and Bailey V11 ground compound is the current working fortified-site baseline. Validated behavior includes a separate open bailey, detached one-story bailey buildings, a separate motte and multilevel keep footprint, a walled open keep approach, two-ring palisade and keep perimeter metadata, open gate/door pass-throughs, connector wing walls, gatehouse throat cleanup, east-side building doors facing inward toward the bailey center, and scene settings tuned for the current visual framing.

Known working scene settings for this baseline:

- Width: 7100 px
- Height: 9100 px
- Grid size: 100 px
- Padding: 0.2
- Background offset horizontal: 1000 px
- Background offset vertical: 1500 px

## Multi-Level Contract

Supported vertical connection types:

- `STAIR`
- `ELEVATOR`
- `LADDER`
- `HATCH`
- `RAMP`
- `MAINTENANCE_SHAFT`

Normal vertical access and hidden ventilation are separate networks. Paired connectors use shared identifiers and building-local anchors.

## Fortified-Site Semantic Contract

**Status: CONTRACT IN PROGRESS; KEEP AND BAILEY V11 GROUND COMPOUND WORKING VISUAL BASELINE**

The fortified-site work still requires a shared semantic contract across Outpost, Fort, Castle, and Fortress before full fortified-site approval. Keep and Bailey V11 is the current working prototype baseline for the ground compound. The broader contract must still be implemented once in the Scene Manager, schema, prompts, normalization, and validation layers. Individual fortified grammars then interpret the contract physically.

### Shared fortified-site fields

The semantic manifest should support:

- `fortifiedSubtype`
- `fortifiedConfiguration`
- `fortificationStyle`
- `floorCount`
- `floorPresentation`
- `floors`
- `verticalConnections`
- `towerCount` or `towerCountRange`
- `outerWallRequired`
- `innerWallRequired`
- `gatehouseCount`
- `secondaryGateCount`
- `wardCount`
- `detachedBuildingGroups`
- `openAreaGroups`
- `populationProfile`
- `militaryCivilianBalance`
- `serviceRoutes`
- `escapeRoutes`
- `requiredAdjacencies`
- `forbiddenAdjacencies`

Suggested semantic structure:

```js
{
  structureType: "CASTLE",
  fortifiedSubtype: "CASTLE",
  fortifiedConfiguration: "KEEP_AND_BAILEY",
  fortificationStyle: "PALISADE_MOTTE_BAILEY",
  floorCount: 3,
  towerCountRange: { min: 2, max: 5 },
  wallSystems: [
    { wallId: "outer-palisade", wallType: "PALISADE", required: true },
    { wallId: "keep-perimeter", wallType: "KEEP_WALL", required: true }
  ],
  detachedBuildingGroups: [],
  openAreaGroups: [],
  populationProfile: {},
  requiredAdjacencies: [],
  forbiddenAdjacencies: []
}
```

The exact schema can vary, but the contract must distinguish detached buildings, open circulation, perimeter systems, multilevel structures, and occupancy.

### Population and occupancy fields

Fortified sites may combine military, noble, service, craft, commercial, and civilian populations. The semantic layer should support:

- Garrison size or tier
- Noble or command household presence
- Commoner population tier
- Servant population tier
- Crafts and production presence
- Commercial activity level
- Market presence
- Refugee or temporary shelter capacity
- Military-to-civilian balance

### Detached building groups

Detached structures must be first-class semantic objects rather than being flattened into rooms of one giant building.

Each detached building should support:

- Stable building ID
- Building purpose
- Display name
- Floor count
- Required rooms
- Optional rooms
- Required and forbidden building relationships
- Public, restricted, military, service, or private access class
- Whether the building must touch an open ward, road, or courtyard
- Whether the building belongs to a keep, bailey, outer ward, inner ward, harbor ward, or civilian ward

Suggested structure:

```js
{
  buildingId: "bailey-blacksmith",
  buildingType: "BLACKSMITH",
  name: "Bailey Blacksmith",
  floorCount: 1,
  placementZone: "BAILEY",
  accessClass: "CRAFT",
  requiredRooms: ["FORGE", "WORKSHOP", "STORE"],
  requiredAdjacencies: ["OPEN_BAILEY"],
  forbiddenAdjacencies: ["KEEP_PRIVATE_QUARTERS"]
}
```

### Open area groups

Open spaces must also be first-class semantic objects:

- Bailey
- Outer ward
- Inner ward
- Courtyard
- Training yard
- Market square
- Harbor yard
- Stable yard
- Garden plots
- Roads and paths
- Motte approach

Open areas are circulation and activity spaces. Detached buildings can face an open area without sharing walls with one another.

### Fortification systems

The semantic contract should support:

- Palisade
- Curtain wall
- Inner curtain wall
- Concentric defenses
- Gatehouse
- Secondary gate
- Sally port
- Wall walk
- Defensive gallery
- Round, square, or octagonal towers
- Motte or elevated keep zone
- Harbor, cliff, or coastal boundary

Fortification perimeter metadata must remain separate from spaceship hull metadata.

## Fortified Configuration Requirements

### Outposts

Shared semantic needs:

- Watch or patrol role
- Signal facilities
- Supply needs
- Small garrison
- Optional civilian and craft support
- One or more defensive towers
- One or two levels depending on configuration

Configurations:

- Frontier Outpost
- Coastal Outpost
- Mountain Watchpost

### Forts

Shared semantic needs:

- Garrison size
- Training area
- Barracks
- Armory
- Command space
- Supply and service facilities
- Stable, harbor, prison, or customs functions when required
- Multiple towers and wall access
- Multilevel command or tower programs

Configurations:

- Garrison Fort
- Coastal Fort
- Border Fort

### Castles

Shared semantic needs:

- Noble household
- Great Hall
- Kitchen and service chain
- Chapel when configured
- Barracks and armory
- Servants and guest spaces
- Civilian or craft support where appropriate
- Multilevel keep, noble, state, and tower programs

Configurations:

- Keep and Bailey
- Courtyard Castle
- Concentric Castle

### Fortresses

Shared semantic needs:

- Multiple wards
- Large garrison
- Command keep
- Barracks wings
- Armories and magazines
- Workshops and storehouses
- Prison or holding functions where appropriate
- Up to eight perimeter towers depending on configuration
- Three or four operational levels

Configurations:

- Citadel Fortress
- Garrison Fortress
- Royal Fortress

## Keep and Bailey Requirements

**Status: CURRENT FOCUSED FORTIFIED CONFIGURATION; V11 GROUND COMPOUND WORKING VISUAL BASELINE**

A Keep and Bailey must not render as one continuous courtyard building.

### Required compound composition

- Independent outer palisade
- Fortified gate into the bailey
- Broad open bailey circulation
- Detached, mostly single-story buildings within the palisade
- Separate motte or elevated keep zone
- Guarded motte approach
- Separate multilevel keep
- Optional smaller perimeter around the keep

### Keep and Bailey V11 working implementation notes

- Ground layout uses detached buildings rather than one merged building footprint.
- Open bailey, well, market, market stalls, and motte approach are open-area sectors and should not receive ordinary room exterior walls.
- East-side bailey buildings should place doors on the west-facing side toward the bailey center.
- Gatehouse should have one explicit north-facing gate into the bailey; avoid duplicate automatic gatehouse exterior openings.
- Outer gate throat uses side throat walls, entry-throat wing walls, and one full-width gate segment.
- Keep approach bridge uses connector side walls, connector wing walls, and open gate/door segments at the bailey and keep wall junctions.
- Fortification perimeter rendering remains separate from ordinary room-wall rendering.
- Scene framing for the current working visual baseline is controlled by scene settings rather than post-render document movement.

### Detached one-story bailey structures

The bailey may include:

- Guardhouse
- Barracks
- Armory
- Blacksmith and forge
- Fletcher
- Carpenter
- General workshop
- Stable
- Storehouse
- Granary
- Bakehouse
- Brewery
- Tavern or alehouse
- Market stalls or market building
- Commoner cottages
- Craftsman houses
- Steward or reeve office
- Tax storehouse
- Well
- Garden plots and sheds

These structures must be distinct buildings. Detached buildings connect through the open bailey, roads, and paths rather than interior doors.

### Civilian habitation and commerce

Keep and Bailey compounds may support a protected settlement population. The semantic program should permit:

- Commoner cottages
- Craftsman housing
- Tavern or alehouse
- Bakery or bakehouse
- Brewery
- Merchant stalls
- Market square
- Gardens
- Wells
- Storage sheds

The Scene Manager should determine the civilian population and commercial tier. Cartographer should choose exact building placement and path geometry.

### Logical relationship rules

Required or preferred relationships:

- Barracks near Armory
- Great Hall near Kitchen
- Kitchen near Pantry, Bakehouse, Storehouse, Servants, or Service Yard
- Stable near Gate or Stable Yard
- Blacksmith near Workshop, Armory, or Stable Yard
- Tavern near Market Area, Commoner Housing, or main bailey circulation
- Commoner housing near Well, Market, and open bailey paths
- Gatehouse opens into the bailey, not directly into a detached building
- Motte access connects the bailey to the keep entrance

Forbidden relationships:

- Kitchen directly connected to Barracks
- Private keep quarters opening directly into the public bailey
- Detached buildings joined by ordinary interior doors
- Commoner housing inside military storage or armory buildings
- Tavern opening directly into the armory, magazine, prison, or private keep

### Keep floor program

Suggested multilevel keep program:

**Keep Floor 1**

- Keep entrance
- Guardroom
- Entrance hall
- Great chamber or administrative hall
- Secure stair
- Storage or service room

**Keep Floor 2**

- Lord or commander quarters
- Guest chamber
- Solar
- Private hall
- Chapel or study when configured

**Keep Floor 3**

- Council chamber
- Treasury
- Private quarters
- Archive or chapel
- Roof and tower access

The Scene Manager owns which semantic rooms are required. The grammar owns exact floor geometry.

## Necessary File Updates for Fortified Sites

### `scene-manager.js`

Required updates:

- Recognize the fortified-site semantic contract.
- Normalize subtype, configuration, occupancy, population, wards, detached buildings, perimeter systems, and floors.
- Preserve user-requested civilian, military, noble, craft, and commercial functions.
- Assign stable building and open-area IDs.
- Avoid flattening detached buildings into one room list.
- Produce explicit required and forbidden relationships.
- Preserve motte, bailey, keep, ward, and perimeter identities.

### `dungeon-schema.js`

Required updates:

- Add schema definitions for fortified subtype and configuration.
- Add detached building groups.
- Add open area groups.
- Add wall and perimeter systems.
- Add tower count or tower range.
- Add population and occupancy profile.
- Add building-level floor counts.
- Add compound-level and building-level vertical connections.
- Add required and forbidden building relationships.
- Validate stable IDs and references.

### `dungeon-prompts.js`

Required updates:

- Teach the model the distinction between rooms, detached buildings, open areas, wall systems, and multilevel structures.
- Require configuration-specific fortified programs.
- Require commoner housing and commercial activity when the prompt calls for a populated protected settlement.
- Require a tavern or alehouse when appropriate.
- Forbid room-label substitution as a substitute for layout variety.
- Forbid direct Kitchen-to-Barracks access.
- Require logical Great Hall-to-Kitchen and Barracks-to-Armory relationships where applicable.
- Require detached Keep and Bailey buildings to face open bailey circulation.

### `dungeon-ledger-manager.js`

Required updates:

- Display and edit detached buildings separately from rooms.
- Display open areas, wards, and perimeter systems.
- Preserve stable IDs when editing compound contents.
- Support building-level floor counts and occupancy.
- Display required and forbidden relationships.

### `dungeon-sync.js`

Required updates:

- Persist detached building groups, open area groups, population profiles, perimeter systems, and multilevel compound metadata.
- Preserve references between buildings, wards, floors, gates, towers, and vertical connectors.

### `architectural-grammar-registry.js`

Required updates:

- Register the final fortified-site grammar version.
- Route Outpost, Fort, Castle, and Fortress to the fortified grammar.
- Preserve explicit configuration selection.

### `grammar-contract.js`

Required updates:

- Add compound-level grammar results.
- Add detached building output contracts.
- Add perimeter and tower plans.
- Add open circulation geometry.
- Add building-level and compound-level reachability requirements.

### `floor-layout-coordinator.js`

Required updates:

- Coordinate floors for the keep, towers, gatehouse, and other multilevel buildings.
- Keep one-story bailey structures on the ground presentation only.
- Preserve stable local frames for each multilevel building.
- Avoid treating the entire compound as one vertically stacked building.

### `multi-level-contract-validator.js`

Required updates:

- Validate compound-level floors and building-level floors.
- Validate that one-story detached buildings do not incorrectly appear on upper keep levels.
- Validate paired keep, gatehouse, and tower connectors.
- Validate destination building, scene, floor, and anchor IDs.

### `stacked-floor-presentation-planner.js` and `separate-scenes-presentation-planner.js`

Required updates:

- Support compounds containing one-story detached buildings plus one or more multilevel buildings.
- Preserve compound identity and building identity.
- Make upper keep floors clearly distinct from ground-bailey presentation.

### Fortification perimeter files

Files:

- `fortification-perimeter-planner.js`
- `fortification-perimeter-renderer.js`

Required behavior:

- Render palisades and curtain walls independently from room walls.
- Support irregular, coastal, cliff, rectangular, bailey, and concentric outlines.
- Create physical blocking walls.
- Create gate openings.
- Support two through eight towers depending on configuration.
- Support inner and outer walls.
- Preserve metadata for wall system, tower, gate, floor, structure, and configuration.
- Remain separate from spaceship hull naming and metadata.

### `fortified-site-grammar.js`

Required updates:

- Build each configuration independently.
- Generate detached building clusters when required.
- Generate open wards and bailey circulation.
- Generate configuration-specific tower counts.
- Generate multilevel keep, command, gatehouse, or tower programs.
- Preserve logical room and building relationships.
- Do not connect Kitchen directly to Barracks.

### Test and review scripts

Required test coverage:

- Same-seed determinism
- Different-seed meaningful variation
- Three unique configurations per subtype
- Ground-floor generation for every configuration
- Detached-building count and separation
- Open-area and path reachability
- Gate-to-ward reachability
- Great Hall-to-Kitchen logic
- Barracks-to-Armory logic
- No Kitchen-to-Barracks door
- Commoner housing and tavern presence when required
- Correct one-story detached-building behavior
- Keep, tower, and gatehouse floor alignment
- Tower range validation, including eight-tower configurations
- Palisade and curtain-wall containment
- Gate opening validation
- Inner-wall validation for concentric configurations
- Room, label, wall, perimeter, and floor rendering
- Persisted-scene reload regression
- Stacked and separate-scene presentation

## Current Fortified-Site Work Order

Work on one configuration at a time:

1. Keep and Bailey ground compound
2. Keep and Bailey multilevel keep
3. Keep and Bailey perimeter, motte, paths, and regression tests
4. Frontier Outpost
5. Coastal Outpost
6. Mountain Watchpost
7. Garrison Fort
8. Coastal Fort
9. Border Fort
10. Courtyard Castle
11. Concentric Castle
12. Citadel Fortress
13. Garrison Fortress
14. Royal Fortress

A configuration is not approved until its ground floor, upper floors, perimeter, logical relationships, and visual review pass.

## Architectural Grammar To Do

### Shared grammar foundation

- Add polygon-aware shared-boundary validation.
- Preserve adjacency when layouts are scaled, mirrored, or rotated.
- Support compound and detached-building geometry.
- Add building-to-open-area relationships.
- Add compound perimeter containment.

### Commercial venue grammar

**Status: APPROVED PROTOTYPE BASELINE**

Remaining production work:

- Persisted-scene regression
- Stacked and separate-scene integration
- Metadata and cleanup/rebuild validation
- Polygon-aware doorway validation

### Fortified-site grammar

**Status: ACTIVE REBUILD; KEEP AND BAILEY V11 GROUND COMPOUND WORKING VISUAL BASELINE**

- Preserve the current Keep and Bailey V11 ground-compound baseline while continuing broader fortified-site work.
- Implement the shared fortified semantic contract.
- Rebuild and validate Keep and Bailey upper keep levels next.
- Do not reuse shared footprints with renamed rooms.
- Support detached single-story bailey buildings.
- Support commoner housing, tavern, market, production, storage, and military buildings.
- Support a separate motte and multilevel keep.
- Support configuration-specific perimeters and tower counts.
- Validate all required and forbidden relationships.

### Covert-site grammar

- Revalidate Hideout, Safehouse, and Secret Base as distinct configurations.
- Validate secret rooms, escape exits, hidden stairs, locked doors, and upper access.

### Manor grammar

- Add distinct public, service, family, guest, and private floor programs.
- Validate kitchen, servants, stair, and exterior-door placement.

### Facility grammar

- Review subtype-specific layouts and multilevel support.
- Validate secure circulation, service access, connectors, and ventilation.

## Current Immediate Task

Maintain the **Keep and Bailey V11 Floor 1 working visual baseline** and continue from it rather than restarting the compound layout. The current ground compound includes:

- Palisade perimeter
- Gatehouse with a single bailey-facing gate
- Open bailey circulation
- Detached one-story buildings
- Commoner housing
- Tavern or alehouse
- Blacksmith and craft buildings
- Barracks and armory
- Stable, storehouse, and granary
- Great Hall and Kitchen relationship where included
- Separate motte approach
- Separate multilevel keep footprint
- Connector and gatehouse wall/door cleanup
- Scene settings that frame the current map cleanly

Next work should preserve this baseline, add regression coverage, and then proceed to Keep and Bailey upper floors before other fortified configurations.

## Working Baseline Changelog

### Keep and Bailey V11 ground compound

**Status: WORKING VISUAL BASELINE**

The map is currently working well visually and should be treated as the baseline for future Keep and Bailey work. Preserve the existing detached-building layout, open bailey, motte approach, keep footprint, gatehouse cleanup, bridge connector cleanup, and scene framing settings when making future changes.

## Alpha Success Criteria

Cartographer Alpha is complete when validated manifests reliably produce playable Foundry maps with:

- Distinct room, building, and compound geometry
- Clean rooms, corridors, roads, yards, wards, and courtyards
- Exterior walls and fortification perimeters without duplicate artifacts
- Standard, locked, secret, service, gate, and exterior doors
- Room and building labels
- Persistent metadata and Ledger synchronization
- Deterministic variation
- Multilevel stacked and separate-scene presentation
- Valid building-level and compound-level vertical circulation
- Spaceship hull and fortified perimeter containment
- Elevated secondary traversal networks

No Dungeon Draw dependency is required for the production vector path.
