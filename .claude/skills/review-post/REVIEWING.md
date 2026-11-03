# Writing the reviews by hand

You act as the LLM for the pipeline in `src/lib/pipeline.ts`. Do the same three steps it does, following the prompts in `src/lib/personas.ts` (`CLUSTER_SYSTEM`, `reviewerSystem(n, cluster)`, `AREA_CHAIR_SYSTEM`) and the schemas in `src/lib/schemas.ts` (`ClusteringSchema`, `ReviewSchema`, `MetaReviewSchema`). The `.describe()` text in the schemas is part of the prompt.

## Inputs
- **The post:** its entry in `data/posts.json` (title, authors, date, text).
- **The reactions:** read ALL of `data/reactions/<id>.json`, in chunks if it's long.
  - Each reaction has `id`, `source`, `kind`, `author`, `text`, `engagement` and `context`.
  - Response posts (`resp-…`) are full blog posts. Read them in full; they often carry the strongest arguments.

## Step A: cluster (CLUSTER_SYSTEM)
- **Exactly 3 distinct takes,** ordered by engagement-weighted size, largest first.
- **Every substantive, on-topic reaction ID** goes into exactly one cluster's `reaction_ids`.
- **Leave out the noise:**
  - link-only shares;
  - off-topic replies;
  - posts that matched only by phrase (a poem or book with the same name);
  - a response post that is just the original essay re-posted.

  The gatherer is noisy, and filtering is your job.
- **`representative_ids`:** the 3–6 clearest, most-engaged reactions of the take. They must also be in `reaction_ids`.

## Step B: three reviews (reviewerSystem)
- **Reviewer n is the synthesized voice of cluster n.** Every argument must come from that cluster's reactions.
- **Cite inline by ID,** e.g. `[hn-50347685]`, `[bsky-3mzgifkxfvs26]` or `[resp-50351111]`, and cite ONLY IDs in that cluster.
- **Only attribute claims a reaction actually makes.** Never rest a claim on a response post's headings or intro alone.
- **Write as a reviewer** ("The submission claims…"), not as a summary of comments ("Commenters said…").
- **Scores reflect the cluster's verdict.** Rating is one of 1, 3, 5, 6, 8 or 10.
- **Format:**
  - strengths and weaknesses as markdown bullets, 4–6 each, with several citations;
  - questions as a numbered list;
  - the summary in 2–4 sentences.

## Step C: meta-review (AREA_CHAIR_SYSTEM)
- **Weigh arguments, not cluster sizes.** A small cluster with a decisive rebuttal can win.
- **Decide:** Accept (Oral), Accept (Spotlight), Accept (Poster) or Reject.
- **Don't cite IDs here;** refer to "Reviewer 1/2/3".
- **Tone:** dry, fair, with a light touch of humor.

## Output: `data/manual/<id>.json`
```json
{
  "model": "claude (hand-run in Claude Code)",
  "clustering": { "clusters": [
    { "label": "", "summary": "", "stance": "positive|mixed|negative", "reaction_ids": [], "representative_ids": [] },
    { "...": "..." }, { "...": "..." }
  ] },
  "reviews": [
    { "summary": "", "strengths": "", "weaknesses": "", "questions": "", "soundness": 3, "presentation": 3,
      "contribution": 3, "rating": 6, "confidence": 4, "hype_index": 3, "flag_for_ethics_review": false },
    { "...": "..." }, { "...": "..." }
  ],
  "metaReview": { "metareview": "", "additional_comments_on_reviewer_discussion": "", "decision": "Accept (Poster)", "decision_comment": "" }
}
```
`reviews[i]` belongs to `clusters[i]`. Write the file with a short script if hand-writing the JSON is error-prone; long markdown strings need escaping.

## Validate
Run `npm run assemble -- --id <id>` and fix the file until it prints `ok`. It checks:
- the schema;
- that every ID exists;
- that no ID is in two clusters;
- that each review cites only its own cluster.

It then writes `data/reviews/<id>.json` for the site.

## Updating after a re-gather
If `data/reactions/<id>.json` changes after a review exists:
1. Diff the old and new reaction IDs and texts.
2. Drop citations to removed IDs and rewrite any sentence that relied only on them.
3. Place new reactions in the right clusters, or leave them out as noise.
4. Re-run `assemble`.
