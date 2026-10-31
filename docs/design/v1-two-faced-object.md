---
name: alienX
description: One object on a quiet ground, with the thought on one face and the post on the other.
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
typography:
  heading:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.25
  numeral:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.25
  action:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
  body:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  button:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.43
  handle:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "14px"
    fontWeight: 400
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0.08em"
  count:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.33
    fontFeature: "tnum"
  stamp:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "14px"
    fontWeight: 500
    letterSpacing: "0.1em"
  draft:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  object: "22px"
  card: "10px"
  mark: "4px"
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

**Creative North Star: "The Two-Faced Object"**

alienX is one white object resting on a faint grey ground. The object is the whole product: the thought on one face, the post on the other, side by side on a laptop and one at a time on a phone. Outside it there is only the red mascot mark at top left and a thin footer signed alienX. Nothing grows the page: drafts show one at a time behind tabs, claims open over the draft, and account upkeep opens as an overlay above the object.

The object carries the system's only lift, a soft red-tinted fall, and a 22px corner. Inside it everything is print-flat: white ground, black type, hairlines mixed from black, 10px corners, and Qalakaar red as the only colour. Numbered steps at heading size tell you where you are; red tells you what to do or what you chose; black records what is.

The voice is dry and short, with no exclamation marks. Three strings are fixed: "No drafts yet. Give me a thought to study.", "Studying the human.", "Signal lost. Try again."

**Key Characteristics:**
- One object (22px corner, one red-tinted shadow) on a `--wash` ground; nothing else but the mark and a footer.
- Two faces: the thought (steps 1 and 2) and the post (step 3), split by a hairline on a laptop, switched on a phone.
- The page never scrolls in normal use; text boxes take the spare height.
- Three colours only: red, white, black, and mixes of them.
- Flat inside the object: 1px lines, 10px corners, no second shadow.
- Monospace for the machine's marks; grotesk for what a person reads; system sans for the draft itself.
- Red means act or chosen; black means state.

## Colors

Three colours, defined once in `app/globals.css`, and seven mixes of them so that no fourth colour exists. No colour literal appears anywhere else in the project, this file included; refer to colours by token.

### Primary
- **Qalakaar Red** (`--red`): the main colour. As a solid fill: chosen account switches, Generate, and the lead "Open in X". As ink and line: the numeral of the step to do now, the chosen angle tab's text and underline, chosen options (format, author, overlay mode), and the mascot mark and the blinking loading mascot. Also the caret, the native control accent, the text selection and a tint in the object's shadow.
- **Pressed Red** (`--red-deep`, red at 86% in black): hover and press on solid red. Nothing else.
- **Red Wash** (`--red-wash`, red at 7% in white): the fill of a chosen option under red text and a red line. A choice, not an action.

### Neutral
- **White** (`--white`): the object, the overlay, the claims popover, fields and buttons at rest; type on red and on black.
- **Black** (`--black`): type, the focus ring, hovered outlines, the current face on the phone switch, solid working buttons in the overlay and the reject form, state tags, decision stamps, the approved dot on an angle tab, the edge of an approved draft, numerals of finished steps, the footer wordmark. Also the overlay backdrop, at 40% over transparent.
- **Pressed Black** (`--black-soft`, black at 80% in white): hover and press on solid black buttons.
- **Grey** (`--grey`, black at 62% in white): secondary text, labels, unchosen angle tabs, counts, placeholders, hints, the footer line, the resting mascot in the empty and error states. About 6:1 on white.
- **Strong Rule** (`--rule-strong`, black at 55% in white): the outline of anything you can use, link underlines, the numeral of a step still ahead, the dashed edge of an account without a voice, scrollbar thumbs.
- **Rule** (`--rule`, black at 16% in white): hairlines inside the object (the face divider, the phone top row, the tab baseline, the action row), the edge of disabled controls.
- **Wash** (`--wash`, black at 4% in white): the ground the object sits on, disabled fills, the pressed state of outline controls.

### Named Rules
**The Three Colours Rule.** Red, white, black. Every other tone is a `color-mix` of those three, written in `app/globals.css`. A new tone is a new mix there, never a new colour and never a literal anywhere else.

