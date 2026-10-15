"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

const leftNav = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/company", label: "Company", icon: "company" },
  { href: "/suppliers", label: "Suppliers", icon: "suppliers" },
  { href: "/purchases", label: "Purchase", icon: "purchase" },
  { href: "/customers", label: "Customers", icon: "customers" },
  { href: "/sales-invoices", label: "Sales", icon: "sales" },
  { href: "/recycle-bin", label: "Recycle Bin", icon: "recycle" },
] as const;

function NavIcon({ name }: { name: (typeof leftNav)[number]["icon"] }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "company":
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <path d="M5 21V8l7-4 7 4v13" />
          <path d="M9 21v-6h6v6" />
        </svg>
      );
    case "suppliers":
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <path d="M5 21V10h4v11" />
          <path d="M9 21V6h6v15" />
          <path d="M15 21V12h4v9" />
        </svg>
      );
    case "purchase":
      return (
        <svg {...common}>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
          <path d="M9 16h4" />
        </svg>
      );
    case "customers":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
        </svg>
      );
    case "sales":
      return (
        <svg {...common}>
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M3 6h.01" />
          <path d="M3 12h.01" />
          <path d="M3 18h.01" />
        </svg>
      );
    case "recycle":
      return (
        <svg {...common}>
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      );
    default:
      return null;
  }
}

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
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">
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
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <NavIcon name={item.icon} />
                </span>
                <span className="leading-none">{item.label}</span>
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
