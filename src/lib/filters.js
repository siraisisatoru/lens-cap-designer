// Standard photographic filter thread sizes (mm) and their usual pitch (mm).
// Most filters 37–82 mm are 0.75 pitch; larger ones are 1.0; small ones 0.5.
export const FILTER_SIZES = [
  [27, 0.5], [30.5, 0.5], [34, 0.5], [37, 0.75], [39, 0.5], [40.5, 0.5],
  [43, 0.75], [46, 0.75], [49, 0.75], [52, 0.75], [55, 0.75], [58, 0.75],
  [62, 0.75], [67, 0.75], [72, 0.75], [77, 0.75], [82, 0.75],
  [86, 1.0], [95, 1.0], [105, 1.0], [112, 1.0],
];

export function defaultPitch(size) {
  const hit = FILTER_SIZES.find(([s]) => Math.abs(s - size) < 1e-6);
  if (hit) return hit[1];
  if (size < 37) return 0.5;
  if (size <= 82) return 0.75;
  return 1.0;
}
