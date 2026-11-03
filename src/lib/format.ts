import type { Decision } from "./schemas";

export const VENUE_ID = "PostReview.ai/2026/Conference";
export const VENUE_SHORT = "PostReview 2026";

const DATE: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
};
const TIME: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
};

// Same en-GB format OpenReview uses: "02 Nov 2024" and "02 Nov 2024, 14:23".
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", DATE);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", DATE)}, ${d.toLocaleTimeString("en-GB", TIME)}`;
}

export function venueString(decision: Decision | null): string {
  switch (decision) {
    case "Accept (Oral)":
      return `${VENUE_SHORT} Oral`;
    case "Accept (Spotlight)":
      return `${VENUE_SHORT} Spotlight`;
    case "Accept (Poster)":
      return `${VENUE_SHORT} Poster`;
    default:
      return `Submitted to ${VENUE_SHORT}`;
  }
}

export function scoreLabel(
  value: number,
  labels: Record<number, string>,
): string {
  return `${value}: ${labels[value] ?? ""}`.trim();
}
