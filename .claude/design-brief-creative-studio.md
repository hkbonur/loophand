# Design prompt — loophand "Creative Artifact Studio"

You are a senior product designer. Design a **completely new, distinctive, impeccably-polished UI** for the *Creative Artifact Studio* in **loophand**. Treat the current implementation as a throwaway prototype — keep the *functional contract* below, but reinvent the look, layout, and interaction model. Aim for something that feels crafted and calm, the kind of tool people screenshot.

## Product context
loophand is a human-in-the-loop kanban for AI coding/agent workflows. Autonomous agents create **tasks** on a board (via MCP); a human reviews/acts on them and the result flows back to the agent. Most tasks are quick decisions ("approve this?") or annotations on a screenshot. This brief is about the richest task kind: a **studio** where the human (or the agent) actually *works an artifact* — edits an image, manipulates a PDF, tweaks an HTML email — then hands the result back.

## What to design
A single, reusable **studio workspace** that adapts to three media — **image, PDF, HTML** — and could grow to more. It opens from a board card (today it's a modal/dialog; you may propose a full-page or split layout if it serves the work better). The agent's request ("crop to 16:9 and add a browser frame") sits alongside the artifact; the human does the work and resolves the task.

## The one principle (non-negotiable)
**Every studio surface = the artifact + an annotate overlay + a comment thread + a medium-specific toolbar.**
- **Annotate overlay:** the human can draw on the artifact — box, arrow, freehand pen, numbered pin — each mark with a severity (blocker / nit) and a short note. Marks float over the artifact (over an image, a rendered PDF page, or an HTML render snapshot).
- **Comment thread:** a running conversation with the agent (the human leaves guidance; the agent reads it back). Plus a freshest-direction "guidance" line.
- **Toolbar:** the only per-medium part.
- **Resolve:** every task ends in **Approve** or **Request changes** (with a note); destructive/irreversible actions need an explicit typed confirm. An **Undo** affordance appears right after resolving (a few-second grace window).

## Media + their tools (design the toolbars + controls for each)
**Image** — all live, composable, non-destructive where possible (an editable op stack the user can reorder/remove):
- crop · resize · rotate / flip · compress (with a live size readout) · convert format (PNG / JPEG / WEBP) · tint & filters (grayscale, sepia, brightness/contrast/saturation/hue sliders + presets) · blur (whole image **or** a drawn region = redact) · watermark (text/image) · **add chrome** (browser frame / device mockup) · **beautify** (gradient/solid background mat, padding, rounded corners, shadow — the "screenshot beautifier" look).
- **AI generate / edit:** generate a brand-new image from a prompt, or modify the existing one (optionally masked by a drawn region). Show provider, a generating state, and that it composes back into the edit pipeline.
- Export the result back to the agent.

**PDF** — preview every page; ops on pages:
- merge multiple PDFs · split / extract page ranges · reorder pages (drag) · delete · rotate pages · compress · stamp / watermark. Annotate any page.

**HTML** — for email templates and small fragments:
- a **sandboxed preview** beside a code editor; desktop/mobile width toggle; edit raw HTML with live preview; annotate over the rendered snapshot.

## Interactions to show
- Switching tools; applying a transform and seeing the artifact update live; building + reordering an op stack.
- Drawing a mark, then attaching a note + severity to it; the marks list.
- The comment composer + thread.
- Resolve flow (approve / request-changes-with-note / typed-confirm delete) and the Undo toast.
- Export / download, with format + quality.
- Handling **tiny** artifacts (a 120×80 image shouldn't float in a vast empty canvas) **and huge** ones (a 4000px image or a 40-page PDF) gracefully.

## States to cover
loading · empty (no artifact) · error (failed to load / CORS) · offline (a banner; submit blocked) · generating (AI) · resolved/awaiting-agent · large vs tiny artifact · light **and** dark theme · touch (annotation works with a finger).

## Visual language (anchor, then push)
Current system is intentionally **calm and neutral** — evolve it boldly but keep it professional, not flashy:
- Type: **Manrope**.
- Palette (light): background `#ffffff`, surface `#fafafa`, text `#262626`, muted text `#6b6b6b`, primary (buttons) near-black `#262626` on `#fafafa`, border subtle gray; success `#059669`, warning `#b45309`, destructive `#ef4444`. Dark theme mirrors it (`#111` / `#161616` surfaces, `#f5f5f5` text).
- Shapes today: **fully-rounded pill** buttons/inputs, `rounded-2xl`/`rounded-3xl` cards, soft shadows, generous spacing, Phosphor-style line icons.
- You may introduce an accent color, texture, motion, or a more expressive canvas chrome — make the *artifact* the hero and the controls quiet until needed. Just keep it accessible (contrast, focus rings) and fast.

## Constraints
- Built in **React + Tailwind v4** (web). Responsive (desktop → mobile), light/dark, keyboard-navigable, WCAG-AA contrast.
- The canvas/preview is the focus; tools shouldn't crowd it. Heavy surfaces are code-split — design loading gracefully.
- One coherent shell across all three media (don't design three unrelated screens — design the system + its three skins).

## Deliverables
1. The **image studio** — full layout, with the op stack, a filter panel, the AI-generate panel, and the annotate + comment + resolve regions.
2. The **PDF studio** — page grid/preview + page ops + annotate.
3. The **HTML studio** — code + sandboxed preview + annotate.
4. The shared **annotate + comment** interaction (marks, marks list, composer, guidance).
5. Key **states** (loading / empty / error / generating / resolved / mobile / dark).
6. The **resolve** footer (approve / request-changes / typed-confirm delete / undo).

## Tone
Quiet, precise, confident. Think Linear's restraint + a pro photo/PDF editor's focus + a delightful "beautifier." The human should feel in control of a powerful tool, never cluttered. Surprise me — go genuinely new — while honoring the functional contract above.
