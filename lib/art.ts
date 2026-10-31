import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { z } from "zod";

import { ICON_NAMES, ICONS, type Icon } from "./icons.ts";

// The visual hook for an X post: one 1600x900 SVG in the One Flow mixed-media scrapbook
// style (torn sheet, tape, pencil, halftone cut-outs, rubber stamp). The picture carries the
// idea as a visual metaphor; words are capped at three and are optional. The generators
// are ports of paper-parts.js, rewritten from canvas Path2D to SVG path strings.

export const PAPER = "#F4F2F1";
export const SHEET = "#FBFAF8";
export const INK = "#16130F";
export const RED = "#D92819";
export const PENCIL = "#5E5852";
export const TAPE = "rgba(206,197,184,.72)";
export const WHITE = "#FFFFFF"; // sticker edge only

// The alien mascot from app/mascot.tsx, in its 24x24 viewBox: one head, two eyes cut out of it.
export const ALIEN_VIEWBOX = "0 0 24 24";
export const ALIEN_HEAD = "M12 2C17.6 2 21 5.4 21 10C21 15.6 16.4 22 12 22C7.6 22 3 15.6 3 10C3 5.4 6.4 2 12 2Z";
export const ALIEN_EYES = ["M5.2 9Q9.95 9.12 10.8 13.8Q6.05 13.68 5.2 9Z", "M18.8 9Q14.05 9.12 13.2 13.8Q17.95 13.68 18.8 9Z"] as const;
// The eyes wound against the head, so they are holes under fill-rule nonzero. The left eye
// in ALIEN_EYES runs the same way as the head and is reversed here; the right one already runs against it.
const EYE_HOLES = ["M5.2 9Q6.05 13.68 10.8 13.8Q9.95 9.12 5.2 9Z", ALIEN_EYES[1]];

// The hand-ported silhouettes (people with gear, the rig, the stage, the mascot). Each is
// drawn in a 530x650 frame; the Phosphor objects in lib/icons.ts are square.
export const MOTIFS = ["singer", "guitarist", "keyboardist", "drummer", "rig", "stage", "crowd", "alien"] as const;
export type Motif = (typeof MOTIFS)[number];
export type ArtObject = Motif | Icon;
export const OBJECTS = [...MOTIFS, ...ICON_NAMES] as [ArtObject, ...ArtObject[]];
const isMotif = (name: ArtObject): name is Motif => (MOTIFS as readonly string[]).includes(name);

export const COMPOSITIONS = ["hero", "versus", "twist", "scale", "odd", "peek"] as const;
export const TWISTS = ["cross", "crack", "flip"] as const;
export const words = (s: string | undefined) => (s ?? "").split(/\s+/).filter(Boolean).length;
const PAIRED = new Set(["versus", "scale"]);

// hero, twist, odd and peek draw objects[0]; versus and scale draw both. Label and stamp together
// carry at most three words.
export const ArtSpec = z
  .object({
    composition: z.enum(COMPOSITIONS),
    objects: z.array(z.enum(OBJECTS)).min(1).max(2),
    twist: z.enum(TWISTS).optional(),
    label: z.string().trim().min(1).max(22).optional(),
    labelPoints: z.union([z.literal(0), z.literal(1)]).optional(),
    stamp: z.string().trim().min(1).max(10).regex(/^\S+$/, "one word").optional(),
    seed: z.number().int().min(1).max(99999),
  })
  .refine((s) => words(s.label) + words(s.stamp) <= 3, { message: "label and stamp together carry at most three words", path: ["label"] })
  .refine((s) => !PAIRED.has(s.composition) || s.objects.length === 2, { message: "versus and scale take two objects", path: ["objects"] });
export type ArtSpec = z.infer<typeof ArtSpec>;

// ---- generators (paper-parts.js) ----

