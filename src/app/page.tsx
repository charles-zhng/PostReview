import { Banner } from "@/components/Chrome";
import { Icon } from "@/components/Icon";
import { VenueTabs, type ListNote, type Tab } from "@/components/VenueTabs";
import { decisionOf, getSubmissions, type Submission } from "@/lib/data";
import { formatDate, venueString } from "@/lib/format";

function toListNote(s: Submission): ListNote {
  const published = s.reviews ? formatDate(s.reviews.metaReview.date) : null;
  return {
    id: s.id,
    title: s.title,
    url: s.url,
    authors: s.authors,
    dateLine: published
      ? `Published: ${published}, Last Modified: ${formatDate(s.reviews!.generatedAt)}`
      : formatDate(s.date),
    venue: venueString(decisionOf(s)),
    replies: s.reviews ? s.reviews.reviews.length + 2 : 0,
    fields: [
      { label: "Keywords", value: s.keywords.join(", ") },
      { label: "TL;DR", value: s.tldr },
      { label: "Format", value: s.source },
      {
        label: "Virality",
        value: s.discovery
          ? `${s.discovery.points} points, ${s.discovery.comments} comments on ${s.discovery.source}`
          : "",
      },
      { label: "Submission Number", value: String(s.number) },
    ],
  };
}

export default function Home() {
  const subs = getSubmissions();
  const by = (pred: (s: Submission) => boolean) =>
    subs.filter(pred).map(toListNote);
  const tabs: Tab[] = [
    {
      id: "accept-oral",
      name: "Accept (Oral)",
      notes: by((s) => decisionOf(s) === "Accept (Oral)"),
    },
    {
      id: "accept-spotlight",
      name: "Accept (Spotlight)",
      notes: by((s) => decisionOf(s) === "Accept (Spotlight)"),
    },
    {
      id: "accept-poster",
      name: "Accept (Poster)",
      notes: by((s) => decisionOf(s) === "Accept (Poster)"),
    },
    {
      id: "submitted",
      name: "Rejected Submissions",
      notes: by((s) => decisionOf(s) === "Reject"),
    },
    {
      id: "under-review",
      name: "Active Submissions",
      notes: by((s) => decisionOf(s) === null),
    },
  ];

  return (
    <>
      <Banner />
      <div className="container grow">
        <main id="content" className="group">
          <div id="header" className="venue-header">
            <h1>PostReview 2026 Conference on Viral AI Discourse</h1>
            <h3>
              The International Conference on Things People Posted About AI
            </h3>
            <h4>
              <span className="venue-location">
                <Icon name="globe" /> The Timeline
              </span>
              <span className="venue-date">
                <Icon name="calendar" /> Nov 03 2026
              </span>
              <span className="venue-website">
                <Icon name="new-window" /> <a href="#">postreview.ai</a>
              </span>
            </h4>
            <div className="description">
              <p>
                Viral AI tweets, threads and blog posts are submitted to the
                conference and peer reviewed by three synthetic reviewers: a
                builder, a rigorous researcher, and a skeptic. A separate Area
                Chair model reads all three reviews and writes the meta-review
                and decision. No real reviewers were harmed.
              </p>
            </div>
          </div>
          <div id="notes">
            <VenueTabs tabs={tabs} />
          </div>
        </main>
      </div>
    </>
  );
}
