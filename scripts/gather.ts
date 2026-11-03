import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { gatherReactions } from "../src/lib/reactions";
import { PostSchema } from "../src/lib/schemas";

const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyId = args.includes("--id")
  ? args[args.indexOf("--id") + 1]
  : undefined;

async function main() {
  const posts = z
    .array(PostSchema)
    .parse(JSON.parse(readFileSync("data/posts.json", "utf8")));
  mkdirSync(join("data", "reactions"), { recursive: true });
  for (const post of posts.filter((p) => !onlyId || p.id === onlyId)) {
    const out = join("data", "reactions", `${post.id}.json`);
    if (existsSync(out) && !force) {
      console.log(`skip ${post.id} (exists, use --force)`);
      continue;
    }
    const file = await gatherReactions(post);
    writeFileSync(out, JSON.stringify(file, null, 2) + "\n");
    const by = (s: string) =>
      file.reactions.filter((r) => r.source === s).length;
    console.log(
      `${post.id}: ${file.reactions.length} reactions (HN ${by("Hacker News")}, Bluesky ${by("Bluesky")}, responses ${by("Response post")}) from ${file.threads.length} threads`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
