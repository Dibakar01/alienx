---
name: alienX
description: Torn paper on a dark ground, in the Qalakaar One Flow scrapbook style. A week of posts, a writing desk and a topic board, switched by a dock.
colors:
  red: "var(--red)"
  white: "var(--white)"
  black: "var(--black)"
  red-deep: "var(--red-deep)"
  red-wash: "var(--red-wash)"
  black-soft: "var(--black-soft)"
  grey: "var(--grey)"
  rule-strong: "var(--rule-strong)"
  rule: "var(--rule)"
  wash: "var(--wash)"
  ground: "var(--ground)"
  paper: "var(--paper)"
  pencil: "var(--pencil)"
  tape: "var(--tape)"
  snow: "var(--snow)"
  panel: "var(--panel)"
typography:
  heading:
    fontFamily: "Outfit, Helvetica Neue, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.25
  numeral:
    fontFamily: "Outfit, Helvetica Neue, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.25
  action:
    fontFamily: "Outfit, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 500
  body:
    fontFamily: "Outfit, Helvetica Neue, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "Outfit, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  button:
    fontFamily: "Outfit, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.43
  handle:
    fontFamily: "Outfit, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  label:
    fontFamily: "Outfit, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.33
  count:
    fontFamily: "Outfit, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.33
    fontFeature: "tnum"
  stamp:
    fontFamily: "Outfit, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  draft:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  object: "14px"
  card: "10px"
  mark: "6px"
spacing:
  tight: "8px"
  stack: "12px"
  face: "24px"
  face-phone: "16px"
  overlay: "20px"
components:
  object:
    backgroundColor: "{colors.white}"
    textColor: "{colors.black}"
    rounded: "{rounded.object}"
  button:
    backgroundColor: "{colors.white}"
    textColor: "{colors.black}"
    typography: "{typography.button}"
    rounded: "{rounded.card}"
    padding: "8px 14px"
  button-active:
    backgroundColor: "{colors.wash}"
  button-disabled:
    backgroundColor: "{colors.white}"
    textColor: "{colors.grey}"
  button-primary:
    backgroundColor: "{colors.red}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.card}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.red-deep}"
  button-primary-disabled:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.grey}"
  button-generate:
    backgroundColor: "{colors.red}"
    textColor: "{colors.white}"
    typography: "{typography.action}"
    rounded: "{rounded.card}"
    padding: "14px 14px"
  button-dark:
    backgroundColor: "{colors.black}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.card}"
    padding: "8px 14px"
  button-dark-hover:
    backgroundColor: "{colors.black-soft}"
  account-switch:
    backgroundColor: "{colors.white}"
    textColor: "{colors.black}"
    typography: "{typography.handle}"
    rounded: "{rounded.card}"
    padding: "0 12px"
    height: "40px"
  account-switch-chosen:
    backgroundColor: "{colors.red}"
    textColor: "{colors.white}"
  account-switch-voiceless:
    backgroundColor: "{colors.white}"
    textColor: "{colors.grey}"
  option:
    backgroundColor: "{colors.white}"
    textColor: "{colors.black}"
    typography: "{typography.small}"
    rounded: "{rounded.card}"
    padding: "0 12px"
    height: "40px"
  option-chosen:
    backgroundColor: "{colors.red-wash}"
    textColor: "{colors.red}"
  angle-tab:
    textColor: "{colors.grey}"
    typography: "{typography.label}"
    padding: "0 8px"
    height: "40px"
  angle-tab-chosen:
    textColor: "{colors.red}"
  face-switch:
    backgroundColor: "{colors.white}"
    textColor: "{colors.black}"
    typography: "{typography.button}"
    rounded: "{rounded.card}"
    padding: "6px 14px"
  face-switch-current:
    backgroundColor: "{colors.black}"
    textColor: "{colors.white}"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.black}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "10px 12px"
  field-disabled:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.grey}"
  claims-popover:
    backgroundColor: "{colors.white}"
    textColor: "{colors.black}"
    typography: "{typography.small}"
    rounded: "{rounded.card}"
    padding: "16px"
  overlay:
    backgroundColor: "{colors.white}"
    textColor: "{colors.black}"
    rounded: "{rounded.object}"
    padding: "24px"
  tag:
    backgroundColor: "{colors.black}"
    textColor: "{colors.white}"
    typography: "{typography.count}"
    rounded: "{rounded.mark}"
    padding: "2px 6px"
  stamp:
    backgroundColor: "{colors.white}"
    textColor: "{colors.black}"
    typography: "{typography.stamp}"
    rounded: "{rounded.mark}"
    padding: "4px 8px"
  stamp-solid:
    backgroundColor: "{colors.black}"
    textColor: "{colors.white}"
---

# Design System: alienX

## Overview

**Creative North Star: "The Scrapbook on the Desk"**

