# alienX

alienX runs a small team's X presence with the founders as editors. Each week it researches what each account should say, drafts posts in that account's own voice, draws one picture-led image per post, and schedules every post into the account's best slot. A founder can edit, move or kill any post until its slot comes up. At the slot the post is due, and it goes out only when a founder taps **Post to X**. alienX never posts by itself.

It is built for [Qalakaar](https://qalakaar.com) and its three accounts, and it runs on one Mac at no cost: model calls go through the Claude Code CLI on a Claude subscription, never a paid API.

## How it works

- **Voices.** `npm run ingest` pulls an account's own essays (`corpus/`), and `npm run profile` studies them into a voice profile (`voices/<handle>.json`). Pasted past X posts sharpen a profile.
- **Research.** Every Sunday at 20:00 IST, `npm run plan` searches the web for each account (Claude Code's WebSearch and WebFetch tools), keeps 5 to 8 sourced findings, and proposes a few topics.
- **Drafts written for X.** Five drafts per topic or thought, one per angle (story, contrarian, observation, lesson, question). The rules follow X's open-source ranker, which favours replies, quotes, shares and read-through over likes. Each draft gets a hook first line, short lines, one concrete detail, an ending worth answering or forwarding, and no link (the source goes in a ready-made first reply). Code checks length the way X counts it, the shape, and the style rules. Every claim is tagged facts, your thought, research (with its link) or unverified.
- **Images.** The model plans a visual metaphor, choosing objects and a composition (hero, versus, twist, scale, odd one out) with at most three words on the image. Code draws it deterministically as an SVG in the Qalakaar One Flow scrapbook style, and headless Chrome turns it into a 1600×900 PNG.
- **Schedule.** India-time windows per account, at most one post a day, three hours apart, three a week (`config/slots.json`). A one-minute clock marks posts due and sends a macOS notification.
- **Studio.** After the login comes a profile chooser (each account, or all three). Then there are three views, switched by a dock:
  - **Studio** is the week of posts, where you can drag a post to another day or open it.
  - **Write** turns a thought into drafts, with a preview of how each looks on X.
  - **Topics** shows what the research proposed.

## Private data stays out of git

The voices, the essays they are built from, the company facts, the database and the generated images are private. They live on disk and are git-ignored: `voices/*.json`, `corpus/`, `knowledge/*.md`, `data/` and `.env`. To start, copy the templates:

```bash
cp .env.example .env
cp knowledge/qalakaar-facts.example.md knowledge/qalakaar-facts.md
cp voices/account.json.example voices/yourhandle.json
```

Tests that need the private files skip themselves when the files are absent.

## Run it

Requirements: macOS, Node 26, Google Chrome (for the images), and the Claude Code CLI signed in to a Claude subscription.

```bash
npm install
npm run dev        # http://127.0.0.1:3000
npm test
npm run typecheck
```

To run it in the background (the server, the one-minute clock and the Sunday research), use `scripts/agents.sh`. It installs three launchd agents for your user; `scripts/agents.sh remove` uninstalls them.

## Put it online

alienX stays on the Mac and is published through a Cloudflare Tunnel, with Cloudflare Access (an emailed one-time PIN to an allow-list) as the only login.

1. In Cloudflare Zero Trust, add a self-hosted Access application for your hostname with an Allow policy for your emails. Do this first.
2. Run `cloudflared tunnel login` and `cloudflared tunnel create alienx`, then `scripts/tunnel.sh`.

The app also refuses any request addressed to a host other than its own (`proxy.ts`), and any POST that does not come from its own page (`lib/origin.ts`).

## Design system

`DESIGN.md` is the current system: Qalakaar One Flow, with torn paper sheets on a dark ground, Outfit, Qalakaar red, and One Flow's analogue motion. The earlier system (one white object, two faces) is kept in `docs/design/v1-two-faced-object.md`. Every colour is defined once, in `app/globals.css`.

## Credits

- [Phosphor Icons](https://phosphoricons.com) (MIT), the objects in the images; see `brand/icons/LICENSE-phosphor.txt`.
- [Outfit](https://fonts.google.com/specimen/Outfit) (SIL OFL 1.1); see `brand/fonts/OFL.txt`.
- [React Bits](https://reactbits.dev) (MIT): Dock, AnimatedList and ShinyText, adapted in `app/bits/`.
