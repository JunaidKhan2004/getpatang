import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PageBody } from "@/components/content/page-body";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/market";

/** Public pages written by staff in Admin → Content. Until one is published, it says so honestly. */
const SECTIONS: Record<string, string> = {
  about: "About",
  contact: "Contact",
  faq: "FAQ",
  terms: "Terms of Service",
  privacy: "Privacy Policy",
};

const getPage = cache((slug: string) => api<{ title: string; body: string; updatedAt: string }>(`/pages/${slug}`).catch(() => null));

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(SECTIONS).map((section) => ({ section }));
}

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const page = SECTIONS[section] ? await getPage(section) : null;
  return { title: page?.title ?? SECTIONS[section] };
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!SECTIONS[section]) notFound();
  const page = await getPage(section);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="mb-2 text-3xl font-bold">{page?.title ?? SECTIONS[section]}</h1>
      {page ? (
        <>
          <p className="mb-8 text-sm text-muted">Last updated {formatDate(page.updatedAt)}</p>
          <PageBody body={page.body} />
        </>
      ) : (
        <EmptyState title="Coming soon" message="This page will be published before launch." action={<ButtonLink href="/" variant="secondary">Back to home</ButtonLink>} />
      )}
    </div>
  );
}
