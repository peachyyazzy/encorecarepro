import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function FacilityLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/facility/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white px-4 py-6">
        <Link href="/" className="text-lg font-semibold text-brand-700">Encore Care</Link>
        <nav className="mt-8 space-y-1 text-sm">
          <NavLink href="/facility/dashboard">Dashboard</NavLink>
          <NavLink href="/facility/book">Book a trip</NavLink>
          <NavLink href="/facility/trips">Trips</NavLink>
          <NavLink href="/facility/patients">Patients</NavLink>
          <NavLink href="/facility/schedules">Recurring schedules</NavLink>
          <NavLink href="/facility/invoices">Invoices</NavLink>
        </nav>
        <div className="mt-auto pt-8 text-xs text-slate-500">
          Signed in as<br />
          <span className="font-medium text-slate-700">
            {profile ? `${profile.first_name} ${profile.last_name}` : user.email}
          </span>
        </div>
      </aside>
      <main className="flex-1 px-10 py-8">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-brand-700"
    >
      {children}
    </Link>
  );
}
