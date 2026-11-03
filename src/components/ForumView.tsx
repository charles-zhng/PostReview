import { BackToVenue } from "./Chrome";
import { Discussion } from "./Discussion";
import { DocIcon, Icon } from "./Icon";
import { NoteContent } from "./NoteContent";
import { formatDate, venueString } from "@/lib/format";
import {
  abstractOf,
  buildReplies,
  decisionOf,
  type Submission,
} from "@/lib/forum";

export function ForumView({ s }: { s: Submission }) {
  const decision = decisionOf(s);
  const replies = s.reviews ? buildReplies(s.number, s.reviews) : [];
  const dateLine = s.reviews
    ? `Published: ${formatDate(s.reviews.metaReview.date)}, Last Modified: ${formatDate(s.reviews.generatedAt)}`
    : `${formatDate(s.date)}`;

  return (
    <>
      <BackToVenue />
      <div className="container grow">
        <main id="content" className="forum">
          <div className="forum-container">
            <div className="forum-note">
              <div className="forum-title">
                <h2 className="citation_title">{s.title}</h2>
                <div className="forum-content-link">
                  <a
                    href={s.url}
                    title="View original post"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <DocIcon size={40} />
                  </a>
                </div>
              </div>
              <div className="forum-authors">
                <h3>
                  {s.authors.map((a, i) => (
                    <span key={a}>
                      {i > 0 && ", "}
                      <a href="#">{a}</a>
                    </span>
                  ))}
                </h3>
              </div>
              <div className="forum-meta">
                <span className="item">
                  <Icon name="calendar" />
                  {dateLine}
                </span>
                <span className="item">
                  <Icon name="folder-open" />
                  {venueString(decision)}
                </span>
                <span className="item">
                  <Icon name="eye-open" />
                  Everyone
                </span>
                <span className="item">
                  <Icon name="duplicate" />
                  <a href="#">Revisions</a>
                </span>
                <span className="item">
                  <Icon name="bookmark" />
                  <a href="#">BibTeX</a>
                </span>
                {s.reviews && (
                  <span className="item">
                    <Icon name="eye-open" />
                    {s.reviews.reactions.total} community reactions (
                    {Object.entries(s.reviews.reactions.bySource)
                      .map(([src, n]) => `${src} ${n}`)
                      .join(", ")}
                    )
                  </span>
                )}
                {s.discovery && (
                  <span className="item">
                    <Icon name="link" />
                    <a
                      href={s.discovery.discussionUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Hacker News: {s.discovery.points} points,{" "}
                      {s.discovery.comments} comments
                    </a>
                  </span>
                )}
                <span className="item">
                  <Icon name="copyright-mark" />
                  <a href={s.url} target="_blank" rel="noreferrer">
                    Original {s.source}
                  </a>
                </span>
              </div>
              <NoteContent
                fields={[
                  { label: "Keywords", value: s.keywords.join(", ") },
                  { label: "TL;DR", value: s.tldr },
                  {
                    label: "Abstract",
                    value: abstractOf(s.text, s.url),
                    markdown: true,
                  },
                  {
                    label: "Format",
                    value: `${s.source}${s.handle ? ` by ${s.handle}` : ""}, posted ${formatDate(s.date)}`,
                  },
                  { label: "Submission Number", value: String(s.number) },
                ]}
              />
            </div>
            {s.reviews ? (
              <Discussion replies={replies} />
            ) : (
              <div className="filters-container">
                <p className="empty-message">
                  Reviews are not yet available for this submission.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
