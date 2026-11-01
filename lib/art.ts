import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { z } from "zod";

import { ICON_NAMES, ICONS, type Icon } from "./icons.ts";
import { chromePath, pngSize } from "./platform.ts";

// The visual hook for an X post: one 1600x900 SVG, a full-bleed analogue collage in the One
// Flow mixed-media style. A coloured ground, torn paper blocks, a big halftone cut-out that runs
// off the edge, and the post's tension as a huge Outfit headline on a taped scrap with one word
// marked in red (circled, struck, highlighted or cut out as ransom letters). The generators are
// ports of paper-parts.js, rewritten from canvas Path2D to SVG path strings.

export const W = 1600, H = 900;
export const PAPER = "#F4F2F1";
export const SHEET = "#FBFAF8";
export const INK = "#16130F";
export const RED = "#D92819";
export const PENCIL = "#5E5852";
export const TAPE = "rgba(206,197,184,.72)";
export const WHITE = "#FFFFFF"; // sticker edge only
export const GROUND = "#0C0C0D"; // the dark ground
export const KRAFT = "#C9A57B"; // brown paper
export const NEWSPRINT = "#E5E0D3"; // grey-warm newsprint
export const BLUE = "#3F5D78"; // the muted second accent, a riso slate blue
export const PALETTE = [PAPER, SHEET, INK, RED, PENCIL, WHITE, GROUND, KRAFT, NEWSPRINT, BLUE] as const;

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
export const MARKS = ["circle", "strike", "highlight", "ransom"] as const;
export const LINKS = ["vs", "then", "not"] as const;
export type Mark = (typeof MARKS)[number];
export type Link = (typeof LINKS)[number];
export const words = (s: string | undefined) => (s ?? "").split(/\s+/).filter(Boolean).length;
const PAIRED = new Set(["versus", "scale"]);
// Printable ASCII plus curly quotes, dashes and the ellipsis: what Outfit draws and the width tables measure.
const HEADLINE = /^[\x20-\x7E\u2018\u2019\u201C\u201D\u2013\u2014\u2026]+$/;

// hero, twist, odd and peek draw objects[0]; versus and scale draw both. The headline is the
// hook, two to six words; mark names the one word that gets the red mark.
export const ArtSpec = z
  .object({
    headline: z.string().trim().min(2).max(40).regex(HEADLINE, "plain letters and punctuation"),
    mark: z.string().trim().min(1).max(24),
    markStyle: z.enum(MARKS),
    composition: z.enum(COMPOSITIONS),
    objects: z.array(z.enum(OBJECTS)).min(1).max(2),
    twist: z.enum(TWISTS).optional(),
    link: z.enum(LINKS).optional(),
    stamp: z.string().trim().min(1).max(10).regex(/^\S+$/, "one word").optional(),
    seed: z.number().int().min(1).max(99999),
  })
  .refine((s) => words(s.headline) <= 6, { message: "the headline is at most six words", path: ["headline"] })
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

// One object placed on the canvas: x y is the centre of its frame, not of its ink.
export type Cut = { name: ArtObject; x: number; y: number; size: number; rot: number; seed: number; red?: boolean; offset?: boolean; flip?: boolean; mirror?: boolean; grow?: number };
export type Box = { x0: number; y0: number; x1: number; y1: number };
export const hit = (a: Box, b: Box, pad = 0) => a.x0 - pad < b.x1 && b.x0 - pad < a.x1 && a.y0 - pad < b.y1 && b.y0 - pad < a.y1;
export const union = (bs: Box[]): Box => ({ x0: Math.min(...bs.map((b) => b.x0)), y0: Math.min(...bs.map((b) => b.y0)), x1: Math.max(...bs.map((b) => b.x1)), y1: Math.max(...bs.map((b) => b.y1)) });
const boxOf = (p: Pt[]): Box => union(p.map(([x, y]) => ({ x0: x, y0: y, x1: x, y1: y })));
const bw = (b: Box) => b.x1 - b.x0, bh = (b: Box) => b.y1 - b.y0;
const grow = (b: Box, m: number): Box => ({ x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m });
const centre = (b: Box): Pt => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
const turn = (p: Pt, c: Pt, deg: number): Pt => {
  const a = (deg * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a), dx = p[0] - c[0], dy = p[1] - c[1];
  return [c[0] + dx * co - dy * si, c[1] + dx * si + dy * co];
};
// The canvas box of b once turned deg about c.
const turnBox = (b: Box, c: Pt, deg: number): Box => boxOf(([[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]] as Pt[]).map((p) => turn(p, c, deg)));
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
export const cutBox = (c: Cut): Box => grow(inkBox(c), edgeOf(c.size) / 2 + offOf(c.size) + (c.grow ?? 0));

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
// Solid red paper reads heavier than the same area of halftone (the dots cover about half the
// shape), so in versus the red side is weighed up by this factor.
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

// ---- the poster ----

// A full-bleed collage: a coloured ground, a torn paper block under the art, a big halftone
// cut-out that runs off the edge, and the headline set huge on its own taped scrap. Four
// scenes ring the changes on the palette; the headline's scrap is always the sheet, so the
// red mark on it always reads.
type Scene = { ground: string; block: string; under: string; disc: string; alt: string; ink: string };
export const SCENES: Scene[] = [
  { ground: GROUND, block: KRAFT, under: RED, disc: RED, alt: SHEET, ink: SHEET },
  { ground: RED, block: NEWSPRINT, under: GROUND, disc: RED, alt: INK, ink: INK },
  { ground: KRAFT, block: GROUND, under: NEWSPRINT, disc: RED, alt: SHEET, ink: INK },
  { ground: NEWSPRINT, block: BLUE, under: KRAFT, disc: RED, alt: SHEET, ink: INK },
];

