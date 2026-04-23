import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-16">
      <nav className="flex items-center justify-between">
        <div className="text-xl font-semibold text-brand-700">Encore Care NEMT</div>
        <div className="flex gap-3">
          <Link href="/login" className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-brand-600">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Get started
          </Link>
        </div>
      </nav>

      <section className="mt-24">
        <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight text-slate-900">
          Non-emergency medical transportation, booked in minutes.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-600">
          Riders and family members book trips from our mobile app. Healthcare
          facilities schedule and manage trips for their patients here. We
          handle the drivers, the invoicing, and—if you&apos;re on a care
          plan—the claims submission.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/facility/dashboard"
            className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700"
          >
            Facility portal
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:border-slate-400"
          >
            Rider &amp; family sign-up
          </Link>
        </div>
      </section>

      <section className="mt-24 grid gap-8 md:grid-cols-3">
        <FeatureCard
          title="Private-pay invoices"
          body="Ride on your own dime or with an HSA/FSA and receive a claim-ready superbill with HCPCS codes you can submit against your own plan."
        />
        <FeatureCard
          title="Medicaid &amp; MCO claims"
          body="On a care plan? We handle the 837P submission to your payer so you never have to think about it."
        />
        <FeatureCard
          title="Standing orders"
          body="Dialysis three times a week? Schedule it once — we generate every recurring trip automatically."
        />
      </section>
    </main>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900" dangerouslySetInnerHTML={{ __html: title }} />
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}
