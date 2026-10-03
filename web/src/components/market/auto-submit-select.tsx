"use client";

import type { ComponentProps } from "react";

/** A <select> inside a GET form that submits the form as soon as the choice changes. */
export function AutoSubmitSelect(props: ComponentProps<"select">) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
