"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import {
  api,
  money,
  poCustomerName,
  remainingQty,
  type Party,
  type PurchaseOrder,
  type SalesInvoice,
} from "@/lib/api";

function poMatchesCustomer(po: PurchaseOrder, customerId: string, customers: Party[]) {
  if (!customerId) return true;
  if (po.customerId && String(po.customerId) === customerId) return true;
  const customer = customers.find((c) => c._id === customerId);
  if (!customer) return false;
  // Legacy POs stored under supplier name
  return poCustomerName(po) === customer.name;
}

type BillLine = {
  key: string;
  purchaseOrderId: string;
  poNumber: string;
  poItemId: string;
  partNo: string;
  description: string;
  maxQty: number;
  qty: string;
  rate: string;
  selected: boolean;
};

function toDateInput(value?: string) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function invoicePoIds(invoice: SalesInvoice) {
  const fromArray = (invoice.purchaseOrders || []).map((po) =>
    typeof po === "string" ? po : po._id
  );
  const fromLegacy =
    typeof invoice.purchaseOrder === "string"
      ? [invoice.purchaseOrder]
      : invoice.purchaseOrder?._id
        ? [invoice.purchaseOrder._id]
        : [];
  const fromItems = invoice.items
    .map((item) => String(item.purchaseOrder || ""))
    .filter(Boolean);
  return [...new Set([...fromArray, ...fromLegacy, ...fromItems])];
}

export function invoicePoLabel(invoice: SalesInvoice) {
  if (invoice.poNumbers?.length) return invoice.poNumbers.join(", ");
  return invoice.poNumber || "—";
}

function buildLinesFromPos(
  purchases: PurchaseOrder[],
  poIds: string[],
  currentInvoice?: SalesInvoice | null
) {
  const legacyPoId =
    currentInvoice &&
    (typeof currentInvoice.purchaseOrder === "string"
      ? currentInvoice.purchaseOrder
      : currentInvoice.purchaseOrder?._id || "");

  const credited = new Map<string, number>();
  if (currentInvoice) {
    for (const line of currentInvoice.items) {
      const poId = String(line.purchaseOrder || legacyPoId || "");
      const key = `${poId}:${line.poItemId}`;
      credited.set(key, (credited.get(key) || 0) + line.qty);
    }
  }

  const next: BillLine[] = [];
  for (const poId of poIds) {
    const po = purchases.find((p) => p._id === poId);
    if (!po) continue;

    for (const item of po.items) {
      const id = String(item._id);
      const key = `${poId}:${id}`;
      const maxQty = remainingQty(item) + (credited.get(key) || 0);
      const matched = currentInvoice?.items.find((line) => {
        if (String(line.poItemId) !== id) return false;
        const linePo = String(line.purchaseOrder || legacyPoId || "");
        return linePo === poId;
      });

      if (maxQty <= 0 && !matched) continue;

      next.push({
        key,
        purchaseOrderId: poId,
        poNumber: po.poNumber,
        poItemId: id,
        partNo: item.partNo,
        description: item.description,
        maxQty,
        qty: matched ? String(matched.qty) : maxQty > 0 ? String(maxQty) : "0",
        rate: String(matched?.rate ?? item.rate),
        selected: Boolean(matched) || (!currentInvoice && maxQty > 0),
      });
    }
  }
  return next;
}

