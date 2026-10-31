import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { z } from "zod";
import { ArtSpec, COMPOSITIONS, OBJECTS, TWISTS, cutBox, plan, renderArt, silhouette, subpaths, textWidth, type Box } from "../lib/art.ts";

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

test("odd copies stay big and keep their red offset, with or without a label", () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const label of [undefined, "the human?"]) {
      const { cuts } = plan({ composition: "odd", objects: ["robot"], label, seed });
      assert.ok(cuts.every((c) => c.size >= 190 && c.offset !== false), `${seed} ${label}`);
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
