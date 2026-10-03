"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { recalculateRankingsAction } from "@/app/actions/tournaments";
import { Button } from "@/components/ui/button";

export function RecalculateButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await recalculateRankingsAction();
          if (res.ok) toast.success(res.message);
          else toast.error(res.message);
        })
      }
    >
      Recalculate all rankings
    </Button>
  );
}
