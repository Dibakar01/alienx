import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { z } from "zod";
import { AREA, ArtSpec, COMPOSITIONS, CX, CY, OBJECTS, SHEET_BOX, STICKER, TWISTS, compositionBox, cutBox, flapBox, hit, inkArea, inkBox, plan, RED_WEIGHT, renderArt, silhouette, subpaths, textWidth, union, weight, type Box, type Plan } from "../lib/art.ts";

const spec: ArtSpec = { composition: "versus", objects: ["megaphone", "hand-palm"], label: "a pause", labelPoints: 1, stamp: "hot", seed: 4242 };

// The words a viewer can read: the content of every <text> element.
const textWords = (svg: string) =>
  [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].flatMap((m) => m[1]!.split(/\s+/).filter(Boolean));

test("the same spec renders the same SVG", () => {
  assert.equal(renderArt(spec), renderArt({ ...spec }));
  assert.ok(renderArt(spec).includes('viewBox="0 0 1600 900"'));
  assert.notEqual(renderArt(spec), renderArt({ ...spec, seed: 4243 }));
});

test("only palette colours appear", () => {
  const allowed = new Set(["#F4F2F1", "#FBFAF8", "#16130F", "#D92819", "#5E5852", "#FFFFFF"]);
  for (const composition of COMPOSITIONS) {
    const svg = renderArt({ ...spec, composition, twist: "crack" });
    for (const hex of svg.match(/#[0-9a-fA-F]{6}\b/g) ?? []) assert.ok(allowed.has(hex.toUpperCase()), `${composition}: ${hex}`);
    for (const rgba of svg.match(/rgba\([^)]*\)/g) ?? []) assert.equal(rgba, "rgba(206,197,184,.72)", composition);
  }
});

test("every object is a plain SVG path", () => {
  for (const name of OBJECTS) assert.match(silhouette(name, 400, 7).d, /^[MLHVCSQTAZmlhvcsqtaz0-9 .,-]+$/, name);
});

test("every object's subpaths start after a Z, so the holes can be filled in", () => {
  for (const name of OBJECTS) {
    const d = silhouette(name, 400, 7).d;
    for (const m of d.matchAll(/[Mm]/g)) assert.ok(m.index === 0 || /[Zz]\s*$/.test(d.slice(0, m.index)), name);
  }
  // The hourglass is an outline with two holes; the relative m of each hole becomes an absolute M.
  assert.deepEqual(subpaths(silhouette("hourglass-high", 256, 1).d).map((p) => p.slice(0, 8)), ["M200 75.", "M184 40V", "M184 216"]);
});

test("every object renders as a hero", () => {
  for (const name of OBJECTS) assert.match(renderArt({ composition: "hero", objects: [name], label: "look", seed: 11 }), /<\/svg>$/, name);
});

test("every composition and twist renders", () => {
  for (let i = 0; i < OBJECTS.length; i += 5) {
    const pair = [OBJECTS[i]!, OBJECTS[(i * 7 + 3) % OBJECTS.length]!];
    for (const composition of ["versus", "scale"] as const) {
      for (const labelPoints of [0, 1] as const) assert.doesNotThrow(() => renderArt({ composition, objects: pair, label: "this one", labelPoints, seed: i + 1 }), `${composition} ${pair}`);
    }
    assert.doesNotThrow(() => renderArt({ composition: "odd", objects: [pair[0]], label: "which", seed: i + 1 }), `odd ${pair[0]}`);
    assert.doesNotThrow(() => renderArt({ composition: "peek", objects: [pair[0]], label: "who?", stamp: "wip", seed: i + 1 }), `peek ${pair[0]}`);
  }
  for (const twist of TWISTS) {
    for (const name of OBJECTS) assert.doesNotThrow(() => renderArt({ composition: "twist", objects: [name], twist, stamp: "no", seed: 9 }), `${twist} ${name}`);
  }
});

test("an image carries at most three words", () => {
  const specs: ArtSpec[] = [
    { composition: "hero", objects: ["alien"], seed: 1 },
    { composition: "odd", objects: ["robot"], label: "the real one", seed: 2 },
    { composition: "scale", objects: ["coins", "hourglass-high"], label: "margin", stamp: "wip", seed: 3 },
    { composition: "twist", objects: ["ticket"], twist: "cross", label: "aaaaaaaaaaaaaaaaaaaaaa", seed: 4 },
    spec,
  ];
  for (const s of specs) {
    assert.ok(ArtSpec.safeParse(s).success, JSON.stringify(s));
    const seen = textWords(renderArt(s));
    assert.ok(seen.length <= 3, `${s.composition}: ${seen.join(" ")}`);
    assert.equal(seen.length, (s.label?.split(" ").length ?? 0) + (s.stamp ? 1 : 0));
  }
  assert.equal(textWords(renderArt({ composition: "hero", objects: ["key"], seed: 5 })).length, 0);
});

const SIDES: { composition: ArtSpec["composition"]; objects: ArtSpec["objects"] }[] = [
  { composition: "hero", objects: ["robot"] },
  { composition: "twist", objects: ["ticket"] },
  { composition: "odd", objects: ["robot"] },
  { composition: "versus", objects: ["megaphone", "hand-palm"] },
  { composition: "scale", objects: ["coins", "hourglass-high"] },
  { composition: "peek", objects: ["music-notes"] },
];

test("a label never leaves the sheet, however long its word", () => {
  for (const label of ["counterrevolutionaries", "authenticity", "who is human?"]) {
    for (const base of SIDES) {
      const anchors = new Set<string>();
      for (let seed = 1; seed <= 24; seed++) {
        const svg = renderArt({ ...base, label, labelPoints: (seed % 2) as 0 | 1, twist: "cross", seed });
        const texts = [...svg.matchAll(/<text x="([\d.-]+)" y="[\d.-]+" text-anchor="(\w+)" font-size="([\d.]+)" font-weight="600"[^>]*>([^<]*)</g)];
        assert.ok(texts.length > 0, `${base.composition} ${label} ${seed}`);
        for (const [, x, anchor, size, text] of texts) {
          const w = textWidth(text!, Number(size), 600), x0 = anchor === "start" ? Number(x) : anchor === "end" ? Number(x) - w : Number(x) - w / 2;
          assert.ok(x0 >= 190 && x0 + w <= 1410, `${base.composition} "${text}" seed ${seed}: ${x0.toFixed(0)}..${(x0 + w).toFixed(0)}`);
          anchors.add(anchor!);
        }
      }
      // The long word goes to the band, which follows the note's side; scale's side note is always left.
      if (label.length === 22) assert.ok(anchors.has("start") && anchors.has("end"), `${base.composition} ${label}: both sides`);
    }
  }
});

test("the stamp keeps clear of every object and of the note", () => {
  const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  for (const base of SIDES) {
    for (const stamp of ["hot", "late", "announced"]) {
      for (const label of [undefined, "margin", "counterrevolutionaries"]) {
        for (let seed = 1; seed <= 20; seed++) {
          const p = plan({ ...base, label, stamp, labelPoints: (seed % 2) as 0 | 1, seed });
          const where = `${base.composition} ${stamp} ${label} ${seed}`;
          for (const c of p.cuts) assert.ok(!hit(p.stamp!.box, cutBox(c)), `${where}: ${c.name}`);
          if (p.note) assert.ok(!hit(p.stamp!.box, p.note.box), `${where}: note`);
        }
      }
    }
  }
});

test("versus turns the two objects to face each other", () => {
  const [a, b] = plan({ composition: "versus", objects: ["megaphone", "megaphone"], seed: 1 }).cuts;
  assert.equal(a!.mirror, true); // the megaphone opens left as drawn, so the first one turns
  assert.equal(b!.mirror, false);
  const [c, d] = plan({ composition: "versus", objects: ["robot", "crown"], seed: 1 }).cuts;
  assert.equal(c!.mirror, false);
  assert.equal(d!.mirror, true);
});

test("odd copies stay big, keep their red offset and sit on an even pitch", () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const label of [undefined, "the human?"]) {
      const { cuts } = plan({ composition: "odd", objects: ["robot"], label, seed });
      assert.ok(cuts.every((c) => bh(inkBox(c)) >= 160 && c.offset !== false), `${seed} ${label}`);
      // Ink centres: every row on one line, one pitch across both rows, the rows centred on each other.
      const mids = cuts.map((c) => { const b = inkBox(c); return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2] as const; });
      const rows = [...new Set(mids.map((m) => Math.round(m[1])))].map((y) => mids.filter((m) => Math.abs(m[1] - y) < 1).map((m) => m[0]));
      assert.equal(rows.length, 2, `${seed} ${label}: two rows`);
      const steps = rows.flatMap((xs) => xs.slice(1).map((x, i) => x - xs[i]!));
      for (const d of steps) assert.ok(Math.abs(d - steps[0]!) < 1, `${seed} ${label}: pitch ${steps.map((v) => v.toFixed(1))}`);
      const mid = (xs: number[]) => (xs[0]! + xs.at(-1)!) / 2;
      assert.ok(Math.abs(mid(rows[0]!) - mid(rows[1]!)) < 1, `${seed} ${label}: rows centred`);
    }
  }
});