alienX now follows the Qalakaar One Flow system (the "Qalakaar · one flow" canvas). The page is a dark ground. Work sits on torn paper sheets held down with a strip of tape, the way One Flow's landing pages lay their panels. Qalakaar red marks the one action on a sheet or the thing that needs you; ink is warm black on paper; pencil grey draws hand marks.

A landing page shows once on the way in: what alienX does in four steps (Discover, Draft, Approve, Post), each with a small moving scrapbook picture, and Get started. Then comes the profile chooser: "Who is posting?" over three taped sheets (Qalakaar with the red alien, Dibakar and Ansh with an ink initial), each with what is due, and a quiet "All three" key on the ground beneath. A profile then fills the screen with that account only, and the dock's last item (the profile's mark) returns to the chooser. Each view's title names the profile ("Studio · Dibakar").

Two views share the ground, switched by a dock at the bottom, in the order the work happens: **1 Create** (ideas become drafts; approve one) and **2 Studio** (the calendar of approved posts, to post from). Each view fits the window; the page itself never scrolls. Long content opens over the view in a dialog. No screen carries a control that does not belong to its step: there is no Home in the app, and posting happens only in the Studio.

The voice stays dry and short, with no exclamation marks. The fixed strings stay: "No drafts yet. Give me a thought to study.", "Studying the human.", "Signal lost. Try again."

**Key Characteristics:**
- A dark ground (`--ground`); torn sheets (`.sheet`, three tear patterns) with tape (`.tape`); a drop shadow that is the sheet's fall.
- One typeface, Outfit, sentence case everywhere. Nothing is uppercase. Figures are tabular where they count.
- Red means act, chosen or needs you. Ink records what is. Pencil is for hand marks.
- One spring for anything that moves, transform and opacity only, feedback on pointer-down.

## Colors

Every colour is defined once in `app/globals.css`. Mixes are written there with `color-mix`; nothing else in the project names a colour. The image renderer (`lib/art.ts`) draws pixels, not UI, and carries its own copy of the paper palette.

- **Qalakaar Red** (`--red`): the one action on a sheet (Generate, Approve, Draft this idea, Post to X), chosen accounts, the step to do now, a due card's edge and its mark, the focus ring, the dock's indicator and badges.
- **Sheet** (`--white`): every surface you read or type on. **Ink** (`--black`): type on paper. **Paper** (`--paper`, also `--wash`): wells, image frames, quiet fills.
- **Ground** (`--ground`): the page. **Snow** (`--snow`) and its mixes (`--snow-muted`, `--snow-faint`, `--snow-line`): type and lines on the ground. **Panel** (`--panel`) and **Glass** (`--glass`): the dock and the toast.
- **Pencil** (`--pencil`): hand marks, the resting mascot, the shimmer of working text. **Tape** (`--tape`): tape strips only.
- Mixes on paper: `--grey` (secondary text), `--rule-strong` (outlines of things you can use), `--rule` (dividers), `--red-wash` (a chosen option; a drop target), `--red-deep` and `--black-soft` (pressed).

**Light and dark.** Dark (the ground) is One Flow's default; light turns the ground into a darker paper (`--paper` mixed with 10% ink) and its ink to `--black`, with a white dock and a softer fall. The sheets are paper in both. With no choice saved it follows the system; the round switch in the top-right corner of every screen overrides it and is remembered on the device, applied before the first paint.

**Red never warns.** Problems are ink tags. A due post is red because it needs you, not because something failed.

## Typography

Outfit only (One Flow), loaded by `next/font`. Draft text stays in the system sans (`--font-x`) so a draft looks the way it will on X.

- **View title** (700, 20px, -0.022em): Create and Studio, and the post dialog's handle.
- **Heading** (500-700, 18px): the numbered steps in Write, a topic's title.
- **Body** (400, 15px, -0.006em, 1.5) and **Small** (400, 14px): sentences and hints.
- **Label** (600, 12px, sentence case): field labels, day names, card times, sources. Counts use tabular figures.
- **Draft** (system sans 400, 15px, 1.4).

Tracking is size-specific: tighter as type grows, near zero for body.

## Layout

