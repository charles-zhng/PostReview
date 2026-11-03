"use client";

import { useMemo, useState } from "react";
import { Icon } from "./Icon";
import { NoteContent, type Field } from "./NoteContent";

export type Reply = {
  id: string;
  type: "Decision" | "Meta Review" | "Official Review";
  title: string; // content.title if set, else the generated title
  hasContentTitle: boolean;
  signature: string;
  date: string; // ISO
  dateLabel: string;
  readers: string;
  fields: Field[];
};

// OpenReview's invitation chip colors.
const CHIP: Record<Reply["type"], string> = {
  Decision: "#bff",
  "Meta Review": "#fbf",
  "Official Review": "#fbb",
};

type Level = 0 | 1 | 2; // −  ＝  ≡

export function Discussion({ replies }: { replies: Reply[] }) {
  const [types, setTypes] = useState<string>("");
  const [author, setAuthor] = useState<string>("");
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [layout, setLayout] = useState<0 | 1 | 2>(1);
  const [level, setLevel] = useState<Level>(1);
  const [levels, setLevels] = useState<Record<string, Level>>({});

  const shown = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return replies
      .filter((r) => !types || r.type === types)
      .filter((r) => !author || r.signature === author)
      .filter(
        (r) =>
          !kw ||
          [r.title, ...r.fields.map((f) => f.value)].some((s) =>
            s.toLowerCase().includes(kw),
          ),
      )
      .sort((a, b) =>
        sort === "desc"
          ? b.date.localeCompare(a.date)
          : a.date.localeCompare(b.date),
      );
  }, [replies, types, author, keyword, sort]);

  const setAll = (l: Level) => {
    setLevel(l);
    setLevels({});
  };
  const signatures = Array.from(new Set(replies.map((r) => r.signature)));
  const typeNames = Array.from(new Set(replies.map((r) => r.type)));

  return (
    <div className="filters-container">
      <form className="filter-controls" onSubmit={(e) => e.preventDefault()}>
        <div className="wrap">
          <div className="form-group expand">
            <select
              className="filter-select"
              value={types}
              onChange={(e) => setTypes(e.target.value)}
            >
              <option value="">Filter by reply type...</option>
              {typeNames.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="form-group expand">
            <select
              className="filter-select"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            >
              <option value="">Filter by author...</option>
              {signatures.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-group expand">
            <input
              className="filter-input"
              placeholder="Search keywords..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="form-group no-expand">
            <select
              className="filter-select sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as "desc" | "asc")}
            >
              <option value="desc">Sort: Newest First</option>
              <option value="asc">Sort: Oldest First</option>
            </select>
          </div>
          <div className="form-group no-expand layout-buttons">
            <div className="btn-group">
              {(["linear", "threaded", "nested"] as const).map((name, i) => (
                <button
                  key={name}
                  type="button"
                  title={`${name[0].toUpperCase()}${name.slice(1)} discussion layout`}
                  className={`btn ${layout === i ? "active" : ""}`}
                  onClick={() => setLayout(i as 0 | 1 | 2)}
                >
                  <LayoutIcon kind={name} />
                </button>
              ))}
            </div>
            <div className="btn-group">
              {(["−", "＝", "≡"] as const).map((g, i) => (
                <button
                  key={g}
                  type="button"
                  title={
                    [
                      "Collapse content",
                      "Partially expand content",
                      "Fully expand content",
                    ][i]
                  }
                  className={`btn ${level === i ? "active" : ""}`}
                  onClick={() => setAll(i as Level)}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="btn-group">
              <button type="button" className="btn" title="Copy filter URL">
                <Icon name="link" />
              </button>
            </div>
          </div>
        </div>
        <div className="readers-row">
          <span className="icon-label" title="Visible to">
            <Icon name="eye-open" />
          </span>
          <div className="readers-filter-container">
            <div className="readers-filter">
              {[
                "Everyone",
                "Program Chairs",
                "Area Chairs",
                "Reviewers",
                "Authors",
              ].map((r) => (
                <label key={r} className="btn">
                  {r}
                </label>
              ))}
              <label className="btn reset-btn">
                <Icon name="remove" />
              </label>
            </div>
          </div>
          <div className="filtered-reply-count">
            <em className="filter-count">
              {shown.length} / {replies.length}{" "}
              {replies.length === 1 ? "reply" : "replies"} shown
            </em>
          </div>
        </div>
      </form>

      <div className="forum-replies-container">
        <div id="forum-replies">
          {shown.map((r) => (
            <div key={r.id}>
              <ReplyNote
                reply={r}
                level={levels[r.id] ?? level}
                setLevel={(l) => setLevels((prev) => ({ ...prev, [r.id]: l }))}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReplyNote({
  reply,
  level,
  setLevel,
}: {
  reply: Reply;
  level: Level;
  setLevel: (l: Level) => void;
}) {
  return (
    <div className="note depth-odd" id={reply.id}>
      <div className="collapse-controls-v">
        {(["−", "＝", "≡"] as const).map((g, i) => (
          <button
            key={g}
            type="button"
            className={`${i === 1 ? "middle " : ""}${level === i ? "active" : ""}`}
            onClick={() => setLevel(i as Level)}
          >
            {g}
          </button>
        ))}
      </div>
      {level === 0 ? (
        <div className="heading">
          <h4 className="minimal-title">
            <strong>{reply.hasContentTitle ? reply.title : reply.type}</strong>{" "}
            • <span className="signatures">by {reply.signature}</span>
          </h4>
        </div>
      ) : (
        <>
          <div className="heading">
            <h4>
              {reply.hasContentTitle ? (
                <strong>{reply.title}</strong>
              ) : (
                <span>{reply.title}</span>
              )}
            </h4>
            <a
              href={`#${reply.id}`}
              className="permalink-btn"
              title="Copy URL of note"
            >
              <Icon name="link" />
            </a>
          </div>
          <div className="subheading">
            <span
              className="invitation highlight"
              style={{ backgroundColor: CHIP[reply.type], color: "#2c3a4a" }}
            >
              {reply.type}
            </span>
            <span className="signatures">by {reply.signature}</span>
            <span className="created-date">
              <Icon name="calendar" />
              {reply.dateLabel}
            </span>
            <span className="readers">
              <Icon name="eye-open" />
              {reply.readers}
            </span>
            <span className="revisions">
              <Icon name="duplicate" />
              <a href="#">Revisions</a>
            </span>
          </div>
          <CollapsibleContent
            fields={reply.fields}
            collapsed={level === 1}
            onExpand={() => setLevel(2)}
          />
        </>
      )}
    </div>
  );
}

function CollapsibleContent({
  fields,
  collapsed,
  onExpand,
}: {
  fields: Field[];
  collapsed: boolean;
  onExpand: () => void;
}) {
  return (
    <div className={`note-content-container ${collapsed ? "collapsed" : ""}`}>
      <NoteContent fields={fields} />
      {collapsed && (
        <div className="gradient-overlay">
          <button type="button" className="btn-link" onClick={onExpand}>
            ≡ &nbsp;Show All
          </button>
        </div>
      )}
    </div>
  );
}

function LayoutIcon({ kind }: { kind: "linear" | "threaded" | "nested" }) {
  const rows =
    kind === "linear"
      ? [0, 0, 0, 0]
      : kind === "threaded"
        ? [0, 1, 1, 0]
        : [0, 1, 2, 1];
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="currentColor"
    >
      {rows.map((indent, i) => (
        <g key={i}>
          <rect x={indent * 3} y={i * 4} width="3" height="3" />
          <rect
            x={indent * 3 + 4}
            y={i * 4 + 0.5}
            width={12 - indent * 3 - 1}
            height="2"
          />
        </g>
      ))}
    </svg>
  );
}
