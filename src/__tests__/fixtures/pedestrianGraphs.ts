/**
 * Deterministic pedestrian networks for the route generator tests. Synthetic test geometry laid out in metres around
 * a fixed origin. These are not real streets and must never be used as production routing data.
 */
import type { PedEdge, PedGraph, PedNode } from "../../../supabase/functions/tournament/routes";

export const ORIGIN = { latitude: 37.77, longitude: -122.42 };

const toLatLng = (x: number, y: number) => {
  const k = Math.cos((ORIGIN.latitude * Math.PI) / 180);
  return { latitude: ORIGIN.latitude + y / 110_540, longitude: ORIGIN.longitude + x / (111_320 * k) };
};

export class GraphBuilder {
  nodes = new Map<string, PedNode>();
  edges: PedEdge[] = [];
  private xy = new Map<string, [number, number]>();

  node(id: string, x: number, y: number) {
    this.nodes.set(id, { id, ...toLatLng(x, y) });
    this.xy.set(id, [x, y]);
    return this;
  }

  /** A straight edge, or one through `via` bends, with its true length. */
  edge(id: string, a: string, b: string, opts: Partial<Omit<PedEdge, "id" | "a" | "b" | "coords" | "lengthM">> & { via?: [number, number][] } = {}) {
    const pts = [this.xy.get(a)!, ...(opts.via ?? []), this.xy.get(b)!];
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const coords = pts.map(([x, y]) => {
      const p = toLatLng(x, y);
      return [p.longitude, p.latitude] as [number, number];
    });
    const { via: _via, ...rest } = opts;
    this.edges.push({ id, a, b, coords, lengthM: len, walkable: true, access: null, pathType: "residential", foot: null, ...rest });
    return this;
  }

  /** Streets every `step` metres over a `cols` x `rows` grid of junctions named g{col}_{row}. */
  grid(cols: number, rows: number, step = 100, skip: (a: [number, number], b: [number, number]) => boolean = () => false) {
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) this.node(`g${c}_${r}`, c * step, r * step);
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        if (c + 1 < cols && !skip([c, r], [c + 1, r])) this.edge(`h${c}_${r}`, `g${c}_${r}`, `g${c + 1}_${r}`);
        if (r + 1 < rows && !skip([c, r], [c, r + 1])) this.edge(`v${c}_${r}`, `g${c}_${r}`, `g${c}_${r + 1}`);
      }
    return this;
  }

  without(...ids: string[]) {
    this.edges = this.edges.filter((e) => !ids.includes(e.id));
    return this;
  }

  graph(): PedGraph {
    return { nodes: [...this.nodes.values()], edges: this.edges };
  }

  at(x: number, y: number) {
    return toLatLng(x, y);
  }

  xOf(nodeId: string) {
    return this.xy.get(nodeId)![0];
  }
}

/** A 7 x 7 grid of 100 m blocks: plenty of square loops. */
export const squareTown = () => new GraphBuilder().grid(7, 7);

/** The same grid with diagonal park paths, so triangles and diamonds can be walked. */
export const parkTown = () => {
  const b = new GraphBuilder().grid(7, 7);
  for (let i = 0; i < 6; i++) {
    b.edge(`d${i}`, `g${i}_${i}`, `g${i + 1}_${i + 1}`, { pathType: "footway" });
    b.edge(`e${i}`, `g${i}_${6 - i}`, `g${i + 1}_${5 - i}`, { pathType: "footway" });
  }
  return b;
};

/** A river runs north to south between columns 3 and 4. Streets cross it only on the bridges given (by row). */
export const riverTown = (bridgeRows: number[] = []) => {
  const b = new GraphBuilder().grid(8, 7, 100, (a, c) => a[1] === c[1] && a[0] === 3 && c[0] === 4);
  for (const r of bridgeRows) b.edge(`bridge${r}`, `g3_${r}`, `g4_${r}`, { pathType: "footway" });
  return b;
};
