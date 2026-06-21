---
name: loophand
description: A human-in-the-loop kanban where agents queue work and a person clears it in seconds.
colors:
  ink: "#262626"
  ink-dark: "#f5f5f5"
  paper: "#ffffff"
  paper-soft: "#fafafa"
  paper-accent: "#fafafa"
  paper-dark: "#111111"
  paper-dark-accent: "#0c0c0c"
  card-dark: "#161616"
  mist: "#0000000a"
  mist-dark: "#ffffff0d"
  hairline: "#00000014"
  hairline-dark: "#ffffff14"
  field-stroke: "#00000026"
  field-stroke-dark: "#ffffff2e"
  muted-foreground: "#6b6b6b"
  muted-foreground-dark: "#a1a1a1"
  ring: "#a3a3a3"
  ring-dark: "#737373"
  success: "#059669"
  success-dark: "#34d399"
  warning: "#b45309"
  warning-dark: "#fbbf24"
  destructive: "#ef4444"
  destructive-dark: "#f87171"
typography:
  display:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.69rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.16em"
rounded:
  sm: "8px"
  code: "7px"
  card: "16px"
  panel: "24px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-soft}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.card}"
    padding: "12px"
  badge-neutral:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  input:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 12px"
---

# Design System: loophand

## 1. Overview

**Creative North Star: "The Quiet Switchboard"**

loophand is the calm operator's panel between an agent and the person who has to say yes. The agent is blocked; the human is busy; the only job of the surface is to route that one decision and get out of the way. So the system is built like a well-run switchboard: almost nothing glows until a line needs answering. The board is ink on paper, near-silent, and the single card you are acting on is the only thing that earns weight.

The aesthetic is the Linear / Raycast lane: monochrome, precise, confident, legible at a glance from across the room or from a phone in one hand. Hierarchy comes from weight and size, never from decoration. Color is rationed to status alone. Surfaces are flat until you touch them. The product should feel like it respects your attention and trusts you to read.

This system explicitly rejects four things, carried straight from the product's anti-references: generic SaaS slop (gradient hero-metric cards, identical icon-card grids, purple gradients, the AI-template look), heavy enterprise density (Jira / ServiceNow toolbars and nested panels), crypto / neon (glow, neon-on-black, hype), and cutesy / toy-like (over-rounding into a toy, emoji-as-UI, mascots). Friendly is allowed; unserious is not.

**Key Characteristics:**

- Two-tone by default: ink on paper, color only for status.
- One typeface (Manrope) carries the entire hierarchy.
- Flat at rest; elevation is a response to interaction, never a decoration.
- Pill geometry for anything you act on; soft 16-24px radii for anything that holds content.
- Light and dark are equal first-class themes, never a reskin.

## 2. Colors

A strict two-tone palette: a single near-black ink on near-white paper (inverted in dark mode), with three muted greys for recession and exactly three saturated hues reserved for status.

### Primary

