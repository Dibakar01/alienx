import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { z } from "zod";
import { ArtSpec, COMPOSITIONS, LINKS, MARKS, OBJECTS, PALETTE, SAFE, STICKER_SIZE, TAPE, TWISTS, cutBox, flapBox, hit, inkArea, inkBox, plan, RED_WEIGHT, renderArt, silhouette, subpaths, textWidth, weight, type Box } from "../lib/art.ts";

const spec: ArtSpec = { headline: "posting more isn't better", mark: "more", markStyle: "strike", composition: "versus", objects: ["megaphone", "hand-palm"], stamp: "hot", seed: 4242 };

// Every piece of text a viewer can read, in drawing order, run together.
const drawn = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!).join("").replaceAll("&apos;", "'");
const bh = (b: Box) => b.y1 - b.y0, bw = (b: Box) => b.x1 - b.x0;
const inside = (b: Box, o: Box, tol = 0.5) => b.x0 >= o.x0 - tol && b.y0 >= o.y0 - tol && b.x1 <= o.x1 + tol && b.y1 <= o.y1 + tol;

test("the same spec renders the same SVG", () => {
  assert.equal(renderArt(spec), renderArt({ ...spec }));
  assert.ok(renderArt(spec).includes('viewBox="0 0 1600 900"'));
  assert.notEqual(renderArt(spec), renderArt({ ...spec, seed: 4243 }));
});

