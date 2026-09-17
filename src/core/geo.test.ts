import { describe, expect, it } from 'vitest';

import {
  distanceMeters,
  HOME_RADIUS_M,
  isWithin,
  tileGridFor,
  TILE_SIZE,
  type Point,
} from './geo';

const BOGOTA: Point = { latitude: 4.6482, longitude: -74.0648 };

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters(BOGOTA, BOGOTA)).toBe(0);
  });

  it('measures one degree of latitude as ~111 km', () => {
    const north = { latitude: BOGOTA.latitude + 1, longitude: BOGOTA.longitude };
    expect(distanceMeters(BOGOTA, north)).toBeGreaterThan(110_000);
    expect(distanceMeters(BOGOTA, north)).toBeLessThan(112_000);
  });

  it('is symmetric', () => {
    const other = { latitude: 4.7, longitude: -74.1 };
    expect(distanceMeters(BOGOTA, other)).toBeCloseTo(distanceMeters(other, BOGOTA), 6);
  });
});

describe('isWithin', () => {
  // 0.001 degrees of latitude is ~111 m, so this lands inside the home radius
  // and the next one comfortably outside it.
  const closeBy = { latitude: BOGOTA.latitude + 0.001, longitude: BOGOTA.longitude };
  const fourBlocks = { latitude: BOGOTA.latitude + 0.004, longitude: BOGOTA.longitude };

  it('counts a point inside the radius', () => {
    expect(isWithin(BOGOTA, closeBy, HOME_RADIUS_M)).toBe(true);
  });

  it('rejects a point beyond it', () => {
    expect(isWithin(BOGOTA, fourBlocks, HOME_RADIUS_M)).toBe(false);
  });
});

describe('tileGridFor', () => {
  const width = 320;
  const height = 200;

  it('covers the whole view with no gap', () => {
    const tiles = tileGridFor(BOGOTA, 16, width, height);
    expect(tiles.length).toBeGreaterThan(0);

    const lefts = tiles.map((t) => t.left);
    const tops = tiles.map((t) => t.top);

    // The first tile starts at or before the left edge, and the last one
    // reaches past the right edge. Same vertically. A gap here is a white band
    // across the map.
    expect(Math.min(...lefts)).toBeLessThanOrEqual(0);
    expect(Math.min(...lefts)).toBeGreaterThan(-TILE_SIZE);
    expect(Math.max(...lefts) + TILE_SIZE).toBeGreaterThanOrEqual(width);
    expect(Math.min(...tops)).toBeLessThanOrEqual(0);
    expect(Math.max(...tops) + TILE_SIZE).toBeGreaterThanOrEqual(height);
  });

  it('keeps every tile index inside the world at that zoom', () => {
    for (const zoom of [0, 1, 8, 16]) {
      const limit = 2 ** zoom;
      for (const tile of tileGridFor(BOGOTA, zoom, width, height)) {
        expect(tile.x).toBeGreaterThanOrEqual(0);
        expect(tile.x).toBeLessThan(limit);
        expect(tile.y).toBeGreaterThanOrEqual(0);
        expect(tile.y).toBeLessThan(limit);
        expect(tile.z).toBe(zoom);
      }
    }
  });

  /** A view centred on the antimeridian straddles x = 0, which is where a
      naive modulo produces negative tile numbers and a 404 image. */
  it('wraps longitude at the antimeridian', () => {
    const tiles = tileGridFor({ latitude: 0, longitude: 180 }, 4, width, height);
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x).toBeLessThan(16);
    }
  });

  /** Near the pole the view runs off the top of the world; those rows have no
      tile to request and must be dropped, not clamped onto row 0. */
  it('drops rows past the pole instead of requesting them', () => {
    const tiles = tileGridFor({ latitude: 85, longitude: 0 }, 1, width, height);
    for (const tile of tiles) {
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeLessThan(2);
    }
  });
});
