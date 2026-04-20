type ModeBadgeProps = {
  mode: "auth" | "demo";
};

export function ModeBadge({ mode }: ModeBadgeProps) {
  const className =
    mode === "auth"
      ? "border-zinc-300 text-zinc-700"
      : "border-emerald-300 bg-emerald-50 text-emerald-700";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${className}`}>
      {mode.toUpperCase()}
    </span>
  );
}
