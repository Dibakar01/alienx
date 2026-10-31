---
version: 2
slug: "app-studio-tsx"
primary_target: "app/studio.tsx"
related_targets: ["app/accounts.tsx","app/layout.tsx","app/globals.css","app/api/generate/route.ts"]
---

# Surface: the alienX page

**Scope and mode.** The whole interface, one route (`/`). Operate: the visitor completes a task.

**Audience and job.** A Qalakaar founder at a laptop with a raw thought. They choose which accounts are posting (one, two or all three), type the thought, and leave with one X draft worth posting per account. Account upkeep (adding an account, pasting past posts) happens in an overlay on the same page.

**Content and states.** Three or more accounts; a thought of up to 4,000 characters; five drafts per account (single posts or threads of 3 to 8); claims tagged facts, seed or unverified. States: no drafts yet, drafting (about half a minute, per account, in parallel), drafts, failed (per account), account without a voice, over the 280 limit, rule flags, approved, rejected, overlay open.

**Chosen direction.** Pinned by the owner on 2026-10-06: no scrolling as a design fundamental, chronological steps, all accounts usable at once, single page, the mascot carries the alienX identity, and the interface is one object in the spirit of artist.qalakaar.com (its design lines, not a copy of its card). Colours stay the owner's: red main, white, black for function.

**Must stay.** alienX name, mascot and blink, the dry fixed strings, Space Grotesk and JetBrains Mono, system font for draft text, flat shapes inside the object, every colour defined once in `app/globals.css`.

**Open.** None.

## Direction contract

THESIS: The thing you make is the interface. One object holds the thought on one face and the post on the other. It refuses the long page, the second page and the stacked list of drafts.

OWN-WORLD: A faint grey ground (black mixed into white) with one white object at 22px corners and one soft red-tinted shadow. Outside it only the red mascot mark at top left and a thin footer signed alienX. Inside, hairline rules, 10px corners, black type; solid red marks the chosen accounts and the one action per face; solid black tags and stamps mark state. Step numbers at heading size, red for the step to do now.

STORY: 1 Who is posting, 2 Your thought, Generate; 3 Pick one: whose drafts, which angle, one draft, then Approve or Reject, Copy, Open in X.

FIRST VIEWPORT: The whole product. On a laptop both faces side by side; on a phone one face with a Thought | Post switch and the mascot in the object's top row. Nothing below the fold, because there is no fold.

FORM: One object, two faces. Long content never grows the page: drafts show one at a time behind tabs, claims open over the draft, account upkeep opens as an overlay. The text boxes take the spare or missing height. Below about 600px of window height, or with a phone keyboard open, the page may scroll rather than hide controls.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
