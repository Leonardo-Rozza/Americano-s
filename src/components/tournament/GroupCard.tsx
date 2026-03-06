import type { ReactNode } from "react";

type GroupCardProps = {
  groupName: string;
  children: ReactNode;
};

export function GroupCard({ groupName, children }: GroupCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex rounded-full border border-[var(--accent)]/70 bg-[var(--accent)]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
          Grupo {groupName}
        </span>
      </div>
      {children}
    </article>
  );
}