// X crops a 16:9 image to about its middle 84% in some views: words and the stamp stay inside.
export const SAFE: Box = { x0: 40, y0: 72, x1: W - 40, y1: H - 72 };
const PAD = 56; // the headline scrap's margin round the words; holds a circle mark at the largest size
const GAP = 70; // from the words to the art
const SIDE_W = 680, SIDE_H = H - 2 * 150 - 2 * PAD, SIDE_MAX = 200, SIDE_MIN = 96; // the headline beside the art
const TOP_W = W - 2 * (72 + PAD) - 60, TOP_H = 214, TOP_MAX = 170; // the headline above the art (versus)
export const STAMP_SIZE = 88;
export const STICKER_SIZE = 104;

type Word = { text: string; marked: boolean };
// A headline word set on the canvas: x is the left of its advance, the glyphs start lead in,
// y is the baseline.
export type Placed = Word & { x: number; y: number; w: number; lead: number };
export type Headline = { words: Placed[]; size: number; lines: number; box: Box; mark: Mark };

const SP = W800[0]! / 1000; // a space, per unit of size
const ASC = 0.8, DESC = 0.24; // the line box above and below the baseline, per unit of size
const RANSOM = 0.2, RING = 0.12, SWIPE = 0.07, STRIKE = 0.04; // room a mark takes beside its word
// Ransom chips and the circle ring stand taller than the letters, so their lines sit further
// apart: the ring (0.84 above the baseline to 0.24 below) clears the descenders above it.
const leading = (m: Mark) => (m === "ransom" ? 1.04 : m === "circle" ? 1.08 : 0.96);

// A word's advance at size 1, and how far in its glyphs start: a marked word takes extra room
// for its mark, so the mark never runs into the next word.
function advance(w: Word, m: Mark): { w: number; lead: number } {
  const g = width(w.text, 1, W800);
  if (!w.marked) return { w: g, lead: 0 };
  if (m === "ransom") return { w: g + [...w.text].length * RANSOM, lead: 0 };
  const p = m === "circle" ? RING : m === "highlight" ? SWIPE : STRIKE;
  return { w: g + 2 * p, lead: p };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
// The headline's words with one marked: the word that matches mark, else the one containing
// it, else the longest. A mismatch never costs the picture.
function markWords(headline: string, mark: string): Word[] {
  const ws = headline.split(/\s+/).filter(Boolean), m = norm(mark);
  let i = ws.findIndex((w) => norm(w) === m);
  if (i < 0 && m) i = ws.findIndex((w) => norm(w).includes(m));
  if (i < 0) i = ws.reduce((b, w, j) => (norm(w).length > norm(ws[b]!).length ? j : b), 0);
  return ws.map((text, j) => ({ text, marked: j === i }));
}

// The biggest setting of the words in maxW x maxH: every way of breaking them into one to four
// lines is tried (six words make 32), each at the size its widest line and its height allow.
// Fewer lines win a close call, then evener lines. Widths are exact advances, so nothing can overflow.
function setHeadline(words: Word[], m: Mark, maxW: number, maxH: number, maxSize: number) {
  const n = words.length, adv = words.map((w) => advance(w, m));
  let best = { rows: [words], size: 0, score: -1 };
  for (let bits = 0; bits < 1 << (n - 1); bits++) {
    const rows: number[][] = [[0]];
    for (let i = 1; i < n; i++) bits & (1 << (i - 1)) ? rows.push([i]) : rows.at(-1)!.push(i);
    if (rows.length > 4) continue;
    const ws = rows.map((r) => r.reduce((t, i) => t + adv[i]!.w, 0) + (r.length - 1) * SP), w1 = Math.max(...ws);
    const h1 = ASC + (rows.length - 1) * leading(m) + DESC;
    const size = Math.floor(Math.min(maxSize, maxW / w1, maxH / h1)), score = size * (1 - 0.07 * (rows.length - 1) - (0.06 * (w1 - Math.min(...ws))) / w1);
    if (score > best.score) best = { rows: rows.map((r) => r.map((i) => words[i]!)), size, score };
  }
  return best;
}

// The setting placed with its top left at x0 y0, every line flush left.
function placeHeadline(rows: Word[][], size: number, m: Mark, x0: number, y0: number): Headline {
  const words: Placed[] = [];
  let y = y0 + ASC * size, x1 = x0;
  for (const row of rows) {
    let x = x0;
    for (const w of row) {
      const a = advance(w, m);
      words.push({ ...w, x, y, w: a.w * size, lead: a.lead * size });
      x += (a.w + SP) * size;
    }
    x1 = Math.max(x1, x - SP * size);
    y += leading(m) * size;
  }
  const h = (ASC + (rows.length - 1) * leading(m) + DESC) * size;
  return { words, size, lines: rows.length, box: { x0, y0, x1, y1: y0 + h }, mark: m };
}

// peek: a torn flap of paper taped over one half of the object. x y is its centre.
export type Flap = { x: number; y: number; w: number; h: number; rot: number; side: 1 | -1 }; // side: the canvas edge it runs off
export const flapBox = (f: Flap) => turnBox({ x0: f.x - f.w / 2, y0: f.y - f.h / 2, x1: f.x + f.w / 2, y1: f.y + f.h / 2 }, [f.x, f.y], f.rot);

export type Stamp = { word: string; size: number; x: number; y: number; rot: number; bw: number; bh: number; box: Box };
export type Plan = {
  scene: Scene;
  layout: "side" | "top";
  right: boolean; // side layout with the words on the right and the art running off the left edge
  seam: number; // the art block's tilt
  head: Headline;
  scrap: { box: Box; rot: number }; // the headline's paper, turned rot about its centre with the words on it
  text: Box; // the canvas box the words and their mark cover, turned
  zone: Box; // where the art goes; it may run off the canvas
  cuts: Cut[];
  target: number; // the cut that is singled out
  flap?: Flap;
  link?: { x: number; y: number; kind: Link };
  stamp?: Stamp;
  sticker: Pt; // the alien sticker's centre, just off the scrap's top left corner
};

const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0)!, 16777619); return h >>> 0; };

