/**
 * Order for tags in a wrapping row so no gap is left that a later tag could fill: each row takes the first
 * remaining tag that still fits, even when that breaks the original order. Returns indexes into `widths`.
 */
export function packOrder(widths: readonly number[], maxWidth: number, gap: number): number[] {
  const remaining = widths.map((_, i) => i);
  const order: number[] = [];
  let used = 0;

  while (remaining.length > 0) {
    const pos = remaining.findIndex((i) => used === 0 || used + gap + Math.min(widths[i], maxWidth) <= maxWidth);
    if (pos < 0) {
      used = 0; // nothing fits: start a new row, the first tag always fits there
      continue;
    }
    const [index] = remaining.splice(pos, 1);
    const width = Math.min(widths[index], maxWidth);
    used = used === 0 ? width : used + gap + width;
    order.push(index);
  }
  return order;
}
