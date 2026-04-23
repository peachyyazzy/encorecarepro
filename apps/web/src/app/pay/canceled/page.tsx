import Link from "next/link";

export default async function PayCanceledPage({
  searchParams,
}: {
  searchParams: Promise<{ trip_id?: string }>;
}) {
  const { trip_id } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Checkout canceled</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your trip is still saved. You can finish paying any time, and we&apos;ll
          assign a driver as soon as payment clears.
        </p>

        <div className="mt-8 flex gap-3">
          {trip_id && (
            <Link
              href={`/facility/trips/${trip_id}`}
              className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-brand-700"
            >
              Finish paying
            </Link>
          )}
          <Link
            href="/facility/trips"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:border-slate-400"
          >
            Back to trips
          </Link>
        </div>
      </div>
    </main>
  );
}
