import { generateObject } from "ai";
import { getModel, modelId } from "./llm";
import { AREA_CHAIR_SYSTEM, CLUSTER_SYSTEM, reviewerSystem } from "./personas";
import type { Reaction, ReactionFile } from "./reactions";
import {
  ClusteringSchema,
  MetaReviewSchema,
  ReviewSchema,
  snapRating,
  type CitedReaction,
  type Clustering,
  type Post,
  type ReviewFile,
  type StoredReview,
} from "./schemas";

export function submissionText(post: Post): string {
  return [
    `Submission${post.number}: ${post.title}`,
    `Authors: ${post.authors.join(", ")}${post.handle ? ` (${post.handle})` : ""}`,
    `Format: ${post.source}, posted ${post.date}`,
    `URL: ${post.url}`,
    `Keywords: ${post.keywords.join(", ")}`,
    "",
    "--- Full text ---",
    post.text,
  ].join("\n");
}

export function reactionLine(r: Reaction): string {
  return `[${r.id}] (${r.source} ${r.kind}, engagement ${r.engagement}${r.context ? `, ${r.context}` : ""}) ${r.author}: ${r.text.replace(/\s+/g, " ")}`;
}

function cite(r: Reaction): CitedReaction {
  const excerpt = r.text.replace(/\s+/g, " ").trim();
  return {
    id: r.id,
    source: r.source,
    author: r.author,
    url: r.url,
    excerpt: excerpt.length > 280 ? `${excerpt.slice(0, 280)}…` : excerpt,
    engagement: r.engagement,
  };
}

const CITATION = /\[((?:hn|bsky|resp)-[\w-]+)\]/g;

export function citationsIn(
  texts: string[],
  byId: Map<string, Reaction>,
): Record<string, CitedReaction> {
  const out: Record<string, CitedReaction> = {};
  for (const t of texts) {
    for (const [, id] of t.matchAll(CITATION)) {
      const r = byId.get(id);
      if (r) out[id] = cite(r);
    }
  }
  return out;
}

export function reactionStats(file: ReactionFile): ReviewFile["reactions"] {
  const bySource: Record<string, number> = {};
  for (const r of file.reactions)
    bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  return { total: file.reactions.length, bySource, threads: file.threads };
}

// Builds the stored review from a reviewer's output and its cluster; shared with hand-run reviews.
export function storeReview(
  n: number,
  cluster: Clustering["clusters"][number],
  review: Omit<StoredReview, "reviewer" | "cluster" | "citations" | "date">,
  file: ReactionFile,
  date: string,
): StoredReview {
  const byId = new Map(file.reactions.map((r) => [r.id, r]));
  const members = cluster.reaction_ids.filter((id) => byId.has(id));
  return {
    ...review,
    rating: snapRating(review.rating),
    reviewer: n,
    cluster: {
      label: cluster.label,
      summary: cluster.summary,
      stance: cluster.stance,
      size: members.length,
      total: file.reactions.length,
      representative: cluster.representative_ids.flatMap((id) =>
        byId.has(id) ? [cite(byId.get(id)!)] : [],
      ),
    },
    citations: citationsIn(
      [review.summary, review.strengths, review.weaknesses, review.questions],
      byId,
    ),
    date,
  };
}

export async function reviewPost(
  post: Post,
  file: ReactionFile,
): Promise<ReviewFile> {
  if (file.reactions.length === 0)
    throw new Error(
      `No reactions gathered for ${post.id}; run npm run gather first`,
    );
  const submission = submissionText(post);
  const byId = new Map(file.reactions.map((r) => [r.id, r]));
  const allReactions = file.reactions.map(reactionLine).join("\n");

  const { object: clustering } = await generateObject({
    model: getModel("areaChair"),
    schema: ClusteringSchema,
    schemaName: "reaction_clusters",
    system: CLUSTER_SYSTEM,
    prompt: `${submission}\n\n--- Community reactions (${file.reactions.length}) ---\n${allReactions}`,
  });

  const reviews = await Promise.all(
    clustering.clusters.map(async (cluster, i): Promise<StoredReview> => {
      const members = cluster.reaction_ids.flatMap((id) =>
        byId.has(id) ? [byId.get(id)!] : [],
      );
      const { object } = await generateObject({
        model: getModel("reviewer"),
        schema: ReviewSchema,
        schemaName: "official_review",
        system: reviewerSystem(i + 1, cluster),
        prompt: `${submission}\n\n--- Reactions in your cluster (${members.length} of ${file.reactions.length}) ---\n${members.map(reactionLine).join("\n")}\n\nWrite your official review.`,
      });
      return storeReview(
        i + 1,
        cluster,
        object,
        file,
        new Date().toISOString(),
      );
    }),
  );

  const reviewsText = reviews
    .map(
      (
        r,
      ) => `### Official Review by Reviewer ${r.reviewer} (cluster "${r.cluster.label}", ${r.cluster.size} of ${r.cluster.total} reactions)
Summary: ${r.summary}
Strengths:
${r.strengths}
Weaknesses:
${r.weaknesses}
Questions:
${r.questions}
Soundness ${r.soundness}/4, Presentation ${r.presentation}/4, Contribution ${r.contribution}/4, Rating ${r.rating}/10, Confidence ${r.confidence}/5`,
    )
    .join("\n\n");

  const { object: meta } = await generateObject({
    model: getModel("areaChair"),
    schema: MetaReviewSchema,
    schemaName: "meta_review",
    system: AREA_CHAIR_SYSTEM,
    prompt: `${submission}\n\n--- Official reviews ---\n\n${reviewsText}\n\nWrite your meta-review and decision.`,
  });

  return {
    postId: post.id,
    generatedAt: new Date().toISOString(),
    models: { reviewer: modelId("reviewer"), areaChair: modelId("areaChair") },
    reactions: reactionStats(file),
    reviews,
    metaReview: {
      ...meta,
      date: new Date().toISOString(),
      areaChairId: anonId(post.id),
    },
  };
}

// Stable 4-char anonymous ID for the AC signature, in the style of "Area Chair Xy9k".
export function anonId(seed: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += chars[(h >>> 0) % chars.length];
    h = Math.imul(h, 2654435761) ^ (h >>> 13);
  }
  return out;
}
