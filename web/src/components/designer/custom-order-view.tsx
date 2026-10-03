import { KitePreview } from "@/components/designer/kite-preview";
import { Badge } from "@/components/ui/feedback";
import { COLOR_FIELDS, CUSTOM_STATUS_LABEL, CUSTOM_STATUS_TONE, type CustomOrder, FONT_LABEL, PATTERN_LABEL, SHAPE_LABEL, SIZE_LABEL } from "@/lib/designer";
import { formatDate, formatPKR } from "@/lib/market";

export function CustomStatusBadge({ r }: { r: Pick<CustomOrder, "status" | "quoteExpired"> }) {
  return <Badge tone={r.quoteExpired ? "neutral" : CUSTOM_STATUS_TONE[r.status]}>{r.quoteExpired ? "Quote expired" : CUSTOM_STATUS_LABEL[r.status]}</Badge>;
}

/** The design and the request details, shown to both the customer and the shop. */
export function CustomOrderSummary({ r }: { r: CustomOrder }) {
  const d = r.design;
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted">{label}</dt><dd className="text-right font-medium">{value}</dd></div>
  );
  return (
    <section className="grid gap-4 rounded-md border border-border bg-surface p-5" aria-labelledby="design-summary">
      <h2 id="design-summary" className="font-display font-semibold">{r.designName}</h2>
      <div className="kite-pattern grid place-items-center rounded-md bg-surface-2 p-4">
        <KitePreview design={d} className="h-64 w-full" title={r.designName} />
      </div>
      <dl className="divide-y divide-border text-sm">
        {row("Shape", `${SHAPE_LABEL[d.shape]}, ${SIZE_LABEL[d.size].toLowerCase()}`)}
        {row("Pattern", PATTERN_LABEL[d.pattern])}
        {COLOR_FIELDS.filter((c) => (c.key !== "patternColor" || d.pattern !== "none") && (c.key !== "tailColor" || d.tail) && (c.key !== "textColor" || d.text)).map((c) =>
          row(c.label, <span className="inline-flex items-center gap-2"><span className="size-4 rounded-full border border-border" style={{ background: d[c.key] }} />{d[c.key]}</span>),
        )}
        {d.text && row("Text", `“${d.text}” (${FONT_LABEL[d.font].toLowerCase()} lettering)`)}
        {d.imageUrl && row("Logo", <a href={d.imageUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">View file</a>)}
        {row("Quantity", `${r.quantity} pcs`)}
        {r.budget && row("Budget", formatPKR(r.budget))}
        {r.deadline && row("Needed by", formatDate(r.deadline))}
      </dl>
      <div className="grid gap-1">
        <h3 className="text-sm font-semibold">Details</h3>
        <p className="whitespace-pre-line text-sm">{r.requirements}</p>
      </div>
    </section>
  );
}

export function QuoteBox({ r }: { r: CustomOrder }) {
  if (!r.quote) return null;
  return (
    <section className="grid gap-2 rounded-md border border-primary/40 bg-primary-soft p-5" aria-labelledby="quote">
      <h2 id="quote" className="font-display font-semibold">Quote</h2>
      <p className="text-2xl font-bold tabular-nums">{formatPKR(r.quote.price)} <span className="text-sm font-normal text-muted">for {r.quantity} pcs, plus delivery</span></p>
      <p className="text-sm">Ready in {r.quote.deliveryDays} days after you accept.</p>
      {r.quote.note && <p className="whitespace-pre-line text-sm">{r.quote.note}</p>}
      <p className="text-xs text-muted">{r.quoteExpired ? "This quote has expired." : `Valid until ${formatDate(r.quote.validUntil, true)}.`}</p>
    </section>
  );
}

export function MessageList({ r, viewer }: { r: CustomOrder; viewer: "customer" | "seller" }) {
  return (
    <ol className="grid gap-3" aria-label="Messages">
      {r.messages.map((m) =>
        m.role === "system" ? (
          <li key={m.id} className="text-center text-xs text-muted">{m.body} · {formatDate(m.createdAt, true)}</li>
        ) : (
          <li key={m.id} className={`grid max-w-[85%] gap-1 rounded-md px-4 py-3 text-sm ${m.role === viewer ? "ml-auto bg-primary text-primary-ink" : "border border-border bg-surface"}`}>
            <span className={`text-xs ${m.role === viewer ? "text-primary-ink/80" : "text-muted"}`}>
              {m.role === "seller" ? r.shop.name : (m.author ?? "Customer")} · {formatDate(m.createdAt, true)}
            </span>
            <p className="whitespace-pre-line">{m.body}</p>
          </li>
        ),
      )}
    </ol>
  );
}
