import * as cheerio from "cheerio";
import { fetchPage } from "./ingest";
import type { Post } from "./schemas";
import { isAiRelated } from "./topics";

export type Reaction = {
  id: string;
  source: "Hacker News" | "Bluesky" | "Response post";
  kind: "comment" | "reply" | "post" | "quote" | "response";
  author: string;
  text: string;
  url: string;
  // Points, likes+reposts+quotes, or replies: whatever the source exposes.
  engagement: number;
  date: string;
  context?: string;
};

export type Thread = {
  source: string;
  title: string;
  url: string;
  points: number;
  comments: number;
};

export type ReactionFile = {
  postId: string;
  gatheredAt: string;
  threads: Thread[];
  reactions: Reaction[];
};

const MAX_TEXT = 1500;
// Response posts are few per submission and carry their argument past the intro.
const RESPONSE_MAX_TEXT = 20000;
const UA = { "User-Agent": "Mozilla/5.0 (compatible; PostReview/0.1)" };

async function json<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: UA });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

async function pool<T, R>(
  items: T[],
  n: number,
  fn: (t: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

function htmlToText(html: string): string {
  const $ = cheerio.load(html.replace(/<p>/g, "\n\n<p>"));
  return $.root()
    .text()
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clip(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
}

function bareUrl(u: string): string {
  const url = new URL(u);
  return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
}

// Tweets are submitted as both x.com and twitter.com URLs, so compare status IDs.
const tweetId = (u: string) =>
  u.match(/(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/)?.[1];

function sameTarget(a: string, b: string): boolean {
  const ta = tweetId(a);
  return ta ? ta === tweetId(b) : bareUrl(a) === bareUrl(b);
}

// ---------- Hacker News ----------

type HnItem = {
  id: number;
  by?: string;
  text?: string;
  time: number;
  kids?: number[];
  dead?: boolean;
  deleted?: boolean;
  descendants?: number;
};
type HnHit = {
  objectID: string;
  title: string;
  url?: string | null;
  points: number;
  num_comments?: number;
};

const HN_ITEM = (id: number | string) =>
  `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
const HN_LINK = (id: number | string) =>
  `https://news.ycombinator.com/item?id=${id}`;

async function hnSearch(params: Record<string, string>): Promise<HnHit[]> {
  const res = await json<{ hits: HnHit[] }>(
    `https://hn.algolia.com/api/v1/search?${new URLSearchParams({ tags: "story", ...params })}`,
  );
  return res?.hits ?? [];
}

// Top-level comments in HN's ranked order, plus the top replies under the leading ones.
async function hnComments(
  storyId: string,
  context: string,
  topLevel: number,
  withReplies: number,
): Promise<Reaction[]> {
  const story = await json<HnItem>(HN_ITEM(storyId));
  const kids = (story?.kids ?? []).slice(0, topLevel);
  const items = await pool(kids, 8, (id) => json<HnItem>(HN_ITEM(id)));
  const out: Reaction[] = [];
  const toReaction = (
    c: HnItem,
    kind: Reaction["kind"],
    ctx: string,
  ): Reaction => ({
    id: `hn-${c.id}`,
    source: "Hacker News",
    kind,
    author: c.by ?? "anonymous",
    text: clip(htmlToText(c.text ?? "")),
    url: HN_LINK(c.id),
    engagement: c.kids?.length ?? 0,
    date: new Date(c.time * 1000).toISOString(),
    context: ctx,
  });
  const live = items.filter((c): c is HnItem =>
    Boolean(c && !c.dead && !c.deleted && c.text),
  );
  live.forEach((c, rank) =>
    out.push({
      ...toReaction(c, "comment", context),
      context: `${context}, top-level comment #${rank + 1}`,
    }),
  );
  const replyIds = live
    .slice(0, withReplies)
    .flatMap((c) =>
      (c.kids ?? []).slice(0, 2).map((id) => ({ id, parent: c })),
    );
  const replies = await pool(replyIds, 8, async ({ id, parent }) => ({
    item: await json<HnItem>(HN_ITEM(id)),
    parent,
  }));
  for (const { item, parent } of replies) {
    if (item && !item.dead && !item.deleted && item.text) {
      out.push(
        toReaction(
          item,
          "reply",
          `${context}, reply to ${parent.by}: "${htmlToText(parent.text ?? "").slice(0, 120)}…"`,
        ),
      );
    }
  }
  return out;
}

async function hackerNews(post: Post, threads: Thread[]): Promise<Reaction[]> {
  const bare = bareUrl(post.url);
  const targets = [post.url, ...(post.tweetUrl ? [post.tweetUrl] : [])];
  const hits = (
    await Promise.all(
      targets.map((t) =>
        hnSearch({
          query: tweetId(t) ?? bareUrl(t),
          restrictSearchableAttributes: "url",
        }),
      ),
    )
  ).flat();
  const stories = [...new Map(hits.map((h) => [h.objectID, h])).values()]
    .filter(
      (h) =>
        h.url &&
        targets.some((t) => sameTarget(h.url!, t)) &&
        (h.num_comments ?? 0) >= 5,
    )
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  const out: Reaction[] = [];
  for (const [i, s] of stories.entries()) {
    threads.push({
      source: "Hacker News",
      title: s.title,
      url: HN_LINK(s.objectID),
      points: s.points,
      comments: s.num_comments ?? 0,
    });
    out.push(
      ...(await hnComments(
        s.objectID,
        `HN thread "${s.title}"`,
        i === 0 ? 40 : 15,
        i === 0 ? 12 : 4,
      )),
    );
  }

  // Response posts: later HN stories whose title names the original post or its HN title.
  const names = [post.title, ...stories.map((s) => s.title)].map((t) =>
    t.toLowerCase(),
  );
  const seen = new Set<string>([bare]);
  for (const name of names.slice(0, 2)) {
    for (const h of await hnSearch({ query: name.slice(0, 80) })) {
      if (!h.url || h.points < 30 || seen.has(bareUrl(h.url))) continue;
      const t = h.title.toLowerCase();
      if (!names.some((n) => t.includes(n.slice(0, 30)))) continue;
      seen.add(bareUrl(h.url));
      threads.push({
        source: "Hacker News",
        title: h.title,
        url: HN_LINK(h.objectID),
        points: h.points,
        comments: h.num_comments ?? 0,
      });
      try {
        const page = await fetchPage(h.url);
        out.push({
          id: `resp-${h.objectID}`,
          source: "Response post",
          kind: "response",
          author: page.authors.join(", ") || new URL(h.url).hostname,
          text: page.text.slice(0, RESPONSE_MAX_TEXT),
          url: h.url,
          engagement: h.points,
          date: page.date ?? new Date().toISOString(),
          context: `Response post "${page.title}"`,
        });
      } catch {
        // Unfetchable response; its HN comments below still count.
      }
      out.push(
        ...(await hnComments(
          h.objectID,
          `HN thread on response "${h.title}"`,
          12,
          3,
        )),
      );
    }
  }
  return out;
}

// ---------- Bluesky ----------

type BskyPost = {
  uri: string;
  author: { handle: string; displayName?: string };
  record: {
    text: string;
    createdAt: string;
    facets?: { features: { uri?: string }[] }[];
  };
  embed?: { external?: { uri: string }; record?: { uri?: string } };
  likeCount?: number;
  repostCount?: number;
  quoteCount?: number;
  replyCount?: number;
};

const BSKY = "https://api.bsky.app/xrpc";
const bskyUrl = (p: BskyPost) =>
  `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split("/").pop()}`;
const bskyEngagement = (p: BskyPost) =>
  (p.likeCount ?? 0) + (p.repostCount ?? 0) + (p.quoteCount ?? 0);

function linksTo(p: BskyPost, bare: string): boolean {
  const uris = [
    p.embed?.external?.uri,
    ...(p.record.facets ?? []).flatMap((f) => f.features.map((x) => x.uri)),
  ];
  return uris.some((u) => {
    try {
      return u ? bareUrl(u) === bare : false;
    } catch {
      return false;
    }
  });
}

function bskyReaction(
  p: BskyPost,
  kind: Reaction["kind"],
  context: string,
): Reaction {
  return {
    id: `bsky-${p.uri.split("/").pop()}`,
    source: "Bluesky",
    kind,
    author: p.author.displayName
      ? `${p.author.displayName} (@${p.author.handle})`
      : `@${p.author.handle}`,
    text: clip(p.record.text),
    url: bskyUrl(p),
    engagement: bskyEngagement(p),
    date: p.record.createdAt,
    context,
  };
}

const PHRASE_WINDOW_DAYS = 90;

// A post that only shares the title phrase (no link) often means something else entirely:
// "situational awareness" for pilots, "machines of loving grace" for the Brautigan poem.
// Keep it only if it names an author, or is AI-related and posted soon after the submission.
function phraseMatchIsAboutPost(p: BskyPost, post: Post): boolean {
  if (post.title.split(" ").length < 4) return false;
  const text = p.record.text.toLowerCase();
  const surnames = post.authors
    .map((a) => a.split(" ").pop()!.toLowerCase())
    .filter((s) => s.length > 2);
  const handle = post.handle?.replace(/^@/, "").toLowerCase();
  if (
    surnames.some((s) => text.includes(s)) ||
    (handle && text.includes(handle))
  )
    return true;
  const days =
    (Date.parse(p.record.createdAt) - Date.parse(post.date)) / 86_400_000;
  return days >= -2 && days <= PHRASE_WINDOW_DAYS && isAiRelated(p.record.text);
}

async function bluesky(post: Post): Promise<Reaction[]> {
  const bare = bareUrl(post.url);
  const host = new URL(post.url).hostname.replace(/^www\./, "");
  const tweet = post.tweetUrl;
  const queries = [bare, `"${post.title.split(/[:|–-]/)[0].trim()}"`];
  // A personal site's domain is specific enough to search on its own.
  if (
    host.split(".").length > 2 ||
    /github\.io|substack|bearblog|medium/.test(host)
  )
    queries.push(host);

  const found = new Map<string, BskyPost>();
  for (const q of queries) {
    const res = await json<{ posts: BskyPost[] }>(
      `${BSKY}/app.bsky.feed.searchPosts?${new URLSearchParams({ q, sort: "top", limit: "50" })}`,
    );
    for (const p of res?.posts ?? []) {
      const phraseQuery = q.startsWith('"');
      const linked =
        linksTo(p, bare) || (tweet ? linksTo(p, bareUrl(tweet)) : false);
      if (linked || (phraseQuery && phraseMatchIsAboutPost(p, post)))
        found.set(p.uri, p);
    }
  }
  const posts = [...found.values()]
    .sort((a, b) => bskyEngagement(b) - bskyEngagement(a))
    .slice(0, 30);
  const out = posts.map((p) =>
    bskyReaction(p, "post", "Bluesky post sharing the submission"),
  );

  // Replies and quote posts under the most-engaged shares.
  for (const p of posts.slice(0, 3)) {
    const ctx = `on ${p.author.handle}'s post: "${p.record.text.slice(0, 100)}…"`;
    const thread = await json<{ thread: { replies?: { post?: BskyPost }[] } }>(
      `${BSKY}/app.bsky.feed.getPostThread?${new URLSearchParams({ uri: p.uri, depth: "1" })}`,
    );
    const replies = (thread?.thread.replies ?? []).flatMap((r) =>
      r.post ? [r.post] : [],
    );
    replies.sort((a, b) => bskyEngagement(b) - bskyEngagement(a));
    out.push(
      ...replies
        .slice(0, 12)
        .map((r) => bskyReaction(r, "reply", `Reply ${ctx}`)),
    );
    const quotes = await json<{ posts: BskyPost[] }>(
      `${BSKY}/app.bsky.feed.getQuotes?${new URLSearchParams({ uri: p.uri, limit: "50" })}`,
    );
    const qs = (quotes?.posts ?? []).sort(
      (a, b) => bskyEngagement(b) - bskyEngagement(a),
    );
    out.push(
      ...qs
        .slice(0, 12)
        .map((r) => bskyReaction(r, "quote", `Quote post ${ctx}`)),
    );
  }
  return out;
}

export async function gatherReactions(post: Post): Promise<ReactionFile> {
  const threads: Thread[] = [];
  const [hn, bsky] = await Promise.all([
    hackerNews(post, threads),
    bluesky(post),
  ]);
  const seen = new Set<string>();
  const reactions = [...hn, ...bsky].filter(
    (r) => r.text.trim() && !seen.has(r.id) && seen.add(r.id),
  );
  return {
    postId: post.id,
    gatheredAt: new Date().toISOString(),
    threads,
    reactions,
  };
}
