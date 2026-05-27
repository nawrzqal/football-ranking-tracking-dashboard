/**
 * Build a smooth cubic-bezier SVG path string from a list of {x, y} points.
 *
 * Strategy: for each segment between p[i] and p[i+1], use two control points
 * placed at the midpoint x of the segment so the curve eases into each anchor
 * while keeping horizontal symmetry — works well for "league race" charts
 * where ranks are integer values spaced evenly on x.
 *
 * Pure: same input → same output. No DOM, no side effects.
 *
 * @param {{x:number,y:number}[]} points
 * @param {{ smoothing?: number }} [opts] smoothing in [0,1], default 0.5
 * @returns {string} SVG path "d" attribute, or "" if fewer than 1 point.
 */
export function buildBezierPath(points, opts = {}) {
  if (!Array.isArray(points) || points.length === 0) return '';
  if (points.length === 1) {
    const { x, y } = points[0];
    return `M ${x} ${y}`;
  }

  const smoothing = clamp(opts.smoothing ?? 0.5, 0, 1);
  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = (p1.x - p0.x) * smoothing;
    const c1x = p0.x + dx;
    const c1y = p0.y;
    const c2x = p1.x - dx;
    const c2y = p1.y;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p1.x} ${p1.y}`;
  }

  return d;
}

/**
 * Map matchweek/rank values to pixel-space points within a chart rect.
 *
 * @param {number[]} matchweeks list of matchweek labels (length = N)
 * @param {number[]} ranks parallel list of rank values 1..maxRank
 * @param {{ x:number, y:number, width:number, height:number, maxRank:number }} rect
 * @returns {{x:number,y:number}[]}
 */
export function mapPoints(matchweeks, ranks, rect) {
  const { x, y, width, height, maxRank } = rect;
  const n = matchweeks.length;
  if (n === 0) return [];
  const stepX = n === 1 ? 0 : width / (n - 1);
  const stepY = height / (maxRank - 1 || 1);
  return matchweeks.map((_, i) => ({
    x: x + i * stepX,
    y: y + (ranks[i] - 1) * stepY,
  }));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