export function rng(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f1 = (n: number) => Math.round(n * 10) / 10 || 0; // `|| 0` drops a -0
type Pt = [number, number];
const xy = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`;
const poly = (pts: Pt[]) => "M" + pts.map(xy).join("L") + "Z";

function edge(pts: Pt[], a: Pt, b: Pt, step: number, j: number, r: () => number) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, n = Math.max(1, Math.round(L / step)), nx = -dy / L, ny = dx / L;
  for (let i = 1; i <= n; i++) {
    const t = i / n, o = i === n ? 0 : (r() - 0.5) * 2 * j;
    pts.push([a[0] + dx * t + nx * o, a[1] + dy * t + ny * o]);
  }
}

type Torn = { t?: boolean; r?: boolean; b?: boolean; l?: boolean };
// A cut sheet w x h. Torn edges get a fine, rough line; tj/ts override its jitter and step
// (the source's 2.6/4.5 are sized for small panels).
export function cut(w: number, h: number, seed: number, o: { torn?: Torn; j?: number; step?: number; tj?: number; ts?: number } = {}): string {
  const r = rng(seed * 9973 + 7), j = o.j ?? 1.1, st = o.step ?? 44, T = o.torn ?? {}, tj = o.tj ?? 2.6, ts = o.ts ?? 4.5;
  const c: Pt[] = [[r() * j, r() * j], [w - r() * j, r() * j], [w - r() * j, h - r() * j], [r() * j, h - r() * j]];
  const pts: Pt[] = [c[0]!];
  edge(pts, c[0]!, c[1]!, T.t ? ts : st, T.t ? tj : j, r);
  edge(pts, c[1]!, c[2]!, T.r ? ts : st, T.r ? tj : j, r);
  edge(pts, c[2]!, c[3]!, T.b ? ts : st, T.b ? tj : j, r);
  edge(pts, c[3]!, c[0]!, T.l ? ts : st, T.l ? tj : j, r);
  return "M" + pts.map(xy).join("L") + "Z";
}

export function disc(cx: number, cy: number, R: number, seed: number, j = 1.3): string {
  const r = rng(seed * 31 + 3), n = Math.max(16, Math.round(R * 0.5)), pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, q = R + (r() - 0.5) * 2 * j;
    pts.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q]);
  }
  return poly(pts);
}

export function line(x0: number, y0: number, x1: number, y1: number, seed: number, j = 0.7): string {
  const r = rng(seed * 17 + 5), L = Math.hypot(x1 - x0, y1 - y0) || 1, n = Math.max(2, Math.round(L / 14)), nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
  let s = "M" + xy([x0, y0]);
  for (let i = 1; i <= n; i++) {
    const t = i / n, o = i === n ? 0 : (r() - 0.5) * 2 * j;
    s += "L" + xy([x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o]);
  }
  return s;
}

export function loop(cx: number, cy: number, rx: number, ry: number, seed: number): string {
  const r = rng(seed * 13 + 1), n = 44, a0 = -2.2 + r() * 0.4;
  let s = "";
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * (Math.PI * 2 + 0.45), k = 1 + (r() - 0.5) * 0.035 + (i / n) * 0.05;
    s += (i ? "L" : "M") + xy([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return s;
}

export function tick(x: number, y: number, s: number): string {
  return "M" + xy([x + 0.15 * s, y + 0.55 * s]) + "L" + xy([x + 0.42 * s, y + 0.82 * s]) + "L" + xy([x + 0.95 * s, y + 0.12 * s]);
}

// Path2D primitives as SVG. Both keep the canvas winding (rect and default arcs clockwise
// on screen), so a hole is a shape wound the other way, exactly as in the source.
const rect = (x: number, y: number, w: number, h: number) => `M${xy([x, y])}h${f1(w)}v${f1(h)}h${f1(-w)}Z`;
function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0, hole = false): string {
  const c = Math.cos(rot), s = Math.sin(rot), a = xy([cx + c * rx, cy + s * rx]), b = xy([cx - c * rx, cy - s * rx]);
  const arc = `A${f1(rx)} ${f1(ry)} ${f1((rot * 180) / Math.PI)} 0 ${hole ? 0 : 1} `;
  return `M${a}${arc}${b}${arc}${a}Z`;
}

// Speaker stack and a light stand with two par cans.
function rig(w: number, h: number): string {
  const m = Math.min(w, h);
  let d =
    rect(w * 0.06, h * 0.56, w * 0.5, h * 0.4) + ellipse(w * 0.31, h * 0.76, m * 0.17, m * 0.17, 0, true) + ellipse(w * 0.31, h * 0.76, m * 0.06, m * 0.06) +
    rect(w * 0.1, h * 0.2, w * 0.42, h * 0.34) + ellipse(w * 0.31, h * 0.3, m * 0.05, m * 0.05, 0, true) + ellipse(w * 0.31, h * 0.44, m * 0.09, m * 0.09, 0, true) +
    rect(w * 0.62, h * 0.14, w * 0.3, h * 0.025) + rect(w * 0.76, h * 0.14, w * 0.025, h * 0.8) + rect(w * 0.66, h * 0.94, w * 0.22, h * 0.025);
  for (const [u, t] of [[0.65, 0.5], [0.89, -0.5]] as const) {
    const ax = -Math.sin(t), ay = Math.cos(t), bx = Math.cos(t), by = Math.sin(t), x = w * u, y = h * 0.15, hw = w * 0.04, L = h * 0.12;
    d += poly([[x - bx * hw, y - by * hw], [x + bx * hw, y + by * hw], [x + bx * hw + ax * L, y + by * hw + ay * L], [x - bx * hw + ax * L, y - by * hw + ay * L]]);
    d += ellipse(x + ax * L * 0.74, y + ay * L * 0.74, hw * 0.6, L * 0.14, t, true); // lens cut out
  }
  return d;
}

// Clockwise on screen, so the polygon adds to the silhouette under fill-rule nonzero.
function cw(pts: Pt[]): Pt[] {
  let a = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]!; a += p[0] * q[1] - q[0] * p[1]; });
  return a < 0 ? pts.reverse() : pts;
}

// Shoulders and head seen from behind (the guest from VectorStage), shoulders on y, body down to bottom.
function person(x: number, y: number, s: number, seed: number, bottom: number): string {
  const body: Pt[] = [[x - 46 * s, bottom], [x - 46 * s, y], [x - 40 * s, y - 52 * s], [x - 16 * s, y - 70 * s], [x + 16 * s, y - 70 * s], [x + 40 * s, y - 52 * s], [x + 46 * s, y], [x + 46 * s, bottom]];
  return poly(body) + disc(x, y - 92 * s, 22 * s, seed, 1.3 * s);
}

// A raised arm from the shoulder on one side (side 1 right, -1 left), with a fist.
function arm(x: number, y: number, s: number, side: number, seed: number): string {
  const a: Pt = [x + side * 32 * s, y - 46 * s], b: Pt = [x + side * 46 * s, y - 210 * s], L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = ((a[1] - b[1]) / L) * 7 * s, ny = ((b[0] - a[0]) / L) * 7 * s;
  return poly(cw([[a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny], [a[0] + nx, a[1] + ny]])) + disc(b[0], b[1], 12 * s, seed, s);
}

// The mascot head scaled into the frame. Every command in it takes x y pairs, so its
// numbers alternate x and y.
function alien(w: number, h: number): string {
  const s = Math.min(w / 18, h / 20) * 0.92;
  const place = (d: string) => {
    let i = 0;
    return d.replace(/-?\d*\.?\d+/g, (n) => String(f1((i++ % 2 ? h / 2 : w / 2) + (Number(n) - 12) * s)));
  };
  return place(ALIEN_HEAD) + EYE_HOLES.map(place).join("");
}

// A motif silhouette in a w x h frame, as one SVG path for fill-rule nonzero.
export function shape(kind: Motif, w: number, h: number, seed: number): string {
  const r = rng(seed * 7 + 2), cx = w * (0.46 + (r() - 0.5) * 0.08), hy = h * 0.3, hr = Math.min(w, h) * 0.17;
  if (kind === "rig") return rig(w, h);
  if (kind === "stage") return rig(w, h * 0.78) + rect(w * 0.02, h * 0.76, w * 0.96, h * 0.2);
  if (kind === "alien") return alien(w, h);
  if (kind === "singer") {
    // A singer at a big mic: a smaller head, a ball capsule at the mouth, its handle angled
    // down and away to a straight stand on the floor. Sized for the 530x650 cut-out.
    const x = cx - w * 0.1, y = h * 0.19, k = hr * 0.75, sy = h * 0.4;
    const mx = x + k * 1.8, my = y + k * 0.45, dx = Math.sin(0.55), dy = Math.cos(0.55);
    const p0: Pt = [mx + dx * hr * 0.4, my + dy * hr * 0.4], p1: Pt = [mx + dx * hr * 2.1, my + dy * hr * 2.1], a = hr * 0.24, b = hr * 0.1;
    return (
      ellipse(x, y, k * 0.92, k * 1.08, (r() - 0.5) * 0.3) + rect(x - k * 0.38, y + k * 0.7, k * 0.76, sy - y - k * 0.7 + 12) +
      `M${xy([x - w * 0.3, h - 3])}L${xy([x - w * 0.26, sy + h * 0.07])}Q${xy([x, sy - h * 0.09])} ${xy([x + w * 0.27, sy + h * 0.07])}L${xy([x + w * 0.31, h - 3])}Z` +
      ellipse(mx, my, hr * 0.5, hr * 0.62, -0.55) + // long axis along the handle, so ball and handle read as one mic
      poly(cw([[p0[0] - dy * a, p0[1] + dx * a], [p1[0] - dy * b, p1[1] + dx * b], [p1[0] + dy * b, p1[1] - dx * b], [p0[0] + dy * a, p0[1] - dx * a]])) +
      rect(p1[0] - hr * 0.07, p1[1] - hr * 0.05, hr * 0.14, h - 3 - p1[1] + hr * 0.05)
    );
  }
  if (kind === "crowd") {
    // Five people in a row from behind at staggered heights, two with an arm up.
    const s = w / 340;
    let d = "";
    [0.1, 0.3, 0.5, 0.7, 0.9].forEach((u, i) => {
      const x = w * (u + (r() - 0.5) * 0.03), y = h * (i % 2 ? 0.54 : 0.44) + (r() - 0.5) * h * 0.04, k = s * (0.92 + r() * 0.16);
      d += person(x, y, k, seed + i * 3, h + 2);
      if (i % 2) d += arm(x, y, k, i === 1 ? -1 : 1, seed + i);
    });
    return d;
  }
  let d =
    ellipse(cx, hy, hr * 0.92, hr * 1.08, (r() - 0.5) * 0.3) + rect(cx - hr * 0.38, hy + hr * 0.7, hr * 0.76, Math.max(hr * 0.9, h * 0.6 - hy - hr * 0.7)) +
    `M${xy([w * 0.1, h - 3])}L${xy([w * 0.16, h * 0.68])}Q${xy([cx, h * 0.5])} ${xy([w * 0.84, h * 0.66])}L${xy([w * 0.9, h - 3])}Z`;
  if (kind === "guitarist") d += ellipse(w * 0.4, h * 0.84, w * 0.24, h * 0.12, -0.45) + poly([[w * 0.5, h * 0.78], [w * 0.86, h * 0.48], [w * 0.9, h * 0.53], [w * 0.55, h * 0.84]]);
  if (kind === "keyboardist") d += rect(w * 0.04, h * 0.8, w * 0.92, h * 0.12);
  if (kind === "drummer") d += ellipse(w * 0.28, h * 0.88, w * 0.18, h * 0.1) + ellipse(w * 0.74, h * 0.88, w * 0.15, h * 0.09) + ellipse(w * 0.84, h * 0.52, w * 0.13, h * 0.025, -0.2);
  return d;
}

// The source's shading, stretched 1.5x around 0.3 so a big cut-out runs from a light top to a
// solid foot instead of reading as flat black. floor keeps the lightest part visible: the
// thin-stroked Phosphor objects need a higher one than the solid hand-ported shapes.
function tone(u: number, v: number, r: () => number, floor: number): number {
  return Math.max(floor, (0.2 + 0.42 * v + 0.2 * u + 0.18 * Math.hypot(u - 0.5, v - 0.35) + (r() - 0.5) * 0.1 - 0.3) * 1.5);
}

// An object as one path for fill-rule nonzero, drawn at k times its own units into a w x h frame.
type Silhouette = { d: string; k: number; w: number; h: number };
export function silhouette(name: ArtObject, size: number, seed: number): Silhouette {
  if (!isMotif(name)) return { d: ICONS[name], k: size / 256, w: size, h: size };
  const w = Math.round((size * 530) / 650);
  return { d: shape(name, w, size, seed), k: 1, w, h: size };
}
const draw = (s: Silhouette, attrs = "") => `<path d="${s.d}"${s.k === 1 ? "" : ` transform="scale(${+s.k.toFixed(4)})"`} ${attrs}/>`;

// Ink dots on a 45-degree screen, sized by tone() and clipped to the silhouette. The screen
// widens on big frames so a frame never needs more than about 5600 dots.
export function halftone(s: Silhouette, seed: number, id: string, floor = 0.1): string {
  const { w, h } = s, r = rng(seed * 131 + 11);
  const sp = Math.max(w > 100 ? 4.2 : 3.4, Math.sqrt((w * h) / 5600)), ca = Math.SQRT1_2, D = Math.hypot(w, h) / 2 + sp;
  let dots = "";
  for (let a = -D; a <= D; a += sp) {
    for (let b = -D; b <= D; b += sp) {
      const x = w / 2 + (a - b) * ca, y = h / 2 + (a + b) * ca;
      if (x < -2 || y < -2 || x > w + 2 || y > h + 2) continue;
      const t = Math.max(0, Math.min(1, tone(x / w, y / h, r, floor))), rad = sp * 0.6 * Math.sqrt(t);
      if (rad < 0.3) continue;
      dots += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(rad)}"/>`;
    }
  }
  return `<clipPath id="${id}">${draw(s)}</clipPath><g clip-path="url(#${id})" fill="${INK}">${dots}</g>`;
}

