import Link from "next/link";

import type { PageMeta } from "@/lib/api";
import { getT } from "@/lib/i18n/server";

/** Previous/next links that keep the current filters in the URL. */
export async function Pagination({ meta, basePath, params }: { meta: PageMeta; basePath: string; params: Record<string, string | undefined> }) {
  const t = await getT();
  if (meta.totalPages <= 1) return null;
  const href = (page: number) => {
    const qs = new URLSearchParams(Object.entries({ ...params, page: String(page) }).filter(([, v]) => v) as [string, string][]);
    return `${basePath}?${qs}`;
  };
  const link = "rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2";
  return (
    <nav aria-label={t("Pagination")} className="mt-8 flex items-center justify-between gap-4">
      {meta.page > 1 ? <Link className={link} href={href(meta.page - 1)} rel="prev">{t("Previous")}</Link> : <span />}
      <span className="text-sm text-muted tabular-nums">
        {t("Page {page} of {totalPages}", { page: meta.page, totalPages: meta.totalPages })}
      </span>
      {meta.page < meta.totalPages ? <Link className={link} href={href(meta.page + 1)} rel="next">{t("Next")}</Link> : <span />}
    </nav>
  );
}
