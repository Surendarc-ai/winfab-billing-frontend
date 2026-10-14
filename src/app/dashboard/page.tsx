"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import {
  api,
  money,
  remainingQty,
  type PurchaseOrder,
  type SalesInvoice,
} from "@/lib/api";

export default function DashboardPage() {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getPurchases(), api.getSalesInvoices()])
      .then(([p, i]) => {
        setPurchases(p);
        setInvoices(i);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      );
  }, []);

  const stats = useMemo(() => {
    const openPos = purchases.filter((p) => p.status !== "closed").length;
    const billed = invoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const unpaid = invoices
      .filter((i) => !i.paymentReceived)
      .reduce((sum, i) => sum + i.totalAmount, 0);
    const remainingLines = purchases.reduce(
      (sum, po) =>
        sum + po.items.filter((item) => remainingQty(item) > 0).length,
      0
    );
    return { openPos, billed, unpaid, remainingLines };
  }, [purchases, invoices]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Overview of purchases and sales invoices.
          </p>

          {error ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Open / partial POs" value={String(stats.openPos)} />
            <Stat
              label="Lines still billable"
              value={String(stats.remainingLines)}
            />
            <Stat label="Invoiced total" value={money(stats.billed)} />
            <Stat label="Payment pending" value={money(stats.unpaid)} />
          </section>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Quick actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/purchases"
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Add Purchase
            </Link>
            <Link
              href="/sales-invoices"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              + Add Invoice
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}