// Where everything goes. Exported so the tests can check boxes without parsing the SVG.
export function plan(spec: ArtSpec): Plan {
  const { seed, composition } = spec, r = rng((seed * 131 + 17) ^ hash(spec.headline));
  const scene = SCENES[Math.floor(r() * SCENES.length)]!, rot = (r() - 0.5) * 3.2, dy = (r() - 0.5) * 40;
  const tilt = Array.from({ length: 6 }, () => (r() - 0.5) * 7), pick = r(), spin = (r() < 0.5 ? -1 : 1) * (14 + r() * 6), stampRot = -(6 + r() * 6);
  const m = spec.markStyle, words = markWords(spec.headline, spec.mark), sideSet = setHeadline(words, m, SIDE_W, SIDE_H, SIDE_MAX);
  // Versus needs the width for its two sides; a headline that only fits the side column small
  // (one very long word) goes across the top instead.
  const layout = composition === "versus" || sideSet.size < SIDE_MIN ? "top" : "side", right = layout === "side" && r() < 0.5, seam = (r() < 0.5 ? -1 : 1) * (2 + r() * 2);
  const set = layout === "side" ? sideSet : setHeadline(words, m, TOP_W, TOP_H, TOP_MAX);
  const hh = (ASC + (set.rows.length - 1) * leading(m) + DESC) * set.size;
  const hw = Math.max(...set.rows.map((row) => row.reduce((t, w) => t + advance(w, m).w, 0) + (row.length - 1) * SP)) * set.size;
  const head = placeHeadline(set.rows, set.size, m, right ? W - 72 - PAD - hw : 72 + PAD, layout === "side" ? H / 2 + dy - hh / 2 : 96 + PAD);
  const scrap = { box: grow(head.box, PAD), rot }, c = centre(scrap.box);
  const text = turnBox(grow(head.box, 0.14 * head.size), c, rot);
  const zone: Box = layout === "top" ? { x0: 0, y0: text.y1 + GAP * 0.6, x1: W, y1: H } : right ? { x0: 0, y0: 0, x1: text.x0 - GAP, y1: H } : { x0: text.x1 + GAP, y0: 0, x1: W, y1: H };
  const zw = bw(zone), zh = bh(zone), dir = right ? -1 : 1; // dir points from the words to the far edge
  const inner = right ? zone.x1 : zone.x0, outer = right ? zone.x0 : zone.x1; // the zone's edge by the words, and the canvas edge
  const [a, b = a] = spec.objects as [ArtObject, ArtObject?];
  const cuts: Cut[] = [];
  let target = 0, flap: Flap | undefined, link: Plan["link"];

  if (composition === "hero" || composition === "twist" || composition === "peek") {
    // Big enough to run off the right edge when it is wide; a tall one fills the height.
    const twist = composition === "twist" ? (spec.twist ?? "cross") : undefined;
    const o = fit({ name: a, x: 0, y: 0, size: 600, rot: tilt[0]!, seed, flip: twist === "flip", grow: twist === "crack" ? 30 : 0 }, zw * 1.02, Math.min(H * 0.84, zh * 0.9));
    cuts.push(pin(o, inner + dir * zw * 0.53, zone.y0 + zh / 2 + 10));
    if (composition === "peek") {
      // The flap covers the half towards the canvas edge and runs off it.
      const ib = inkBox(o), a0 = right ? Math.min(ib.x0 - 70, -40) : ib.x0 + bw(ib) * 0.48, a1 = right ? ib.x1 - bw(ib) * 0.48 : Math.max(ib.x1 + 70, W + 40);
      const b0 = Math.max(ib.y0 - 60, zone.y0 + 20), b1 = ib.y1 + 60;
      flap = { x: (a0 + a1) / 2, y: (b0 + b1) / 2, w: a1 - a0, h: b1 - b0, rot: dir * (2 + r() * 2), side: dir };
    }
  } else if (composition === "scale") {
    // A huge object and, standing at its foot in front of it, a tiny red one.
    // The huge one runs off the canvas edge; the tiny one stands by the words.
    const floor = layout === "top" ? H - 30 : H * 0.9;
    const Hg = fit({ name: b, x: 0, y: 0, size: 600, rot: tilt[1]! * 0.6, seed: seed + 1 }, zw * 0.7, Math.min(H * 0.8, floor - zone.y0 - 30)), hb = inkBox(Hg);
    const T = fit({ name: a, x: 0, y: 0, size: 140, rot: tilt[0]! * 2, seed, red: true, offset: false }, 260, Math.min(210, bh(hb) * 0.38));
    cuts.push(pin(Hg, outer + dir * bw(hb) * 0.08, floor, right ? 0 : 1, 1), pin(T, inner + dir * 24, floor, right ? 1 : 0, 1));
    target = 1;
  } else if (composition === "versus") {
    // Close to equal visual weight on one floor, facing each other across a gap that holds the
    // link. The heavier side gives up half the difference (in log terms) rather than all of it,
    // so a dense shape against a thin one never shrinks to a dot.
    const floor = H + 16, fw = W * 0.37, fh = floor - zone.y0 - 24; // a little off the bottom edge
    const A = fit({ name: a, x: 0, y: 0, size: 400, rot: tilt[0]!, seed, mirror: FACES_LEFT.has(a) }, fw, fh);
    const B = fit({ name: b, x: 0, y: 0, size: 400, rot: tilt[1]!, seed: seed + 1, red: true, offset: false, mirror: !FACES_LEFT.has(b) }, fw, fh);
    for (let i = 0; i < 2; i++) { const w0 = Math.min(weight(A), weight(B)); for (const k of [A, B]) k.size *= (w0 / weight(k)) ** (i ? 0.125 : 0.25); }
    const gap = 260;
    cuts.push(pin(A, W / 2 - gap / 2, floor, 1, 1), pin(B, W / 2 + gap / 2, floor, 0, 1));
    const top = Math.max(inkBox(A).y0, inkBox(B).y0);
    link = { x: W / 2, y: (top + floor) / 2, kind: spec.link ?? "vs" };
    target = 1;
  } else {
    // odd: six copies, 3 x 2 beside the words or a row of six under them, exactly one solid red and turned.
    const cols = layout === "top" ? 6 : 3, rows = 6 / cols, cw = (zw - 60) / cols, ch = (zh * 0.8) / rows;
    const proto = fit({ name: a, x: 0, y: 0, size: 300, rot: 0, seed }, cw * 0.84, ch * 0.84);
    target = Math.floor(pick * 6);
    for (let i = 0; i < 6; i++) {
      const odd = i === target;
      cuts.push(pin({ name: a, x: 0, y: 0, size: proto.size, rot: odd ? spin : tilt[i]!, seed: seed + i, red: odd }, zone.x0 + 30 + cw * ((i % cols) + 0.5), zone.y0 + zh / 2 + (rows === 1 ? 0 : i < 3 ? -0.5 : 0.5) * ch));
    }
  }

  const p: Plan = { scene, layout, right, seam, head, scrap, text, zone, cuts, target, flap, link, sticker: turn([scrap.box.x0 - 20, scrap.box.y0 - 20], c, rot) };
  if (spec.stamp) p.stamp = stampFor(p, spec.stamp.toUpperCase(), stampRot);
  return p;
}

