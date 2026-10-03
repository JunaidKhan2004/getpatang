"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteDesignAction } from "@/app/actions/custom-orders";
import { Button } from "@/components/ui/button";

export function DeleteDesign({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={() => {
        if (!window.confirm(`Delete “${name}”? Requests already sent keep their copy.`)) return;
        start(async () => {
          const res = await deleteDesignAction(id);
          if (res.ok) {
            toast.success(res.message);
            router.refresh();
          } else toast.error(res.message);
        });
      }}
    >
      Delete
    </Button>
  );
}
