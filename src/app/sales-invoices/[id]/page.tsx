"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import SalesInvoiceFormModal, {
  invoicePoLabel,
} from "@/components/SalesInvoiceFormModal";
import { downloadSalesInvoicePdf } from "@/lib/invoicePdf";
import {
  api,
  formatDate,
  money,
  type Company,
  type Party,
  type PurchaseOrder,
  type SalesInvoice,
} from "@/lib/api";

export default function SalesInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || "");

  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [customer, setCustomer] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [inv, p, c, co] = await Promise.all([
        api.getSalesInvoice(id),
        api.getPurchases(),
        api.getCustomers(),
        api.getCompany(),
      ]);
      setInvoice(inv);
      setPurchases(p);
      setCustomers(c.filter((item) => item.active !== false));
      setCompany(co);

      const customerList = c.filter((item) => item.active !== false);
      let resolved: Party | null = null;
      if (inv.customerId) {
        try {
          resolved = await api.getCustomer(String(inv.customerId));
        } catch {
          resolved =
            customerList.find((item) => item._id === String(inv.customerId)) ||
            null;
        }
      } else if (inv.customerName) {
        resolved =
          customerList.find(
            (item) =>
              item.name.toLowerCase() === inv.customerName!.toLowerCase()
          ) || null;
      }
      setCustomer(resolved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoice");
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const linesByPo = useMemo(() => {
    if (!invoice) return [];
    const map = new Map<
      string,
      { poNumber: string; lines: typeof invoice.items; total: number }
    >();
    for (const item of invoice.items) {
      const key = item.poNumber || "Unknown PO";
      let group = map.get(key);
      if (!group) {
        group = { poNumber: key, lines: [], total: 0 };
        map.set(key, group);
      }
      group.lines.push(item);
      group.total += item.amount;
    }
    return Array.from(map.values());
  }, [invoice]);

  async function togglePayment() {
    if (!invoice) return;
    try {
      const updated = await api.updateSalesInvoice(invoice._id, {
        paymentReceived: !invoice.paymentReceived,
      });
      setInvoice(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function onDelete() {
    if (!invoice) return;
    if (
      !confirm(
        "Move this invoice to Recycle Bin? Remaining qty on the linked POs will be restored."
      )
    )
      return;
    try {
      await api.deleteSalesInvoice(invoice._id);
      router.replace("/sales-invoices");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function onDownloadPdf() {
    if (!invoice) return;
    if (!customer) {
      setError(
        "Select a customer on this invoice. HSN and GST % are taken from Customer master."
      );
      setEditOpen(true);
      return;
    }
    if (!customer.hsnCode?.trim()) {
      setError("Add HSN Code on Customer master for this customer.");
      return;
    }
    if (
      customer.gstPercentage === undefined ||
      customer.gstPercentage === null ||
      !Number.isFinite(Number(customer.gstPercentage))
    ) {
      setError("Add GST % on Customer master for this customer.");
      return;
    }
    try {
      setError("");
      downloadSalesInvoicePdf({
        invoice,
        company,
        customer,
        purchases,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF download failed");
    }
  }

  return (
    <AppShell>
      <div className="mb-4">
        <Link
          href="/sales-invoices"
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          ← Back to Sales
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : error && !invoice ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : invoice ? (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  {invoice.billNo}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Bill date {formatDate(invoice.billDate)}
                  {invoice.customerName || customer?.name
                    ? ` · ${invoice.customerName || customer?.name}`
                    : " · No customer"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  POs: {invoicePoLabel(invoice)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  HSN: {customer?.hsnCode || "—"} · GST:{" "}
                  {customer?.gstPercentage !== undefined &&
                  customer?.gstPercentage !== null
                    ? `${customer.gstPercentage}%`
                    : "—"}{" "}
                  <span className="text-slate-400">(from Customer master)</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={invoice.paymentReceived}
                    onChange={togglePayment}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  Payment received
                </label>
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Move to bin
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Total
                </p>
                <p className="mt-1 text-xl font-semibold text-emerald-600">
                  {money(invoice.totalAmount)}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Line items
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-800">
                  {invoice.items.length}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Purchase orders
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-800">
                  {linesByPo.length}
                </p>
              </div>
            </div>
          </div>

          {linesByPo.map((group) => (
            <section
              key={group.poNumber}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    PO {group.poNumber}
                  </p>
                  <p className="text-sm text-slate-500">
                    {group.lines.length} line
                    {group.lines.length === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-emerald-600">
                  {money(group.total)}
                </p>
              </header>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2.5 font-medium">Part No</th>
                      <th className="px-4 py-2.5 font-medium">Description</th>
                      <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Rate
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.lines.map((item, index) => (
                      <tr
                        key={`${group.poNumber}-${index}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {item.partNo}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.description}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {item.qty}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {money(item.rate)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-600">
                          {money(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : null}

      <SalesInvoiceFormModal
        open={editOpen}
        invoice={invoice}
        purchases={purchases}
        customers={customers}
        onClose={() => setEditOpen(false)}
        onSaved={(saved) => {
          setInvoice(saved);
          setEditOpen(false);
          load();
        }}
      />
    </AppShell>
  );
}
