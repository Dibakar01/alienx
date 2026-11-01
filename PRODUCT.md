# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person, or a small team, running their own X accounts. They open alienX on their Mac, pick who is posting on the front door, glance at the week, veto or tweak what alienX booked, and post what is due with one tap. Sometimes they drop in a raw thought or a link. Each account is a profile; profiles are views, not permissions. A team's own details (who the accounts are, their order, their posting windows) stay on their Mac in git-ignored files: `voices/`, `knowledge/facts.md`, `config/local.json` and `PRODUCT.local.md`.

## Product Purpose

alienX runs an X presence with the person as editor. It discovers what each account should say, drafts posts in that account's voice, draws one picture per post as its visual hook, and books each post into the account's best slot. A raw thought takes the same path. The person approves each post in Create; it then waits on the Studio calendar, where it can be edited, moved or killed until its slot, and goes out only when they tap Post. alienX never posts by itself. Success is one draft out of five good enough to post with light edits. A draft is good only if it passes three tests: voice (it reads like the person), truth (every claim about them traces to their facts or their thought) and native (it is written for X, not an essay cut to length).

## Positioning

It learns how a person writes, from their own essays and past posts, or from the topics and style they pick when they make their account. It researches with sources, so every claim is tagged facts, your thought, research (with a link) or unverified. Length is counted the way X counts it. Approving or rejecting a draft feeds the next ones.

## Operating Context

Runs on the person's Mac at http://127.0.0.1:3000, installed from the download page or one Terminal line. Optional launchd agents (`scripts/agents.sh`) keep the server running, mark posts due every minute, discover ideas on Sundays and make alienX's daily pick. Model calls go through the Claude Code CLI on the person's Claude subscription, research included (WebSearch and WebFetch); nothing is billed to an API account. Pictures are drawn by code from a small spec the model picks and rasterized with headless Google Chrome. Posting happens in X through a link the person submits themselves.

## Capabilities and Constraints

- Making an account: X handle, name, person or brand, topics (tags, at most 6) and writing style (tags, at most 5). Optional: a blog to study, past X posts, facts alienX may state, a voice to inherit. Tags are cleaned before they reach a prompt.
- Discover (`lib/plan.ts`, `prompts/research.md`): per account, in sequence because accounts share one subscription limit. What is new in the account's world from the last 14 days, as a mix of ideas, each with a takeaway.
- Schedule (`config/slots.json`, overridden per handle in `config/local.json`): posting windows, at most one post a day, three hours apart, three a week by default.
- Visual hook (`lib/art.ts`, `prompts/art.md`): a picture-led collage in alienX's scrapbook style, drawn by code from the model's spec, saved as SVG and PNG under `data/art/`.
- Written for X (`prompts/generate.md`, `lib/post.ts`): five variants per idea (story, contrarian, observation, lesson, question), a hook first line, short lines, one concrete detail, no link in the post (sources go in a ready-made first reply), 280 weighted characters checked in code.
- No X API, no scraping, no posting without the person's tap, no analytics. The app answers only on localhost and refuses requests from other pages.

## Brand Commitments

- Name: "alienX", lowercase "alien", capital "X". Mascot: a minimal alien head with the eyes cut out.
- Look: One Flow (by Qalakaar): torn paper sheets with tape on a dark ground, Outfit, a red accent, analogue motion. Every colour is defined once in `app/globals.css`.
- Interface voice: dry, short, no exclamation marks. Statuses are shown as marks, not sentences; every wait is one line and a progress bar.

## Product Principles

1. Voice first: a draft that sounds generic is worthless.
2. Truth is traceable: claims are tagged, and unverified ones are made obvious.
3. The human decides: alienX drafts and books, the person posts.
4. One clear path: the front door, Create, then Studio.
5. Free to run: the Claude subscription only.
6. Show, don't tell: pictures and marks over paragraphs.
