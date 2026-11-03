import { z } from "zod";

// Score scales mirror the ICLR 2025 review form so the UI can render "8: accept, good paper".
export const RATING_LABELS: Record<number, string> = {
  1: "strong reject",
  3: "reject, not good enough",
  5: "marginally below the acceptance threshold",
  6: "marginally above the acceptance threshold",
  8: "accept, good paper",
  10: "strong accept, should be highlighted at the conference",
};

export const QUALITY_LABELS: Record<number, string> = {
  1: "poor",
  2: "fair",
  3: "good",
  4: "excellent",
};

export const CONFIDENCE_LABELS: Record<number, string> = {
  1: "You are unable to assess this paper and have alerted the ACs to seek an opinion from different reviewers.",
  2: "You are willing to defend your assessment, but it is quite likely that you did not understand the central parts of the submission or that you are unfamiliar with some pieces of related work. Math/other details were not carefully checked.",
  3: "You are fairly confident in your assessment. It is possible that you did not understand some parts of the submission or that you are unfamiliar with some pieces of related work. Math/other details were not carefully checked.",
  4: "You are confident in your assessment, but not absolutely certain. It is unlikely, but not impossible, that you did not understand some parts of the submission or that you are unfamiliar with some pieces of related work.",
  5: "You are absolutely certain about your assessment. You are very familiar with the related work and checked the math/other details carefully.",
};

export const HYPE_LABELS: Record<number, string> = {
  1: "measured, almost academic",
  2: "mild enthusiasm",
  3: "noticeable hype",
  4: "heavy hype, several superlatives",
  5: '"everything changes" tier',
};

export const DECISIONS = [
  "Accept (Oral)",
  "Accept (Spotlight)",
  "Accept (Poster)",
  "Reject",
] as const;
export type Decision = (typeof DECISIONS)[number];

export const PostSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  title: z.string(),
  authors: z.array(z.string()),
  handle: z.string().optional(),
  url: z.string(),
  // The tweet that made a blog post go viral, if any. X can't be fetched, but HN threads link it.
  tweetUrl: z.string().optional(),
  date: z.string(),
  source: z.enum(["X thread", "Tweet", "Blog post"]),
  keywords: z.array(z.string()),
  tldr: z.string(),
  text: z.string(),
  // Set when the post was found by scripts/discover.ts.
  discovery: z
    .object({
      source: z.literal("Hacker News"),
      points: z.number(),
      comments: z.number(),
      discussionUrl: z.string(),
      discoveredAt: z.string(),
    })
    .optional(),
});
export type Post = z.infer<typeof PostSchema>;

// What the clustering LLM returns: the community's reactions grouped into three takes.
export const ClusteringSchema = z.object({
  clusters: z
    .array(
      z.object({
        label: z
          .string()
          .describe(
            "Short name for this take, e.g. 'Impressed builders' or 'Methodology skeptics'.",
          ),
        summary: z
          .string()
          .describe("2-3 sentences: what this group of people thinks and why."),
        stance: z.enum(["positive", "mixed", "negative"]),
        reaction_ids: z
          .array(z.string())
          .describe("IDs of every reaction that belongs to this take."),
        representative_ids: z
          .array(z.string())
          .describe(
            "3-6 IDs of the clearest, most-engaged reactions that express this take.",
          ),
      }),
    )
    .length(3)
    .describe(
      "Exactly three distinct takes, largest (by engagement-weighted size) first.",
    ),
});
export type Clustering = z.infer<typeof ClusteringSchema>;

// What the reviewer LLM returns.
export const ReviewSchema = z.object({
  summary: z
    .string()
    .describe(
      "2-4 sentence summary of the submission's claims, in your own words.",
    ),
  strengths: z
    .string()
    .describe(
      "Markdown bullet list of strengths, citing reactions like [hn-123].",
    ),
  weaknesses: z
    .string()
    .describe(
      "Markdown bullet list of weaknesses, citing reactions like [bsky-abc].",
    ),
  questions: z
    .string()
    .describe("Markdown numbered list of questions for the authors."),
  soundness: z
    .number()
    .int()
    .min(1)
    .max(4)
    .describe("1 poor, 2 fair, 3 good, 4 excellent"),
  presentation: z
    .number()
    .int()
    .min(1)
    .max(4)
    .describe("1 poor, 2 fair, 3 good, 4 excellent"),
  contribution: z
    .number()
    .int()
    .min(1)
    .max(4)
    .describe("1 poor, 2 fair, 3 good, 4 excellent"),
  rating: z
    .number()
    .int()
    .describe(
      "One of 1, 3, 5, 6, 8, 10 (1 strong reject ... 10 strong accept)",
    ),
  confidence: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("1 (guessing) to 5 (absolutely certain)"),
  hype_index: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe(
      "How hyped the submission is, 1 measured to 5 'everything changes'",
    ),
  flag_for_ethics_review: z
    .boolean()
    .describe("True only if the post raises real ethical concerns."),
});
export type Review = z.infer<typeof ReviewSchema>;

// What the Area Chair LLM returns.
export const MetaReviewSchema = z.object({
  metareview: z
    .string()
    .describe(
      "Markdown meta-review: summarize the submission, weigh each reviewer's arguments, resolve disagreements.",
    ),
  additional_comments_on_reviewer_discussion: z
    .string()
    .describe(
      "Which reviewer points were most decisive, which you discounted, and why.",
    ),
  decision: z.enum(DECISIONS),
  decision_comment: z
    .string()
    .describe("One or two sentences for the Paper Decision note."),
});
export type MetaReview = z.infer<typeof MetaReviewSchema>;

export type CitedReaction = {
  id: string;
  source: string;
  author: string;
  url: string;
  excerpt: string;
  engagement: number;
};

export type StoredReview = Review & {
  reviewer: number; // 1, 2, 3
  cluster: {
    label: string;
    summary: string;
    stance: "positive" | "mixed" | "negative";
    size: number; // reactions in this cluster
    total: number; // reactions gathered for the post
    representative: CitedReaction[];
  };
  // Every reaction cited inline in the review text, keyed by ID.
  citations: Record<string, CitedReaction>;
  date: string;
};

export type ReviewFile = {
  postId: string;
  generatedAt: string;
  models: { reviewer: string; areaChair: string };
  reactions: {
    total: number;
    bySource: Record<string, number>;
    threads: {
      source: string;
      title: string;
      url: string;
      points: number;
      comments: number;
    }[];
  };
  reviews: StoredReview[];
  metaReview: MetaReview & { date: string; areaChairId: string };
};

const ALLOWED_RATINGS = [1, 3, 5, 6, 8, 10];

export function snapRating(r: number): number {
  return ALLOWED_RATINGS.reduce((best, x) =>
    Math.abs(x - r) < Math.abs(best - r) ? x : best,
  );
}
