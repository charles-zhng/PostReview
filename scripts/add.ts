// Adds one post by URL, without any LLM. Keywords and TL;DR can be passed in
// (e.g. written by Claude in a Claude Code session) or filled in later.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { fetchPage, slugify, toPost } from "../src/lib/ingest";
import { PostSchema, type Post } from "../src/lib/schemas";

const args = process.argv.slice(2);
const opt = (name: string) =>
  args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined;
const url = args.find(
  (a, i) => !a.startsWith("--") && (i === 0 || !args[i - 1].startsWith("--")),
);

const USAGE = `Usage: npm run add -- <url> [options]
  --tweet <x-url>        the tweet that made the post go viral (stored for reaction gathering)
  --text-file <path>     post text, required when <url> is a tweet (X can't be fetched)
  --title, --author "A, B", --date YYYY-MM-DD, --keywords "a, b", --tldr "...", --id <slug>`;

const TWEET = /(?:x|twitter)\.com\/([^/]+)\/status\/(\d+)/;

// Tweet IDs are snowflakes: the top bits are milliseconds since 2010-11-04.
function tweetDate(id: string): string {
  return new Date(Number(BigInt(id) >> BigInt(22)) + 1288834974657)
    .toISOString()
    .slice(0, 10);
}

function bare(u: string): string {
  const x = new URL(u);
  return `${x.hostname.replace(/^www\./, "")}${x.pathname.replace(/\/$/, "")}`;
}

async function hnStats(targets: string[]): Promise<Post["discovery"]> {
  let best:
    { objectID: string; points: number; num_comments?: number } | undefined;
  for (const t of targets) {
    const query = t.match(TWEET)?.[2] ?? bare(t);
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search?${new URLSearchParams({ query, tags: "story", restrictSearchableAttributes: "url" })}`,
    );
    if (!res.ok) continue;
    const { hits } = (await res.json()) as {
      hits: {
        objectID: string;
        url?: string;
        points: number;
        num_comments?: number;
      }[];
    };
    for (const h of hits) {
      if (
        h.url &&
        (h.url.match(TWEET)?.[2] ?? bare(h.url)) === query &&
        (!best || h.points > best.points)
      )
        best = h;
    }
  }
  return best
    ? {
        source: "Hacker News",
        points: best.points,
        comments: best.num_comments ?? 0,
        discussionUrl: `https://news.ycombinator.com/item?id=${best.objectID}`,
        discoveredAt: new Date().toISOString(),
      }
    : undefined;
}

async function main() {
  if (!url) {
    console.error(USAGE);
    process.exit(1);
  }
  const postsPath = join("data", "posts.json");
  const posts = z
    .array(PostSchema)
    .parse(JSON.parse(readFileSync(postsPath, "utf8")));
  if (posts.some((p) => bare(p.url) === bare(url)))
    throw new Error(`Already added: ${url}`);

  const number = Math.max(0, ...posts.map((p) => p.number)) + 1;
  const tweet = url.match(TWEET);
  let post: Post;
  if (tweet) {
    const file = opt("text-file");
    if (!file)
      throw new Error(
        "X can't be fetched: pass the tweet's text with --text-file <path>\n" +
          USAGE,
      );
    const text = readFileSync(file, "utf8").trim();
    const title =
      opt("title") ?? text.split(/(?<=[.!?])\s|\n/)[0].slice(0, 120);
    post = {
      id: opt("id") ?? slugify(title),
      number,
      title,
      authors: opt("author")?.split(/,\s*/) ?? [`@${tweet[1]}`],
      handle: `@${tweet[1]}`,
      url,
      date: opt("date") ?? tweetDate(tweet[2]),
      source: text.length > 280 ? "X thread" : "Tweet",
      keywords: [],
      tldr: "",
      text,
    };
  } else {
    const page = await fetchPage(url);
    post = toPost(page, {}, { id: opt("id") ?? slugify(page.title), number });
    if (opt("title")) post.title = opt("title")!;
    if (opt("author")) post.authors = opt("author")!.split(/,\s*/);
    if (opt("date")) post.date = opt("date")!;
  }
  if (opt("tweet")) post.tweetUrl = opt("tweet");
  if (opt("keywords")) post.keywords = opt("keywords")!.split(/,\s*/);
  if (opt("tldr")) post.tldr = opt("tldr")!;
  if (posts.some((p) => p.id === post.id)) post.id = `${post.id}-${number}`;

  const stats = await hnStats([
    post.url,
    ...(post.tweetUrl ? [post.tweetUrl] : []),
  ]);
  if (stats) post.discovery = stats;

  posts.push(PostSchema.parse(post));
  writeFileSync(postsPath, JSON.stringify(posts, null, 2) + "\n");
  console.log(`Added #${post.number} ${post.id}`);
  console.log(
    `  ${post.title} | ${post.authors.join(", ")} | ${post.date} | ${post.text.length} chars`,
  );
  console.log(
    `  HN: ${stats ? `${stats.points} points, ${stats.comments} comments` : "no thread found"}`,
  );
  if (!post.keywords.length || !post.tldr)
    console.log("  Missing keywords/TL;DR: fill them in data/posts.json.");
  console.log(`Next: npm run gather -- --id ${post.id}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
