"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import ListToolbar from "@/components/ListToolbar";
import RowActions from "@/components/RowActions";
import SalesInvoiceFormModal, {
  invoicePoLabel,
} from "@/components/SalesInvoiceFormModal";
import {
  api,
  formatDate,
  money,
  type Party,
  type PurchaseOrder,
  type SalesInvoice,
} from "@/lib/api";
import { exportToExcel } from "@/lib/exportExcel";

export default function SalesInvoicesPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, i, c] = await Promise.all([
        api.getPurchases(),
        api.getSalesInvoices(),
        api.getCustomers(),
      ]);
      setPurchases(p);
      setInvoices(i);
      setCustomers(c.filter((item) => item.active !== false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (inv) =>
        inv.billNo.toLowerCase().includes(q) ||
        inv.poNumber.toLowerCase().includes(q) ||
        (inv.poNumbers || []).some((po) => po.toLowerCase().includes(q)) ||
        (inv.customerName || "").toLowerCase().includes(q) ||
        inv.items.some(
          (item) =>
            item.partNo.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            (item.poNumber || "").toLowerCase().includes(q)
        )
    );
  }, [invoices, search]);

  async function togglePayment(invoice: SalesInvoice, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.updateSalesInvoice(invoice._id, {
        paymentReceived: !invoice.paymentReceived,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function onDelete(id: string) {
    if (
      !confirm(
        "Move this invoice to Recycle Bin? Remaining qty on the linked POs will be restored."
      )
    )
      return;
    try {
      await api.deleteSalesInvoice(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <AppShell>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-5 text-3xl font-bold tracking-tight text-slate-900">
          Sales Invoice
        </h1>

        <ListToolbar
          addLabel="Add Invoice"
          onAdd={() => {
            setError("");
            setOpen(true);
          }}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search by bill no, PO no, part no..."
          totalLabel={`Bills: ${filtered.length}`}
          exportDisabled={!filtered.length}
          onExportExcel={() => {
            try {
              exportToExcel(
                filtered.flatMap((invoice) =>
                  invoice.items.map((item) => ({
                    "Bill No": invoice.billNo,
                    "PO No": item.poNumber || invoicePoLabel(invoice),
                    "Bill Date": formatDate(invoice.billDate),
                    Customer: invoice.customerName || "",
                    "Part No": item.partNo,
                    Description: item.description,
                    Qty: item.qty,
                    Rate: item.rate,
                    Amount: item.amount,
                    Payment: invoice.paymentReceived ? "Received" : "Pending",
                  }))
                ),
                `sales-invoices-${new Date().toISOString().slice(0, 10)}`,
                "Sales Invoices"
              );
            } catch (err) {
              setError(err instanceof Error ? err.message : "Export failed");
            }
          }}
        />

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
          ) : !filtered.length ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No invoices yet. Click <strong>+ Add Invoice</strong>.
            </p>
          ) : (
            filtered.map((invoice) => {
              const poCount =
                invoice.poNumbers?.length ||
                (invoice.poNumber ? invoice.poNumber.split(",").length : 0);
              return (
                <Link
                  key={invoice._id}
                  href={`/sales-invoices/${invoice._id}`}
                  className="block rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-blue-300 hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900">
                        {invoice.billNo}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {formatDate(invoice.billDate)}
                        {invoice.customerName
                          ? ` · ${invoice.customerName}`
                          : ""}
                        {" · "}
                        {invoice.items.length} line
                        {invoice.items.length === 1 ? "" : "s"}
                        {" · "}
                        {poCount} PO{poCount === 1 ? "" : "s"}
                      </p>
                      <p className="mt-1 truncate text-sm text-slate-600">
                        PO {invoicePoLabel(invoice)}
                      </p>
                    </div>

                    <div
                      className="flex flex-wrap items-center gap-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label
                        className="inline-flex items-center gap-2 text-sm text-slate-600"
                        onClick={(e) => e.preventDefault()}
                      >
                        <input
                          type="checkbox"
                          checked={invoice.paymentReceived}
                          onChange={() => undefined}
                          onClick={(e) => togglePayment(invoice, e)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        Paid
                      </label>
                      <span className="text-sm font-semibold text-emerald-600">
                        {money(invoice.totalAmount)}
                      </span>
                      <RowActions
                        onEdit={() =>
                          router.push(`/sales-invoices/${invoice._id}`)
                        }
                        onDelete={() => onDelete(invoice._id)}
                      />
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <SalesInvoiceFormModal
        open={open}
        purchases={purchases}
        customers={customers}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          load();
        }}
      />
    </AppShell>
  );
}