// ---- text ----

// Outfit advance widths per 1000 units for ASCII 32..126, measured in Chrome at weights 800
// and 500. Kerning only narrows a run, so sums of these never undershoot.
const W800 = [185,297,471,673,613,698,701,254,315,315,489,571,287,463,304,376,671,390,576,569,613,568,579,530,569,579,300,286,571,571,571,496,766,742,650,692,761,627,602,791,739,305,550,721,567,866,748,812,640,819,663,596,649,708,722,1012,724,694,617,352,376,352,474,517,338,603,603,501,603,554,452,588,583,275,288,563,276,879,583,582,603,603,453,471,410,550,550,800,550,541,495,349,308,349,571];
const W500 = [200,262,426,641,584,658,669,242,299,299,491,547,276,461,290,401,655,355,541,540,599,545,562,522,548,562,271,269,547,547,547,506,737,702,622,683,740,590,566,772,712,267,494,672,550,842,717,794,604,820,628,556,619,690,696,982,698,672,589,341,401,341,451,481,293,580,580,487,580,534,403,575,551,234,242,511,232,861,551,563,580,580,425,430,378,517,510,754,509,518,451,326,282,326,547];
const W600 = W800.map((v, i) => Math.max(v, W500[i]!)); // ponytail: 600 bounded by the wider of 500 and 800
function width(s: string, size: number, table: number[]): number {
  let t = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    t += c >= 32 && c < 127 ? table[c - 32]! : c > 0x2000 ? 1000 : 700; // ponytail: non-ASCII guessed wide
  }
  return (t / 1000) * size;
}
export const textWidth = (s: string, size: number, weight: 600 | 800) => width(s, size, weight === 800 ? W800 : W600);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

// Greedy word wrap at a fixed size.
function wrap(text: string, size: number, w: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && width(`${last} ${word}`, size, W600) <= w) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}
const widest = (lines: string[], size: number) => Math.max(0, ...lines.map((l) => width(l, size, W600)));

// ---- path geometry ----

const NUM = /[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi;

// d split into standalone subpaths, one per M after Z. A relative m after Z starts from the
// previous subpath's start, so it becomes an absolute M; any pairs after it stay relative, as l.
// Filled one by one, the subpaths make the silhouette with every hole filled in.
// Assumes a moveto only ever follows a Z, which holds for every object (see the art test).
export function subpaths(d: string): string[] {
  let sx = 0, sy = 0;
  return d.split(/(?<=[Zz])\s*(?=[Mm])/).map((part, i) => {
    const head = new RegExp(`^([Mm])[\\s,]*(${NUM.source})[\\s,]*(${NUM.source})`, "i").exec(part);
    if (!head) return part;
    const rel = head[1] === "m" && i > 0, x = Number(head[2]) + (rel ? sx : 0), y = Number(head[3]) + (rel ? sy : 0);
    const rest = part.slice(head[0].length);
    [sx, sy] = [x, y];
    return `M${f1(x)} ${f1(y)}${/^[\s,]*[-+.\d]/.test(rest) ? (head[1] === "m" ? "l" : "L") : ""}${rest}`;
  });
}

const ARITY: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7 };
const bez = (ps: Pt[], t: number): Pt =>
  ps.length === 1 ? ps[0]! : bez(ps.slice(1).map((p, i): Pt => [ps[i]![0] + (p[0] - ps[i]![0]) * t, ps[i]![1] + (p[1] - ps[i]![1]) * t]), t);

