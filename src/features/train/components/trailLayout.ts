export type TrailItem = { kind: "step"; index: number } | { kind: "chest"; after: number };

/**
 * The path as stops: the lessons, with a chest halfway and one at the end. The path swings on a sine around the
 * middle chest so the lessons either side of it sit on opposite sides, and the chests stay on the centre line.
 */
export const trailLayout = (count: number) => {
  const mid = count >= 3 ? Math.ceil(count / 2) : 0;
  const items: TrailItem[] = [];
  for (let i = 0; i < count; i++) {
    if (mid && i === mid) items.push({ kind: "chest", after: mid });
    items.push({ kind: "step", index: i });
  }
  if (count > 0) items.push({ kind: "chest", after: count });
  const pivot = mid ? items.findIndex((it) => it.kind === "chest") : 0;
  return { items, sway: (j: number) => (!items[j] || items[j].kind === "chest" ? 0 : Math.sin(((j - pivot) * Math.PI) / 4) * 0.9) };
};