// A rubber stamp pressed over the main object's lower corner, where a stamp on a thing reads
// as a verdict on it. It stays inside SAFE and off the words; in odd it goes on the copy
// farthest from the red one and never covers the red one.
function stampFor(p: Plan, word: string, rot: number): Stamp {
  // A long word sets smaller, so the stamp never outgrows the object it sits on.
  const size = Math.min(STAMP_SIZE, 380 / (width(word, 1, W800) + word.length * 0.05)), w = width(word, size, W800) + word.length * 0.05 * size + 60, h = size + 44;
  const at = (x: number, y: number): Stamp => {
    const b = turnBox({ x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 }, [x, y], rot);
    const dx = Math.max(0, SAFE.x0 - b.x0) - Math.max(0, b.x1 - SAFE.x1), dy = Math.max(0, SAFE.y0 - b.y0) - Math.max(0, b.y1 - SAFE.y1);
    return { word, size, x: x + dx, y: y + dy, rot, bw: w, bh: h, box: { x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 + dx, y1: b.y1 + dy } };
  };
  const odd = p.cuts.length > 2, t = centre(inkBox(p.cuts[p.target]!)), far = (c: Cut) => { const q = centre(inkBox(c)); return Math.hypot(q[0] - t[0], q[1] - t[1]); };
  const mains = odd ? p.cuts.filter((_, i) => i !== p.target).sort((u, v) => far(v) - far(u)) : [p.cuts[p.link ? 1 : 0]!];
  const tries = [
    ...mains.flatMap((c) => { const ib = inkBox(c); return [at(ib.x0 + bw(ib) * 0.3, ib.y1 - bh(ib) * 0.16), at(ib.x1 - bw(ib) * 0.3, ib.y1 - bh(ib) * 0.16), at(ib.x1 - bw(ib) * 0.3, ib.y0 + bh(ib) * 0.2), at(ib.x0 + bw(ib) * 0.3, ib.y0 + bh(ib) * 0.2)]; }),
    at(SAFE.x1, SAFE.y1), at(SAFE.x0, SAFE.y1),
  ];
  return tries.find((s) => !hit(s.box, p.text, 24) && (!odd || !hit(s.box, cutBox(p.cuts[p.target]!), 8))) ?? tries.at(-1)!;
}

// ---- collage parts ----

const pencil = (d: string, sw: number, color = RED) =>
  `<g transform="translate(1.5 -1)" fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="${d}" stroke-width="${f1(sw)}" opacity=".94"/><path d="${d}" stroke-width="${f1(sw * 0.7)}" opacity=".45" transform="translate(${f1(sw * 0.22)} ${f1(sw * 0.19)})"/></g>`;