Each view is a two-row grid filling the window: a header (mascot, view title, one line of status, the view's own controls) and the work. The bottom 96px is kept for the dock. Padding is 8px on a phone, 12px from 640px, 32px from 1024px.

- **Profiles:** three sheets in a row (stacked rows on a phone), tilted a degree apart, straightening on hover.
- **Studio:** one torn sheet holding a grid: seven day columns in India time; in All three, a 104px account column and one row per account; in a single profile, no account column and larger cards. A cell holds its posts as small paper cards (image, time, first line). On a phone, one day shows at a time, chosen from a row of day chips.
- **Create:** one taped sheet with two faces. Left, "Start from an idea" with an Ideas / Your own switch: the discovered ideas (Discover new ideas, then cards with why now, what the reader gets, sources, Draft this idea or Skip), or your own thought with Single / Thread, topic chips and Generate. Right, "Choose and approve": the five drafts as X previews, Approve or Reject. On a phone the faces switch with Idea / Drafts.
- **Post dialog:** a taped sheet over the dimmed view: the image left, the text, claims, sources, Move and the action row right; one column on a phone.

Every tappable control is at least 44px tall on a coarse pointer or below 640px.

## Elevation & Depth

Sheets fall onto the ground with `--lift` (a soft dark fall and a short contact edge), drawn as a drop shadow so the torn edge casts it. The dock is glass (`--glass`, a blur behind it). Dialogs dim the view with the ground at 60% and an 8px blur. Inside a sheet everything is flat: 1px lines and solid fills.

## Shapes

Torn edges for sheets (`--torn-a`, `--torn-b`, `--torn-c`, from One Flow's scrapbook layer), a tape strip with zigzag ends. 10px corners on anything pressable, 14px on containers, 6px on tags, stamps and post cards. Round only for dots and badges.

## Components

- **Buttons:** outline on paper (`.btn`), solid red for the one action (`.btn-primary`), solid ink for a working button (`.btn-dark`, Schedule, Save changes), outline on the ground (`.btn-ground`). Keys go down 1px on pointer-down and pop back on `--ease-pop`.
- **Post card:** paper, 6px corners, a 1px rule (red when due), tilted by up to 0.8 degrees and straightened on hover. Image at 16:9, then the time or "Due now" with a red square, then two lines of the post. Dragged, it follows the pointer from where it was grabbed and tilts 2 degrees; dropped, it travels into its new cell on `--spring`; dropped nowhere, it springs home.
- **Dock** (React Bits Dock, colours from the tokens): 1 Create and 2 Studio with drawn line icons, then the profile's mark, a red indicator under the current view, red badges for ideas waiting (Create) and posts due (Studio).
- **Theme switch:** a round outline key fixed in the top-right corner of every screen, a sun in the dark and a moon in the light. Headers keep 56px clear for it.
- **Page turn:** changing view or profile is one View Transition: the old page slides 16px left and fades fast, the new one settles in from the right on the spring, while the dock and the theme switch stay put.
- **Create, simplified:** inside a profile there is no account step. Drafts open on their X preview; Approve is the red action, and a draft can only be copied here, never posted.
- **Toast:** dark panel above the dock, ten seconds, with Undo after a kill.
- **Working text** (React Bits ShinyText through `Shiny`): a pencil-to-ink shimmer on lines like "Drawing the hook." Plain text under reduced motion.
- **Feed preview:** the post as X's dark feed will show it (avatar, name, handle, text with its line breaks, the image, the action row), in the post dialog and behind each Create draft's On X / Edit switch.
- **Segmented switch:** a dark carriage that slides to its detent on the spring (Write's Edit / On X).
- **First reply:** a paper well under the post's text holding its sources, with Copy first reply.
- **Post to X:** red. On a laptop it copies the image and opens X with the text; on a phone it opens the share sheet with the image. Copy image and Download sit beside it.
- **Tags and stamps:** ink tags for passing states; stamps for decisions (approved, rejected, scheduled, posted).

### Motion
One Flow's rules: move to explain, never to decorate; one spring (`--spring`, critically damped, `--spring-bounce` only after a drag); transform and opacity only; feedback on pointer-down. It should feel very subtly analogue:
- Keys go down 1px on press and pop back.
- A view settles into place each time it is shown, and a red pencil line draws itself under its title.
- A dialog's sheet is laid down: it drops in slightly tilted and settles flat.
- A card picked up lifts and casts a deeper fall; set down, it travels into its cell and lands with a small bounce, with a light knock on phones.
- A drop target is outlined in dashed red pencil.
- A stamp (scheduled, approved, posted) lands pressed in from above.
- Counts roll into place when they change.
- The mascot blinks while something is being made.
Everything moving stops under `prefers-reduced-motion: reduce`; colour changes stay.

## Do's and Don'ts

### Do:
- **Do** add a colour only as a token or a mix in `app/globals.css`.
- **Do** put work on a torn sheet and keep the ground for chrome: headers, the dock, the toast.
- **Do** keep one red action per sheet, and make a due post the only other red thing.
- **Do** let a long list or a dialog scroll inside itself; the page never does.
- **Do** keep every view working without the drag: the post dialog moves a post with a date field.

### Don't:
- **Don't** use gradients, glow or grain in the interface (One Flow). The image may use halftone; the interface may not.
- **Don't** set anything in uppercase or in a second typeface.
- **Don't** use red for errors or warnings.
- **Don't** add motion that does not explain where something came from or went.
- **Don't** use exclamation marks.