// Points along an elliptical arc (SVG endpoint form, converted to centre form), end included.
function arcPts(p0: Pt, a: number[], p1: Pt): Pt[] {
  let [rx, ry] = [Math.abs(a[0]!), Math.abs(a[1]!)];
  if (!rx || !ry) return [p1];
  const phi = (a[2]! * Math.PI) / 180, c = Math.cos(phi), s = Math.sin(phi), dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2;
  const xp = c * dx + s * dy, yp = -s * dx + c * dy, lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lam > 1) [rx, ry] = [rx * Math.sqrt(lam), ry * Math.sqrt(lam)];
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp, den = rx * rx * yp * yp + ry * ry * xp * xp;
  const k = (a[3] === a[4] ? -1 : 1) * Math.sqrt(Math.max(0, num / den)), cxp = (k * rx * yp) / ry, cyp = (-k * ry * xp) / rx;
  const cx = c * cxp - s * cyp + (p0[0] + p1[0]) / 2, cy = s * cxp + c * cyp + (p0[1] + p1[1]) / 2;
  const t0 = Math.atan2((yp - cyp) / ry, (xp - cxp) / rx);
  let dt = Math.atan2((-yp - cyp) / ry, (-xp - cxp) / rx) - t0;
  if (a[4] && dt < 0) dt += 2 * Math.PI;
  if (!a[4] && dt > 0) dt -= 2 * Math.PI;
  const out: Pt[] = [];
  for (let i = 1; i <= 8; i++) {
    const t = t0 + (dt * i) / 8;
    out.push([cx + c * rx * Math.cos(t) - s * ry * Math.sin(t), cy + s * rx * Math.cos(t) + c * ry * Math.sin(t)]);
  }
  return out;
}

// Points along d's outline, a few per segment, in d's own units. S and T are taken as if
// their first control point sat on the current point: close enough to find an edge.
export function outline(d: string): Pt[] {
  const pts: Pt[] = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  for (const [, cmd, args] of d.matchAll(/([a-zA-Z])([^a-zA-Z]*)/g)) {
    const l = cmd!.toLowerCase(), rel = cmd === l, n = (args!.match(NUM) ?? []).map(Number), k = ARITY[l];
    if (!k) { [x, y] = [sx, sy]; continue; } // z
    for (let i = 0; i + k <= n.length; i += k) {
      const a = n.slice(i, i + k), p0: Pt = [x, y], P = (j: number): Pt => [a[j]! + (rel ? x : 0), a[j + 1]! + (rel ? y : 0)];
      let ctrl: Pt[];
      if (l === "m" && i === 0) { [x, y] = P(0); [sx, sy] = [x, y]; pts.push([x, y]); continue; }
      if (l === "h") ctrl = [p0, [a[0]! + (rel ? x : 0), y]];
      else if (l === "v") ctrl = [p0, [x, a[0]! + (rel ? y : 0)]];
      else if (l === "c") ctrl = [p0, P(0), P(2), P(4)];
      else if (l === "s") ctrl = [p0, p0, P(0), P(2)];
      else if (l === "q") ctrl = [p0, P(0), P(2)];
      else if (l === "a") { const e = P(5); pts.push(...arcPts(p0, a, e)); [x, y] = e; continue; }
      else ctrl = [p0, P(0)]; // l, t, and the pairs after an m
      for (let j = 1; j <= 6; j++) pts.push(bez(ctrl, j / 6));
      [x, y] = ctrl.at(-1)!;
    }
  }
  return pts;
}

// ---- layout ----

// One object placed on the sheet: x y is the centre of its frame, not of its ink.
export type Cut = { name: ArtObject; x: number; y: number; size: number; rot: number; seed: number; red?: boolean; offset?: boolean; flip?: boolean; mirror?: boolean; grow?: number };
export type Box = { x0: number; y0: number; x1: number; y1: number };
export const hit = (a: Box, b: Box, pad = 0) => a.x0 - pad < b.x1 && b.x0 - pad < a.x1 && a.y0 - pad < b.y1 && b.y0 - pad < a.y1;
export const union = (bs: Box[]): Box => ({ x0: Math.min(...bs.map((b) => b.x0)), y0: Math.min(...bs.map((b) => b.y0)), x1: Math.max(...bs.map((b) => b.x1)), y1: Math.max(...bs.map((b) => b.y1)) });
const boxOf = (p: Pt[]): Box => union(p.map(([x, y]) => ({ x0: x, y0: y, x1: x, y1: y })));
const bw = (b: Box) => b.x1 - b.x0, bh = (b: Box) => b.y1 - b.y0;
const edgeOf = (size: number) => Math.max(10, size * 0.03); // white sticker edge
const offOf = (size: number) => Math.max(7, size * 0.022); // red offset

// Objects whose front points left as drawn. In versus, objects[0] is turned to face right and
// objects[1] to face left, so the two face each other; everything else counts as facing right.
const FACES_LEFT = new Set<ArtObject>(["megaphone", "cursor-click", "paint-brush", "pencil-simple", "hammer", "magnifying-glass", "key", "magnet"]);

// Maps a point in the silhouette's own units to the canvas, as cutout()'s transform does.
function placer(c: Cut, s: Silhouette) {
  const a = (c.rot * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a), fx = (c.mirror ? -1 : 1) * (c.flip ? -1 : 1), fy = c.flip ? -1 : 1;
  return ([px, py]: Pt): Pt => {
    const u = (px * s.k - s.w / 2) * fx, v = (py * s.k - s.h / 2) * fy;
    return [c.x + u * co - v * si, c.y + u * si + v * co];
  };
}
const rim = (c: Cut) => { const s = silhouette(c.name, c.size, c.seed); return outline(s.d).map(placer(c, s)); };

// The canvas box of the drawn object itself (its real path bounds, not its 256 frame), and
// the box it covers with the sticker edge and red offset.
export const inkBox = (c: Cut): Box => boxOf(rim(c));
export function cutBox(c: Cut): Box {
  const b = inkBox(c), m = edgeOf(c.size) / 2 + offOf(c.size) + (c.grow ?? 0);
  return { x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m };
}

// The filled area of the drawn object on the canvas: the shoelace area of each placed subpath,
// signed, so a hole wound the other way subtracts. That is the ink a viewer sees, where the box
// would count the empty middle of an open shape (headphones) as weight.
// ponytail: overlapping subpaths wound the same way count twice (a motif's head on its body); fine for weighing.
export function inkArea(c: Cut): number {
  const s = silhouette(c.name, c.size, c.seed), at = placer(c, s);
  let a = 0;
  for (const sp of subpaths(s.d)) {
    const p = outline(sp).map(at);
    p.forEach((q, i) => { const n = p[(i + 1) % p.length]!; a += q[0] * n[1] - n[0] * q[1]; });
  }
  return Math.abs(a) / 2;
}
// Solid red paper reads heavier than the same area of halftone: the dots cover about half the
// shape (measured 0.47 to 0.52 over a spread of objects) and the red is nearly as dark as ink, so in
// versus the red side is weighed up by this factor.
export const RED_WEIGHT = 1.6;
export const weight = (c: Cut) => inkArea(c) * (c.red ? RED_WEIGHT : 1);

// Scales c so its ink fits w x h. Twice, since a hand-drawn motif is only nearly linear in size.
function fit(c: Cut, w: number, h: number): Cut {
  for (let i = 0; i < 2; i++) { const b = inkBox(c); c.size *= Math.min(w / bw(b), h / bh(b)); }
  return c;
}
// Moves c so the point at fractions fx fy of its ink box lands on x y.
function pin(c: Cut, x: number, y: number, fx = 0.5, fy = 0.5): Cut {
  const b = inkBox(c);
  c.x += x - (b.x0 + bw(b) * fx);
  c.y += y - (b.y0 + bh(b) * fy);
  return c;
}

