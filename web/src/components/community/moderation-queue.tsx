import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { type ModerationItem, REPORT_REASONS, timeAgo } from "@/lib/community";
import { getAccessToken } from "@/lib/session";

import { ModerationActions } from "./moderation-actions";

const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;

/** Server component shared by /admin/community (posts, comments, users) and /admin/reports (everything). */
export async function ModerationQueue({
  basePath,
  title,
  description,
  types,
  params,
}: {
  basePath: string;
  title: string;
  description: string;
  types: string[];
  params: { type?: string; state?: string; page?: string };
}) {
  const state = params.state === "closed" ? "closed" : "open";
  const type = types.includes(params.type ?? "") ? params.type : types.length === 1 ? types[0] : undefined;
  const result = await apiPage<ModerationItem>("/admin/moderation", {
    token: await getAccessToken(),
    query: { state, targetType: type, page: params.page, pageSize: 20 },
  }).catch(() => null);
  const visible = result?.data.filter((i) => !type ? types.includes(i.targetType) : true) ?? [];
  const href = (p: Record<string, string | undefined>) => `${basePath}?${new URLSearchParams(Object.entries({ state, type, ...p }).filter(([, v]) => v) as [string, string][])}`;
  const tab = "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary";

  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="mb-4 flex flex-wrap justify-between gap-2">
        <nav aria-label="Type" className="flex gap-1 overflow-x-auto">
          {types.length > 1 && <Link href={href({ type: undefined })} aria-current={!type ? "page" : undefined} className={tab}>All</Link>}
          {types.map((t) => (
            <Link key={t} href={href({ type: t })} aria-current={type === t ? "page" : undefined} className={`${tab} capitalize`}>{t}s</Link>
          ))}
        </nav>
        <nav aria-label="State" className="flex gap-1">
          <Link href={href({ state: "open", page: undefined })} aria-current={state === "open" ? "page" : undefined} className={tab}>Needs review</Link>
          <Link href={href({ state: "closed", page: undefined })} aria-current={state === "closed" ? "page" : undefined} className={tab}>Closed</Link>
        </nav>
      </div>

      {!result && <Alert tone="error">Reports could not load. You may not have moderation access.</Alert>}
      {result && visible.length === 0 && <EmptyState title={state === "open" ? "Nothing to review" : "No closed reports"} message={state === "open" ? "New reports appear here, most-reported first." : "Decisions you make appear here."} />}
      {result && visible.length > 0 && (
        <>
          <ul className="grid gap-4">
            {visible.map((item) => (
              <li key={`${item.targetType}:${item.targetId}`} className="grid gap-4 rounded-md border border-border bg-surface p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="grid min-w-0 content-start gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{item.targetType}</Badge>
                    <Badge tone={item.reportCount >= 3 ? "danger" : "warning"}>{item.reportCount} {item.reportCount === 1 ? "report" : "reports"}</Badge>
                    {item.preview?.status && <Badge tone={item.preview.status === "VISIBLE" || item.preview.status === "ACTIVE" ? "neutral" : "danger"}>{item.preview.status.toLowerCase()}</Badge>}
                    <span className="text-xs text-muted">latest {timeAgo(item.latestAt)}</span>
                  </div>
                  {item.preview ? (
                    <blockquote className="rounded-md border-l-4 border-primary/40 bg-surface-2 px-3 py-2 text-sm whitespace-pre-line break-words">
                      {item.preview.text}
                      {item.preview.media && item.preview.media.length > 0 && <span className="mt-1 block text-xs text-muted">+ {item.preview.media.length} {item.preview.media[0].kind === "video" ? "video" : "photo(s)"}</span>}
                    </blockquote>
                  ) : (
                    <p className="text-sm text-muted">The reported item no longer exists.</p>
                  )}
                  <p className="text-xs text-muted">
                    {item.preview?.author && <>By {item.preview.author.fullName} · </>}
                    {item.preview?.link && <Link href={item.preview.link} target="_blank" className="font-semibold text-primary hover:underline">Open</Link>}
                    {item.preview?.adminLink && <> · <Link href={item.preview.adminLink} className="font-semibold text-primary hover:underline">Manage in admin</Link></>}
                    {item.preview?.note && <> · {item.preview.note}</>}
                  </p>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted">
                      {Object.entries(item.reasons).map(([r, n]) => `${reasonLabel(r)} (${n})`).join(", ")}
                    </summary>
                    <ul className="mt-2 grid gap-1">
                      {item.reports.map((r) => (
                        <li key={r.id} className="text-xs">
                          <strong>{r.reporter.fullName}</strong>: {reasonLabel(r.reason)}{r.details && ` — “${r.details}”`} <span className="text-muted">· {timeAgo(r.createdAt)}</span>
                          {r.action && <span className="text-muted"> · {r.action}{r.resolution && `: ${r.resolution}`}</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
                {state === "open" && <ModerationActions targetType={item.targetType} targetId={item.targetId} />}
              </li>
            ))}
          </ul>
          <Pagination meta={result.meta} basePath={basePath} params={{ state, type }} />
        </>
      )}
    </>
  );
}
