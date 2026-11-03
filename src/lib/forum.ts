import type { Field } from "@/components/NoteContent";
import type { Reply } from "@/components/Discussion";
import { formatDateTime, scoreLabel } from "./format";
import {
  CONFIDENCE_LABELS,
  HYPE_LABELS,
  QUALITY_LABELS,
  RATING_LABELS,
  type CitedReaction,
  type Decision,
  type Post,
  type ReviewFile,
  type StoredReview,
} from "./schemas";

// A post with its reviews, as served to the forum page (public/data/<id>.json).
export type Submission = Post & { reviews: ReviewFile | null };

export function decisionOf(s: Submission): Decision | null {
  return s.reviews?.metaReview.decision ?? null;
}

const ABSTRACT_CHARS = 1600;

// Reviewers see the full text; the page shows the opening paragraphs like an abstract.
export function abstractOf(text: string, url: string): string {
  if (text.length <= ABSTRACT_CHARS) return text;
  const paras = text.split("\n\n");
  let out = "";
  for (const p of paras) {
    if (out && out.length + p.length > ABSTRACT_CHARS) break;
    out += (out ? "\n\n" : "") + p;
  }
  return `${out}\n\n… [Read the full post](${url})`;
}

const CITATION = /\[((?:hn|bsky|resp)-[\w-]+)\]/g;

function reactionItem(c: CitedReaction, i?: number): string {
  const quote = c.excerpt.replace(/"/g, "'").replace(/\n/g, " ");
  const marker = i === undefined ? "-" : `${i + 1}.`;
  return `${marker} **${c.author}** (${c.source}, ${c.engagement} engagement): "${quote}" [↗](${c.url})`;
}

// Turns inline "[hn-123]" citations into numbered links, numbered by first appearance.
function citationLinker(r: StoredReview) {
  const order: string[] = [];
  const link = (text: string) =>
    text.replace(CITATION, (match, id: string) => {
      const c = r.citations[id];
      if (!c) return "";
      if (!order.includes(id)) order.push(id);
      return `[[${order.indexOf(id) + 1}]](${c.url})`;
    });
  return { link, cited: () => order.map((id) => r.citations[id]) };
}

export function buildReplies(n: number, file: ReviewFile): Reply[] {
  const meta = file.metaReview;
  const decisionDate = new Date(
    new Date(meta.date).getTime() + 36 * 3600 * 1000,
  ).toISOString();
  const replies: Reply[] = [
    {
      id: "decision",
      type: "Decision",
      title: "Paper Decision",
      hasContentTitle: true,
      signature: "Program Chairs",
      date: decisionDate,
      dateLabel: formatDateTime(decisionDate),
      readers: "Everyone",
      fields: [
        { label: "Decision", value: meta.decision },
        { label: "Comment", value: meta.decision_comment, markdown: true },
      ],
    },
    {
      id: "metareview",
      type: "Meta Review",
      title: `Meta Review of Submission${n} by Area Chair ${meta.areaChairId}`,
      hasContentTitle: false,
      signature: `Area Chair ${meta.areaChairId}`,
      date: meta.date,
      dateLabel: formatDateTime(meta.date),
      readers: "Everyone",
      fields: [
        { label: "Metareview", value: meta.metareview, markdown: true },
        {
          label: "Additional Comments On Reviewer Discussion",
          value: meta.additional_comments_on_reviewer_discussion,
          markdown: true,
        },
      ],
    },
  ];
  for (const r of file.reviews) {
    const { link, cited } = citationLinker(r);
    const fields: Field[] = [
      {
        label: "Community Cluster",
        value: `**${r.cluster.label}** (${r.cluster.stance}; ${r.cluster.size} of ${r.cluster.total} reactions). ${r.cluster.summary}`,
        markdown: true,
      },
      { label: "Summary", value: link(r.summary), markdown: true },
      { label: "Soundness", value: scoreLabel(r.soundness, QUALITY_LABELS) },
      {
        label: "Presentation",
        value: scoreLabel(r.presentation, QUALITY_LABELS),
      },
      {
        label: "Contribution",
        value: scoreLabel(r.contribution, QUALITY_LABELS),
      },
      { label: "Strengths", value: link(r.strengths), markdown: true },
      { label: "Weaknesses", value: link(r.weaknesses), markdown: true },
      { label: "Questions", value: link(r.questions), markdown: true },
      {
        label: "Flag For Ethics Review",
        value: r.flag_for_ethics_review
          ? "Yes, Other reasons (please specify below)"
          : "No ethics review needed.",
      },
      { label: "Rating", value: scoreLabel(r.rating, RATING_LABELS) },
      {
        label: "Confidence",
        value: scoreLabel(r.confidence, CONFIDENCE_LABELS),
      },
      { label: "Hype Index", value: scoreLabel(r.hype_index, HYPE_LABELS) },
      {
        label: "Representative Reactions",
        value: r.cluster.representative.map(reactionItem).join("\n"),
        markdown: true,
      },
      {
        label: "Cited Reactions",
        value: cited()
          .map((c, i) => reactionItem(c, i))
          .join("\n"),
        markdown: true,
      },
      { label: "Code Of Conduct", value: "Yes" },
    ];
    replies.push({
      id: `review-${r.reviewer}`,
      type: "Official Review",
      title: `Official Review of Submission${n} by Reviewer ${r.reviewer}`,
      hasContentTitle: false,
      signature: `Reviewer ${r.reviewer}`,
      date: r.date,
      dateLabel: formatDateTime(r.date),
      readers: "Everyone",
      fields,
    });
  }
  return replies;
}