// The grid, in canvas pixels. One torn sheet in the middle of the frame; everything that
// carries meaning sits inside AREA, one GRID unit in from the sheet's edges, which also keeps it
// clear of the outer 8% at top and bottom that X crops. The composition (objects, flap and note)
// is centred on the sheet's centre.
const SX = 170, SY = 78, SW = 1260, SH = 744;
export const SHEET_BOX: Box = { x0: SX, y0: SY, x1: SX + SW, y1: SY + SH };
export const GRID = 64;
export const AREA: Box = { x0: SX + GRID, y0: SY + GRID, x1: SX + SW - GRID, y1: SY + SH - GRID };
export const CX = SX + SW / 2, CY = SY + SH / 2;
export const SUBJECT = 470; // the subject's ink height at full size: 63% of the sheet
const SIDE_W = 520, SIDE_GAP = 120, BAND_GAP = 110; // a note's width at the side, and its gap to the ink
const VS_GAP = 180, SCALE_GAP = 140, ODD = 210, ODD_GAP = 72;
export const LABEL_SIZE = 88; // pencil label, just under 1/10 of the image height
export const LABEL_MIN = 76; // never below 1/12 of the image height
export const STAMP_SIZE = 76;

type Setting = { lines: string[]; size: number; lh: number; w: number; h: number };
export type Note = { lines: string[]; size: number; lh: number; anchor: "start" | "end"; box: Box };

// The label set in as few lines as fit maxW, shrinking only when one word is too wide. Its
// height runs from the ascenders to the descenders.
function setNote(text: string, maxW: number): Setting {
  let size = LABEL_SIZE, lines = wrap(text, size, maxW);
  while (widest(lines, size) > maxW && size > 24) lines = wrap(text, (size -= 4), maxW);
  const lh = size * 1.02;
  return { lines, size, lh, w: widest(lines, size), h: size * 0.76 + (lines.length - 1) * lh + size * 0.24 };
}
// The note with its anchored (flush) edge at x and its top at y.
function noteAt(t: Setting, anchor: "start" | "end", x: number, y: number): Note {
  const x0 = anchor === "start" ? x : x - t.w;
  return { lines: t.lines, size: t.size, lh: t.lh, anchor, box: { x0, y0: y, x1: x0 + t.w, y1: y + t.h } };
}

// peek: a torn flap of paper taped over one side of the object. x y is its centre; side is
// the side of the object it covers.
export type Flap = { x: number; y: number; w: number; h: number; rot: number; side: 1 | -1 };
const flapCorners = (f: Flap): Pt[] => {
  const a = (f.rot * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a);
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([u, v]): Pt => [f.x + (u * f.w * co - v * f.h * si) / 2, f.y + (u * f.w * si + v * f.h * co) / 2]);
};
export const flapBox = (f: Flap) => boxOf(flapCorners(f));
// Points along the flap's edge, for the arrow to find its nearest side.
const flapRim = (f: Flap): Pt[] => {
  const c = flapCorners(f), out: Pt[] = [];
  c.forEach((p, i) => { const q = c[(i + 1) % 4]!; for (let t = 0; t < 1; t += 0.05) out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); });
  return out;
};

type Stamp = { word: string; x: number; y: number; rot: number; bw: number; bh: number; box: Box };
export type Plan = { cuts: Cut[]; target: number; note?: Note; stamp?: Stamp; flap?: Flap };

// Everything a note, a stamp or another object must keep clear of.
export const taken = (p: Plan): Box[] => [...p.cuts.map(cutBox), ...(p.flap ? [flapBox(p.flap)] : [])];
// The composition: objects, flap and note together. It is what gets centred.
export const compositionBox = (p: Plan): Box => union([...taken(p), ...(p.note ? [p.note.box] : [])]);

type Dice = { left: boolean; tilt: number[]; n: number; pick: number; turn: number; flapTilt: number; stampRot: number };

// The composition at scale k, laid out around 0 0 and then centred on the sheet.
function layout(spec: ArtSpec, k: number, R: Dice): Plan {
  const { seed, composition } = spec;
  const [a, b = a] = spec.objects as [ArtObject, ArtObject?];
  const label = spec.label?.trim() || undefined;
  const side = label ? setNote(label, SIDE_W) : undefined, band = label ? setNote(label, bw(AREA)) : undefined;
  const sideOk = !!side && side.size >= LABEL_MIN && side.lines.length <= 2;
  // A note in the band above the composition, flush with its left or right ink edge.
  const above = (anchor: "start" | "end", blk: Box) => noteAt(band!, anchor, anchor === "start" ? blk.x0 : blk.x1, blk.y0 - BAND_GAP - band!.h);
  const inks = () => union(cuts.map(inkBox));
  const cuts: Cut[] = [];
  let target = 0, note: Note | undefined, flap: Flap | undefined;

  if (composition === "hero" || composition === "twist" || composition === "peek") {
    const twist = composition === "twist" ? (spec.twist ?? "cross") : undefined;
    const o = pin(fit({ name: a, x: 0, y: 0, size: 600, rot: R.tilt[0]!, seed, flip: twist === "flip", grow: twist === "crack" ? 30 : 0 }, 780 * k, SUBJECT * k), 0, 0);
    cuts.push(o);
    const ib = inkBox(o), s = R.left ? -1 : 1;
    if (composition === "peek") {
      // The flap covers half the object on the note's side, so the arrow points at what is hidden.
      const xa = s > 0 ? ib.x0 + bw(ib) * 0.5 : ib.x0 - 36 * k, xb = s > 0 ? ib.x1 + 36 * k : ib.x1 - bw(ib) * 0.5;
      flap = { x: (xa + xb) / 2, y: (ib.y0 + ib.y1) / 2, w: xb - xa, h: bh(ib) + 80 * k, rot: s * R.flapTilt, side: s };
    }
    const blk = union([ib, ...(flap ? [flapBox(flap)] : [])]);
    // A side note sits on the composition's middle line, so subject and note read as one balanced
    // row (hung from the top edge it left the opposite lower quadrant empty, an L at phone size).
    // A long one, or one that would squeeze a wide subject, goes in the band above.
    const my = (blk.y0 + blk.y1) / 2 - (side?.h ?? 0) / 2;
    if (label) note = !sideOk || bw(blk) + SIDE_GAP + side!.w > bw(AREA) ? above(s < 0 ? "start" : "end", blk) : s < 0 ? noteAt(side!, "end", blk.x0 - SIDE_GAP, my) : noteAt(side!, "start", blk.x1 + SIDE_GAP, my);
  } else if (composition === "versus") {
    // Equal visual weight on one baseline, facing each other across a gap: both fit the same box,
    // then the heavier one (by filled area, red weighed up) shrinks to the lighter one's weight.
    const A = fit({ name: a, x: 0, y: 0, size: 400, rot: R.tilt[0]!, seed, mirror: FACES_LEFT.has(a) }, 500 * k, SUBJECT * k);
    const B = fit({ name: b, x: 0, y: 0, size: 400, rot: R.tilt[1]!, seed: seed + 1, red: true, offset: false, mirror: !FACES_LEFT.has(b) }, 500 * k, SUBJECT * k);
    // Twice, since a hand-drawn motif is only nearly linear in size.
    for (let i = 0; i < 2; i++) { const W = Math.min(weight(A), weight(B)); for (const c of [A, B]) c.size *= Math.sqrt(W / weight(c)); }
    cuts.push(pin(A, (-VS_GAP * k) / 2, 0, 1, 1), pin(B, (VS_GAP * k) / 2, 0, 0, 1));
    target = spec.labelPoints ?? 0;
    if (label) note = above(target ? "end" : "start", inks());
  } else if (composition === "scale") {
    // A tiny red object right beside a huge one, on one baseline. A note on the tiny one sits in
    // the column over it, flush with its right edge, so the arrow drops straight onto it. Otherwise
    // the note goes in the band, flush with the side of the object it points at.
    target = spec.labelPoints ?? 0;
    const T = fit({ name: a, x: 0, y: 0, size: 140, rot: R.tilt[0]! * 2, seed, red: true, offset: false }, 150 * k, 0.24 * SUBJECT * k);
    const H = fit({ name: b, x: 0, y: 0, size: 600, rot: R.tilt[1]! * 0.6, seed: seed + 1 }, 640 * k, SUBJECT * k);
    const useSide = !target && sideOk && side!.w + SCALE_GAP * k + bw(inkBox(H)) <= bw(AREA), col = Math.max(bw(inkBox(T)), useSide ? side!.w : 0);
    cuts.push(pin(T, col, 0, 1, 1), pin(H, col + SCALE_GAP * k, 0, 0, 1));
    if (label) note = useSide ? noteAt(side!, "end", col, Math.min(inkBox(H).y0, inkBox(T).y0 - BAND_GAP - side!.h)) : above(target ? "end" : "start", inks());
  } else {
    // odd: 5-7 copies in two centred rows on an even pitch, exactly one solid red and turned.
    // With a label the red one is in the top row, nearest the note.
    const proto = fit({ name: a, x: 0, y: 0, size: 300, rot: 0, seed }, ODD * 1.15 * k, ODD * k), pb = inkBox(proto);
    const px = bw(pb) + ODD_GAP * k, py = bh(pb) + ODD_GAP * k, per = [Math.ceil(R.n / 2), Math.floor(R.n / 2)];
    const pool = label ? per[0]! : R.n;
    target = Math.floor(R.pick * pool);
    per.forEach((count, row) => {
      for (let col = 0; col < count; col++) {
        const i = cuts.length, odd = i === target;
        cuts.push(pin({ name: a, x: 0, y: 0, size: proto.size, rot: odd ? R.turn : R.tilt[i]!, seed: seed + i, red: odd }, (col - (count - 1) / 2) * px, row * py));
      }
    });
    if (label) { const tx = cuts[target]!.x; note = above(tx < -1 ? "start" : tx > 1 ? "end" : R.left ? "start" : "end", inks()); }
  }

  const p: Plan = { cuts, target, note, flap }, g = compositionBox(p);
  shiftPlan(p, CX - (g.x0 + g.x1) / 2, CY - (g.y0 + g.y1) / 2);
  return p;
}

