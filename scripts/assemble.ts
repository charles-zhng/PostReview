// Turns a hand-run model output (data/manual/<id>.json) into data/reviews/<id>.json,
// using the same code paths and schemas as the API pipeline.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { writePublicData } from "../src/lib/data";
import { anonId, reactionStats, storeReview } from "../src/lib/pipeline";
import type { ReactionFile } from "../src/lib/reactions";
import {
  ClusteringSchema,
  MetaReviewSchema,
  ReviewSchema,
  type ReviewFile,
} from "../src/lib/schemas";

const ManualSchema = z.object({
  model: z.string(),
  clustering: ClusteringSchema,
  reviews: z.array(ReviewSchema).length(3),
  metaReview: MetaReviewSchema,
});

const CITATION = /\[((?:hn|bsky|resp)-[\w-]+)\]/g;
const onlyId = process.argv.includes("--id")
  ? process.argv[process.argv.indexOf("--id") + 1]
  : undefined;

let failed = false;
const ids = onlyId
  ? [onlyId]
  : readdirSync("data/manual").map((f) => f.replace(/\.json$/, ""));
for (const id of ids) {
  const problems: string[] = [];
  const parsed = ManualSchema.safeParse(
    JSON.parse(readFileSync(join("data/manual", `${id}.json`), "utf8")),
  );
  if (!parsed.success) {
    console.log(`FAIL ${id}: ${parsed.error.message}`);
    failed = true;
    continue;
  }
  const manual = parsed.data;
  const reactionsPath = join("data/reactions", `${id}.json`);
  if (!existsSync(reactionsPath)) throw new Error(`No reactions for ${id}`);
  const file = JSON.parse(readFileSync(reactionsPath, "utf8")) as ReactionFile;
  const known = new Set(file.reactions.map((r) => r.id));

  // Clusters must use real reaction IDs, and each reviewer may only cite its own cluster.
  const seen = new Set<string>();
  manual.clustering.clusters.forEach((c, i) => {
    for (const rid of [...c.reaction_ids, ...c.representative_ids]) {
      if (!known.has(rid))
        problems.push(`cluster ${i + 1} has unknown id ${rid}`);
    }
    for (const rid of c.reaction_ids) {
      if (seen.has(rid)) problems.push(`id ${rid} is in more than one cluster`);
      seen.add(rid);
    }
    const members = new Set(c.reaction_ids);
    const r = manual.reviews[i];
    for (const text of [r.summary, r.strengths, r.weaknesses, r.questions]) {
      for (const [, cid] of text.matchAll(CITATION)) {
        if (!members.has(cid))
          problems.push(
            `review ${i + 1} cites ${cid}, which is not in its cluster`,
          );
      }
    }
  });
  if (problems.length) {
    console.log(
      `FAIL ${id}:\n  ${[...new Set(problems)].slice(0, 15).join("\n  ")}`,
    );
    failed = true;
    continue;
  }

  const now = Date.now();
  const reviews = manual.clustering.clusters.map((c, i) =>
    storeReview(
      i + 1,
      c,
      manual.reviews[i],
      file,
      new Date(now - (3 - i) * 3600_000).toISOString(),
    ),
  );
  const out: ReviewFile = {
    postId: id,
    generatedAt: new Date(now).toISOString(),
    models: { reviewer: manual.model, areaChair: manual.model },
    reactions: reactionStats(file),
    reviews,
    metaReview: {
      ...manual.metaReview,
      date: new Date(now).toISOString(),
      areaChairId: anonId(id),
    },
  };
  writeFileSync(
    join("data/reviews", `${id}.json`),
    JSON.stringify(out, null, 2) + "\n",
  );
  const sizes = reviews.map((r) => r.cluster.size).join("/");
  console.log(
    `ok   ${id}: clusters ${sizes} of ${file.reactions.length}, ratings ${reviews.map((r) => r.rating).join("/")} -> ${manual.metaReview.decision}`,
  );
}
// Keep the forum page's browser-side data in sync.
writePublicData();
if (failed) process.exit(1);
