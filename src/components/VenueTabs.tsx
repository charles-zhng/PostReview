"use client";

import Link from "next/link";
import { useState } from "react";
import { DocIcon, Icon } from "./Icon";
import { NoteContent, type Field } from "./NoteContent";

export type ListNote = {
  id: string;
  title: string;
  url: string;
  authors: string[];
  dateLine: string;
  venue: string;
  replies: number;
  fields: Field[];
};

export type Tab = { id: string; name: string; notes: ListNote[] };

export function VenueTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(
    () => (tabs.find((t) => t.notes.length > 0) ?? tabs[0]).id,
  );
  const [query, setQuery] = useState("");
  const tab = tabs.find((t) => t.id === active)!;
  const q = query.trim().toLowerCase();
  const notes = q
    ? tab.notes.filter((n) =>
        [n.title, ...n.authors, ...n.fields.map((f) => f.value)].some((s) =>
          s.toLowerCase().includes(q),
        ),
      )
    : tab.notes;

  return (
    <div className="tabs-container">
      <ul className="nav-tabs" role="tablist">
        {tabs.map((t) => (
          <li
            key={t.id}
            role="presentation"
            className={t.id === active ? "active" : undefined}
          >
            <a
              href={`#${t.id}`}
              role="tab"
              onClick={(e) => {
                e.preventDefault();
                setActive(t.id);
              }}
            >
              {t.name}
            </a>
          </li>
        ))}
      </ul>
      <div className="tab-pane" role="tabpanel">
        {tab.notes.length === 0 ? (
          <p className="empty-message">No papers to display at this time</p>
        ) : (
          <>
            <form
              className="notes-search-form"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="search-content">
                <input
                  className="form-control"
                  placeholder="Search submissions by title and metadata"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="form-control-feedback">
                  <Icon name="search" />
                </span>
              </div>
            </form>
            <ul className="list-paginated">
              {notes.map((n) => (
                <li key={n.id}>
                  <NoteListItem note={n} />
                </li>
              ))}
            </ul>
            <nav className="pagination-container">
              <ul className="pagination">
                <li className="disabled left-arrow">
                  <span>«</span>
                </li>
                <li className="disabled left-arrow">
                  <span>‹</span>
                </li>
                <li className="active">
                  <span>1</span>
                </li>
                <li className="disabled right-arrow">
                  <span>›</span>
                </li>
                <li className="disabled right-arrow">
                  <span>»</span>
                </li>
              </ul>
              <span className="pagination-count">
                Showing 1-{notes.length} of {notes.length}
              </span>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}

function NoteListItem({ note }: { note: ListNote }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="note">
      <h4>
        <Link href={`/forum?id=${note.id}`}>{note.title}</Link>
        <a
          className="pdf-link"
          href={note.url}
          title="View original post"
          target="_blank"
          rel="noreferrer"
        >
          <DocIcon size={20} />
        </a>
      </h4>
      <div className="note-authors">
        {note.authors.map((a, i) => (
          <span key={a}>
            {i > 0 && ", "}
            <a href="#">{a}</a>
          </span>
        ))}
      </div>
      <ul className="note-meta-info">
        <li>{note.dateLine}</li>
        <li>{note.venue}</li>
        <li className="readers">
          Readers: <Icon name="globe" className="readers-icon" /> Everyone
        </li>
        {note.replies > 0 && (
          <li>{note.replies === 1 ? "1 Reply" : `${note.replies} Replies`}</li>
        )}
      </ul>
      <div className="collapse-widget">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setOpen(!open);
          }}
        >
          {open ? "Hide details" : "Show details"}
        </a>
        {open && (
          <div className="collapse-indent">
            <NoteContent fields={note.fields} />
          </div>
        )}
      </div>
    </div>
  );
}
