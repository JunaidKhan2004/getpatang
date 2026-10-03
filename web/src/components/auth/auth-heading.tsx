export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8 grid gap-2">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-muted">{subtitle}</p>
    </div>
  );
}