test("only palette colours appear", () => {
  const allowed = new Set<string>(PALETTE);
  for (const composition of COMPOSITIONS) {
    for (const markStyle of MARKS) {
      for (let seed = 1; seed <= 6; seed++) {
        const svg = renderArt({ ...spec, composition, markStyle, objects: composition === "versus" || composition === "scale" ? spec.objects : ["robot"], twist: "crack", seed });
        for (const hex of svg.match(/#[0-9a-fA-F]{6}\b/g) ?? []) assert.ok(allowed.has(hex.toUpperCase()), `${composition}: ${hex}`);
        for (const rgba of svg.match(/rgba\([^)]*\)/g) ?? []) assert.equal(rgba, TAPE, composition);
      }
    }
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
  for (const name of OBJECTS) assert.match(renderArt({ headline: "look closer", mark: "look", markStyle: "circle", composition: "hero", objects: [name], seed: 11 }), /<\/svg>$/, name);
});

test("every composition, twist, mark and link renders", () => {
  for (let i = 0; i < OBJECTS.length; i += 5) {
    const pair = [OBJECTS[i]!, OBJECTS[(i * 7 + 3) % OBJECTS.length]!];
    const base = { headline: "this one wins", mark: "wins", markStyle: MARKS[i % MARKS.length]!, seed: i + 1 };
    for (const link of LINKS) assert.doesNotThrow(() => renderArt({ ...base, composition: "versus", objects: pair, link }), `versus ${pair} ${link}`);
    assert.doesNotThrow(() => renderArt({ ...base, composition: "scale", objects: pair }), `scale ${pair}`);
    assert.doesNotThrow(() => renderArt({ ...base, composition: "odd", objects: [pair[0]] }), `odd ${pair[0]}`);
    assert.doesNotThrow(() => renderArt({ ...base, composition: "peek", objects: [pair[0]], stamp: "wip" }), `peek ${pair[0]}`);
  }
  for (const twist of TWISTS) {
    for (const name of OBJECTS) assert.doesNotThrow(() => renderArt({ headline: "not any more", mark: "not", markStyle: "highlight", composition: "twist", objects: [name], twist, stamp: "no", seed: 9 }), `${twist} ${name}`);
  }
});

test("the words drawn are the headline, then the flap's ?, the VS and the stamp", () => {
  const flat = (s: string) => s.replace(/\s+/g, "");
  for (const markStyle of MARKS) {
    assert.equal(drawn(renderArt({ ...spec, markStyle })), flat(spec.headline) + "VSHOT", markStyle);
    assert.equal(drawn(renderArt({ ...spec, markStyle, link: "then", stamp: undefined })), flat(spec.headline), markStyle);
    assert.equal(drawn(renderArt({ ...spec, markStyle, composition: "peek", objects: ["crown"], stamp: undefined })), flat(spec.headline) + "?", markStyle);
  }
});

test("exactly one word is marked, falling back to the longest when mark is not in the headline", () => {
  const marked = (s: ArtSpec) => plan(s).head.words.filter((w) => w.marked).map((w) => w.text);
  assert.deepEqual(marked(spec), ["more"]);
  assert.deepEqual(marked({ ...spec, mark: "More!" }), ["more"]);
  assert.deepEqual(marked({ ...spec, headline: "is AI repricing music?", mark: "repricing" }), ["repricing"]);
  assert.deepEqual(marked({ ...spec, headline: "AI isn't killing music", mark: "repricing" }), ["killing"]);
});

// A spread of realistic specs: every composition and mark, short and long headlines, with and
// without a stamp, over a slice of the objects.
const HEADLINES = ["posting more isn't better", "who sang it?", "counterrevolutionaries win", "slow artists outlast the fast ones", "zero songs"];
function* specs(): Generator<ArtSpec> {
  for (let i = 0; i < OBJECTS.length; i += 4) {
    const objects = [OBJECTS[i]!, OBJECTS[(i * 7 + 3) % OBJECTS.length]!] as ArtSpec["objects"];
    for (const composition of COMPOSITIONS) {
      for (const [j, headline] of HEADLINES.entries()) {
        for (const stamp of [undefined, "sold", "announced"]) {
          yield { headline, mark: headline.split(" ")[j % 2]!, markStyle: MARKS[(i + j) % MARKS.length]!, composition, objects: composition === "versus" || composition === "scale" ? objects : [objects[0]], stamp, link: LINKS[i % 3], twist: TWISTS[i % 3], seed: i + j + 1 };
        }
      }
    }
  }
}
const where = (s: ArtSpec) => `${s.composition} ${s.objects.join("+")} "${s.headline}" ${s.markStyle} ${s.stamp} ${s.seed}`;

test("every spec in the spread parses", () => {
  for (const s of specs()) assert.ok(ArtSpec.safeParse(s).success, where(s));
});

test("the headline never overflows: every word's glyphs and mark sit inside the scrap, and the scrap's words inside SAFE", () => {
  for (const s of specs()) {
    const p = plan(s), { head } = p;
    for (const w of head.words) {
      const g0 = w.x + w.lead, g1 = g0 + textWidth(w.text, head.size, 800);
      assert.ok(g0 >= head.box.x0 - 0.5 && g1 <= w.x + w.w + 0.5 && w.x + w.w <= head.box.x1 + 0.5, `${where(s)}: "${w.text}" runs past its line`);
      assert.ok(w.y - 0.8 * head.size >= head.box.y0 - 0.5 && w.y + 0.24 * head.size <= head.box.y1 + 0.5, `${where(s)}: "${w.text}" leaves the block`);
    }
    // Words on one line never overlap.
    const lines = Map.groupBy(head.words, (w) => w.y);
    for (const ws of lines.values()) ws.forEach((w, k) => k && assert.ok(w.x >= ws[k - 1]!.x + ws[k - 1]!.w, `${where(s)}: "${w.text}" overlaps`));
    assert.ok(inside(head.box, p.scrap.box), where(s));
    assert.ok(inside(p.text, SAFE), `${where(s)}: words ${JSON.stringify(p.text)}`);
  }
});

test("nothing covers the words: objects, flap, stamp and sticker keep clear", () => {
  for (const s of specs()) {
    const p = plan(s), w = where(s);
    for (const c of p.cuts) assert.ok(!hit(cutBox(c), p.text, 10), `${w}: ${c.name}`);
    if (p.flap) assert.ok(!hit(flapBox(p.flap), p.text, 10), `${w}: flap`);
    if (p.stamp) assert.ok(!hit(p.stamp.box, p.text, 20) && inside(p.stamp.box, SAFE), `${w}: stamp ${JSON.stringify(p.stamp.box)}`);
    // The sticker is round: its edge stays off the words' box.
    const [x, y] = p.sticker, dx = Math.max(p.text.x0 - x, 0, x - p.text.x1), dy = Math.max(p.text.y0 - y, 0, y - p.text.y1);
    assert.ok(Math.hypot(dx, dy) > STICKER_SIZE / 2 + 6, `${w}: sticker`);
  }
});

test("the headline is set big enough to read at timeline size", () => {
  for (const s of specs()) {
    const p = plan(s), min = s.headline.length > 24 ? 64 : 90;
    assert.ok(p.head.size >= min, `${where(s)}: ${p.head.size}px`);
  }
  // Two short words beside the art go huge.
  assert.ok(plan({ ...spec, headline: "zero songs", composition: "hero", objects: ["receipt"] }).head.size >= 180);
  // One very long word moves the headline across the top rather than shrink it.
  assert.equal(plan({ ...spec, headline: "counterrevolutionaries win", composition: "hero", objects: ["crown"] }).layout, "top");
  assert.equal(plan({ ...spec, composition: "hero", objects: ["crown"] }).layout, "side");
});

test("a lone object is big and runs towards the canvas edge", () => {
  for (const s of specs()) {
    if (s.composition !== "hero" && s.composition !== "twist" && s.composition !== "peek") continue;
    const p = plan(s), ib = inkBox(p.cuts[0]!);
    assert.ok(bh(ib) >= bh(p.zone) * 0.6 || bw(ib) >= bw(p.zone) * 0.9, `${where(s)}: ${bw(ib).toFixed(0)}x${bh(ib).toFixed(0)}`);
  }
});

test("versus turns the two objects to face each other", () => {
  const [a, b] = plan({ ...spec, objects: ["megaphone", "megaphone"], seed: 1 }).cuts;
  assert.equal(a!.mirror, true); // the megaphone opens left as drawn, so the first one turns
  assert.equal(b!.mirror, false);
  const [c, d] = plan({ ...spec, objects: ["robot", "crown"], seed: 1 }).cuts;
  assert.equal(c!.mirror, false);
  assert.equal(d!.mirror, true);
});

test("versus and scale share a floor; versus stays near equal weight, scale stays lopsided", () => {
  for (const s of specs()) {
    if (s.composition !== "versus" && s.composition !== "scale") continue;
    const cuts = plan(s).cuts, [a, b] = cuts.map(inkBox) as [Box, Box];
    assert.ok(Math.abs(a.y1 - b.y1) < 1, `${where(s)}: floor ${a.y1.toFixed(1)} ${b.y1.toFixed(1)}`);
    assert.ok(!hit(cutBox(cuts[0]!), cutBox(cuts[1]!)) || s.composition === "scale", `${where(s)}: versus sides touch`);
    if (s.composition === "versus") { const k = weight(cuts[0]!) / weight(cuts[1]!); assert.ok(k > 0.25 && k < 4, `${where(s)}: weight ratio ${k.toFixed(2)}`); }
    else assert.ok(bh(b) < bh(a) * 0.45, `${where(s)}: scale`);
  }
});

test("odd has six equal copies, exactly one red, and a stamp never covers the red one", () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const headline of ["the ones who come back", "counterrevolutionaries win"]) {
      const p = plan({ headline, mark: "back", markStyle: "ransom", composition: "odd", objects: ["user"], stamp: "announced", seed });
      assert.equal(p.cuts.length, 6);
      assert.deepEqual(p.cuts.map((c, i) => !!c.red === (i === p.target)), [true, true, true, true, true, true]);
      assert.equal(new Set(p.cuts.map((c) => c.size)).size, 1);
      assert.ok(!hit(p.stamp!.box, cutBox(p.cuts[p.target]!)), `${seed} ${headline}: stamp on the red one`);
    }
  }
});

