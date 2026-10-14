"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

const leftNav = [
  { href: "/dashboard", label: "Dashboard", icon: "▣" },
  { href: "/purchases", label: "Purchase", icon: "◫" },
  { href: "/sales-invoices", label: "Sales Invoice", icon: "▤" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col bg-slate-900 text-slate-300">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">
            WF
          </span>
          <span className="text-base font-semibold text-white">WinFab</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {leftNav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className="text-base opacity-80">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="truncate text-xs text-slate-400">{user.email}</p>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="mt-3 w-full rounded-md border border-white/20 px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
