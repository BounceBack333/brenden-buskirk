/**
 * The Birthday Continental — art kit for the first world, plus the hero props of its first
 * attraction, Catapult Courier.
 *
 * Presentation only: nothing here holds or changes gameplay state. Every builder is
 * deterministic (seeded), needs no external assets, and returns the interface declared in
 * src/kit/contracts.ts. Dimensions quoted in each builder's doc comment are gameplay-facing and
 * exact; the dev page (dev/props.html?debug=1) draws them over the art.
 *
 * Optional extras beyond the contract (all backward compatible):
 *   buildJellyDome(radius, capHeight?, color?)   shallow spherical cap, as the Courier sim uses
 *   buildRingGate(innerRadius, { yaw? })         how far the donut turns toward the camera
 *   buildBalloon(...).pop(instant?)              restore an already-popped balloon without the burst
 *   buildCupcake(...).bump(strength)             frosting jiggle for hit feedback
 */
export { buildTableScene, DRESSING_Z_MAX } from './table';
export { buildSpoonCatapult, SPOON } from './spoon';
export { buildCatchBasket, BASKET } from './basket';
export { buildCocktailUmbrella, UMBRELLA } from './umbrella';
export { buildJellyDome } from './jelly';
export { buildBalloon, BALLOON_WEIGHT_HEIGHT } from './balloon';
export { buildRingGate, ringTubeRadius } from './ring';
export { buildTableFan, buildWindStreamers, FAN } from './fan';
export { buildRunway, buildSplat, RUNWAY } from './runway';
export { buildCupcake } from './cupcake';
