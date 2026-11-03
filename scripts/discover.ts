import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  enrich,
  fetchPage,
  llmAvailable,
  slugify,
  toPost,
  type Enrichment,
} from "../src/lib/ingest";
import { reviewPost } from "../src/lib/pipeline";
import { gatherReactions } from "../src/lib/reactions";
import { PostSchema, type Post } from "../src/lib/schemas";
import { isAiRelated } from "../src/lib/topics";

function flag(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}
const DAYS = flag("days", 14);
const MIN_POINTS = flag("min-points", 300);
const LIMIT = flag("limit", 5);
const DRY_RUN = process.argv.includes("--dry-run");
const REVIEW = process.argv.includes("--review");
const MIN_TEXT = 1500;

// News outlets, social networks and filings: not blog posts, or not fetchable.
const BLOCKED_HOSTS = [
  "nytimes.com",
  "wsj.com",
  "ft.com",
  "bloomberg.com",
  "reuters.com",
  "cnbc.com",
  "theverge.com",
  "wired.com",
  "arstechnica.com",
  "techcrunch.com",
  "theguardian.com",
  "bbc.co.uk",
  "bbc.com",
  "washingtonpost.com",
  "404media.co",
  "seattletimes.com",
  "axios.com",
  "businessinsider.com",
  "science.org",
  "nature.com",
  "smithsonianmag.com",
  "sec.gov",
  "x.com",
  "twitter.com",
  "youtube.com",
  "reddit.com",
  "news.ycombinator.com",
  "bsky.app",
  "linkedin.com",
  "apple.com",
];

const HitSchema = z.object({
  objectID: z.string(),
  title: z.string(),
  url: z.string().nullish(),
  points: z.number(),
  num_comments: z.number().nullish(),
  created_at: z.string(),
});
type Hit = z.infer<typeof HitSchema>;

function normalizeUrl(u: string): string {
  const url = new URL(u);
  url.hash = "";
  url.search = "";
  return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
}

function heuristicReject(hit: Hit): string | null {
  if (!isAiRelated(hit.title)) return "not AI-related";
  if (!hit.url) return "no link (Ask/Tell HN)";
  if (/^(Show|Ask|Tell|Launch) HN\b/i.test(hit.title)) return "Show/Ask HN";
  const url = new URL(hit.url);
  const host = url.hostname.replace(/^www\./, "");
  if (BLOCKED_HOSTS.some((b) => host === b || host.endsWith(`.${b}`)))
    return `blocked host ${host}`;
  if (url.pathname === "/" || url.pathname === "")
    return "homepage, not a post";
  if (/\.pdf$/i.test(url.pathname) || /\/releases\/tag\//.test(url.pathname))
    return "pdf or release page";
  return null;
}

async function fetchHits(): Promise<Hit[]> {
  const since = Math.floor(Date.now() / 1000) - DAYS * 86400;
  const params = new URLSearchParams({
    tags: "story",
    numericFilters: `created_at_i>${since},points>=${MIN_POINTS}`,
    hitsPerPage: "1000",
  });
  const res = await fetch(`https://hn.algolia.com/api/v1/search?${params}`);
  if (!res.ok) throw new Error(`HN search failed: HTTP ${res.status}`);
  const { hits } = (await res.json()) as { hits: unknown[] };
  // Rank by points, then comments: both measure how widely a post spread.
  return z
    .array(HitSchema)
    .parse(hits)
    .sort(
      (a, b) =>
        b.points - a.points || (b.num_comments ?? 0) - (a.num_comments ?? 0),
    );
}

async function main() {
  const postsPath = join("data", "posts.json");
  const posts = z
    .array(PostSchema)
    .parse(JSON.parse(readFileSync(postsPath, "utf8")));
  const known = new Set(posts.map((p) => normalizeUrl(p.url)));
  const useLlm = llmAvailable();

  const hits = await fetchHits();
  console.log(
    `${hits.length} HN stories with >=${MIN_POINTS} points in the last ${DAYS} days. LLM check: ${useLlm ? "on" : "off (no API key)"}`,
  );

  const added: Post[] = [];
  for (const hit of hits) {
    if (added.length >= LIMIT) break;
    const label = `${String(hit.points).padStart(5)} pts | ${hit.title.slice(0, 70)}`;
    const reason = heuristicReject(hit);
    if (reason) {
      if (reason !== "not AI-related")
        console.log(`  skip  ${label}  (${reason})`);
      continue;
    }
    if (known.has(normalizeUrl(hit.url!))) {
      console.log(`  skip  ${label}  (already added)`);
      continue;
    }

    let page;
    try {
      page = await fetchPage(hit.url!);
    } catch (err) {
      console.log(`  skip  ${label}  (${(err as Error).message})`);
      continue;
    }
    if (page.text.length < MIN_TEXT) {
      console.log(`  skip  ${label}  (only ${page.text.length} chars of text)`);
      continue;
    }

    let meta: Partial<Enrichment> = {};
    if (useLlm) {
      meta = await enrich(page);
      if (!meta.is_reviewable) {
        console.log(`  skip  ${label}  (LLM: not a reviewable AI post)`);
        continue;
      }
    }

    const number = Math.max(0, ...posts.map((p) => p.number)) + 1;
    let id = slugify(page.title) || `post-${number}`;
    if (posts.some((p) => p.id === id)) id = `${id}-${number}`;
    const post = toPost(page, meta, {
      id,
      number,
      discovery: {
        source: "Hacker News",
        points: hit.points,
        comments: hit.num_comments ?? 0,
        discussionUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        discoveredAt: new Date().toISOString(),
      },
    });
    posts.push(post);
    known.add(normalizeUrl(post.url));
    added.push(post);
    console.log(`  ADD   ${label}  -> ${id} (${post.authors.join(", ")})`);
  }

  if (added.length === 0) {
    console.log("Nothing new to add.");
    return;
  }
  if (DRY_RUN) {
    console.log(`Dry run: would add ${added.length} post(s).`);
    return;
  }
  writeFileSync(postsPath, JSON.stringify(posts, null, 2) + "\n");
  console.log(`Added ${added.length} post(s) to ${postsPath}.`);

  if (REVIEW) {
    for (const post of added) {
      console.log(`reviewing ${post.id}...`);
      const reactions = await gatherReactions(post);
      writeFileSync(
        join("data", "reactions", `${post.id}.json`),
        JSON.stringify(reactions, null, 2) + "\n",
      );
      const result = await reviewPost(post, reactions);
      writeFileSync(
        join("data", "reviews", `${post.id}.json`),
        JSON.stringify(result, null, 2) + "\n",
      );
      console.log(
        `  ${result.reviews.map((r) => r.rating).join("/")} -> ${result.metaReview.decision}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
