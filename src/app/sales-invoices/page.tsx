"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import ListToolbar from "@/components/ListToolbar";
import Modal from "@/components/Modal";
import RowActions from "@/components/RowActions";
import {
  api,
  formatDate,
  money,
  remainingQty,
  type PurchaseOrder,
  type SalesInvoice,
  type SalesInvoiceItem,
} from "@/lib/api";
import { exportToExcel } from "@/lib/exportExcel";

type BillLine = {
  poItemId: string;
  partNo: string;
  description: string;
  maxQty: number;
  qty: string;
  rate: string;
  selected: boolean;
};

type InvoiceLine = {
  invoice: SalesInvoice;
  item: SalesInvoiceItem;
  index: number;
};

function toDateInput(value?: string) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function poIdOf(invoice: SalesInvoice) {
  return typeof invoice.purchaseOrder === "string"
    ? invoice.purchaseOrder
    : invoice.purchaseOrder?._id || "";
}

export default function SalesInvoicesPage() {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [lines, setLines] = useState<BillLine[]>([]);
  const [billDate, setBillDate] = useState("");
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, i] = await Promise.all([
        api.getPurchases(),
        api.getSalesInvoices(),
      ]);
      setPurchases(p);
      setInvoices(i);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const billablePos = useMemo(
    () =>
      purchases.filter((po) =>
        po.items.some((item) => remainingQty(item) > 0)
      ),
    [purchases]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (inv) =>
        inv.billNo.toLowerCase().includes(q) ||
        inv.poNumber.toLowerCase().includes(q) ||
        inv.items.some(
          (item) =>
            item.partNo.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q)
        )
    );
  }, [invoices, search]);

  const tableLines = useMemo<InvoiceLine[]>(
    () =>
      filtered.flatMap((invoice) =>
        invoice.items.map((item, index) => ({ invoice, item, index }))
      ),
    [filtered]
  );

  const groupedByPo = useMemo(() => {
    type BillGroup = {
      invoice: SalesInvoice;
      lines: InvoiceLine[];
      totalAmount: number;
    };

    type PoGroup = {
      poNumber: string;
      supplier: string;
      bills: BillGroup[];
      totalAmount: number;
    };

    const poMap = new Map<string, PoGroup>();

    for (const line of tableLines) {
      const poKey = line.invoice.poNumber || "Unknown PO";
      const supplier =
        typeof line.invoice.purchaseOrder === "object" &&
        line.invoice.purchaseOrder
          ? line.invoice.purchaseOrder.supplier || ""
          : purchases.find((p) => p.poNumber === poKey)?.supplier || "";

      let poGroup = poMap.get(poKey);
      if (!poGroup) {
        poGroup = {
          poNumber: poKey,
          supplier,
          bills: [],
          totalAmount: 0,
        };
        poMap.set(poKey, poGroup);
      } else if (!poGroup.supplier && supplier) {
        poGroup.supplier = supplier;
      }

      let billGroup = poGroup.bills.find(
        (b) => b.invoice._id === line.invoice._id
      );
      if (!billGroup) {
        billGroup = {
          invoice: line.invoice,
          lines: [],
          totalAmount: 0,
        };
        poGroup.bills.push(billGroup);
      }

      billGroup.lines.push(line);
      billGroup.totalAmount += line.item.amount;
      poGroup.totalAmount += line.item.amount;
    }

    return Array.from(poMap.values());
  }, [tableLines, purchases]);

  function resetForm() {
    setEditingId(null);
    setSelectedPoId("");
    setBillNo("");
    setLines([]);
    setBillDate("");
    setPaymentReceived(false);
  }

  function buildLinesFromPo(
    po: PurchaseOrder,
    currentInvoice?: SalesInvoice | null
  ) {
    const credited = new Map<string, number>();
    if (currentInvoice) {
      for (const line of currentInvoice.items) {
        credited.set(
          String(line.poItemId),
          (credited.get(String(line.poItemId)) || 0) + line.qty
        );
      }
    }

    return po.items
      .map((item) => {
        const id = String(item._id);
        const maxQty = remainingQty(item) + (credited.get(id) || 0);
        const current = currentInvoice?.items.find(
          (line) => String(line.poItemId) === id
        );
        return {
          poItemId: id,
          partNo: item.partNo,
          description: item.description,
          maxQty,
          qty: current ? String(current.qty) : maxQty > 0 ? String(maxQty) : "0",
          rate: String(current?.rate ?? item.rate),
          selected: Boolean(current) || (!currentInvoice && maxQty > 0),
        };
      })
      .filter((line) => line.maxQty > 0 || line.selected);
  }

  function onSelectPo(poId: string) {
    setSelectedPoId(poId);
    const po = purchases.find((p) => p._id === poId);
    if (!po) {
      setLines([]);
      return;
    }
    setLines(buildLinesFromPo(po));
  }

  function openCreate() {
    setError("");
    resetForm();
    setOpen(true);
  }

  function openEdit(invoice: SalesInvoice) {
    setError("");
    setEditingId(invoice._id);
    setBillNo(invoice.billNo);
    setBillDate(toDateInput(invoice.billDate));
    setPaymentReceived(invoice.paymentReceived);
    const poId = poIdOf(invoice);
    setSelectedPoId(poId);
    const po = purchases.find((p) => p._id === poId);
    if (po) {
      setLines(buildLinesFromPo(po, invoice));
    } else {
      setLines(
        invoice.items.map((item) => ({
          poItemId: String(item.poItemId),
          partNo: item.partNo,
          description: item.description,
          maxQty: item.qty,
          qty: String(item.qty),
          rate: String(item.rate),
          selected: true,
        }))
      );
    }
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!billNo.trim()) {
      setError("Bill no is required");
      return;
    }

    const selected = lines.filter(
      (line) => line.selected && Number(line.qty) > 0
    );
    if (!selectedPoId || !selected.length) {
      setError("Select a PO and at least one item qty to bill");
      return;
    }

    const payload = {
      purchaseOrderId: selectedPoId,
      billNo: billNo.trim(),
      billDate: billDate || undefined,
      paymentReceived,
      items: selected.map((line) => ({
        poItemId: line.poItemId,
        qty: Number(line.qty),
        rate: Number(line.rate),
      })),
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.updateSalesInvoice(editingId, payload);
      } else {
        await api.createSalesInvoice(payload);
      }
      resetForm();
      setOpen(false);
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingId
            ? "Could not update invoice"
            : "Could not create invoice"
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePayment(invoice: SalesInvoice) {
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
        "Delete this invoice? Remaining qty on the PO will be restored."
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

  const draftTotal = lines
    .filter((l) => l.selected)
    .reduce(
      (sum, line) => sum + (Number(line.qty) || 0) * (Number(line.rate) || 0),
      0
    );

  const poOptions = editingId
    ? purchases.filter((po) => po._id === selectedPoId)
    : billablePos;

  return (
    <AppShell>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-5 text-3xl font-bold tracking-tight text-slate-900">
          Sales Invoice
        </h1>

        <ListToolbar
          addLabel="Add Invoice"
          onAdd={openCreate}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search by bill no, PO no, part no..."
          totalLabel={`Total POs: ${groupedByPo.length} · Bills: ${filtered.length} · Lines: ${tableLines.length}`}
          exportDisabled={!tableLines.length}
          onExportExcel={() => {
            try {
              exportToExcel(
                tableLines.map(({ invoice, item }) => ({
                  "PO No": invoice.poNumber,
                  "Bill No": invoice.billNo,
                  "Bill Date": formatDate(invoice.billDate),
                  "Part No": item.partNo,
                  Description: item.description,
                  Qty: item.qty,
                  Rate: item.rate,
                  Amount: item.amount,
                  Payment: invoice.paymentReceived ? "Received" : "Pending",
                })),
                `sales-invoices-${new Date().toISOString().slice(0, 10)}`,
                "Sales Invoices"
              );
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Export failed"
              );
            }
          }}
        />

        {error && !open ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 space-y-5">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
          ) : !groupedByPo.length ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No invoices yet. Click <strong>+ Add Invoice</strong>.
            </p>
          ) : (
            groupedByPo.map((poGroup) => (
              <section
                key={poGroup.poNumber}
                className="overflow-hidden rounded-xl border border-slate-200"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      PO - {poGroup.poNumber}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {poGroup.supplier || "—"} · {poGroup.bills.length} bill
                      {poGroup.bills.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="text-base font-semibold text-emerald-600">
                    {money(poGroup.totalAmount)}
                  </p>
                </header>

                <div className="divide-y divide-slate-200">
                  {poGroup.bills.map((bill) => (
                    <div key={bill.invoice._id} className="bg-white">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-800">
                            {bill.invoice.billNo}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-500">
                            {formatDate(bill.invoice.billDate)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                            <input
                              type="checkbox"
                              checked={bill.invoice.paymentReceived}
                              onChange={() => togglePayment(bill.invoice)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600"
                            />
                            Paid
                          </label>
                          <span className="text-sm font-semibold text-emerald-600">
                            {money(bill.totalAmount)}
                          </span>
                          <RowActions
                            onEdit={() => openEdit(bill.invoice)}
                            onDelete={() => onDelete(bill.invoice._id)}
                          />
                        </div>
                      </div>

                      <div className="overflow-x-auto border-t border-slate-100 px-2 pb-2">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                              <th className="px-3 py-2 font-medium">Part No</th>
                              <th className="px-3 py-2 font-medium">
                                Description
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                Qty
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                Rate
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {bill.lines.map(({ item, index }) => (
                              <tr
                                key={`${bill.invoice._id}-${index}`}
                                className="border-t border-slate-100"
                              >
                                <td className="px-3 py-2.5 font-medium text-slate-800">
                                  {item.partNo}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600">
                                  {item.description}
                                </td>
                                <td className="px-3 py-2.5 text-right text-slate-600">
                                  {item.qty}
                                </td>
                                <td className="px-3 py-2.5 text-right text-slate-600">
                                  {money(item.rate)}
                                </td>
                                <td className="px-3 py-2.5 text-right font-medium text-emerald-600">
                                  {money(item.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      <Modal
        open={open}
        title={editingId ? "Edit Sales Invoice" : "Add Sales Invoice"}
        wide
        onClose={() => {
          setOpen(false);
          setError("");
          resetForm();
        }}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-500">Bill No</span>
              <input
                type="text"
                required
                value={billNo}
                onChange={(e) => setBillNo(e.target.value)}
                placeholder="e.g. INV-001 / Tax invoice no"
                className="rounded-md border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-500">PO ID</span>
              <select
                required
                value={selectedPoId}
                disabled={Boolean(editingId)}
                onChange={(e) => onSelectPo(e.target.value)}
                className="rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50"
              >
                <option value="">Select purchase order</option>
                {poOptions.map((po) => (
                  <option key={po._id} value={po._id}>
                    {po.poNumber} — {po.supplier} ({po.status})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-500">Bill date</span>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="rounded-md border border-slate-200 px-3 py-2"
              />
            </label>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={paymentReceived}
              onChange={(e) => setPaymentReceived(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Payment received
          </label>

          {!editingId && !billablePos.length ? (
            <p className="text-sm text-slate-500">
              No billable POs. Create a purchase first, or all POs are fully
              billed.
            </p>
          ) : null}

          {selectedPoId && lines.length === 0 ? (
            <p className="text-sm text-slate-500">
              This PO is fully billed. Pick another PO.
            </p>
          ) : null}

          {lines.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Bill?</th>
                    <th className="px-3 py-2 text-left font-medium">Part No</th>
                    <th className="px-3 py-2 text-left font-medium">Item</th>
                    <th className="px-3 py-2 text-right font-medium">Max qty</th>
                    <th className="px-3 py-2 text-left font-medium">Qty</th>
                    <th className="px-3 py-2 text-left font-medium">Rate</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const amount =
                      (Number(line.qty) || 0) * (Number(line.rate) || 0);
                    return (
                      <tr
                        key={line.poItemId}
                        className="border-t border-slate-200"
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={line.selected}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l, i) =>
                                  i === index
                                    ? { ...l, selected: e.target.checked }
                                    : l
                                )
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">{line.partNo}</td>
                        <td className="px-3 py-2">{line.description}</td>
                        <td className="px-3 py-2 text-right text-red-600">
                          {line.maxQty}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            max={line.maxQty}
                            step="any"
                            disabled={!line.selected}
                            value={line.qty}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l, i) =>
                                  i === index
                                    ? { ...l, qty: e.target.value }
                                    : l
                                )
                              )
                            }
                            className="w-24 rounded border border-slate-200 px-2 py-1.5 disabled:bg-slate-50"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            disabled={!line.selected}
                            value={line.rate}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l, i) =>
                                  i === index
                                    ? { ...l, rate: e.target.value }
                                    : l
                                )
                              )
                            }
                            className="w-28 rounded border border-slate-200 px-2 py-1.5 disabled:bg-slate-50"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-emerald-600">
                          {money(amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Draft total:{" "}
              <span className="font-semibold text-emerald-600">
                {money(draftTotal)}
              </span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || (!editingId && !billablePos.length)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Update invoice"
                    : "Save invoice"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
