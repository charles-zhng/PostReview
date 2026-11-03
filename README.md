# PostReview

A parody of OpenReview: viral AI tweets and blog posts are "submitted" to a fake conference. Each one is reviewed by three reviewers built from **real community reactions**, then judged by a synthetic Area Chair.

1. **Gather** (`npm run gather`): collects reactions to each post.
   - **Hacker News:** ranked comments and top replies, from every thread that links the post.
   - **Bluesky:** posts sharing the link, plus replies to and quote posts of the most-engaged shares.
   - **Response posts:** later blog posts that rebut or discuss the original, with their HN comments.
   - X/Twitter replies and quote tweets aren't available without the paid API.
2. **Cluster:** an LLM groups the reactions into the three main takes the community actually had, weighted by engagement.
3. **Review:** Reviewer 1, 2 and 3 are each the synthesized voice of one cluster. They write an ICLR-style review that cites the real reactions inline, and the site links each citation to the original comment or post.
4. **Area Chair:** a separate LLM call weighs the three reviews' arguments and writes the meta-review and decision.

## Setup

```bash
npm install
cp .env.example .env   # add ANTHROPIC_API_KEY (or OPENAI_API_KEY with LLM_PROVIDER=openai)
```

## Generate reviews

```bash
npm run gather                      # collect reactions for posts without them (data/reactions/)
npm run review                      # cluster + review + meta-review for posts without reviews
npm run review -- --id ai-2027      # one post
npm run review -- --force           # regenerate everything
```

Configure models with `LLM_PROVIDER` (`anthropic` | `openai`), `REVIEWER_MODEL`, and `AC_MODEL`. The clustering step uses `AC_MODEL`.

### Without an API key

You can run the same three steps by hand, e.g. with Claude Code. Write the clustering, the three reviews and the meta-review to `data/manual/<id>.json`, then run:

```bash
npm run assemble -- --id <id>
```

`assemble` builds the review file with the pipeline's own code. It checks that every cited reaction ID exists and that each reviewer only cites its own cluster. The current reviews were made this way.

## Discover viral posts automatically

```bash
npm run discover                    # add up to 5 new posts
npm run discover -- --review        # ...and gather reactions + generate reviews
npm run discover -- --dry-run       # show what would be added
```

Discovery pulls Hacker News stories from the last `--days` (default 14) with at least `--min-points` (default 300). It ranks them by points, then comments, and adds the top `--limit` (default 5) that pass these filters:

- The title looks AI-related.
- The link is a fetchable blog-style page, not a news outlet, social site, PDF, release page or Show/Ask HN.
- The page has at least 1,500 characters of article text.
- With an API key set, an LLM also confirms it is a reviewable AI post and writes the keywords, TL;DR and authors.

Article text is extracted with Mozilla Readability. Hacker News points and comments are saved on the post and shown on the site.

X/Twitter isn't used. Its pages can't be fetched without the paid API, and the posts that go viral there almost always link to a blog post that HN also picks up.

## Add a post by link

```bash
npm run add -- <url> --keywords "a, b" --tldr "One-sentence claim."
npm run add -- <blog-url> --tweet <x-url>             # also gather reactions to the viral tweet
npm run add -- <x-url> --text-file tweet.txt          # tweet only: X can't be fetched, so supply the text
```

`add` fetches the page, extracts the title, authors, date and article text, and looks up the Hacker News stats, without using an LLM. Then run `npm run gather -- --id <id>` and write the reviews.

In Claude Code, just paste a link and ask for a review. The project skill in `.claude/skills/review-post/` walks Claude through adding, gathering, writing the reviews by hand, and validating them.

## Run the site

```bash
npm run dev
```

The UI follows OpenReview's layout and palette. All CSS is written for this project in `src/app/globals.css`.

## Hosting

The site is a static export (`npm run build` writes `out/`). The forum page reads `?id=` in the browser and loads `public/data/<id>.json`. Those files are generated from `data/` by `npm run data`, which runs automatically before `dev` and `build` and after `assemble`.

**GitHub Pages:**
1. Push to `main`.
2. In the repo's Settings → Pages, set Source to "GitHub Actions".
3. `.github/workflows/deploy.yml` builds and deploys on every push, and sets `BASE_PATH` to `/<repo>` for project sites automatically.

**Elsewhere** (Cloudflare Pages, Netlify): build command `npm run build`, output directory `out`. Set `BASE_PATH` only if the site isn't served from the domain root.
