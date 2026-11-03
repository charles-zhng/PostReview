import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { reviewPost } from "../src/lib/pipeline";
import type { ReactionFile } from "../src/lib/reactions";
import { PostSchema } from "../src/lib/schemas";

const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyId = args.includes("--id")
  ? args[args.indexOf("--id") + 1]
  : undefined;

const posts = z
  .array(PostSchema)
  .parse(JSON.parse(readFileSync("data/posts.json", "utf8")));
const targets = posts.filter((p) => !onlyId || p.id === onlyId);
if (onlyId && targets.length === 0)
  throw new Error(`No post with id "${onlyId}"`);

async function main() {
  for (const post of targets) {
    const out = join("data/reviews", `${post.id}.json`);
    if (existsSync(out) && !force) {
      console.log(`skip ${post.id} (exists, use --force)`);
      continue;
    }
    console.log(`reviewing ${post.id}...`);
    const reactionsPath = join("data/reactions", `${post.id}.json`);
    if (!existsSync(reactionsPath)) {
      console.log(
        `skip ${post.id} (no reactions; run npm run gather -- --id ${post.id})`,
      );
      continue;
    }
    const reactions = JSON.parse(
      readFileSync(reactionsPath, "utf8"),
    ) as ReactionFile;
    const result = await reviewPost(post, reactions);
    writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
    const ratings = result.reviews.map((r) => r.rating).join("/");
    console.log(`  ${ratings} -> ${result.metaReview.decision}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
