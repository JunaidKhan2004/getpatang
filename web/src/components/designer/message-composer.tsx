"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { customOrderMessageAction, sellerCustomOrderAction } from "@/app/actions/custom-orders";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export function MessageComposer({ id, as }: { id: string; as: "customer" | "seller" }) {
  const t = useT();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      const res = as === "customer" ? await customOrderMessageAction(id, body.trim()) : await sellerCustomOrderAction(id, "messages", { body: body.trim() });
      if (!res.ok) return void toast.error(res.message);
      setBody("");
      router.refresh();
    });

  return (
    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <label htmlFor="message" className="sr-only">{t("Message")}</label>
      <textarea id="message" required maxLength={2000} rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={as === "customer" ? t("Message the shop") : t("Message the customer")} className="rounded-md border border-border bg-surface px-4 py-3 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
      <div><Button type="submit" size="sm" loading={pending} disabled={!body.trim()}>{t("Send")}</Button></div>
    </form>
  );
}
