/**
 * Pure geography: how far apart two points are, and which map tiles cover a
 * view centred on one of them.
 *
 * Pure like money.ts, and for the same reason: this is the arithmetic behind
 * something the user reads as a fact - "you were at home when you paid this" -
 * so it has to be testable without a database, a network, or a map library.
 *
 * WHY THERE IS NO MAP LIBRARY BEHIND THIS
 * ---------------------------------------
 * A map on the transaction detail is a still picture of one point. Leaflet is
 * ~43 KB gz plus its CSS, and this codebase already refuses Framer Motion at
 * ~50 KB (CLAUDE.md, performance budget). Everything an interactive library
 * would do here - project a coordinate, pick the tiles around it - is the
 * hundred lines below, and the result is plain <img> tags: no JavaScript ships
 * to the client at all, so the detail screen cannot cost INP it did not have.
 * Panning and zooming happen in the phone's own map app, one tap away.
 */

export interface Point {
  readonly latitude: number;
  readonly longitude: number;
}

/** IUGG mean Earth radius. */
const EARTH_RADIUS_M = 6_371_008.8;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Great-circle distance in metres.
 *
 * Haversine rather than the cheaper equirectangular approximation: the error of
 * the cheap version grows with latitude, and the question this answers is
 * decided on a radius of ~150 m, where a few percent is the whole answer.
 */
export function distanceMeters(a: Point, b: Point): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  // min(1, …) guards the floating-point case where h creeps just past 1 for
  // antipodal points and asin returns NaN.
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * How close to the saved home coordinate still counts as being there.
 *
 * 150 m, not 50: a phone indoors reports 20-100 m of error routinely, and the
 * expensive mistake is telling someone they were out when they were on their
 * own sofa. A building next door being swallowed by the radius costs nothing -
 * the app never decides anything on its own from this, it only labels.
 */
export const HOME_RADIUS_M = 150;

export function isWithin(a: Point, b: Point, radiusMeters: number): boolean {
  return distanceMeters(a, b) <= radiusMeters;
}

/**
 * Worse than this and the reading is not worth storing.
 *
 * A phone with no GPS fix falls back to the cell tower, which lands anywhere
 * in a half-kilometre. Drawing a map pin from that is not a small error, it is
 * a different street - so the reading is dropped rather than shown with an
 * apology next to it.
 */
export const MAX_USABLE_ACCURACY_M = 500;

/** Slippy-map tiles are 256 px square by definition. */
export const TILE_SIZE = 256;

export interface MapTile {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Pixel offset inside the view. Negative for the tile that is cut off. */
  readonly left: number;
  readonly top: number;
}

/**
 * The tiles that cover a `width` x `height` view centred on `center`.
 *
 * Web Mercator, the projection every slippy-map tile server uses: longitude is
 * linear, latitude goes through asinh(tan(lat)). The marker needs no
 * coordinates of its own - the view is centred on the point by construction,
 * so it is always drawn at the middle of the box.
 */
export function tileGridFor(
  center: Point,
  zoom: number,
  width: number,
  height: number,
): MapTile[] {
  const tilesPerAxis = 2 ** zoom;

  const worldX = ((center.longitude + 180) / 360) * tilesPerAxis * TILE_SIZE;
  const worldY =
    ((1 - Math.asinh(Math.tan(toRadians(center.latitude))) / Math.PI) / 2) *
    tilesPerAxis *
    TILE_SIZE;

  // Top-left corner of the view, in world pixels.
  const originX = worldX - width / 2;
  const originY = worldY - height / 2;

  const firstX = Math.floor(originX / TILE_SIZE);
  const firstY = Math.floor(originY / TILE_SIZE);

  const tiles: MapTile[] = [];

  for (let ty = firstY; ty * TILE_SIZE < originY + height; ty += 1) {
    // Past either pole there is no tile to ask for. Requesting one returns a
    // 404 page, not an empty square, so the row is skipped instead.
    if (ty < 0 || ty >= tilesPerAxis) continue;

    for (let tx = firstX; tx * TILE_SIZE < originX + width; tx += 1) {
      tiles.push({
        // Longitude wraps around the world; latitude does not. The double
        // modulo keeps a negative tx (a view straddling the antimeridian) in
        // range rather than producing a negative tile number.
        x: ((tx % tilesPerAxis) + tilesPerAxis) % tilesPerAxis,
        y: ty,
        z: zoom,
        left: tx * TILE_SIZE - originX,
        top: ty * TILE_SIZE - originY,
      });
    }
  }

  return tiles;
}
