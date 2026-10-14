import { describe, expect, it } from 'vitest';
import { packOrder } from './packTags';

describe('packOrder', () => {
  it('keeps the order when everything fits in one row', () => {
    expect(packOrder([50, 60, 70], 300, 8)).toEqual([0, 1, 2]);
  });

  it('moves a later tag into a gap a wide tag would leave', () => {
    // row 1: 100 + 8 + 70 + 8 + 40 = 226; the 150 tag does not fit next to the 100 tag
    expect(packOrder([100, 150, 70, 40], 250, 8)).toEqual([0, 2, 3, 1]);
  });

  it('lets a tag wider than the row take its own row', () => {
    expect(packOrder([400, 50], 300, 8)).toEqual([0, 1]);
  });

  it('handles no tags', () => {
    expect(packOrder([], 300, 8)).toEqual([]);
  });
});
