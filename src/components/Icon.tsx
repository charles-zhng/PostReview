// Small inline SVG stand-ins for the Bootstrap glyphicons OpenReview uses.
const PATHS: Record<string, string> = {
  search:
    "M6.5 1a5.5 5.5 0 0 1 4.38 8.82l3.65 3.65-1.06 1.06-3.65-3.65A5.5 5.5 0 1 1 6.5 1zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  globe:
    "M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 1.3c-.6.6-1.3 1.9-1.6 3.7h3.2C9.3 4.2 8.6 2.9 8 2.3zM5.1 6c.1-1.3.5-2.5.9-3.3A5.7 5.7 0 0 0 2.4 6h2.7zm-2.8 1.3a5.7 5.7 0 0 0 0 1.4h2.8a17 17 0 0 1 0-1.4H2.3zm.1 2.7a5.7 5.7 0 0 0 3.6 3.3c-.4-.8-.8-2-.9-3.3H2.4zm4 0c.3 1.8 1 3.1 1.6 3.7.6-.6 1.3-1.9 1.6-3.7H6.4zm4.5 0c-.1 1.3-.5 2.5-.9 3.3A5.7 5.7 0 0 0 13.6 10h-2.7zm2.8-1.3a5.7 5.7 0 0 0 0-1.4h-2.8a17 17 0 0 1 0 1.4h2.8zm-.1-2.7A5.7 5.7 0 0 0 10 2.7c.4.8.8 2 .9 3.3h2.7zM6.4 7.3a15 15 0 0 0 0 1.4h3.2a15 15 0 0 0 0-1.4H6.4z",
  calendar:
    "M4 1h1.5v1.5h5V1H12v1.5h2.5V15h-13V2.5H4V1zM3 6v7.5h10V6H3zm1.5 1.5h2v2h-2v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2zm-6 3h2v2h-2v-2zm3 0h2v2h-2v-2z",
  "new-window":
    "M2 3h6v1.5H3.5v8h8V8H13v6H2V3zm7-2h6v6l-2.2-2.2-4.1 4.1-1.6-1.6 4.1-4.1L9 1z",
  "folder-open": "M1 3h5l1.5 1.5H13V6H4L1.5 13H1V3zm3.5 4H16l-3 7H1.5l3-7z",
  "eye-open":
    "M8 3c3.5 0 6.2 2.6 7.5 5-1.3 2.4-4 5-7.5 5S1.8 10.4.5 8C1.8 5.6 4.5 3 8 3zm0 1.5A3.5 3.5 0 1 0 8 11.5 3.5 3.5 0 0 0 8 4.5zM8 6.3a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4z",
  duplicate: "M5 1h9v9h-2V3H5V1zM2 5h9v10H2V5zm1.5 1.5v7h6v-7h-6z",
  bookmark: "M3.5 1h9v14L8 11.5 3.5 15V1z",
  link: "M6.8 9.2a2.5 2.5 0 0 0 3.5 0l3-3a2.5 2.5 0 0 0-3.5-3.5L8.6 3.9l1 1 1.2-1.2a1.1 1.1 0 0 1 1.5 1.5l-3 3a1.1 1.1 0 0 1-1.5 0l-1 1zm2.4-2.4a2.5 2.5 0 0 0-3.5 0l-3 3a2.5 2.5 0 0 0 3.5 3.5l1.2-1.2-1-1-1.2 1.2a1.1 1.1 0 0 1-1.5-1.5l3-3a1.1 1.1 0 0 1 1.5 0l1-1z",
  "copyright-mark":
    "M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zm.2 2.2c1.3 0 2.3.6 2.8 1.6l-1.3.6c-.3-.5-.8-.8-1.5-.8-1 0-1.7.8-1.7 1.9s.7 1.9 1.7 1.9c.7 0 1.2-.3 1.5-.8l1.3.6c-.5 1-1.5 1.6-2.8 1.6-1.9 0-3.2-1.4-3.2-3.3s1.3-3.3 3.2-3.3z",
  remove:
    "M3.4 2.3 8 6.9l4.6-4.6 1.1 1.1L9.1 8l4.6 4.6-1.1 1.1L8 9.1l-4.6 4.6-1.1-1.1L6.9 8 2.3 3.4z",
};

export function Icon({
  name,
  className,
}: {
  name: keyof typeof PATHS | string;
  className?: string;
}) {
  return (
    <svg
      className={`glyph ${className ?? ""}`}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

// Document icon standing in for OpenReview's blue PDF icon.
export function DocIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 1.5h9.5L20 7v15.5H5z"
        fill="none"
        stroke="#4d8093"
        strokeWidth="1.6"
      />
      <path d="M14.5 1.5V7H20" fill="none" stroke="#4d8093" strokeWidth="1.6" />
      <rect x="2.5" y="11" width="13" height="7" rx="1" fill="#4d8093" />
      <text
        x="9"
        y="16.6"
        textAnchor="middle"
        fontSize="5.2"
        fontWeight="700"
        fill="#fff"
        fontFamily="Arial, sans-serif"
      >
        POST
      </text>
    </svg>
  );
}

export function ArrowLeft() {
  return (
    <svg
      className="banner-arrow"
      viewBox="0 0 68 48"
      height="12"
      aria-hidden="true"
    >
      <path d="M24 0 0 24l24 24 4-4L11 27h57v-6H11L28 4z" fill="#4d8093" />
    </svg>
  );
}
