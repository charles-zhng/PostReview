import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Submission } from "./forum";
import { PostSchema, type ReviewFile } from "./schemas";

export { decisionOf, type Submission } from "./forum";

const DATA_DIR = join(process.cwd(), "data");
const PUBLIC_DATA_DIR = join(process.cwd(), "public", "data");

export function getSubmissions(): Submission[] {
  const posts = z
    .array(PostSchema)
    .parse(JSON.parse(readFileSync(join(DATA_DIR, "posts.json"), "utf8")));
  return posts.map((post) => {
    const file = join(DATA_DIR, "reviews", `${post.id}.json`);
    const reviews = existsSync(file)
      ? (JSON.parse(readFileSync(file, "utf8")) as ReviewFile)
      : null;
    return { ...post, reviews };
  });
}

// Writes public/data/<id>.json, which the forum page loads in the browser.
export function writePublicData(): number {
  rmSync(PUBLIC_DATA_DIR, { recursive: true, force: true });
  mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
  const subs = getSubmissions();
  for (const s of subs)
    writeFileSync(join(PUBLIC_DATA_DIR, `${s.id}.json`), JSON.stringify(s));
  return subs.length;
}
