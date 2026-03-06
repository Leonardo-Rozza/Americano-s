type ParejaNameProps = {
  name: string;
  variant?: "default" | "winner" | "loser" | "bye";
  className?: string;
};

export function ParejaName({ name, variant = "default", className }: ParejaNameProps) {
  const variantClass =
    variant === "winner"
      ? "text-[var(--green)]"
      : variant === "loser"
        ? "text-[var(--red)]"
        : variant === "bye"
          ? "text-[var(--purple)]"
          : "text-[var(--text)]";

  return (
    <span
      className={`min-w-0 truncate text-sm font-semibold md:text-base ${variantClass} ${className ?? ""}`}
      title={name}
    >
      {name}
    </span>
  );
}