test("ArtSpec rejects too many words, unknown objects and a lone versus", () => {
  assert.equal(ArtSpec.safeParse({ ...spec, label: "one two three four", stamp: undefined }).success, false);
  assert.equal(ArtSpec.safeParse({ ...spec, label: "one two three" }).success, false); // plus the stamp is four
  assert.equal(ArtSpec.safeParse({ ...spec, stamp: "two words" }).success, false);
  assert.equal(ArtSpec.safeParse({ ...spec, objects: ["megaphone", "trumpet"] }).success, false);
  assert.equal(ArtSpec.safeParse({ ...spec, objects: ["megaphone"] }).success, false);
  assert.equal(ArtSpec.safeParse({ ...spec, composition: "scale", objects: ["coins"] }).success, false);
  assert.equal(ArtSpec.safeParse(spec).success, true);
});

test("ArtSpec converts to the JSON schema the model call sends", () => {
  const schema = JSON.stringify(z.toJSONSchema(ArtSpec));
  for (const name of ["hourglass-high", "singer", "versus", "crack"]) assert.ok(schema.includes(`"${name}"`), name);
});

test("the art prompt explains every object", () => {
  const md = fs.readFileSync(new URL("../prompts/art.md", import.meta.url), "utf8");
  for (const name of OBJECTS) assert.ok(md.includes(`- ${name}:`), name);
});

