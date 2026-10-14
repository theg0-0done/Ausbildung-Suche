import { useLayoutEffect, useRef, useState } from 'react';
import { packOrder } from '../lib/packTags';

export interface HeroTag {
  label: string;
  className: string;
}

/** Tag row that fills its whitespace: a tag moves up into a gap when it fits there, whatever its position. */
export default function PackedTags({ tags }: { tags: readonly HeroTag[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<number[]>(() => tags.map((_, i) => i));
  const signature = tags.map((t) => t.label).join('|');

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const pack = () => {
      const widths = new Array<number>(tags.length).fill(0);
      for (const child of Array.from(el.children) as HTMLElement[]) {
        widths[Number(child.dataset.index)] = child.offsetWidth;
      }
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const next = packOrder(widths, el.clientWidth, gap);
      setOrder((prev) => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next));
    };

    pack();
    const observer = new ResizeObserver(pack);
    observer.observe(el);
    return () => observer.disconnect();
    // `signature` stands for the tag texts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const shown = order.length === tags.length ? order : tags.map((_, i) => i);

  return (
    <div className="detail-tags" ref={ref}>
      {shown.map((i) => (
        <span key={i} data-index={i} className={tags[i].className}>
          {tags[i].label}
        </span>
      ))}
    </div>
  );
}
