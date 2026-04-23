import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "dispatcher"].includes(profile.role as string)) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-slate-900 px-4 py-6 text-slate-200">
        <Link href="/" className="text-lg font-semibold text-white">Encore Care · Admin</Link>
        <nav className="mt-8 space-y-1 text-sm">
          <Nav href="/admin">Overview</Nav>
          <Nav href="/admin/dispatch">Dispatch board</Nav>
          <Nav href="/admin/claims">Claims</Nav>
          <Nav href="/admin/drivers">Drivers</Nav>
          <Nav href="/admin/facilities">Facilities</Nav>
          <Nav href="/admin/audit">Audit log</Nav>
        </nav>
      </aside>
      <main className="flex-1 px-10 py-8">{children}</main>
    </div>
  );
}

function Nav({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-md px-3 py-2 hover:bg-slate-800">
      {children}
    </Link>
  );
}
