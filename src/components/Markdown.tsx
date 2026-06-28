import { marked } from "marked";

const escapeHtml = (s: string) =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

// Descriptions come from external feeds: render markdown, but never raw HTML.
marked.use({
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
  },
});

interface Props {
  text?: string;
  truncate?: number;
  className?: string;
}

/** Static, server-rendered markdown. No client JS, no renderer chrome. */
export default function Markdown({ text, truncate, className }: Props) {
  if (!text) return null;
  let body = text;
  if (truncate && body.length > truncate) {
    body = body.slice(0, truncate).trimEnd() + "…";
  }
  const html = marked.parse(body, { async: false }) as string;
  return (
    <div
      className={className ? `md ${className}` : "md"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
