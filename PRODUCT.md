# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Qalakaar's founders. Dibakar (co-founder, COO) is the main operator (inferred: he commissioned and reviews the tool); Ansh (co-founder, CTO) is the second voice. They run three X accounts from one site: @dibakaarr, @anshsarkar_ and the brand account @iamqalakaar. They open alienX.qalakaar.com on a laptop or a phone, glance at the week, veto or tweak what alienX has scheduled, and post what is due with one tap. Sometimes they drop in a raw thought or a link. One login (Cloudflare Access) covers both founders. After it comes a profile chooser (Qalakaar, Dibakar, Ansh, or All three); inside a profile every view shows that account only. Each device remembers its profile. Profiles are views, not permissions.

## Product Purpose

alienX runs the three accounts' X presence with the founders as editors. Every week it researches what each account should say, drafts posts in that account's voice, draws one mixed-media image per post as its visual hook, and schedules each post into the account's best slot. A raw thought from a founder takes the same path. A founder approves each post in Create; it then waits on the Studio calendar, where it can be edited, moved or killed until its slot, and goes out when a founder taps Post. The app never posts by itself. Success is one draft out of five that is good enough to post with light edits. A draft is only good if it passes three tests: voice (it reads like the named person), truth (every claim about Qalakaar traces to the facts file or the user's thought) and native (it is written for X, not an essay cut to length).

## Positioning

It studies how each person actually writes, from their own essays and past posts, and drafts in that voice. It researches with sources, so every claim is tagged facts, your thought, research (with a link) or unverified. Length is counted the way X counts it. Approving, scheduling, posting or rejecting a draft feeds the next ones for that account.

## Operating Context

Runs on Dibakar's Mac as three launchd agents installed by `scripts/agents.sh`: the Next.js server (`next start` on 127.0.0.1:3000), a one-minute tick (`npm run tick`: due posts and a macOS notification) and the Sunday 20:00 research run (`npm run plan`). A Cloudflare Tunnel (`scripts/tunnel.sh`) publishes it at alienX.qalakaar.com, and Cloudflare Access is the only login; the app has no auth code. When the Mac sleeps the site is offline and the clock catches up on wake. Model calls go through the Claude Code CLI on the owner's Claude subscription, research included (WebSearch and WebFetch tools); nothing is billed to an API account. Images are rendered by code from a small spec the model picks and rasterized with headless Google Chrome. Voices live in `voices/*.json`, the corpus in `corpus/`, company facts in `knowledge/qalakaar-facts.md`, prompts in `prompts/`, style rules in `config/style-rules.json`. Posting happens in X through an "Open in X" link the user submits themselves.

## Capabilities and Constraints