export default function SalesInvoiceFormModal({
  open,
  invoice,
  purchases,
  customers,
  onClose,
  onSaved,
}: {
  open: boolean;
  invoice?: SalesInvoice | null;
  purchases: PurchaseOrder[];
  customers: Party[];
  onClose: () => void;
  onSaved: (invoice: SalesInvoice) => void;
}) {
  const editingId = invoice?._id || null;
  const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);
  const [poSearch, setPoSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [lines, setLines] = useState<BillLine[]>([]);
  const [billDate, setBillDate] = useState("");
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const billablePos = useMemo(
    () =>
      purchases.filter(
        (po) =>
          po.items.some((item) => remainingQty(item) > 0) &&
          poMatchesCustomer(po, customerId, customers)
      ),
    [purchases, customerId, customers]
  );

  useEffect(() => {
    if (!open) return;
    setError("");
    setPoSearch("");
    if (invoice) {
      setBillNo(invoice.billNo);
      setBillDate(toDateInput(invoice.billDate));
      setPaymentReceived(invoice.paymentReceived);
      setCustomerId(invoice.customerId ? String(invoice.customerId) : "");
      const poIds = invoicePoIds(invoice);
      setSelectedPoIds(poIds);
      setLines(buildLinesFromPos(purchases, poIds, invoice));
    } else {
      setBillNo("");
      setBillDate("");
      setPaymentReceived(false);
      setCustomerId("");
      setSelectedPoIds([]);
      setLines([]);
    }
  }, [open, invoice, purchases]);

  function syncLinesForPos(
    poIds: string[],
    currentInvoice?: SalesInvoice | null
  ) {
    setSelectedPoIds(poIds);
    setLines(buildLinesFromPos(purchases, poIds, currentInvoice));
  }

  function onCustomerChange(nextCustomerId: string) {
    setCustomerId(nextCustomerId);
    // Drop POs that don't belong to the newly selected customer
    const kept = selectedPoIds.filter((id) => {
      const po = purchases.find((p) => p._id === id);
      return po ? poMatchesCustomer(po, nextCustomerId, customers) : false;
    });
    if (kept.length !== selectedPoIds.length) {
      syncLinesForPos(kept, invoice || null);
    }
  }

  function togglePo(poId: string) {
    if (!customerId) {
      setError("Select a customer first, then pick their purchase orders");
      return;
    }
    const next = selectedPoIds.includes(poId)
      ? selectedPoIds.filter((id) => id !== poId)
      : [...selectedPoIds, poId];
    syncLinesForPos(next, invoice || null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!billNo.trim()) {
      setError("Bill no is required");
      return;
    }
    if (!customerId) {
      setError("Select a customer (HSN and GST % come from Customer master)");
      return;
    }

    const selected = lines.filter(
      (line) => line.selected && Number(line.qty) > 0
    );
    if (!selectedPoIds.length || !selected.length) {
      setError("Select at least one PO and one item qty to bill");
      return;
    }

    const payload = {
      purchaseOrderIds: selectedPoIds,
      customerId,
      billNo: billNo.trim(),
      billDate: billDate || undefined,
      paymentReceived,
      items: selected.map((line) => ({
        purchaseOrderId: line.purchaseOrderId,
        poItemId: line.poItemId,
        qty: Number(line.qty),
        rate: Number(line.rate),
      })),
    };

    setSaving(true);
    try {
      const saved = editingId
        ? await api.updateSalesInvoice(editingId, payload)
        : await api.createSalesInvoice(payload);
      onSaved(saved);
      onClose();
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

  const draftTotal = lines
    .filter((l) => l.selected)
    .reduce(
      (sum, line) => sum + (Number(line.qty) || 0) * (Number(line.rate) || 0),
      0
    );

  const poPickerList = useMemo(() => {
    const selected = purchases.filter((po) => selectedPoIds.includes(po._id));
    const billable = billablePos.filter(
      (po) => !selectedPoIds.includes(po._id)
    );
    return [...selected, ...billable];
  }, [purchases, selectedPoIds, billablePos]);

  const filteredPoPicker = useMemo(() => {
    const q = poSearch.trim().toLowerCase();
    if (!q) return poPickerList;
    return poPickerList.filter(
      (po) =>
        po.poNumber.toLowerCase().includes(q) ||
        poCustomerName(po).toLowerCase().includes(q) ||
        po.status.toLowerCase().includes(q)
    );
  }, [poPickerList, poSearch]);

  const selectedPos = useMemo(
    () => purchases.filter((po) => selectedPoIds.includes(po._id)),
    [purchases, selectedPoIds]
  );

  const selectedCustomer = customers.find((c) => c._id === customerId);
  const customerTitle = selectedCustomer
    ? [
        selectedCustomer.name,
        selectedCustomer.hsnCode ? `HSN ${selectedCustomer.hsnCode}` : "",
        selectedCustomer.gstPercentage != null
          ? `GST ${selectedCustomer.gstPercentage}%`
          : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  return (
    <Modal
      open={open}
      title={editingId ? "Edit Sales Invoice" : "Add Sales Invoice"}
      wide
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,10.5rem)]">
          <label className="grid min-w-0 gap-1 text-sm">
            <span className="text-slate-500">Bill No</span>
            <input
              type="text"
              required
              value={billNo}
              onChange={(e) => setBillNo(e.target.value)}
              placeholder="e.g. INV-001 / Tax invoice no"
              className="box-border w-full min-w-0 rounded-md border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="grid min-w-0 gap-1 text-sm">
            <span className="text-slate-500">Customer</span>
            <select
              required
              value={customerId}
              onChange={(e) => onCustomerChange(e.target.value)}
              className="box-border w-full min-w-0 max-w-full rounded-md border border-slate-200 px-3 py-2"
              title={customerTitle}
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                  {c.hsnCode ? ` · HSN ${c.hsnCode}` : ""}
                  {c.gstPercentage !== undefined && c.gstPercentage !== null
                    ? ` · GST ${c.gstPercentage}%`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-sm">
            <span className="text-slate-500">Bill date</span>
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="box-border w-full min-w-0 rounded-md border border-slate-200 px-3 py-2"
            />
          </label>
        </div>

        <div className="grid gap-1 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-slate-500">
              Customer purchase orders (select multiple)
            </span>
            <span className="text-xs text-slate-400">
              {selectedPoIds.length} selected
              {poPickerList.length ? ` · ${poPickerList.length} available` : ""}
            </span>
          </div>

          {selectedPos.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedPos.map((po) => (
                <button
                  key={po._id}
                  type="button"
                  onClick={() => togglePo(po._id)}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  title="Remove PO"
                >
                  {po.poNumber}
                  <span aria-hidden>×</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-md border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 p-2">
              <input
                type="search"
                value={poSearch}
                onChange={(e) => setPoSearch(e.target.value)}
                placeholder="Search PO no…"
                disabled={!customerId}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto p-2">
              {!customerId ? (
                <p className="px-1 py-2 text-slate-500">
                  Select a customer to see their purchase orders.
                </p>
              ) : !poPickerList.length ? (
                <p className="px-1 py-2 text-slate-500">
                  No billable POs for this customer. Add a PO under Purchase, or
                  all their POs are fully billed.
                </p>
              ) : !filteredPoPicker.length ? (
                <p className="px-1 py-2 text-slate-500">
                  No POs match “{poSearch.trim()}”.
                </p>
              ) : (
                filteredPoPicker.map((po) => (
                  <label
                    key={po._id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPoIds.includes(po._id)}
                      onChange={() => togglePo(po._id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{po.poNumber}</span>
                      <span className="text-slate-500">
                        {" "}
                        — {poCustomerName(po)}{" "}
                      </span>
                      <span className="text-slate-400">({po.status})</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
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

        {selectedPoIds.length > 0 && lines.length === 0 ? (
          <p className="text-sm text-slate-500">
            Selected POs have no remaining qty to bill.
          </p>
        ) : null}

        {lines.length > 0 ? (
          <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Bill?</th>
                  <th className="px-3 py-2 text-left font-medium">PO</th>
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
                    <tr key={line.key} className="border-t border-slate-200">
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
                      <td className="px-3 py-2 text-slate-600">
                        {line.poNumber}
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
              onClick={onClose}
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
  );
}
