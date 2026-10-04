"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updatePayoutAction } from "@/app/actions/seller";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { PAYOUT_METHODS, type SellerApplication } from "@/lib/seller";
import { useT } from "@/lib/i18n/client";

export function PayoutForm({ shop }: { shop: SellerApplication }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      className="grid max-w-xl gap-4 rounded-md border border-border bg-surface p-5"
      action={(fd) =>
        start(async () => {
          const res = await updatePayoutAction(Object.fromEntries(["payoutMethod", "payoutAccountTitle", "payoutAccountNumber"].map((k) => [k, String(fd.get(k) ?? "")])));
          setErrors(res.fieldErrors ?? {});
          if (res.ok) toast.success(res.message);
          else toast.error(res.message);
        })
      }
    >
      <h2 className="font-display font-semibold">{t("Payout account")}</h2>
      <Alert>{t("For your security, every change to payout details is recorded and may be checked by our team.")}</Alert>
      <div className="grid gap-1.5">
        <label htmlFor="payoutMethod" className="text-sm font-medium">{t("Payout method")}</label>
        <select id="payoutMethod" name="payoutMethod" defaultValue={shop.payoutMethod ?? "bank"} className="h-12 rounded-md border border-border bg-surface px-4">
          {PAYOUT_METHODS.map((m) => <option key={m.value} value={m.value}>{t(m.label)}</option>)}
        </select>
      </div>
      <Field label={t("Account title")} name="payoutAccountTitle" required defaultValue={shop.payoutAccountTitle ?? ""} error={errors.payoutAccountTitle} />
      <Field label={t("IBAN or wallet number")} name="payoutAccountNumber" required defaultValue={shop.payoutAccountNumber ?? ""} error={errors.payoutAccountNumber} />
      <div><Button type="submit" loading={pending}>{t("Save payout details")}</Button></div>
    </form>
  );
}