const shiftPlan = (p: Plan, dx: number, dy: number) => {
  for (const c of p.cuts) { c.x += dx; c.y += dy; }
  if (p.flap) { p.flap.x += dx; p.flap.y += dy; }
  if (p.note) p.note.box = { x0: p.note.box.x0 + dx, y0: p.note.box.y0 + dy, x1: p.note.box.x1 + dx, y1: p.note.box.y1 + dy };
};

// A rubber stamp. First choice is a corner of AREA clear of the composition, lower right first,
// which leaves the composition where it is. Next is beside it, one GRID unit out on its middle
// line, or under it, flush with its right edge; the two are then centred together.
// That keeps a wide or tall subject big where a corner would force it to shrink.
function stampFor(p: Plan, word: string, rot: number, fallback: boolean): Stamp | undefined {
  const w = width(word, STAMP_SIZE, W800) + word.length * 0.04 * STAMP_SIZE + 52, h = STAMP_SIZE + 36;
  const t = (rot * Math.PI) / 180, hw = (w * Math.abs(Math.cos(t)) + h * Math.abs(Math.sin(t))) / 2, hh = (w * Math.abs(Math.sin(t)) + h * Math.abs(Math.cos(t))) / 2;
  const at = (x: number, y: number): Stamp => ({ word, x, y, rot, bw: w, bh: h, box: { x0: x - hw, y0: y - hh, x1: x + hw, y1: y + hh } });
  const busy = [...taken(p), ...(p.note ? [p.note.box] : [])], g = compositionBox(p);
  const corners = [at(AREA.x1 - hw, AREA.y1 - hh), at(AREA.x0 + hw, AREA.y1 - hh), at(AREA.x1 - hw, AREA.y0 + hh), at(AREA.x0 + hw, AREA.y0 + hh)];
  const corner = corners.find((s) => busy.every((b) => !hit(s.box, b, 24)));
  if (corner) return corner;
  const gx = GRID + 2 * hw, gy = GRID + 2 * hh;
  if (bw(g) + gx <= bw(AREA)) { shiftPlan(p, -gx / 2, 0); return at(g.x1 + GRID + hw - gx / 2, (g.y0 + g.y1) / 2); }
  if (bh(g) + gy <= bh(AREA)) { shiftPlan(p, 0, -gy / 2); return at(g.x1 - hw, g.y1 + GRID + hh - gy / 2); }
  return fallback ? corners[0] : undefined;
}

// Where everything goes. Exported so the tests can check boxes without parsing the SVG. The
// composition starts at full size and shrinks about the centre until it fits AREA and leaves
// room for the stamp.
export function plan(spec: ArtSpec): Plan {
  const r = rng(spec.seed * 131 + 17), tilt = () => (r() - 0.5) * 7;
  const R: Dice = { left: r() < 0.5, tilt: Array.from({ length: 7 }, tilt), n: 5 + Math.floor(r() * 3), pick: r(), turn: (r() < 0.5 ? -1 : 1) * (14 + r() * 6), flapTilt: 2 + r() * 2, stampRot: -(5 + r() * 6) };
  const word = spec.stamp?.toUpperCase();
  let p!: Plan;
  // ponytail: a 22-letter label plus a long stamp can need k near 0.4; the floor keeps a stamp from ever landing on the art.
  for (let k = 1; k > 0.3; k -= 0.04) {
    p = layout(spec, k, R);
    const g = compositionBox(p);
    if (bw(g) > bw(AREA) || bh(g) > bh(AREA)) continue;
    if (!word || (p.stamp = stampFor(p, word, R.stampRot, false))) return p;
  }
  if (word) p.stamp = stampFor(p, word, R.stampRot, true);
  return p;
}

// ---- scrapbook parts ----

const pencil = (d: string, sw: number, color = RED) =>
  `<g transform="translate(1.5 -1)" fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" style="mix-blend-mode:multiply">` +
  `<path d="${d}" stroke-width="${f1(sw)}" opacity=".92"/><path d="${d}" stroke-width="${f1(sw * 0.7)}" opacity=".5" transform="translate(${f1(sw * 0.22)} ${f1(sw * 0.19)})"/></g>`;

// The torn-edge tape strip of paper-parts.js Tape, centred on cx cy.
const TAPE_EDGE = [[0, 12], [5, 0], [11, 9], [89, 4], [95, 0], [100, 14], [97, 52], [100, 90], [93, 100], [86, 92], [9, 98], [3, 100], [0, 86], [3, 48]];
const tape = (cx: number, cy: number, w: number, h: number, rot: number) =>
  `<path d="${poly(TAPE_EDGE.map(([u, v]) => [cx - w / 2 + (u! / 100) * w, cy - h / 2 + (v! / 100) * h]))}" fill="${TAPE}" transform="rotate(${f1(rot)} ${f1(cx)} ${f1(cy)})" style="mix-blend-mode:multiply"/>`;