test("text is XML-escaped", () => {
  const svg = renderArt({ ...spec, label: "<b> &", stamp: 'a"b' });
  assert.ok(!svg.includes("<b>") && svg.includes("&lt;b&gt;") && svg.includes("&amp;") && svg.includes("A&quot;B"));
});

// ---- alignment ----

const bh = (b: Box) => b.y1 - b.y0;
const inside = (b: Box, o: Box, tol = 0.5) => b.x0 >= o.x0 - tol && b.y0 >= o.y0 - tol && b.x1 <= o.x1 + tol && b.y1 <= o.y1 + tol;
const mid = (b: Box) => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2] as const;
const CROP = { x0: 0, y0: 900 * 0.08, x1: 1600, y1: 900 * 0.92 }; // what X can crop off the top and bottom

// A spread of real specs: every composition, short and long labels, with and without a stamp,
// over a slice of the objects.
function* specs(): Generator<ArtSpec> {
  for (let i = 0; i < OBJECTS.length; i += 3) {
    const objects = [OBJECTS[i]!, OBJECTS[(i * 7 + 3) % OBJECTS.length]!] as ArtSpec["objects"];
    for (const composition of COMPOSITIONS) {
      for (const label of [undefined, "who made this?", "counterrevolutionaries"]) {
        for (const stamp of [undefined, "hot"]) yield { composition, objects, label, stamp, labelPoints: (i % 2) as 0 | 1, twist: TWISTS[i % 3], seed: i + 1 };
      }
    }
  }
}
const where = (s: ArtSpec) => `${s.composition} ${s.objects.join("+")} ${s.label} ${s.stamp}`;