- **Ink** (#262626 light, #f5f5f5 dark): the one color that does the heavy lifting. Body text, headings, the primary button fill, the active-chip border and text, the live "waiting on you" pulse dot. In dark mode the ink inverts to near-white. There is no brand accent competing with it; ink _is_ the brand.

### Neutral

- **Paper** (#ffffff light, #111111 dark): the base surface the board sits on. **Paper Soft** (#fafafa) is the page-accent tone and the text color printed on the ink button.
- **Card** (#ffffff light, #161616 dark): the raised surface of task cards and panels. In light mode it equals paper and is separated by a hairline; in dark mode it lifts one step above the background.
- **Mist** (rgba black 0.04 light, rgba white 0.05 dark): the recessed fill for chips, inputs, secondary buttons, and inactive pills. A wash, not a color.
- **Hairline** (rgba black 0.08 light, rgba white 0.08 dark): borders and dividers. Present but barely.
- **Muted Foreground** (#6b6b6b light, #a1a1a1 dark): timestamps, hints, secondary labels, the uppercase kicker.
- **Focus Ring** (#a3a3a3 light, #737373 dark): the keyboard-focus halo, rendered at partial opacity.

### Tertiary (status only)

- **Signal Green** (#059669 light, #34d399 dark): a resolved / approved outcome.
- **Signal Amber** (#b45309 light, #fbbf24 dark): a warning, a stale task, changes requested.
- **Signal Red** (#ef4444 light, #f87171 dark): destructive or expired / cancelled.

Status hues never appear as a fill at full strength. They live as a tinted chip: color at 15% background, 30% border, full-strength text.

### Named Rules

**The Ink-and-Paper Rule.** The interface is two-tone. Ink on paper, nothing else, until a state needs to speak. If you are reaching for a colored fill to make something look nicer, stop: the answer is weight, size, or space, not hue.

**The Status-Is-Earned Rule.** Green, amber, and red are reserved for task state and outcomes. They are forbidden as decorative accents, brand color, or emphasis. A color on screen always means "this is what happened to a task."

## 3. Typography

**Display Font:** Manrope (with ui-sans-serif, system-ui, sans-serif)
**Body Font:** Manrope (same stack)
**Label Font:** Manrope (same stack)

**Character:** One humanist-geometric sans does everything. Manrope is clean and quiet at body sizes and gets quietly assertive at 700-800 for headings. The whole personality comes from the weight range, not from pairing fonts. (Note: Fraunces is currently loaded in the stylesheet but unused; the live system is single-typeface. Treat Manrope as the sole voice until a serif is deliberately introduced.)

### Hierarchy

- **Display** (700, 1.5rem / text-2xl, line-height 1.2, letter-spacing -0.015em): page titles like "Board". Tight tracking, heavy weight, the loudest type on any screen.
- **Title** (600, 1rem / text-base, line-height 1.4): panel and section headings, empty-state titles.
- **Body** (400-500, 0.875rem / text-sm, line-height 1.5): card titles (semibold), descriptions, the working text of the app. Cap reading measure at 65-75ch (the empty-state copy already holds to ~28rem).
- **Label** (700, 0.69rem, letter-spacing 0.16em, uppercase): the "LOOPHAND" kicker and small eyebrow labels. Wide tracking earns its legibility at this size.
- **Numeric** (400, text-xs, tabular-nums): relative timestamps and counts use tabular figures so they do not jitter as they tick.

### Named Rules

**The One-Voice Rule.** A single typeface carries the entire hierarchy. Contrast is built from weight (400 to 800) and size, never from switching families. Reach for a heavier weight before you reach for a second font.

## 4. Elevation

Flat by default, with depth used sparingly and never as ornament. At rest, raised surfaces carry only a whisper of shadow (`shadow-sm`) over a hairline border; the separation reads as a hairline, not a drop shadow. Cards stay flat even on interaction: an interactive card answers a hover with a quiet border + wash shift, never a rise. Heavy shadows are reserved exclusively for true overlays (dialogs, popovers) that float above the board.

### Shadow Vocabulary

- **Rest** (`box-shadow: 0 1px 2px rgba(0,0,0,0.05)` / shadow-sm): every card and panel, at rest and on hover.
- **Hover** (`border-ring/50` + `bg-muted/60`, no translate, no added shadow): an interactive card's hover answer — a quiet border and wash. The card stays put.
- **Float** (`shadow-xl` / `shadow-2xl`): dialogs and overlays only. Never on inline content.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat and separated by a hairline. Hover answers with a border + wash, not a rise; a shadow heavier than `shadow-sm` appears only on a true overlay floating above the board. A resting card with a heavy shadow is a bug. If it looks like a 2014 Material card, the shadow is too dark.

**The Motion-Safe Rule.** The live pulse is wrapped so `prefers-reduced-motion` flattens it (`motion-safe:animate-pulse`); the card hover is a color-only transition with no motion to reduce. Any new motion must degrade the same way.

## 5. Components

### Buttons

- **Shape:** fully rounded pill (9999px). Always.
- **Primary:** ink fill (#262626 / #f5f5f5 dark) with paper-soft text, height 40px (`md`) or 32px (`sm`), horizontal padding 16px. The single loudest control on a screen; there should rarely be two on one view.
- **Secondary / Ghost:** secondary is a mist fill with a hairline border and ink text; ghost drops the fill entirely and tints on hover. Use these for everything that is not the one primary action.
- **Hover / Focus:** background shifts to 90% on the primary; all buttons carry a 180ms ease transition on color and transform. Focus shows a 2px ring at 40% opacity. Labels never wrap (`whitespace-nowrap`) and never shrink below their content (`shrink-0`).

### Chips / Badges

- **Project chips:** pill, mist fill when inactive (muted-foreground text), and ink-bordered with an ink-tinted fill when active. The active project reads as "selected" through border and text weight, not through a saturated fill.
- **Status badges:** pill with a tinted background at 15%, border at 30%, full-strength text. Tones are neutral (mist), info (ink-tinted), success, warning, danger. The badge is the _only_ place saturated status color is allowed.

### Cards / Containers

- **Corner Style:** 16px (`rounded-2xl`) for task cards and the snippet block; 24px (`rounded-3xl`) for large empty-state and panel containers.
- **Background:** card token over a hairline border.
- **Shadow Strategy:** `shadow-sm` at rest and on hover; an interactive card answers a hover with a border + wash shift, not a lift. See Elevation.
- **Internal Padding:** 12px (`p-3`) on task cards; 24-48px on large empty states.
- **Never nest a card inside a card.** A card is a leaf surface.

### Inputs / Fields

- **Style:** pill (9999px), mist fill, hairline stroke (field-stroke at ~0.15 alpha), height 36px, 12px horizontal padding.
- **Focus:** border shifts to ink (`focus:border-primary`) plus a soft 30% ring. No glow.
- **Behavior:** on narrow screens the field goes full-width and its action button stays a fixed pill beside it; on `sm+` the field is a fixed 12rem.

### Navigation

- **Style:** there is no heavy nav chrome. Top-of-board controls (project switcher, Agents link, Turn-off-notifications) are pill-shaped and sit inline above the columns. The Agents link is a pill with a leading gear icon. Active route is carried by ink border + tint, inactive by mist. Everything wraps gracefully and stays reachable by thumb on mobile.

### Signature Component: the Board Column

The four-column flow (Queue, Awaiting agent, Agent working, Done) is the heart of the product. Columns are unboxed: a small uppercase-ish section label and hint over a vertical stack of cards, with a one-column layout on mobile that expands to two then four columns as width allows. The status a card is in is communicated by its column and a label, never by color alone, so the flow holds for color-blind users and in a peripheral glance. A task "waiting on you" carries a single 8px ink pulse dot.

## 6. Do's and Don'ts

### Do:

- **Do** keep the board two-tone: ink on paper. Build emphasis from weight (400-800) and size, not from color.
- **Do** reserve green / amber / red for task state and outcomes only, rendered as a tinted badge (15% fill, 30% border, full-strength text).
- **Do** keep surfaces flat (`shadow-sm` + hairline) at rest and on hover; let a heavier shadow appear only on true overlays.
- **Do** use pill geometry for anything actionable (buttons, chips, inputs) and 16-24px radii for anything that holds content.
- **Do** carry status with a label or shape in addition to any color, so it survives color blindness and a one-second glance.
- **Do** honor `prefers-reduced-motion` on every new transition, the way the pulse dot already does.
- **Do** keep both themes in parity: design the token, not the light-mode screen.

### Don't:

- **Don't** ship generic SaaS slop: no gradient hero-metric cards, no identical icon-card grids, no purple gradients, no AI-template look. If it reads as "made by a landing-page generator", it is wrong.
- **Don't** drift toward heavy enterprise: no Jira / ServiceNow density, cluttered toolbars, or nested panels. The board carries little chrome.
- **Don't** use crypto / neon: no neon-on-black, no glow effects, no hype aesthetic.
- **Don't** go cutesy / toy-like: no over-rounding into a toy, no emoji-as-UI, no mascots. Friendly is fine; unserious is not.
- **Don't** use a colored `border-left` / `border-right` stripe as an accent on cards, list items, or callouts. Use a full hairline, a tint, or a leading dot.
- **Don't** put `background-clip: text` gradients on type. One solid ink color; emphasis via weight or size.
- **Don't** add a second typeface to create hierarchy. Reach for a heavier Manrope weight first.
- **Don't** rest a card under a heavy shadow or nest a card inside a card.
- **Don't** reach for a modal as the first answer. Exhaust inline and progressive surfaces (the board already prefers an inline rail and panels).
