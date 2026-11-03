"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Submission } from "@/lib/forum";
import { BackToVenue } from "./Chrome";
import { ForumView } from "./ForumView";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ok"; submission: Submission };

// The site is a static export, so /forum?id=... reads its submission from public/data in the browser.
export function ForumLoader() {
  const id = useSearchParams().get("id");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!id || !/^[\w-]+$/.test(id)) {
      setState({ status: "missing" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    fetch(`${BASE_PATH}/data/${id}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<Submission>) : null))
      .then((submission) => {
        if (cancelled) return;
        setState(
          submission ? { status: "ok", submission } : { status: "missing" },
        );
        if (submission) document.title = `${submission.title} | PostReview`;
      })
      .catch(() => !cancelled && setState({ status: "missing" }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === "ok") return <ForumView s={state.submission} />;
  return (
    <>
      <BackToVenue />
      <div className="container grow">
        <main id="content" className="forum">
          <p className="empty-message">
            {state.status === "loading"
              ? "Loading…"
              : "The submission you requested could not be found."}
          </p>
        </main>
      </div>
    </>
  );
}