// The torn-edge tape strip of paper-parts.js Tape, centred on cx cy.
const TAPE_EDGE = [[0, 12], [5, 0], [11, 9], [89, 4], [95, 0], [100, 14], [97, 52], [100, 90], [93, 100], [86, 92], [9, 98], [3, 100], [0, 86], [3, 48]];
const tape = (cx: number, cy: number, w: number, h: number, rot: number) =>
  `<path d="${poly(TAPE_EDGE.map(([u, v]) => [cx - w / 2 + (u! / 100) * w, cy - h / 2 + (v! / 100) * h]))}" fill="${TAPE}" transform="rotate(${f1(rot)} ${f1(cx)} ${f1(cy)})"/>`;

// Paper fibres: short faint strokes scattered over a box.
function fibres(x: number, y: number, w: number, h: number, n: number, r: () => number, color = PENCIL, op = 0.14): string {
  let d = "";
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + r() * h, L = 8 + r() * 22, a = r() * Math.PI, c = Math.cos(a), s = Math.sin(a);
    d += `M${xy([px, py])}Q${xy([px + (c * L) / 2 + (r() - 0.5) * 8, py + (s * L) / 2 + (r() - 0.5) * 8])} ${xy([px + c * L, py + s * L])}`;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width=".9" stroke-opacity="${op}" stroke-linecap="round"/>`;
}

// A printed dot screen fading out from a corner, the texture of cheap newsprint.
function dots(x0: number, y0: number, w: number, h: number, corner: Pt, color: string, op: number): string {
  const sp = 24, R = Math.hypot(w, h) * 0.8;
  let s = "";
  for (let y = y0 + sp / 2; y < y0 + h; y += sp) {
    for (let x = x0 + sp / 2 + ((Math.round((y - y0) / sp) % 2) * sp) / 2; x < x0 + w; x += sp) {
      const t = 1 - Math.hypot(x - corner[0], y - corner[1]) / R;
      if (t > 0.08) s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(sp * 0.46 * t ** 1.3)}"/>`;
    }
  }
  return `<g fill="${color}" opacity="${op}">${s}</g>`;
}

// A torn sheet of paper w x h at x y, turned rot about its centre, with a soft fall shadow.
function sheet(x: number, y: number, w: number, h: number, rot: number, fill: string, seed: number, torn: Torn, r: () => number, extra = "", screen?: Pt): string {
  const d = cut(w, h, seed, { torn, j: 2, step: 60, tj: 5, ts: 7 });
  const light = fill !== GROUND && fill !== BLUE && fill !== RED;
  return (
    `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)} ${f1(w / 2)} ${f1(h / 2)})">` +
    `<path d="${d}" fill="${INK}" opacity=".3" transform="translate(0 14)" filter="url(#soft)"/>` +
    `<path d="${d}" fill="${INK}" opacity=".2" transform="translate(0 2)" filter="url(#soft-near)"/>` +
    `<path d="${d}" fill="${fill}"/>` +
    (screen ? dots(0, 0, w, h, screen, light ? INK : SHEET, light ? 0.07 : 0.06) : "") +
    fibres(10, 10, w - 20, h - 20, Math.round((w * h) / 7000), r, light ? PENCIL : SHEET, light ? 0.16 : 0.1) +
    extra +
    `</g>`
  );
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
  const solid = (fill: string, w: number) =>
    `<g${s.k === 1 ? "" : ` transform="scale(${+s.k.toFixed(4)})"`} fill="${fill}" stroke="${fill}" stroke-width="${f1(w / s.k)}" stroke-linejoin="round">${subpaths(s.d).map((p) => `<path d="${p}"/>`).join("")}</g>`;
  let t = `translate(${f1(c.x - s.w / 2)} ${f1(c.y - s.h / 2)}) rotate(${f1(c.rot)} ${f1(s.w / 2)} ${f1(s.h / 2)})`;
  if (c.flip) t += ` rotate(180 ${f1(s.w / 2)} ${f1(s.h / 2)})`;
  if (c.mirror) t += ` translate(${f1(s.w)} 0) scale(-1 1)`;
  return (
    `<g transform="${t}">` +
    `<g transform="translate(${f1(ox * 1.6)} ${f1(oy * 2.2)})" opacity=".35" filter="url(#soft)">${solid(INK, edge)}</g>` +
    (c.offset === false ? "" : `<g transform="translate(${f1(ox)} ${f1(oy)})">${solid(RED, Math.max(0, edge - 6))}</g>`) +
    solid(WHITE, edge) +
    (c.red ? draw(s, `fill="${RED}"`) : halftone(s, c.seed, id, isMotif(c.name) ? 0.1 : 0.3)) +
    `</g>`
  );
}

