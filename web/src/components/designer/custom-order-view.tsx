import { KitePreview } from "@/components/designer/kite-preview";
import { Badge } from "@/components/ui/feedback";
import { COLOR_FIELDS, CUSTOM_STATUS_LABEL, CUSTOM_STATUS_TONE, type CustomOrder, FONT_LABEL, PATTERN_LABEL, SHAPE_LABEL, SIZE_LABEL } from "@/lib/designer";
import { formatDate, formatPKR } from "@/lib/market";
import { getT } from "@/lib/i18n/server";

export async function CustomStatusBadge({ r }: { r: Pick<CustomOrder, "status" | "quoteExpired"> }) {
  const t = await getT();
  return <Badge tone={r.quoteExpired ? "neutral" : CUSTOM_STATUS_TONE[r.status]}>{r.quoteExpired ? t("Quote expired") : t(CUSTOM_STATUS_LABEL[r.status])}</Badge>;
}

/** The design and the request details, shown to both the customer and the shop. */
export async function CustomOrderSummary({ r }: { r: CustomOrder }) {
  const t = await getT();
  const d = r.design;
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted">{label}</dt><dd className="text-end font-medium">{value}</dd></div>
  );
  return (
    <section className="grid gap-4 rounded-md border border-border bg-surface p-5" aria-labelledby="design-summary">
      <h2 id="design-summary" className="font-display font-semibold">{r.designName}</h2>
      <div className="kite-pattern grid place-items-center rounded-md bg-surface-2 p-4">
        <KitePreview design={d} className="h-64 w-full" title={r.designName} />
      </div>
      <dl className="divide-y divide-border text-sm">
        {row(t("Shape"), t("{shape}, {size}", { shape: t(SHAPE_LABEL[d.shape]), size: t(SIZE_LABEL[d.size]).toLowerCase() }))}
        {row(t("Pattern"), t(PATTERN_LABEL[d.pattern]))}
        {COLOR_FIELDS.filter((c) => (c.key !== "patternColor" || d.pattern !== "none") && (c.key !== "tailColor" || d.tail) && (c.key !== "textColor" || d.text)).map((c) =>
          row(c.label, <span className="inline-flex items-center gap-2"><span className="size-4 rounded-full border border-border" style={{ background: d[c.key] }} />{d[c.key]}</span>),
        )}
        {d.text && row(t("Text"), t("“{text}” ({font} lettering)", { text: d.text, font: t(FONT_LABEL[d.font]).toLowerCase() }))}
        {d.imageUrl && row(t("Logo"), <a href={d.imageUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{t("View file")}</a>)}
        {row(t("Quantity"), t("{quantity} pcs", { quantity: r.quantity }))}
        {r.budget && row(t("Budget"), formatPKR(r.budget))}
        {r.deadline && row(t("Needed by"), formatDate(r.deadline))}
      </dl>
      <div className="grid gap-1">
        <h3 className="text-sm font-semibold">{t("Details")}</h3>
        <p className="whitespace-pre-line text-sm">{r.requirements}</p>
      </div>
    </section>
  );
}

export async function QuoteBox({ r }: { r: CustomOrder }) {
  const t = await getT();
  if (!r.quote) return null;
  return (
    <section className="grid gap-2 rounded-md border border-primary/40 bg-primary-soft p-5" aria-labelledby="quote">
      <h2 id="quote" className="font-display font-semibold">{t("Quote")}</h2>
      <p className="text-2xl font-bold tabular-nums">{formatPKR(r.quote.price)} <span className="text-sm font-normal text-muted">{t("for {quantity} pcs, plus delivery", { quantity: r.quantity })}</span></p>
      <p className="text-sm">{t("Ready in {deliveryDays} days after you accept.", { deliveryDays: r.quote.deliveryDays })}</p>
      {r.quote.note && <p className="whitespace-pre-line text-sm">{r.quote.note}</p>}
      <p className="text-xs text-muted">{r.quoteExpired ? t("This quote has expired.") : t("Valid until {true}.", { true: formatDate(r.quote.validUntil, true) })}</p>
    </section>
  );
}

export async function MessageList({ r, viewer }: { r: CustomOrder; viewer: "customer" | "seller" }) {
  const t = await getT();
  return (
    <ol className="grid gap-3" aria-label={t("Messages")}>
      {r.messages.map((m) =>
        m.role === "system" ? (
          <li key={m.id} className="text-center text-xs text-muted">{m.body} · {formatDate(m.createdAt, true)}</li>
        ) : (
          <li key={m.id} className={`grid max-w-[85%] gap-1 rounded-md px-4 py-3 text-sm ${m.role === viewer ? "ms-auto bg-primary text-primary-ink" : "border border-border bg-surface"}`}>
            <span className={`text-xs ${m.role === viewer ? "text-primary-ink/80" : "text-muted"}`}>
              {m.role === "seller" ? r.shop.name : (m.author ?? t("Customer"))} · {formatDate(m.createdAt, true)}
            </span>
            <p className="whitespace-pre-line">{m.body}</p>
          </li>
        ),
      )}
    </ol>
  );
}