test("the composition is centred on the sheet, by its real path bounds", () => {
  for (const s of specs()) {
    const p = plan(s), g = compositionBox(p);
    // A stamp beside the composition, rather than in a corner, is centred together with it.
    const centred = (b: Box) => Math.abs(mid(b)[0] - CX) < 1 && Math.abs(mid(b)[1] - CY) < 1;
    assert.ok(centred(g) || (p.stamp && centred(union([g, p.stamp.box]))), `${where(s)}: centre ${mid(g).map((v) => v.toFixed(1))}`);
    // The composition box is built from the ink, not the 256 frame: no wider than ink plus edges.
    for (const c of p.cuts) { const i = inkBox(c), b = cutBox(c); assert.ok(b.x0 < i.x0 && b.x1 > i.x1 && b.x1 - b.x0 - (i.x1 - i.x0) < 120, where(s)); }
  }
});

test("everything sits on the grid inside the sheet and clear of X's crop zone", () => {
  for (const s of specs()) {
    const p = plan(s);
    const boxes: [string, Box][] = [...p.cuts.map((c): [string, Box] => [c.name, cutBox(c)]), ...(p.flap ? [["flap", flapBox(p.flap)] as [string, Box]] : []), ...(p.note ? [["note", p.note.box] as [string, Box]] : []), ...(p.stamp ? [["stamp", p.stamp.box] as [string, Box]] : [])];
    for (const [name, b] of boxes) {
      // A 22-letter word plus a stamp is the one case allowed to spill past the grid, never off the sheet.
      const box = s.label === "counterrevolutionaries" && s.stamp ? SHEET_BOX : AREA;
      assert.ok(inside(b, box) && inside(b, CROP), `${where(s)}: ${name} ${JSON.stringify(b)}`);
    }
  }
  assert.ok(inside(STICKER, CROP), "the alien sticker");
});

test("no note, stamp or object touches another", () => {
  for (const s of specs()) {
    const p = plan(s), objects = p.cuts.map(cutBox), flap = p.flap ? [flapBox(p.flap)] : [];
    for (let i = 0; i < objects.length; i++) for (let j = i + 1; j < objects.length; j++) assert.ok(!hit(objects[i]!, objects[j]!), `${where(s)}: objects ${i} ${j}`);
    if (p.note) for (const b of [...objects, ...flap]) assert.ok(!hit(p.note.box, b, 40), `${where(s)}: note`);
    if (p.stamp) for (const b of [...objects, ...flap, ...(p.note ? [p.note.box] : [])]) assert.ok(!hit(p.stamp.box, b, 20), `${where(s)}: stamp`);
  }
});

test("a note is flush with an edge of the composition, or on its middle line", () => {
  for (const s of specs()) {
    const p = plan(s);
    if (!p.note) continue;
    const inks = p.cuts.map(inkBox), blk = union([...inks, ...(p.flap ? [flapBox(p.flap)] : [])]), n = p.note.box;
    const edges = [blk, ...inks].flatMap((b) => [[n.x0, b.x0], [n.x1, b.x1], [n.y0, b.y0], [mid(n)[1], mid(b)[1]]]);
    assert.ok(edges.some(([a, b]) => Math.abs(a! - b!) < 0.5), `${where(s)}: ${JSON.stringify(n)}`);
  }
});