// The headline on its scrap: Outfit black, one word marked in red.
function drawHeadline(p: Plan, seed: number, r: () => number): string {
  const { head, scrap } = p, s = head.size, sb = scrap.box, [cx, cy] = centre(sb);
  const out: string[] = [];
  for (const w of head.words) {
    const gx = w.x + w.lead, y = w.y, txt = (x: number, fill: string) => `<text x="${f1(x)}" y="${f1(y)}" font-size="${s}" font-weight="800" fill="${fill}">${esc(w.text)}</text>`;
    if (!w.marked) { out.push(txt(gx, INK)); continue; }
    const g = width(w.text, s, W800);
    if (head.mark === "circle") {
      out.push(txt(gx, INK), pencil(loop(w.x + w.w / 2, y - 0.31 * s, w.w / 2, 0.51 * s, seed), Math.max(7, 0.05 * s)));
    } else if (head.mark === "strike") {
      out.push(txt(gx, INK), pencil(line(gx - 0.03 * s, y - 0.26 * s, gx + g + 0.03 * s, y - 0.36 * s, seed, 2) + line(gx, y - 0.36 * s, gx + g, y - 0.3 * s, seed + 1, 2), Math.max(8, 0.075 * s)));
    } else if (head.mark === "highlight") {
      // A torn red swipe of paper behind the word, the word knocked out of it in sheet white.
      const x0 = w.x, x1 = w.x + w.w, t = y - 0.78 * s, b = y + 0.2 * s, k = 0.03 * s;
      out.push(`<path d="${poly([[x0 + k, t + k], [x1, t - k * 0.4], [x1 - k * 0.6, b - k], [x0, b + k * 0.3]])}" fill="${RED}"/>`, txt(gx, SHEET));
    } else {
      // Ransom letters: each one cut from a different scrap and stuck on at its own angle.
      const chips = [[INK, SHEET], [RED, SHEET], [KRAFT, INK], [NEWSPRINT, INK], [BLUE, SHEET]];
      let x = w.x;
      [...w.text].forEach((ch, i) => {
        const gw = width(ch, s, W800), aw = gw + RANSOM * s, [bg, fg] = chips[(i + seed) % chips.length]!, a = (r() - 0.5) * 12, mx = x + aw / 2, my = y - 0.3 * s;
        out.push(
          `<g transform="rotate(${f1(a)} ${f1(mx)} ${f1(my)})"><path d="${cut(aw - 0.05 * s, 1.06 * s, seed + i, { j: 0.012 * s, step: 0.3 * s })}" transform="translate(${f1(x + 0.025 * s)} ${f1(y - 0.84 * s)})" fill="${bg}"/>` +
          `<text x="${f1(mx)}" y="${f1(y)}" text-anchor="middle" font-size="${s}" font-weight="800" fill="${fg}">${esc(ch)}</text></g>`,
        );
        x += aw;
      });
    }
  }
  // A ruled scrap of another paper peeks out behind, turned the other way.
  const rules = Array.from({ length: Math.floor((bh(sb) - 40) / 38) }, (_, i) => `M24 ${30 + i * 38}H${f1(bw(sb) - 24)}`).join("");
  const ruled = `<path d="${rules}" stroke="${p.scene.under === GROUND || p.scene.under === RED ? SHEET : INK}" stroke-opacity=".14" stroke-width="2"/>`;
  return (
    sheet(p.right ? sb.x0 - 40 : sb.x0 + bw(sb) * 0.32 + 40, sb.y0 - 38, bw(sb) * 0.68, bh(sb) * 0.6, scrap.rot + (p.right ? -1 : 1) * (4 + r() * 3), p.scene.under, seed + 3, { t: true, r: true }, r, ruled) +
    `<g transform="rotate(${f1(scrap.rot)} ${f1(cx)} ${f1(cy)})">` +
    sheet(sb.x0, sb.y0, bw(sb), bh(sb), 0, SHEET, seed, { b: true, r: true }, r) +
    out.join("") +
    tape(sb.x1 - 20, sb.y0 + 8, 200, 52, 36 + (r() - 0.5) * 8) +
    tape(sb.x0 + bw(sb) * 0.42, sb.y1 - 4, 170, 48, -4 + (r() - 0.5) * 6) +
    `</g>`
  );
}

// A hand-drawn arrow from a to b: a gently bowed, slightly wobbly stroke and a head.
function arrow(a: Pt, b: Pt, seed: number, sw: number, color: string): string {
  const r = rng(seed * 19 + 4), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, bend = (seed % 2 ? 1 : -1) * L * 0.2;
  const m: Pt = [(a[0] + b[0]) / 2 - (dy / L) * bend, (a[1] + b[1]) / 2 + (dx / L) * bend];
  const pts: Pt[] = [];
  for (let i = 0, n = Math.max(4, Math.round(L / 24)); i <= n; i++) {
    const t = i / n, u = 1 - t, o = i && i < n ? (r() - 0.5) * 2.4 : 0;
    pts.push([u * u * a[0] + 2 * u * t * m[0] + t * t * b[0] - (dy / L) * o, u * u * a[1] + 2 * u * t * m[1] + t * t * b[1] + (dx / L) * o]);
  }
  const ang = Math.atan2(b[1] - m[1], b[0] - m[0]), head = sw * 5;
  const wing = (s: number) => line(b[0], b[1], b[0] - Math.cos(ang + s) * head, b[1] - Math.sin(ang + s) * head, seed + 3, 0.8);
  return pencil("M" + pts.map(xy).join("L") + wing(0.5) + wing(-0.5), sw, color);
}

// Three short strokes flicked out from a box's top corner on the words' side: look here.
function rays(b: Box, seed: number, color: string, right: boolean): string {
  const L = Math.max(44, Math.min(80, bw(b) * 0.3)), x = right ? b.x1 - bw(b) * 0.12 : b.x0 + bw(b) * 0.12, y = b.y0 + bh(b) * 0.12, R0 = Math.hypot(bw(b), bh(b)) * 0.12 + 40;
  return pencil([-0.5, 0, 0.5].map((a, i) => { const t = Math.PI * (right ? 1.75 : 1.25) + a; return line(x + Math.cos(t) * R0, y + Math.sin(t) * R0, x + Math.cos(t) * (R0 + L), y + Math.sin(t) * (R0 + L), seed + i, 1.5); }).join(""), 10, color);
}