- Inputs: one or more accounts (any of them, all at once), thought, format (single post or a thread of 3 to 8), hashtags on or off, and a pillar per account: "Any" (the drafts take whichever of the account's own pillars fits) or one of that account's pillars.
- Pillars belong to each account, set by the owner on 2026-10-06: @anshsarkar_ (CTO) Tech and Qalakaar; @dibakaarr (COO) Qalakaar, Design and Growth; @iamqalakaar everything Qalakaar: Music, Culture, People, Tech, Design and Growth. A pillar outside the account's list is refused. They live in `voices/<handle>.json`. Qalakaar's own company pillars (Music, Culture, People) remain a fact in the facts file.
- Weekly research (`lib/plan.ts`, `prompts/research.md`): per account, in sequence because the accounts share one subscription limit. It looks for what is new and trending in the account's world (popular culture, releases, conversations) from the last 14 days, and code drops any finding older than 21 days. It then proposes a mixed week (a trending moment, a useful lesson, a behind-the-work story, an argument), each topic with a takeaway for the reader. The ideas wait in Create for a founder to draft or skip; the Sunday run only discovers, so nothing reaches the calendar without approval.
- Schedule (`config/slots.json`, `lib/schedule.ts`): India-time windows per account, at most one post a day, three hours apart, three a week by default. A post dragged to another day keeps its time of day there.
- Visual hook (`lib/art.ts`, `lib/icons.ts`, `prompts/art.md`): a picture-led visual metaphor with at most three words on it. The model picks objects (hand-drawn music silhouettes plus Phosphor icons, MIT) and a composition (hero, versus, twist, scale, odd one out); code draws it as a One Flow scrapbook cut-out on torn paper and saves SVG and PNG under `data/art/`.
- Posting: no X API. Post to X copies the image and opens X's composer with the text on a laptop, or opens the share sheet with the image on a phone. A thread posts its first post; the rest are copied as replies.
- Written for X (`prompts/generate.md`, `lib/post.ts`): following X's open-source ranker (replies, quotes, shares and read-through weigh most; mutes cost most), every draft has a hook first line under about 80 characters, short lines with air between beats, one concrete detail, a takeaway the reader did not have, and an ending worth answering or forwarding. No link in the post: a researched post comes with a ready-made first reply holding its sources. Code flags a long hook, a wall of text and a link.
- Output: exactly five variants per account (story, contrarian, observation, lesson, question), each with claims tagged facts, seed or unverified. Accounts draft in parallel, one generation each, through the `/api/generate` route; it refuses any request that does not come from the page itself.
- Each post is limited to 280 weighted characters, checked in code. A rule break gets one repair attempt and is otherwise shown flagged, never truncated.
- Accounts can be added from the interface (handle, name, type, inherits, source URL, pillars, past X posts); saving ingests and profiles that account. Any account can be sharpened by pasting past X posts.
- Approve and Reject (with a one-line reason) are saved and fed into the next generation for that account. Approving puts the post on the Studio calendar with its picture, sources and first reply.
- No X API, no scraping of x.com, no posting without a founder's tap, no analytics, no auth code in the app.
- A generation takes roughly half a minute. Usage counts against the subscription's limits, once per account drafted.

## Brand Commitments

- Name: "alienX", lowercase "alien", capital "X".
- Mascot: a minimal alien head of three shapes with the eyes cut out. It is the alienX mark: red at the top left of the page (in the object's top row on a phone), and also the favicon, empty state and loading state. The eyes blink while a generation runs. The wordmark "alienX" signs the footer and the browser tab.
- Colours: Qalakaar red, ink, sheet, paper, pencil and tape on a dark ground, as One Flow defines them. Every colour is defined once in `app/globals.css`; the image renderer keeps its own copy of the paper palette because it draws pixels, not UI.
- Type: Outfit only, sentence case; system sans at 15px for draft text.
- Shape: torn sheets with tape; 10px on anything pressable, 14px on containers, 6px on tags; no gradients, glow or grain in the interface.
- Interface voice: dry, short, no exclamation marks. Fixed strings: "No drafts yet. Give me a thought to study.", "Studying the human.", "Signal lost. Try again."
- The interface follows the Qalakaar One Flow system, set by the owner on 2026-10-31: torn paper sheets on a dark ground, Outfit, Qalakaar red, One Flow's motion. A landing page once, then who is posting, then two views switched by a dock: Create (ideas to an approved post) and Studio (the calendar to post from). Nothing scrolls, set by the owner on 2026-10-06 as a design fundamental; long content opens over the view.

## Evidence on Hand

- 25 essays by Dibakar and 16 by Ansh in `corpus/`; voice profiles with verbatim exemplars in `voices/`.
- Company facts in `knowledge/qalakaar-facts.md`. Nothing about Qalakaar may be stated beyond that file and the user's thought.
- No real past X posts have been added yet.

## Product Principles

1. Voice first: a draft that sounds generic is worthless.
2. Truth is traceable: claims are tagged, and unverified ones are made obvious.
3. The human decides: the tool drafts, the person edits and posts.
4. One clear path: who is posting, the thought, then the drafts. The steps stay numbered and in order.
5. Free to run: the Claude subscription only.
6. Nothing scrolls: the whole product is in view, on a laptop and on a phone.
7. The founder has the last tap: alienX schedules, a human posts.