**The Red Means Go Rule.** Solid red is for the chosen accounts and the one action per face: Generate on the thought, the lead "Open in X" on the post. Once the same thought has been generated, Generate drops to an outline; once a draft is approved, only that account's approved draft keeps a red "Open in X". Red never warns.

**The Black Means State Rule.** Black marks what is: a failed author, a draft over the limit, an unverified claim, a broken rule, a decision. Problems are black, not red.

**The Two Lines Rule.** `--rule-strong` outlines things you can use; `--rule` divides things that only hold content. An outline that darkens to black on hover is interactive.

## Typography

**Display Font:** none; the largest type is the 18px step heading
**Body Font:** Space Grotesk (with system-ui, sans-serif)
**Label/Mono Font:** JetBrains Mono (with ui-monospace, monospace)
**Draft Font:** the system sans stack (`--font-x`)

**Character:** A plain grotesk for the reading, a monospace for everything the machine marks, counts or names. The draft is set in the system face so it looks the way it will on X. The ramp is short and flat because the object, not the type, carries the hierarchy.

### Hierarchy
- **Heading** (grotesk 500, 18px, 1.25): "Who is posting", "Your thought", "Pick one", and the overlay's "Accounts". The largest words in the product.
- **Numeral** (mono 500, 18px, on the heading's baseline, 10px before the title): the step number. Red for the step to do now, black once done, `--rule-strong` while ahead; changes over 150ms. Hidden from assistive tech; the heading carries `aria-current="step"`.
- **Action** (grotesk 500, 16px): Generate only.
- **Body** (grotesk 400, 15px, 1.5): field text, notices. Weight 500 for a notice that must be heard.
- **Small** (grotesk 400, 14px): hints, helper lines, claim text, the saved sentence. Weight 500 on buttons and links.
- **Handle** (mono 400, 14px): account handles on switches, author tabs and handle fields.
- **Label** (mono 500, 12px, 0.08em, uppercase): field labels in the overlay and "Post 1 of 3" in grey; angle tabs share the setting (grey, red when chosen).
- **Count** (mono 400, 12px, tabular figures, grey): "212 / 280", account statistics, raw error text, claim sources. Tags share this size in white on black.
- **Stamp** (mono 500, 14px, 0.1em, uppercase): APPROVED, REJECTED.
- **Draft** (system sans 400, 15px, 1.4): the post text, and fields where past posts are pasted.
- **Footer** (12px): the grey line "Drafts in your voice. You post." and the black mono wordmark "alienX".

### Named Rules
**The Machine Marks Rule.** Monospace is for what the tool stamps, counts or names: wordmark, numerals, handles, labels, angle names, counts, tags, stamps. Sentences are never set in mono.

**The As Posted Rule.** Draft text is always the system sans at 15px, never a brand face. The draft should look like the post.

**The Two Weights Rule.** 400 and 500. Emphasis comes from colour and the mono face, not from weight.

## Layout

The page is a three-row grid filling the dynamic viewport (rows auto / 1fr / auto): the mark, the object, the footer. Page padding is 8px on a phone, 12px from 640px, and 32px by 20px from 1024px with 16px between rows. The object is centred, up to 1152px wide and, from 1024px, up to 736px tall, sitting in the middle of the spare height.

From 1024px the object is two equal columns, the thought and the post, divided by a `--rule` hairline; each face has 24px padding. Below 1024px the header and footer are hidden, the object takes a top row (mascot left, Thought | Post switch right, hairline beneath) and shows one face at a time with 16px padding. Pressing Generate turns the phone to the post face.

Inside a face, parts stand 12px apart; steps 1 and 2 have an extra 16px between them. Buttons and switches sit 8px apart. The thought textarea and the draft textarea are the flexible members: they grow to take the spare height and keep a low floor (80px each, about three lines), so a short window squeezes text boxes before it hides a control. When even the floors do not fit, roughly below 600px of window height or with a phone keyboard open, the page scrolls rather than hide controls.

The overlay is centred, up to 544px wide and never taller than the viewport less 24px, with 20px padding (24px from 640px) and 20px between parts; its forms go two-up from 640px. Inside the object or overlay only the claims popover (up to half the viewport) and the overlay itself may scroll internally.

On a coarse pointer or below 640px, every button, switch, tab and text link is at least 44px tall; elsewhere controls stand at 40px.

## Elevation & Depth

Two levels. The ground is `--wash`; the object and the Accounts overlay are lifted on the one shadow in the system, `--lift` (exposed to Tailwind as `shadow-object`): a long soft fall tinted with red at 45% over transparent, plus a short faint contact edge of black at 22% over transparent. Everything inside the object is flat: depth there is a 1px line or a solid fill. The overlay dims what is behind it with black at 40% over transparent.

Focus is a 2px solid black outline, offset 2px, which reads on white and on red alike. On a field the ring sits on the edge (offset 0); on a tab or an option it wraps the label.

### Shadow Vocabulary
- **Object lift** (`--lift`): the one object and the Accounts overlay. Nothing else.

### Named Rules
**The One Lift Rule.** Only the object and its overlay carry a shadow. Anything opened inside the object, the claims popover included, is separated by a `--rule-strong` outline, never a second shadow. The shadow scale is cleared in the theme so no other one can be reached by accident.

## Shapes

Three corners. 22px on the object and the overlay, the two things that lift. 10px on everything inside: fields, buttons, switches, options, the claims popover. 4px on marks stamped onto something (tags, stamps) and on the focus shape of text buttons. Borders are 1px; the stamp alone is 2px so it reads as pressed on, and the chosen angle tab's underline is 2px.

The mascot is an alien head of three shapes: one head, two eyes cut out of it, drawn in the surrounding text colour. It appears at top left in red (32px; 28px in the phone's top row), as the favicon, and in the empty, loading and error notices (56px: grey at rest, red with blinking eyes while drafting).

Drawn glyphs are minimal and in palette: a 1.5px chevron on selects, a small solid triangle on the claims trigger, a 6px black dot on an approved angle tab. A rejected angle is struck through.

## Components

Controls are plain and literal: an outline you can use, a fill when it is the thing to do or the thing you chose.

### Buttons
- **Shape:** 10px corners, 1px border, 8px by 14px padding, 14px medium grotesk.
- **Outline (default):** white with a `--rule-strong` border and black text; hover darkens the border to black, press fills with `--wash`. Approve, Reject, Copy, Previous, Next, Try again, Cancel, Generate again, and any "Open in X" that is not the lead.
- **Primary:** solid red, white text; hover and press go to `--red-deep`. Generate is primary at full width with 14px vertical padding and 16px text, red from the start; pressed too early, its hint below turns black and medium to say what is missing.
- **Dark:** solid black, white text; hover and press go to `--black-soft`. The working button in the overlay and the reject form: Save and study, Add and rebuild, Reject.
- **Disabled (all variants):** `--rule` border, grey text, `--wash` fill for primary and dark. A submit stays disabled until its form is valid, with a short grey hint beside it.
- **Link button:** 14px medium black text, underlined in `--rule-strong` with a 4px offset; the underline darkens on hover. Accounts, Close, Undo.
- **Transition:** background, border and text colour over 150ms ease-out.

### Switches and Options
- **Account switch:** a toggle per account, mono handle, 40px tall, outlined. Chosen: solid red, white text. Without a voice: a dashed `--rule-strong` edge, grey text and "no voice yet"; pressing it opens the overlay to fix that.
- **Pillar picker:** a chosen account with pillars carries a compact select joined to its switch's right edge (no seam: the switch loses its right corners, the picker its left border and corners). `--red-wash` fill, red line, red 12px medium text, arrow tucked 8px from the edge (`select.field.tight`). It offers "Any", then only that account's pillars. Unchosen accounts show no picker. With all three chosen, switches and pickers wrap to two rows on a laptop; the thought box gives up the height.
- **Option** (format, author, overlay mode): a styled radio or pressed button, outlined. Chosen: `--red-wash` fill, red line, red text. An author option names only a state worth noticing: "drafting" or "picked" in small text, or a black "failed" tag.
- **Face switch** (phone only): two borderless buttons, Thought and Post; the current face is solid black with white text, the other hovers to `--wash`.

### Angle Tabs
The five angles (story, contrarian, observation, lesson, question) as an underlined radio group on a `--rule` baseline, so arrow keys move between them. Mono 12px caps in grey; hover goes black; chosen takes red text and a 2px red underline. An approved angle carries a black dot; a rejected one is struck through. Each tab's title gives the gloss ("a small scene").

### Cards / Containers
- **The object:** white, 22px corners, `--lift`, no border. Holds both faces and nothing outside it but the mark and footer.
- **Draft:** not a card. One draft at a time fills the post face: an optional thread pager ("Post 1 of 3", Previous, Next), the draft textarea, a row of count, tags and the claims trigger, then one action row above a `--rule` hairline.
- **Notice:** the mascot and one fixed line centred in the post face, for the empty, drafting and failed states, with a grey note and, on failure, Try again.

### Action Row
One row, always in the same place. Undecided: Approve and Reject on the left, Copy and Open in X on the right. Rejecting: the row becomes a one-line reason field with a dark Reject and Cancel, settling in over 150ms. Decided: a stamp (solid black APPROVED, outlined REJECTED) and Undo take the left; Copy and Open in X stay put; the saved sentence sits beneath in grey (screen-reader only on a phone). Over the limit, Open in X is disabled and Approve is unavailable.

### Inputs / Fields
- **Style:** white, 1px `--rule-strong` border, 10px corners, 10px by 12px padding, grey placeholder; hover darkens the border to black. Text boxes do not resize by hand; they take the spare height.
- **Focus:** the 2px black ring on the field's edge.
- **Disabled:** `--rule` border, `--wash` fill, grey text. A rejected draft reads this way; an approved draft keeps a black border and black text on white.
- **Select:** native arrow replaced by the drawn chevron.
- **Label:** the mono Label above, 8px gap.

### Claims Popover
A native popover anchored above its trigger and growing left from the trigger's right edge, flipping below if there is no room. White, 10px corners, a `--rule-strong` outline, 16px padding, up to 448px wide and half the viewport tall, no shadow. A one-line verdict, then each claim with its source in mono grey, or a black "unverified" tag for a claim to check.

### Accounts Overlay
A native modal dialog over a black 40% backdrop: white, 22px corners, `--lift`. Title "Accounts" at heading size with a Close link (Esc closes too), a two-option mode choice (Add past posts, Add an account), then one form. It stays mounted, so a save keeps running when it is closed.

### Tags and Stamps
- **Tag:** white mono 12px on solid black, 4px corners. A passing state: "46 over", "unverified", "failed", a broken rule.
- **Stamp:** mono caps with 0.1em tracking in a 2px black border, 4px corners. Outlined for REJECTED, solid for APPROVED.

### Motion
Three motions, and no others. The mascot's eyes blink on a 2.2s loop while a generation runs. Controls and step numerals change colour over 150ms ease-out. The reject form settles over 150ms from slightly above and slightly faded, starting readable. All three are off under `prefers-reduced-motion: reduce`.

## Do's and Don'ts

### Do:
- **Do** define any new tone as a `color-mix` of `--red`, `--white` and `--black` in `app/globals.css`, and refer to it by token everywhere else.
- **Do** keep the whole product inside one object on the `--wash` ground; open long content over it (a popover, the overlay) rather than growing the page.
- **Do** let text boxes take the spare height with a low floor, so a short window squeezes text before it hides a control.
- **Do** keep one solid red action per face, and demote Generate to an outline once it would only repeat itself.
- **Do** mark problems and decisions in solid black: tags for passing states, stamps for decisions.
- **Do** separate anything opened inside the object with a `--rule-strong` outline.
- **Do** set anything the machine counts, stamps or names in JetBrains Mono, and draft text in the system sans at 15px.
- **Do** keep every tappable control at least 44px tall on a phone.
- **Do** write interface copy dry and short, and keep the three fixed strings exactly as they are.

### Don't:
- **Don't** write a colour literal outside `app/globals.css`, in code or in documents.
- **Don't** add a fourth colour, including a green for success or an amber for warning. Approved is black; over the limit is black.
- **Don't** use red for errors or warnings. Red means act or chosen.
- **Don't** add a shadow to anything but the object and the Accounts overlay, and don't use gradients, glow or blur.
- **Don't** add a second page, a sidebar, a stacked list of drafts or a settings screen.
- **Don't** put anything outside the object but the mascot mark and the footer.
- **Don't** add motion beyond the blink, the 150ms colour change and the reject form's settle.
- **Don't** use exclamation marks.
