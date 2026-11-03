import { generateObject } from "ai";
import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { parseHTML } from "linkedom";
import { z } from "zod";
import { getModel } from "./llm";
import type { Post } from "./schemas";

const MAX_TEXT = 30000;

export type Extracted = {
  url: string;
  title: string;
  authors: string[];
  date: string | null;
  description: string | null;
  text: string;
};

// "Takehi, Rikiya" -> "Rikiya Takehi" (citation_author style).
function normalizeName(name: string): string {
  const parts = name.split(",").map((s) => s.trim());
  return parts.length === 2 && parts[1]
    ? `${parts[1]} ${parts[0]}`
    : name.trim();
}

function jsonLdAuthors($: cheerio.CheerioAPI): string[] {
  const names: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      for (const node of [
        data,
        ...(Array.isArray(data["@graph"]) ? data["@graph"] : []),
      ]) {
        const author = node?.author;
        for (const a of Array.isArray(author)
          ? author
          : author
            ? [author]
            : []) {
          if (typeof a === "string") names.push(a);
          else if (a?.name) names.push(a.name);
        }
      }
    } catch {
      // Malformed JSON-LD is common; other sources cover it.
    }
  });
  return names;
}

// Main article body as light markdown: Readability strips page chrome,
// then block elements become paragraphs, headings and bullets.
function articleMarkdown(html: string): string {
  const { document } = parseHTML(html);
  const article = new Readability(document as unknown as Document).parse();
  const $ = cheerio.load(article?.content ?? "");
  const blocks: string[] = [];
  $("p, h1, h2, h3, h4, h5, li, pre, blockquote").each((_, el) => {
    // Skip blocks nested in another collected block (e.g. <p> inside <li>).
    if ($(el).parents("p, li, pre, blockquote").length) return;
    const tag = el.tagName.toLowerCase();
    const raw =
      tag === "pre" ? $(el).text() : $(el).text().replace(/\s+/g, " ");
    const t = raw.trim();
    if (!t) return;
    if (/^h[1-5]$/.test(tag)) blocks.push(`**${t}**`);
    else if (tag === "li") blocks.push(`- ${t}`);
    else if (tag === "pre") blocks.push("```\n" + t + "\n```");
    else if (tag === "blockquote") blocks.push(`> ${t}`);
    else blocks.push(t);
  });
  // Join consecutive list items with single newlines so they render as one list.
  return blocks.reduce((out, b, i) => {
    if (i === 0) return b;
    const sep =
      b.startsWith("- ") && blocks[i - 1].startsWith("- ") ? "\n" : "\n\n";
    return out + sep + b;
  }, "");
}

// Sites that render posts client-side, mapped to server-rendered mirrors.
function fetchableUrl(url: string): string {
  const u = new URL(url);
  if (/(^|\.)lesswrong\.com$/.test(u.hostname))
    u.hostname = "www.greaterwrong.com";
  return u.toString();
}

const MIN_EXTRACTED = 300;

// "Post title · example.com" / "Post title | Site Name" -> "Post title".
function stripSiteName(title: string, siteNames: (string | null)[]): string {
  for (const name of siteNames) {
    if (!name) continue;
    const m = title.match(/^(.+?)\s+[|·•—–-]\s+(.+)$/);
    if (m && m[2].trim().toLowerCase() === name.toLowerCase())
      return m[1].trim();
  }
  return title;
}

export async function fetchPage(url: string): Promise<Extracted> {
  const res = await fetch(fetchableUrl(url), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PostReview/0.1)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html"))
    throw new Error(`Not an HTML page (${type}): ${url}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const meta = (sel: string) => $(sel).attr("content")?.trim() || null;

  const title = stripSiteName(
    meta('meta[property="og:title"]') ?? $("title").first().text().trim(),
    [
      meta('meta[property="og:site_name"]'),
      new URL(url).hostname.replace(/^www\./, ""),
    ],
  );
  const metaAuthors = $(
    'meta[name="citation_author"], meta[name="author"], meta[property="article:author"]',
  )
    .map((_, el) => $(el).attr("content") ?? "")
    .get()
    .filter((a) => a && !a.startsWith("http"));
  const authors = [
    ...new Set([...metaAuthors, ...jsonLdAuthors($)].map(normalizeName)),
  ];
  const date =
    meta('meta[property="article:published_time"]') ??
    meta('meta[name="citation_publication_date"]') ??
    $("time[datetime]").first().attr("datetime") ??
    null;

  const text = articleMarkdown(html).slice(0, MAX_TEXT);
  // Client-rendered pages come back as an empty shell; better no text than junk.
  if (text.length < MIN_EXTRACTED)
    throw new Error(`No article text extracted from ${url}`);

  return {
    url,
    title,
    authors,
    date,
    description:
      meta('meta[property="og:description"]') ??
      meta('meta[name="description"]'),
    text,
  };
}

const EnrichSchema = z.object({
  is_reviewable: z
    .boolean()
    .describe(
      "True if this is an AI/ML blog post, essay, research write-up or technical announcement with real claims to review. False for news reports, product pages, job posts, or non-AI topics.",
    ),
  authors: z
    .array(z.string())
    .describe("Author names as written in the post. Empty if unknown."),
  keywords: z.array(z.string()).describe("3-6 short lowercase keywords."),
  tldr: z
    .string()
    .describe(
      "One-sentence TL;DR of the post's main claim, in the style of an OpenReview TL;DR.",
    ),
});

export type Enrichment = z.infer<typeof EnrichSchema>;

export function llmAvailable(): boolean {
  const provider = process.env.LLM_PROVIDER ?? "anthropic";
  return Boolean(
    provider === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY,
  );
}

export async function enrich(page: Extracted): Promise<Enrichment> {
  const { object } = await generateObject({
    model: getModel("reviewer"),
    schema: EnrichSchema,
    schemaName: "post_metadata",
    prompt: `Title: ${page.title}\nURL: ${page.url}\nKnown authors: ${page.authors.join(", ") || "unknown"}\n\n${page.text.slice(0, 12000)}`,
  });
  return object;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 6)
    .join("-");
}

export function toPost(
  page: Extracted,
  meta: Partial<Enrichment>,
  extra: Pick<Post, "id" | "number"> & Partial<Pick<Post, "discovery">>,
): Post {
  const authors = page.authors.length
    ? page.authors
    : meta.authors?.length
      ? meta.authors
      : [new URL(page.url).hostname];
  return {
    ...extra,
    title: page.title,
    authors,
    url: page.url,
    date: (page.date ? new Date(page.date) : new Date())
      .toISOString()
      .slice(0, 10),
    source: "Blog post",
    keywords: meta.keywords ?? [],
    tldr: meta.tldr ?? page.description ?? "",
    text: page.text,
  };
}
