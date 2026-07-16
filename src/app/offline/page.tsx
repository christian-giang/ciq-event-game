export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-8">
      <section className="card w-full rounded-2xl p-8 text-center">
        <p className="label-caps mb-2">No connection</p>
        <h1 className="mb-4 text-3xl">The wifi blinked</h1>
        <p className="text-sm leading-relaxed text-muted">
          Nothing is lost — anything you submitted is saved on this phone and
          will upload once you&apos;re back online. Pull down to retry.
        </p>
      </section>
    </main>
  );
}