test("peek's flap hides the half towards the canvas edge", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const p = plan({ headline: "who really sang it?", mark: "really", markStyle: "highlight", composition: "peek", objects: ["microphone-stage"], seed });
    const i = inkBox(p.cuts[0]!), f = flapBox(p.flap!);
    assert.ok(hit(i, f), `${seed}: covers`);
    assert.ok(p.right ? f.x0 < 0 && f.x1 < i.x1 : f.x1 > 1600 && f.x0 > i.x0, `${seed}: runs off the far edge`);
  }
});

test("ink area is the filled area: holes subtract, an open frame weighs less than its box", () => {
  const sq = { name: "lock-key" as const, x: 800, y: 450, size: 256, rot: 0, seed: 1 };
  const b = inkBox(sq), a = inkArea(sq);
  assert.ok(a > 0 && a < bw(b) * bh(b), "under the box");
  const fill = (name: "headphones" | "ticket") => { const c = { ...sq, name }, q = inkBox(c); return inkArea(c) / (bw(q) * bh(q)); };
  assert.ok(fill("headphones") < fill("ticket") * 0.8, "headphones vs ticket");
  assert.ok(Math.abs(inkArea({ ...sq, size: 512 }) / a - 4) < 0.01, "scales with size squared");
  assert.equal(weight({ ...sq, red: true }), a * RED_WEIGHT);
});

test("ArtSpec rejects long headlines, odd characters, unknown objects and a lone versus", () => {
  assert.equal(ArtSpec.safeParse(spec).success, true);
  assert.equal(ArtSpec.safeParse({ ...spec, headline: "one two three four five six seven" }).success, false);
  assert.equal(ArtSpec.safeParse({ ...spec, headline: "posting more ≠ better" }).success, false);
  assert.equal(ArtSpec.safeParse({ ...spec, headline: "it’s not “more” — it’s depth" }).success, true);
  assert.equal(ArtSpec.safeParse({ ...spec, markStyle: "underline" }).success, false);
  assert.equal(ArtSpec.safeParse({ ...spec, stamp: "two words" }).success, false);
  assert.equal(ArtSpec.safeParse({ ...spec, objects: ["megaphone", "trumpet"] }).success, false);
  assert.equal(ArtSpec.safeParse({ ...spec, objects: ["megaphone"] }).success, false);
  assert.equal(ArtSpec.safeParse({ ...spec, composition: "scale", objects: ["coins"] }).success, false);
});

test("ArtSpec converts to the JSON schema the model call sends", () => {
  const schema = JSON.stringify(z.toJSONSchema(ArtSpec));
  for (const name of ["hourglass-high", "singer", "versus", "crack", "ransom", "then", "headline"]) assert.ok(schema.includes(`"${name}"`), name);
});

test("the art prompt explains every object, composition, mark and link", () => {
  const md = fs.readFileSync(new URL("../prompts/art.md", import.meta.url), "utf8");
  for (const name of [...OBJECTS, ...COMPOSITIONS, ...MARKS, ...LINKS]) assert.ok(md.includes(`- ${name}:`), name);
});

test("text is XML-escaped", () => {
  for (const markStyle of MARKS) {
    const svg = renderArt({ ...spec, headline: "<b> & co", mark: "<b>", markStyle, stamp: 'a"b' });
    assert.ok(!svg.includes("<b>") && svg.includes("&lt;") && svg.includes("&amp;") && svg.includes("A&quot;B"), markStyle);
  }
});