// versus's link between the two sides: a VS sticker, a before-to-after arrow, or a not-equal sign.
function drawLink(l: NonNullable<Plan["link"]>, seed: number, color: string): string {
  const { x, y } = l;
  if (l.kind === "then") return arrow([x - 95, y + 10], [x + 95, y - 10], seed, 14, color);
  if (l.kind === "not") return pencil(line(x - 80, y - 26, x + 80, y - 30, seed, 2) + line(x - 80, y + 30, x + 80, y + 26, seed + 1, 2) + line(x + 34, y - 92, x - 34, y + 92, seed + 2, 2), 18, color);
  const R = 74;
  return (
    `<g transform="rotate(-8 ${x} ${y})"><path d="${disc(x, y, R + 9, seed, 1.5)}" fill="${WHITE}"/><path d="${disc(x, y, R, seed + 1, 1.5)}" fill="${INK}"/>` +
    `<text x="${x}" y="${f1(y + 27)}" text-anchor="middle" font-size="78" font-weight="800" fill="${SHEET}">VS</text></g>`
  );
}

// peek's flap: a torn scrap lifted by a soft shadow, taped at the top, with a big red question
// mark on it. Its torn edge faces the half of the object that still shows.
function drawFlap(f: Flap, seed: number, r: () => number): string {
  const x0 = f.x - f.w / 2, show = f.side > 0 ? Math.min(f.w, W - x0) : Math.min(f.w, x0 + f.w), mx = f.side > 0 ? show / 2 : f.w - show / 2;
  const q = Math.min(f.h * 0.5, (show - 60) * 1.5, 420);
  const mark = `<text x="${f1(mx)}" y="${f1(f.h / 2 + q * 0.36)}" text-anchor="middle" font-size="${f1(q)}" font-weight="800" fill="${RED}" transform="rotate(-6 ${f1(mx)} ${f1(f.h / 2)})">?</text>`;
  return sheet(x0, f.y - f.h / 2, f.w, f.h, f.rot, SHEET, seed + 5, f.side > 0 ? { l: true } : { r: true }, r, mark + tape(mx, 10, 190, 50, -8 + r() * 6));
}

// A rubber stamp with one word.
function drawStamp(s: Stamp, r: () => number): string {
  let specks = "";
  for (let i = 0; i < 46; i++) specks += `<circle cx="${f1((r() - 0.5) * s.bw)}" cy="${f1((r() - 0.5) * s.bh)}" r="${f1(0.8 + r() * 2.6)}"/>`;
  return (
    `<g transform="translate(${f1(s.x)} ${f1(s.y)}) rotate(${f1(s.rot)})" opacity=".95">` +
    `<rect x="${f1(-s.bw / 2)}" y="${f1(-s.bh / 2)}" width="${f1(s.bw)}" height="${f1(s.bh)}" rx="12" fill="${SHEET}" fill-opacity=".9" stroke="${RED}" stroke-width="7"/>` +
    `<rect x="${f1(-s.bw / 2 + 11)}" y="${f1(-s.bh / 2 + 11)}" width="${f1(s.bw - 22)}" height="${f1(s.bh - 22)}" rx="7" fill="none" stroke="${RED}" stroke-width="3"/>` +
    `<text x="0" y="${f1(s.size * 0.35)}" text-anchor="middle" font-size="${f1(s.size)}" font-weight="800" letter-spacing=".05em" fill="${RED}">${esc(s.word)}</text>` +
    `<g fill="${SHEET}" opacity=".8">${specks}</g></g>`
  );
}

