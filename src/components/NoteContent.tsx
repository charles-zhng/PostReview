import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type Field = { label: string; value: string; markdown?: boolean };

// Renders fields as OpenReview does: a bold red "Label:" followed by the value.
export function NoteContent({ fields }: { fields: Field[] }) {
  return (
    <div className="note-content">
      {fields
        .filter((f) => f.value.trim())
        .map((f) => (
          <div key={f.label}>
            <strong className="note-content-field">{f.label}:</strong>{" "}
            {f.markdown ? (
              <div className="note-content-value markdown-rendered">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {f.value}
                </ReactMarkdown>
              </div>
            ) : (
              <span className="note-content-value">{f.value}</span>
            )}
          </div>
        ))}
    </div>
  );
}