// Paper fibres: short faint pencil strokes scattered over a box.
function fibres(x: number, y: number, w: number, h: number, n: number, r: () => number): string {
  let d = "";
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + r() * h, L = 8 + r() * 22, a = r() * Math.PI, c = Math.cos(a), s = Math.sin(a);
    d += `M${xy([px, py])}Q${xy([px + (c * L) / 2 + (r() - 0.5) * 8, py + (s * L) / 2 + (r() - 0.5) * 8])} ${xy([px + c * L, py + s * L])}`;
  }
  return `<path d="${d}" fill="none" stroke="${PENCIL}" stroke-width=".8" stroke-opacity=".14" stroke-linecap="round"/>`;
}

let fontFace: string | undefined;
// Outfit embedded once, so the SVG renders the same anywhere.
function font(): string {
  fontFace ??= `@font-face{font-family:'Outfit';src:url(data:font/ttf;base64,${fs.readFileSync(path.join(process.cwd(), "brand", "fonts", "Outfit.ttf")).toString("base64")}) format('truetype');font-weight:100 900}`;
  return fontFace;
}

// The scrapbook cut-out: a red offset copy behind, a white sticker edge, then ink halftone
// (or solid red paper) clipped to the silhouette. The two backing layers are filled subpath by
// subpath, so they have no holes: a hole in the object shows white sticker paper, never red.
function cutout(c: Cut, id: string): string {
  const s = silhouette(c.name, c.size, c.seed), edge = edgeOf(c.size), off = offOf(c.size);
  const ox = off * (c.flip ? -1 : 1) * (c.mirror ? -1 : 1), oy = off * 0.85 * (c.flip ? -1 : 1);
  // The red copy's edge is 6px thinner than the white one, so where an outline runs almost along
  // the offset (the hourglass diagonals) no red hairline peeks out; elsewhere the offset shows.
  const solid = (fill: string, w: number) =>
    `<g${s.k === 1 ? "" : ` transform="scale(${+s.k.toFixed(4)})"`} fill="${fill}" stroke="${fill}" stroke-width="${f1(w / s.k)}" stroke-linejoin="round">${subpaths(s.d).map((p) => `<path d="${p}"/>`).join("")}</g>`;
  let t = `translate(${f1(c.x - s.w / 2)} ${f1(c.y - s.h / 2)}) rotate(${f1(c.rot)} ${f1(s.w / 2)} ${f1(s.h / 2)})`;
  if (c.flip) t += ` rotate(180 ${f1(s.w / 2)} ${f1(s.h / 2)})`;
  if (c.mirror) t += ` translate(${f1(s.w)} 0) scale(-1 1)`;
  return (
    `<g transform="${t}">` +
    (c.offset === false ? "" : `<g transform="translate(${f1(ox)} ${f1(oy)})" style="mix-blend-mode:multiply">${solid(RED, Math.max(0, edge - 6))}</g>`) +
    solid(WHITE, edge) +
    (c.red ? draw(s, `fill="${RED}"`) : halftone(s, c.seed, id, isMotif(c.name) ? 0.1 : 0.3)) +
    `</g>`
  );
}

// A hand-drawn pencil arrow from a to b: a gently bowed, slightly wobbly stroke and a head.
function arrow(a: Pt, b: Pt, seed: number): string {
  const r = rng(seed * 19 + 4), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, bend = (seed % 2 ? 1 : -1) * L * 0.3;
  const m: Pt = [(a[0] + b[0]) / 2 - (dy / L) * bend, (a[1] + b[1]) / 2 + (dx / L) * bend]; // quadratic control point
  const pts: Pt[] = [];
  for (let i = 0, n = Math.max(4, Math.round(L / 24)); i <= n; i++) {
    const t = i / n, u = 1 - t, o = i && i < n ? (r() - 0.5) * 2.4 : 0;
    pts.push([u * u * a[0] + 2 * u * t * m[0] + t * t * b[0] - (dy / L) * o, u * u * a[1] + 2 * u * t * m[1] + t * t * b[1] + (dx / L) * o]);
  }
  const ang = Math.atan2(b[1] - m[1], b[0] - m[0]), head = 34;
  const wing = (s: number) => line(b[0], b[1], b[0] - Math.cos(ang + s) * head, b[1] - Math.sin(ang + s) * head, seed + 3, 0.8);
  return pencil("M" + pts.map(xy).join("L") + wing(0.45) + wing(-0.45), 5.5, PENCIL);
}

// The pencil note and its arrow. The arrow leaves the side of the note that faces its aim and
// stops just short of the aim's nearest edge, so its head sits on clear paper.
function drawNote(n: Note, aim: Pt[], pad: number, seed: number): string {
  const b = n.box, my = (b.y0 + b.y1) / 2, rot = -2.5 + (seed % 3), tx = n.anchor === "start" ? b.x0 : b.x1;
  const t = boxOf(aim), cx = (t.x0 + t.x1) / 2, cy = (t.y0 + t.y1) / 2;
  const start: Pt = cx > b.x1 + 40 ? [b.x1 + 22, my] : cx < b.x0 - 40 ? [b.x0 - 22, my] : [Math.min(b.x1 - 20, Math.max(b.x0 + 20, cx)), cy > my ? b.y1 + 16 : b.y0 - 16];
  const dist = (p: Pt) => Math.hypot(p[0] - start[0], p[1] - start[1]);
  const near = aim.reduce((p, q) => (dist(q) < dist(p) ? q : p));
  const d = dist(near) || 1, gap = Math.min(d / 2, pad);
  const end: Pt = [near[0] + ((start[0] - near[0]) / d) * gap, near[1] + ((start[1] - near[1]) / d) * gap];
  return (
    n.lines.map((l, i) => `<text x="${f1(tx)}" y="${f1(b.y0 + n.size * 0.76 + i * n.lh)}" text-anchor="${n.anchor}" font-size="${n.size}" font-weight="600" fill="${PENCIL}" transform="rotate(${rot} ${f1(tx)} ${f1(my)})">${esc(l)}</text>`).join("") +
    arrow(start, end, seed)
  );
}

// peek's flap: a torn scrap of the same sheet, lifted by a soft shadow and taped at the top.
// Its torn edge faces the half of the object that still shows.
function drawFlap(f: Flap, seed: number, r: () => number): string {
  const piece = cut(f.w, f.h, seed + 5, { torn: f.side > 0 ? { l: true } : { r: true }, j: 1.5, step: 60, tj: 5, ts: 7 });
  return (
    `<g transform="translate(${f1(f.x - f.w / 2)} ${f1(f.y - f.h / 2)}) rotate(${f1(f.rot)} ${f1(f.w / 2)} ${f1(f.h / 2)})">` +
    `<path d="${piece}" fill="${INK}" opacity=".24" transform="translate(${f1(-f.side * 4)} 12)" filter="url(#soft)"/>` +
    `<path d="${piece}" fill="${INK}" opacity=".18" transform="translate(0 2)" filter="url(#soft-near)"/>` +
    `<path d="${piece}" fill="${SHEET}"/>` +
    fibres(10, 10, f.w - 20, f.h - 20, Math.round((f.w * f.h) / 9000), r) +
    tape(f.w / 2, 4, Math.min(190, f.w * 0.7), 48, f.side * (5 + r() * 4)) +
    `</g>`
  );
}

