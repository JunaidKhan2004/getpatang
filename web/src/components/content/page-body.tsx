/**
 * Renders staff-written page text: blank line between paragraphs, "## " for a heading,
 * lines starting with "- " for a list. Plain text only — nothing is interpreted as HTML.
 * The mobile app follows the same rules (mobile/lib/features/content).
 */
export function PageBody({ body }: { body: string }) {
  const blocks = body.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="grid gap-4 leading-relaxed">
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) return <h2 key={i} className="mt-2 text-xl font-semibold">{b.slice(3)}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="grid list-disc gap-1 pl-6">
              {lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}
            </ul>
          );
        }
        return <p key={i} className="whitespace-pre-line">{b}</p>;
      })}
    </div>
  );
}
