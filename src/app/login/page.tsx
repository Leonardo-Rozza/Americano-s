import { LoginForm } from "@/components/auth/LoginForm";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

function resolveNextPath(raw: string | undefined): string {
  if (!raw) {
    return "/dashboard";
  }
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  if (raw.startsWith("/login")) {
    return "/dashboard";
  }
  return raw;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const nextPath = resolveNextPath(query.next);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-dim)]">
          Americano&apos;s
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--text)]">Acceso</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Ingresá con tu username para ver únicamente tus torneos.
        </p>

        <div className="mt-6">
          <LoginForm nextPath={nextPath} />
        </div>
      </section>
    </main>
  );
}
