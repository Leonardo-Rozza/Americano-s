type LayoutParams = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function TorneoLayout({ children }: LayoutParams) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 md:px-8">
      {children}
    </main>
  );
}