export function renderArt(spec: ArtSpec): string {
  const { seed, composition } = spec, p = plan(spec), { scene, cuts, zone } = p, r = rng(seed * 977 + 29);
  const side = p.layout === "side";

  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Outfit, 'Helvetica Neue', Arial, sans-serif">`,
    `<defs><style>${font()}</style><filter id="soft" x="-10%" y="-10%" width="120%" height="125%"><feGaussianBlur stdDeviation="9"/></filter><filter id="soft-near" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.5"/></filter>` +
      `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${seed % 1000}" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.4 1"/></filter></defs>`,
    `<rect width="${W}" height="${H}" fill="${scene.ground}"/>`,
    dots(0, 0, W, H, !side ? [W, 0] : p.right ? [W, H] : [0, H], scene.ground === GROUND ? SHEET : INK, scene.ground === GROUND ? 0.09 : 0.1),
    fibres(0, 0, W, H, 140, r, scene.ground === GROUND || scene.ground === RED ? SHEET : PENCIL, 0.1),
  ];

  // The block of paper under the art, torn along the edge that faces the words.
  out.push(!side
    ? sheet(-60, zone.y0 - 30, W + 120, H - zone.y0 + 120, p.seam * 0.3, scene.block, seed + 7, { t: true }, r, "", [0, H])
    : p.right
      ? sheet(-80, -80, zone.x1 + 120, H + 160, p.seam, scene.block, seed + 7, { r: true }, r, "", [0, 0])
      : sheet(zone.x0 - 40, -80, W - zone.x0 + 120, H + 160, p.seam, scene.block, seed + 7, { l: true }, r, "", [W - zone.x0 + 120, 0]));

  const c = cuts[0]!, ib = inkBox(c), [mx, my] = centre(ib), single = !p.link && cuts.length === 1;
  const cross = composition === "twist" && (spec.twist ?? "cross") === "cross";
  // A cut paper sun behind a lone object.
  if (single) out.push(`<path d="${disc(mx - bw(ib) * 0.06, my - bh(ib) * 0.05, Math.min(Math.max(bw(ib), bh(ib)) * 0.5, 430), seed, 2.5)}" fill="${cross ? scene.alt : scene.disc}"/>`);

  out.push(drawHeadline(p, seed, r));

  if (composition === "twist" && spec.twist === "crack") {
    // The object split down a jagged line, the halves pulled apart.
    const w = bw(ib), h = bh(ib) / 2 + 60, pts: Pt[] = [];
    for (let i = 0; i <= 7; i++) pts.push([mx + (i % 2 ? 1 : -1) * w * 0.04 + (r() - 0.5) * w * 0.07, my - h + (2 * h * i) / 7]);
    const half = (sx: number) => poly([[mx + sx * (w + 300), my - h], ...pts, [mx + sx * (w + 300), my + h]]);
    out.push(
      `<clipPath id="crack-l"><path d="${half(-1)}"/></clipPath><clipPath id="crack-r"><path d="${half(1)}"/></clipPath>`,
      `<g transform="translate(-26 -6) rotate(-3 ${f1(mx)} ${f1(my)})"><g clip-path="url(#crack-l)">${cutout(c, "ht-l")}</g></g>`,
      `<g transform="translate(26 8) rotate(3 ${f1(mx)} ${f1(my)})"><g clip-path="url(#crack-r)">${cutout(c, "ht-r")}</g></g>`,
    );
  } else {
    // The singled-out cut goes last, so it sits on top.
    cuts.forEach((k, i) => i !== p.target && out.push(cutout(k, `ht-${i}`)));
    if (cuts[p.target]) out.push(cutout(cuts[p.target]!, `ht-${p.target}`));
  }
  if (cross) {
    const kx = bw(ib) * 0.46, ky = bh(ib) * 0.46;
    out.push(pencil(line(mx - kx, my - ky, mx + kx, my + ky * 0.9, seed, 4) + line(mx + kx * 0.95, my - ky, mx - kx * 0.9, my + ky, seed + 1, 4), 30));
  }
  if (p.flap) out.push(drawFlap(p.flap, seed, r));
  if (p.link) out.push(drawLink(p.link, seed, scene.block === GROUND || scene.block === BLUE ? SHEET : RED));
  if (composition === "scale" || composition === "odd") out.push(rays(inkBox(cuts[p.target]!), seed, scene.block === GROUND || scene.block === BLUE ? SHEET : RED, p.right));
  if (p.stamp) out.push(drawStamp(p.stamp, r));

  // Print grain over everything, so the flat colour reads as ink on paper.
  out.push(`<rect width="${W}" height="${H}" fill="${INK}" filter="url(#grain)" opacity=".16"/>`);
  // The alien sticker, the brand mark, stuck over the headline scrap's corner.
  const m = STICKER_SIZE, [sx, sy] = p.sticker;
  out.push(
    `<g transform="translate(${f1(sx - m / 2)} ${f1(sy - m / 2)}) rotate(-12 ${m / 2} ${m / 2})">`,
    `<path d="${alien(m, m)}" fill="${INK}" opacity=".3" transform="translate(3 6)" filter="url(#soft-near)"/>`,
    `<path d="${alien(m, m)}" fill="${WHITE}" stroke="${WHITE}" stroke-width="12" stroke-linejoin="round"/>`,
    `<path d="${alien(m, m)}" fill="${RED}"/>`,
    `</g>`,
    `</svg>`,
  );
  return out.join("\n");
}

// ---- files ----

const run = promisify(execFile);

// SVG to a 1600x900 PNG with headless Chrome (or Edge on Windows), size read from the PNG.
// Chrome writes a temporary PNG next to the target, which replaces the old picture only once
// it checks out, so a failed redraw keeps the picture there was.
export async function rasterize(svgPath: string, pngPath: string): Promise<void> {
  const chrome = chromePath();
  if (!chrome) throw new Error("Found no Chrome or Edge to draw the picture. Install Chrome, or set CHROME_BIN to its path.");
  const target = path.resolve(pngPath);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  // A fresh name, so a stale file cannot pass the size check. Chrome picks the format from
  // the extension, so it stays .png.
  const png = `${target.slice(0, -4)}.${process.pid}-${Date.now()}.tmp.png`;
  const profile = await fs.promises.mkdtemp(path.join(os.tmpdir(), "alienx-chrome-"));
  try {
    await run(
      chrome,
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
      { timeout: 60_000, windowsHide: true },
    );
    let size: ReturnType<typeof pngSize>;
    try {
      size = pngSize(await fs.promises.readFile(png));
    } catch (e) {
      throw new Error(`Chrome left no readable PNG at ${png}: ${(e as Error).message}`);
    }
    if (size?.width !== 1600 || size.height !== 900) throw new Error(`${png} is ${size ? `${size.width}x${size.height}` : "not a PNG"}, expected 1600x900. Check CHROME_BIN and the Chrome flags.`);
    await fs.promises.rename(png, target);
  } finally {
    await fs.promises.rm(profile, { recursive: true, force: true });
    await fs.promises.rm(png, { force: true });
  }
}

export function artPath(id: number | string, ext: "svg" | "png"): string {
  return path.join(process.cwd(), "data", "art", `${id}.${ext}`);
}