test("the subject is big enough to read as a thumbnail", () => {
  const SH = bh(SHEET_BOX);
  for (const s of specs()) {
    if (s.stamp && s.label === "counterrevolutionaries") continue;
    const f = bh(union(plan(s).cuts.map(inkBox))) / SH;
    assert.ok(f >= 0.4 && f <= 0.72, `${where(s)}: ${f.toFixed(2)}`);
  }
  // A plain square subject fills most of the band the brief asks for.
  for (const composition of ["hero", "twist", "peek"] as const) {
    const f = bh(union(plan({ composition, objects: ["robot"], seed: 3 }).cuts.map(inkBox))) / SH;
    assert.ok(f >= 0.6 && f <= 0.7, `${composition}: ${f.toFixed(2)}`);
  }
});

test("versus and scale share a baseline, and versus gives both sides the same weight", () => {
  for (const s of specs()) {
    if (s.composition !== "versus" && s.composition !== "scale") continue;
    const cuts = plan(s).cuts, [a, b] = cuts.map(inkBox) as [Box, Box];
    assert.ok(Math.abs(a.y1 - b.y1) < 1, `${where(s)}: baseline ${a.y1.toFixed(1)} ${b.y1.toFixed(1)}`);
    // Weight is filled ink area, the solid red side weighed up; not the bounding box.
    if (s.composition === "versus") assert.ok(Math.abs(weight(cuts[0]!) / weight(cuts[1]!) - 1) < 0.05, `${where(s)}: weight ${weight(cuts[0]!).toFixed(0)} ${weight(cuts[1]!).toFixed(0)}`);
    else assert.ok(bh(a) < bh(b) * 0.4, `${where(s)}: scale`);
  }
});

test("scale's note sits on the side of the object its arrow points at", () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (const labelPoints of [0, 1] as const) {
      const p = plan({ composition: "scale", objects: ["hourglass-high", "users-three"], label: "five minutes", labelPoints, seed });
      const t = inkBox(p.cuts[labelPoints]!), n = p.note!.box;
      // On the huge one: flush with its right edge. On the tiny one: in the column over it, or in the band flush with its left edge.
      assert.ok(Math.abs(n.x1 - t.x1) < 0.5 || (!labelPoints && Math.abs(n.x0 - t.x0) < 0.5), `${seed} ${labelPoints}: ${JSON.stringify(n)}`);
    }
  }
});

test("ink area is the filled area: holes subtract, an open frame weighs less than its box", () => {
  const sq = { name: "lock-key" as const, x: 800, y: 450, size: 256, rot: 0, seed: 1 };
  const b = inkBox(sq), a = inkArea(sq);
  assert.ok(a > 0 && a < (b.x1 - b.x0) * bh(b), "under the box");
  const hp = { ...sq, name: "headphones" as const }, tk = { ...sq, name: "ticket" as const };
  const fill = (c: typeof sq | typeof hp | typeof tk) => { const q = inkBox(c); return inkArea(c) / ((q.x1 - q.x0) * bh(q)); };
  assert.ok(fill(hp) < fill(tk) * 0.8, `headphones ${fill(hp).toFixed(2)} vs ticket ${fill(tk).toFixed(2)}`);
  assert.ok(Math.abs(inkArea({ ...sq, size: 512 }) / a - 4) < 0.01, "scales with size squared");
  assert.equal(weight({ ...sq, red: true }), a * RED_WEIGHT);
});

test("peek's flap hides part of the object, on the note's side", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const p: Plan = plan({ composition: "peek", objects: ["music-notes"], label: "who made this?", seed });
    const i = inkBox(p.cuts[0]!), f = flapBox(p.flap!), n = p.note!.box;
    assert.ok(hit(i, f) && f.x0 > i.x0 + 20 !== f.x1 < i.x1 - 20, `${seed}: covers one side`);
    assert.equal(n.x0 > i.x1, f.x1 > i.x1, `${seed}: note on the flap side`);
  }
});

test("the art prompt lists every composition", () => {
  const md = fs.readFileSync(new URL("../prompts/art.md", import.meta.url), "utf8");
  for (const c of COMPOSITIONS) assert.ok(md.includes(`- ${c}:`), c);
});
