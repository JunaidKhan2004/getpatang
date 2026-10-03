"use client";

import { type ComponentProps, useId, useState } from "react";

const inputClass =
  "h-12 w-full rounded-md border bg-surface px-4 text-[15px] text-ink placeholder:text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 aria-[invalid=true]:border-danger";

/** Labelled input with hint and error text wired up for screen readers. */
export function Field({
  label,
  error,
  hint,
  className = "",
  ...props
}: ComponentProps<"input"> & { label: string; error?: string; hint?: string }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        className={`${inputClass} ${error ? "border-danger" : "border-border focus:border-primary"}`}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField(props: Omit<ComponentProps<typeof Field>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Field {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-[34px] rounded px-2 py-1 text-sm font-medium text-primary hover:bg-primary-soft"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export function SelectField({
  label,
  error,
  options,
  ...props
}: ComponentProps<"select"> & { label: string; error?: string; options: string[] }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass} ${error ? "border-danger" : "border-border focus:border-primary"}`}
        {...props}
      >
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
