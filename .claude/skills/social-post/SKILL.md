---
name: social-post
description: Draft a short, engagement-focused X/Twitter post based on recent commits. Turns work into a value-giving tip, fun fact, or lesson for developers — friendly tone, no company or sensitive info. Use when the user wants a /social-post, a tweet, or build-in-public content from recent work.
argument-hint: '(optional) an angle, topic, or commit range — e.g. "the dnd bug" or "last 5 commits"'
---

# /social-post

Turn recent work into a short X/Twitter post whose job is to **give followers value and earn engagement** (new follows, replies, reposts). Friendly, human, dev-to-dev. Never a press release.

## Step 1 — Gather material

- Default: read the last ~15 commits: `git log --oneline -15 --pretty=format:'%h %s'`.
- If the user passed an argument, treat it as the angle/topic/range and scope to that (e.g. a commit range, a single commit, or a theme like "the drag-and-drop bug").
- For a promising commit, inspect the actual change to find the *generalizable* insight: `git show <hash> --stat` then read the relevant diff. The lesson lives in the code, not the commit subject.

## Step 2 — Find the shareable insight

Pick ONE angle that a stranger scrolling X would stop for. Good shapes:

- **The lesson** — a non-obvious gotcha you hit and how you fixed it ("spent an hour on X, turned out to be Y").
- **The tip** — a concrete technique others can copy today.
- **The fun fact** — a surprising detail about how something works under the hood.
- **The hot take / mini-rant** — a defensible opinion that invites replies (use sparingly).
- **The build-in-public beat** — what you shipped and why it mattered, told as a small story.

Prefer specificity over breadth. "Scoped a DOM query to the editor root and the phantom drag handle vanished" beats "fixed some bugs." One crisp idea > three vague ones.

## Step 3 — Scrub anything sensitive (REQUIRED)

This is the product's own repo. Before drafting, strip everything below. When in doubt, generalize it out.

**Never reveal:**
- The company or product name, internal codenames, repo paths, or file names — unless the user *explicitly* opts into build-in-public branding for this post.
- Security work: vulnerabilities, hardening, rate limits, auth/abuse defenses, anything that hands an attacker a map.
- Business internals: pricing, revenue, MRR, costs, margins, conversion, growth strategy, launch/GTM plans.
- Unreleased features, roadmap, or competitive positioning (e.g. comparisons to named rivals).
- Vendor/infrastructure specifics tied to strategy (which provider, migrations, account details).
- Customer data, user counts, employee names, or anything from memory files.
- Secrets, keys, endpoints, internal URLs.

**Safe to share:** the *generalizable* engineering or design lesson, stated in terms any dev using the same tools/framework would recognize. Translate the specific fix into the universal principle.

If the only interesting angle is sensitive, say so and suggest a safe alternative — don't ship a watered-down leak.

## Step 4 — Write the post

Constraints:
- **≤ 280 characters.** Count them. Shorter often wins.
- **Hook on line 1** — the first ~8 words decide whether anyone reads on. Lead with the surprise, tension, or payoff, not setup.
- Plain, warm, conversational. Contractions. No corporate voice, no buzzwords, no "thrilled to announce."
- Line breaks for skimmability; one idea per line.
- **No links in the body** (X suppresses link posts) — offer to put any link in a reply instead.
- Emoji: 0–1, only if it earns its place. Hashtags: avoid, or 1 max.
- End with a light engagement nudge when it fits — a question, a "what's your approach?", a relatable confession. Don't force it.

## Step 5 — Deliver

Present **2–3 variants** with different angles (e.g. one lesson-style, one fun-fact, one hot-take) so the user can pick. For each, show the post text in a code block and note its character count. Add one line on the angle.

Then ask which to keep, or offer to tweak tone/length. Do **not** post anywhere — output text only, the user posts it themselves.
