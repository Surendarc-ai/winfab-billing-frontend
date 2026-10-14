"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Cell, TableRow, TableShell } from "@/components/DataTable";
import ListToolbar from "@/components/ListToolbar";
import Modal from "@/components/Modal";
import RowActions from "@/components/RowActions";
import {
  api,
  formatDate,
  money,
  remainingQty,
  type Party,
  type PurchaseItem,
  type PurchaseOrder,
} from "@/lib/api";
import { exportToExcel } from "@/lib/exportExcel";

type DraftItem = {
  _id?: string;
  partNo: string;
  description: string;
  qty: string;
  rate: string;
  billedQty?: number;
};

type LineRow = {
  po: PurchaseOrder;
  item: PurchaseItem;
};

const emptyItem = (): DraftItem => ({
  partNo: "",
  description: "",
  qty: "1",
  rate: "",
  billedQty: 0,
});

const HEADERS = [
  "PO No",
  "Supplier",
  "Date",
  "Part No",
  "Description",
  "Qty",
  "Billed",
  "Remaining",
  "Rate",
  "Amount (₹)",
  "Status",
  "Actions",
];

function toDateInput(value?: string) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function PurchasesPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [poNumber, setPoNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [poDate, setPoDate] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [purchaseList, supplierList] = await Promise.all([
        api.getPurchases(),
        api.getSuppliers(),
      ]);
      setOrders(purchaseList);
      setSuppliers(supplierList.filter((s) => s.active !== false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load purchases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (po) =>
        po.poNumber.toLowerCase().includes(q) ||
        po.supplier.toLowerCase().includes(q) ||
        po.status.toLowerCase().includes(q) ||
        po.items.some(
          (item) =>
            item.partNo.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q)
        )
    );
  }, [orders, search]);

  const lines = useMemo<LineRow[]>(
    () =>
      filtered.flatMap((po) =>
        po.items.map((item) => ({
          po,
          item,
        }))
      ),
    [filtered]
  );

  function resetForm() {
    setEditingId(null);
    setPoNumber("");
    setSupplierId("");
    setPoDate("");
    setItems([emptyItem()]);
  }

  function openCreate() {
    setError("");
    resetForm();
    setOpen(true);
  }

  function openEdit(po: PurchaseOrder) {
    setError("");
    setEditingId(po._id);
    setPoNumber(po.poNumber);
    const matched =
      po.supplierId ||
      suppliers.find((s) => s.name === po.supplier)?._id ||
      "";
    setSupplierId(String(matched || ""));
    setPoDate(toDateInput(po.poDate));
    setItems(
      po.items.map((item) => ({
        _id: item._id,
        partNo: item.partNo,
        description: item.description,
        qty: String(item.qty),
        rate: String(item.rate),
        billedQty: item.billedQty || 0,
      }))
    );
    setOpen(true);
  }

  function updateItem(index: number, key: keyof DraftItem, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: value } : item))
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    if (!supplierId) {
      setError("Select a supplier");
      setSaving(false);
      return;
    }

    const selectedSupplier = suppliers.find((s) => s._id === supplierId);
    const payload = {
      poNumber,
      supplierId,
      supplier: selectedSupplier?.name || "",
      poDate: poDate || undefined,
      items: items.map((item) => ({
        _id: item._id,
        partNo: item.partNo,
        description: item.description,
        qty: Number(item.qty),
        rate: Number(item.rate),
      })),
    };

    try {
      if (editingId) {
        await api.updatePurchase(editingId, payload);
      } else {
        await api.createPurchase(payload);
      }
      resetForm();
      setOpen(false);
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingId
            ? "Could not update PO"
            : "Could not create PO"
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this purchase order?")) return;
    try {
      await api.deletePurchase(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <AppShell>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-5 text-3xl font-bold tracking-tight text-slate-900">
          Purchase
        </h1>

        <ListToolbar
          addLabel="Add Purchase"
          onAdd={openCreate}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search by PO no, supplier, part no..."
          totalLabel={`Total line items: ${lines.length}`}
          exportDisabled={!lines.length}
          onExportExcel={() => {
            try {
              exportToExcel(
                lines.map(({ po, item }) => ({
                  "PO No": po.poNumber,
                  Supplier: po.supplier,
                  Date: formatDate(po.poDate),
                  "Part No": item.partNo,
                  Description: item.description,
                  Qty: item.qty,
                  Billed: item.billedQty || 0,
                  Remaining: remainingQty(item),
                  Rate: item.rate,
                  Amount: item.amount,
                  Status: po.status,
                })),
                `purchases-${new Date().toISOString().slice(0, 10)}`,
                "Purchases"
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

        <TableShell
          headers={HEADERS}
          colSpan={HEADERS.length}
          loading={loading}
          empty={
            !loading && !lines.length
              ? "No purchases yet. Click + Add Purchase."
              : undefined
          }
        >
          {lines.map(({ po, item }) => {
            const rem = remainingQty(item);
            return (
              <TableRow key={`${po._id}-${item._id}`}>
                <Cell className="font-medium text-slate-800">{po.poNumber}</Cell>
                <Cell className="text-slate-700">{po.supplier}</Cell>
                <Cell>{formatDate(po.poDate)}</Cell>
                <Cell className="font-medium text-slate-800">{item.partNo}</Cell>
                <Cell>{item.description}</Cell>
                <Cell>
                  {item.qty} {item.unit || "nos"}
                </Cell>
                <Cell>{item.billedQty || 0}</Cell>
                <Cell
                  className={`font-semibold ${
                    rem > 0 ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {rem}
                </Cell>
                <Cell>{money(item.rate)}</Cell>
                <Cell className="font-semibold text-emerald-600">
                  {money(item.amount)}
                </Cell>
                <Cell>
                  <StatusBadge status={po.status} />
                </Cell>
                <Cell>
                  <RowActions
                    onEdit={() => openEdit(po)}
                    onDelete={() => onDelete(po._id)}
                  />
                </Cell>
              </TableRow>
            );
          })}
        </TableShell>
      </div>

      <Modal
        open={open}
        title={editingId ? "Edit Purchase" : "Add Purchase"}
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
            <Field
              label="PO No"
              value={poNumber}
              onChange={setPoNumber}
              required
              placeholder="OP 26000008"
            />
            <label className="grid gap-1 text-sm">
              <span className="text-slate-500">Supplier</span>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="rounded-md border border-slate-200 px-3 py-2"
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {!suppliers.length ? (
                <span className="text-xs text-amber-600">
                  No suppliers yet. Add one under Suppliers master.
                </span>
              ) : null}
            </label>
            <Field
              label="PO Date"
              type="date"
              value={poDate}
              onChange={setPoDate}
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Part No</th>
                  <th className="px-3 py-2 text-left font-medium">Item</th>
                  <th className="px-3 py-2 text-left font-medium">Qty</th>
                  <th className="px-3 py-2 text-left font-medium">Rate</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const amount =
                    (Number(item.qty) || 0) * (Number(item.rate) || 0);
                  return (
                    <tr key={item._id || index} className="border-t border-slate-200">
                      <td className="px-3 py-2">
                        <input
                          required
                          value={item.partNo}
                          onChange={(e) =>
                            updateItem(index, "partNo", e.target.value)
                          }
                          className="w-28 rounded border border-slate-200 px-2 py-1.5"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          required
                          value={item.description}
                          onChange={(e) =>
                            updateItem(index, "description", e.target.value)
                          }
                          className="w-full min-w-40 rounded border border-slate-200 px-2 py-1.5"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          required
                          type="number"
                          min={item.billedQty || 0}
                          step="any"
                          value={item.qty}
                          onChange={(e) =>
                            updateItem(index, "qty", e.target.value)
                          }
                          className="w-20 rounded border border-slate-200 px-2 py-1.5"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          required
                          type="number"
                          min="0"
                          step="any"
                          value={item.rate}
                          onChange={(e) =>
                            updateItem(index, "rate", e.target.value)
                          }
                          className="w-24 rounded border border-slate-200 px-2 py-1.5"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-emerald-600">
                        {money(amount)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={
                            items.length === 1 || (item.billedQty || 0) > 0
                          }
                          onClick={() =>
                            setItems((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                          className="text-xs text-red-600 disabled:opacity-40"
                          title={
                            (item.billedQty || 0) > 0
                              ? "Cannot remove billed item"
                              : "Remove"
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              + Add item
            </button>
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
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Update purchase"
                    : "Save purchase"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-200 px-3 py-2"
      />
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-blue-50 text-blue-700",
    partial: "bg-amber-50 text-amber-700",
    closed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        styles[status] || "bg-slate-100 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}
