---
name: review-post
description: Add a viral AI post to PostReview and write its reviews by hand (no API key). Use when the user pastes a link to a blog post or tweet and asks to review it, add it, or include it on the site.
---

# Review a post for PostReview

The user has no LLM API key, so you do the LLM steps of the pipeline yourself: clustering, three reviews, and the meta-review. Everything else is a script. Work from the project root.

## 1. Add the post

- **Blog post, article or paper page:**
  `npm run add -- <url> [--tweet <x-url>] [--author "A, B"] --keywords "a, b, c" --tldr "..."`
  Pass `--tweet` when the user also gives the tweet that made it viral. The gatherer then searches for both links.
- **Tweet or thread only:** X can't be fetched. Ask the user to paste the tweet text, or the blog post it links to, which is better. Save the text to a file in your scratchpad, then run:
  `npm run add -- <x-url> --text-file <path> --keywords ... --tldr ...`

Read the extracted text (`data/posts.json`, last entry) before writing keywords and TL;DR. Write 3–6 short lowercase keywords. The TL;DR is one sentence stating the post's main claim, in OpenReview style. Check the authors and date too: when the page doesn't name an author, `add` falls back to the hostname, so fix it with `--author` or by editing the entry.

## 2. Gather reactions

`npm run gather -- --id <id>`

This collects Hacker News comments, Bluesky posts, replies and quote posts, and response blog posts into `data/reactions/<id>.json`. It prints the counts.

- **Fewer than about 15 reactions:** tell the user the clusters will be thin. A post usually needs a day or two after going viral to collect reactions. Ask whether to go ahead or wait.

## 3. Write the reviews

Follow [REVIEWING.md](REVIEWING.md). It covers clustering, the three reviews, the meta-review, the output format for `data/manual/<id>.json`, and validation with `npm run assemble -- --id <id>`.

- **Over about 150 reactions:** read the file in chunks, or hand the whole of step 3 to a general-purpose subagent. Tell it to follow `.claude/skills/review-post/REVIEWING.md` for `<id>`, then check its result yourself.

## 4. Check and publish

1. `npm run assemble -- --id <id>` must print `ok`.
2. Run the dev server and open `/forum?id=<id>`. Check that the cluster labels, citation links and decision render.
3. Tell the user the decision and the three cluster labels with their sizes.
4. Ask before committing or pushing. Pushing to `main` redeploys the site on Cloudflare Pages.
