/**
 * Target shapes for Follow the Shape, as normalized vector paths (y up, roughly -1 to 1). Generated once and
 * copied into the database seed (`shape_presets`), so the phone and the server score against identical geometry.
 * Edit both together, and bump SHAPE_ALGORITHM if scoring would change.
 */

export type ShapeDifficulty = "easy" | "medium" | "hard";
export type ShapePreset = { key: string; name: string; difficulty: ShapeDifficulty; closed: boolean; minDistanceM: number; points: [number, number][] };

export const SHAPE_PRESETS: readonly ShapePreset[] = [
  { key: "triangle", name: "Triangle", difficulty: "easy", closed: true, minDistanceM: 300, points: [[0, 1], [0.866, -0.5], [-0.866, -0.5]] },
  { key: "square", name: "Square", difficulty: "easy", closed: true, minDistanceM: 300, points: [[-1, 1], [1, 1], [1, -1], [-1, -1]] },
  { key: "heart", name: "Heart", difficulty: "medium", closed: true, minDistanceM: 500, points: [[0.0, 0.2941], [0.0049, 0.3298], [0.0377, 0.4242], [0.1176, 0.5446], [0.25, 0.6488], [0.4231, 0.6998], [0.6113, 0.6765], [0.781, 0.5785], [0.8989, 0.4229], [0.9412, 0.2353], [0.8989, 0.0397], [0.781, -0.1483], [0.6113, -0.3235], [0.4231, -0.4871], [0.25, -0.6404], [0.1176, -0.7799], [0.0377, -0.8953], [0.0049, -0.9726], [0.0, -1.0], [-0.0049, -0.9726], [-0.0377, -0.8953], [-0.1176, -0.7799], [-0.25, -0.6404], [-0.4231, -0.4871], [-0.6113, -0.3235], [-0.781, -0.1483], [-0.8989, 0.0397], [-0.9412, 0.2353], [-0.8989, 0.4229], [-0.781, 0.5785], [-0.6113, 0.6765], [-0.4231, 0.6998], [-0.25, 0.6488], [-0.1176, 0.5446], [-0.0377, 0.4242], [-0.0049, 0.3298]] },
  // Taller than wide, so it stays distinct from the square when shapes may be turned.
  { key: "diamond", name: "Diamond", difficulty: "easy", closed: true, minDistanceM: 300, points: [[0, 1], [0.6, 0], [0, -1], [-0.6, 0]] },
  { key: "lightning", name: "Lightning bolt", difficulty: "medium", closed: false, minDistanceM: 400, points: [[0.25, 1], [-0.35, 0.05], [0.2, 0.05], [-0.25, -1]] },
  { key: "star", name: "Star", difficulty: "hard", closed: true, minDistanceM: 700, points: [[0.0, 1.0], [-0.2351, 0.3236], [-0.9511, 0.309], [-0.3804, -0.1236], [-0.5878, -0.809], [-0.0, -0.4], [0.5878, -0.809], [0.3804, -0.1236], [0.9511, 0.309], [0.2351, 0.3236]] },
  { key: "letter_s", name: "Letter S", difficulty: "hard", closed: false, minDistanceM: 500, points: [[0.4698, 0.671], [0.3783, 0.8269], [0.2373, 0.9401], [0.0653, 0.9957], [-0.1153, 0.9865], [-0.2808, 0.9137], [-0.4096, 0.7868], [-0.4848, 0.6224], [-0.4966, 0.442], [-0.4435, 0.2691], [-0.3324, 0.1265], [-0.1778, 0.0327], [-0.0, 0.0], [0.1778, -0.0327], [0.3324, -0.1265], [0.4435, -0.2691], [0.4966, -0.442], [0.4848, -0.6224], [0.4096, -0.7868], [0.2808, -0.9137], [0.1153, -0.9865], [-0.0653, -0.9957], [-0.2373, -0.9401], [-0.3783, -0.8269], [-0.4698, -0.671]] },
];

export const presetByKey = (key: string) => SHAPE_PRESETS.find((s) => s.key === key) ?? null;