// A small rubber stamp with one word, pressed over a free corner of the sheet.
function drawStamp(s: Stamp, r: () => number): string {
  const size = STAMP_SIZE;
  let specks = "";
  for (let i = 0; i < 36; i++) specks += `<circle cx="${f1((r() - 0.5) * s.bw)}" cy="${f1((r() - 0.5) * s.bh)}" r="${f1(0.8 + r() * 2.2)}"/>`;
  return (
    `<g transform="translate(${f1(s.x)} ${f1(s.y)}) rotate(${f1(s.rot)})" opacity=".92">` +
    `<rect x="${f1(-s.bw / 2)}" y="${f1(-s.bh / 2)}" width="${f1(s.bw)}" height="${f1(s.bh)}" rx="10" fill="${SHEET}" fill-opacity=".92" stroke="${RED}" stroke-width="5"/>` +
    `<rect x="${f1(-s.bw / 2 + 8)}" y="${f1(-s.bh / 2 + 8)}" width="${f1(s.bw - 16)}" height="${f1(s.bh - 16)}" rx="6" fill="none" stroke="${RED}" stroke-width="2.5"/>` +
    `<text x="0" y="${f1(size * 0.35)}" text-anchor="middle" font-size="${size}" font-weight="700" letter-spacing=".04em" fill="${RED}">${esc(s.word)}</text>` +
    `<g fill="${SHEET}" opacity=".75">${specks}</g></g>`
  );
}

// The alien sticker, the brand mark: on the paper left of the sheet, clear of the crop zone.
export const STICKER: Box = { x0: 40, y0: 736, x1: 106, y1: 802 };

export function renderArt(spec: ArtSpec): string {
  const { seed, composition } = spec, { cuts, target, note, stamp, flap } = plan(spec), r = rng(seed * 977 + 29);

  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" font-family="Outfit, 'Helvetica Neue', Arial, sans-serif">`,
    `<defs><style>${font()}</style><filter id="soft" x="-10%" y="-10%" width="120%" height="125%"><feGaussianBlur stdDeviation="9"/></filter><filter id="soft-near" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.5"/></filter></defs>`,
    `<rect width="1600" height="900" fill="${PAPER}"/>`,
    fibres(0, 0, 1600, 900, 160, r),
  ];

  // The torn sheet with a soft lift off the paper, like eco.css drop-shadow(0 14px 18px) plus (0 2px 3px).
  const sheet = cut(SW, SH, seed, { torn: { b: true, r: true }, j: 2, step: 60, tj: 5, ts: 7 });
  out.push(
    `<g transform="translate(${SX} ${SY}) rotate(${f1(-(0.4 + r() * 0.7))} ${SW / 2} ${SH / 2})">`,
    `<path d="${sheet}" fill="${INK}" opacity=".22" transform="translate(0 14)" filter="url(#soft)"/>`,
    `<path d="${sheet}" fill="${INK}" opacity=".16" transform="translate(0 2)" filter="url(#soft-near)"/>`,
    `<path d="${sheet}" fill="${SHEET}"/>`,
    fibres(14, 14, SW - 60, SH - 60, 110, r),
    tape(40, 16, 190, 50, -34 + (r() - 0.5) * 8),
    tape(SW - 34, 20, 190, 50, 34 + (r() - 0.5) * 8),
    `</g>`,
  );

  const c = cuts[0]!, ib = inkBox(c), mx = (ib.x0 + ib.x1) / 2, my = (ib.y0 + ib.y1) / 2;
  if (composition === "twist" && spec.twist === "crack") {
    // The object split down a jagged line, the halves pulled apart so the sheet shows between.
    const w = bw(ib), h = bh(ib) / 2 + 40, pts: Pt[] = [];
    for (let i = 0; i <= 7; i++) pts.push([mx + (i % 2 ? 1 : -1) * w * 0.04 + (r() - 0.5) * w * 0.07, my - h + (2 * h * i) / 7]);
    const half = (sx: number) => poly([[mx + sx * (w + 200), my - h], ...pts, [mx + sx * (w + 200), my + h]]);
    out.push(
      `<clipPath id="crack-l"><path d="${half(-1)}"/></clipPath><clipPath id="crack-r"><path d="${half(1)}"/></clipPath>`,
      `<g transform="translate(-18 -5) rotate(-2.5 ${f1(mx)} ${f1(my)})"><g clip-path="url(#crack-l)">${cutout(c, "ht-l")}</g></g>`,
      `<g transform="translate(18 6) rotate(2.5 ${f1(mx)} ${f1(my)})"><g clip-path="url(#crack-r)">${cutout(c, "ht-r")}</g></g>`,
    );
  } else {
    cuts.forEach((c, i) => out.push(cutout(c, `ht-${i}`)));
  }
  if (composition === "twist" && (spec.twist ?? "cross") === "cross") {
    const kx = bw(ib) * 0.5, ky = bh(ib) * 0.5;
    out.push(pencil(line(mx - kx, my - ky, mx + kx, my + ky * 0.9, seed, 3) + line(mx + kx * 0.95, my - ky, mx - kx * 0.9, my + ky, seed + 1, 3), 18));
  }
  if (flap) out.push(drawFlap(flap, seed, r));

  if (note) {
    const t = cuts[target]!;
    out.push(flap ? drawNote(note, flapRim(flap), 16, seed) : drawNote(note, rim(t), 10 + edgeOf(t.size) / 2 + offOf(t.size) / 2, seed));
  }
  if (stamp) out.push(drawStamp(stamp, r));

  const m = STICKER.x1 - STICKER.x0;
  out.push(
    `<g transform="translate(${STICKER.x0} ${STICKER.y0}) rotate(-10 ${m / 2} ${m / 2})">`,
    `<path d="${alien(m, m)}" fill="${WHITE}" stroke="${WHITE}" stroke-width="10" stroke-linejoin="round"/>`,
    `<path d="${alien(m, m)}" fill="${RED}"/>`,
    `</g>`,
    `</svg>`,
  );
  return out.join("\n");
}

// ---- files ----

const run = promisify(execFile);

// SVG to a 1600x900 PNG with headless Chrome, checked with sips.
export async function rasterize(svgPath: string, pngPath: string): Promise<void> {
  const png = path.resolve(pngPath);
  await fs.promises.rm(png, { force: true }); // a stale PNG must not pass the size check
  const profile = await fs.promises.mkdtemp(path.join(os.tmpdir(), "alienx-chrome-"));
  try {
    await run(
      process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      [
        "--headless",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--screen-info={1600x900}",
        "--window-size=1600,900",
        "--virtual-time-budget=3000",
        "--use-mock-keychain",
        `--user-data-dir=${profile}`,
        `--screenshot=${png}`,
        pathToFileURL(path.resolve(svgPath)).href,
      ],
      { timeout: 60_000 },
    );
  } finally {
    await fs.promises.rm(profile, { recursive: true, force: true });
  }
  let size = "";
  try {
    size = (await run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", png])).stdout;
  } catch (e) {
    throw new Error(`Chrome left no readable PNG at ${png}: ${(e as Error).message}`);
  }
  const w = /pixelWidth: (\d+)/.exec(size)?.[1], h = /pixelHeight: (\d+)/.exec(size)?.[1];
  if (w !== "1600" || h !== "900") throw new Error(`${png} is ${w ?? "?"}x${h ?? "?"}, expected 1600x900. Check CHROME_BIN and the Chrome flags.`);
}

export function artPath(id: number | string, ext: "svg" | "png"): string {
  return path.join(process.cwd(), "data", "art", `${id}.${ext}`);
}
