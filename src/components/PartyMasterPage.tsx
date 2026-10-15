"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Cell, TableRow, TableShell } from "@/components/DataTable";
import ListToolbar from "@/components/ListToolbar";
import Modal from "@/components/Modal";
import RowActions from "@/components/RowActions";
import { exportToExcel } from "@/lib/exportExcel";
import type { Party } from "@/lib/api";

type Draft = {
  name: string;
  email: string;
  phone: string;
  gstNumber: string;
  hsnCode: string;
  gstPercentage: string;
  address: string;
  city: string;
  state: string;
  notes: string;
  active: boolean;
};

const emptyDraft = (): Draft => ({
  name: "",
  email: "",
  phone: "",
  gstNumber: "",
  hsnCode: "",
  gstPercentage: "",
  address: "",
  city: "",
  state: "",
  notes: "",
  active: true,
});

export default function PartyMasterPage({
  title,
  addLabel,
  searchPlaceholder,
  loadItems,
  createItem,
  updateItem,
  deleteItem,
  exportFileName,
  showTaxFields = false,
}: {
  title: string;
  addLabel: string;
  searchPlaceholder: string;
  loadItems: () => Promise<Party[]>;
  createItem: (body: Record<string, unknown>) => Promise<Party>;
  updateItem: (id: string, body: Record<string, unknown>) => Promise<Party>;
  deleteItem: (id: string) => Promise<unknown>;
  exportFileName: string;
  showTaxFields?: boolean;
}) {
  const headers = showTaxFields
    ? [
        "Name",
        "Email",
        "Phone",
        "GST Number",
        "HSN",
        "GST %",
        "City",
        "State",
        "Status",
        "Actions",
      ]
    : [
        "Name",
        "Email",
        "Phone",
        "GST Number",
        "City",
        "State",
        "Status",
        "Actions",
      ];
  const [items, setItems] = useState<Party[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await loadItems());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [loadItems]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.gstNumber.toLowerCase().includes(q) ||
        (item.hsnCode || "").toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q) ||
        item.state.toLowerCase().includes(q)
    );
  }, [items, search]);

  function resetForm() {
    setEditingId(null);
    setDraft(emptyDraft());
  }

  function openCreate() {
    setError("");
    resetForm();
    setOpen(true);
  }

  function openEdit(item: Party) {
    setError("");
    setEditingId(item._id);
    setDraft({
      name: item.name || "",
      email: item.email || "",
      phone: item.phone || "",
      gstNumber: item.gstNumber || "",
      hsnCode: item.hsnCode || "",
      gstPercentage:
        item.gstPercentage !== undefined && item.gstPercentage !== null
          ? String(item.gstPercentage)
          : "",
      address: item.address || "",
      city: item.city || "",
      state: item.state || "",
      notes: item.notes || "",
      active: item.active !== false,
    });
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!draft.name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: draft.name.trim(),
        email: draft.email,
        phone: draft.phone,
        gstNumber: draft.gstNumber,
        address: draft.address,
        city: draft.city,
        state: draft.state,
        notes: draft.notes,
        active: draft.active,
      };
      if (showTaxFields) {
        payload.hsnCode = draft.hsnCode.trim();
        payload.gstPercentage = draft.gstPercentage
          ? Number(draft.gstPercentage)
          : 0;
      }
      if (editingId) await updateItem(editingId, payload);
      else await createItem(payload);
      resetForm();
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (
      !confirm(
        `Move this ${title.toLowerCase().replace(/s$/, "")} to Recycle Bin?`
      )
    )
      return;
    try {
      await deleteItem(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <AppShell>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-5 text-3xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>

        <ListToolbar
          addLabel={addLabel}
          onAdd={openCreate}
          search={search}
          onSearch={setSearch}
          searchPlaceholder={searchPlaceholder}
          totalLabel={`Total: ${filtered.length}`}
          exportDisabled={!filtered.length}
          onExportExcel={() => {
            try {
              exportToExcel(
                filtered.map((item) => ({
                  Name: item.name,
                  Email: item.email || "",
                  Phone: item.phone || "",
                  "GST Number": item.gstNumber || "",
                  ...(showTaxFields
                    ? {
                        "HSN Code": item.hsnCode || "",
                        "GST %": item.gstPercentage ?? "",
                      }
                    : {}),
                  Address: item.address || "",
                  City: item.city || "",
                  State: item.state || "",
                  Notes: item.notes || "",
                  Status: item.active === false ? "Inactive" : "Active",
                })),
                `${exportFileName}-${new Date().toISOString().slice(0, 10)}`,
                title
              );
            } catch (err) {
              setError(err instanceof Error ? err.message : "Export failed");
            }
          }}
        />

        {error && !open ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <TableShell
          headers={headers}
          colSpan={headers.length}
          loading={loading}
          empty={
            !loading && !filtered.length
              ? `No records yet. Click + ${addLabel}.`
              : undefined
          }
        >
          {filtered.map((item) => (
            <TableRow key={item._id}>
              <Cell className="font-medium text-slate-800">{item.name}</Cell>
              <Cell>{item.email || "—"}</Cell>
              <Cell>{item.phone || "—"}</Cell>
              <Cell>{item.gstNumber || "—"}</Cell>
              {showTaxFields ? (
                <>
                  <Cell>{item.hsnCode || "—"}</Cell>
                  <Cell>
                    {item.gstPercentage !== undefined &&
                    item.gstPercentage !== null
                      ? `${item.gstPercentage}%`
                      : "—"}
                  </Cell>
                </>
              ) : null}
              <Cell>{item.city || "—"}</Cell>
              <Cell>{item.state || "—"}</Cell>
              <Cell>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.active === false
                      ? "bg-slate-100 text-slate-600"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {item.active === false ? "Inactive" : "Active"}
                </span>
              </Cell>
              <Cell>
                <RowActions
                  onEdit={() => openEdit(item)}
                  onDelete={() => onDelete(item._id)}
                />
              </Cell>
            </TableRow>
          ))}
        </TableShell>
      </div>

      <Modal
        open={open}
        title={editingId ? `Edit ${title.replace(/s$/, "")}` : addLabel}
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Name"
              value={draft.name}
              onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
              required
            />
            <Field
              label="GST Number"
              value={draft.gstNumber}
              onChange={(v) => setDraft((d) => ({ ...d, gstNumber: v }))}
            />
            {showTaxFields ? (
              <>
                <Field
                  label="HSN Code"
                  value={draft.hsnCode}
                  onChange={(v) => setDraft((d) => ({ ...d, hsnCode: v }))}
                />
                <Field
                  label="GST %"
                  type="number"
                  value={draft.gstPercentage}
                  onChange={(v) =>
                    setDraft((d) => ({ ...d, gstPercentage: v }))
                  }
                />
              </>
            ) : null}
            <Field
              label="Email"
              type="email"
              value={draft.email}
              onChange={(v) => setDraft((d) => ({ ...d, email: v }))}
            />
            <Field
              label="Phone"
              value={draft.phone}
              onChange={(v) => setDraft((d) => ({ ...d, phone: v }))}
            />
            <Field
              label="City"
              value={draft.city}
              onChange={(v) => setDraft((d) => ({ ...d, city: v }))}
            />
            <Field
              label="State"
              value={draft.state}
              onChange={(v) => setDraft((d) => ({ ...d, state: v }))}
            />
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-500">Address</span>
            <textarea
              value={draft.address}
              onChange={(e) =>
                setDraft((d) => ({ ...d, address: e.target.value }))
              }
              rows={2}
              className="rounded-md border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-500">Notes</span>
            <textarea
              value={draft.notes}
              onChange={(e) =>
                setDraft((d) => ({ ...d, notes: e.target.value }))
              }
              rows={2}
              className="rounded-md border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) =>
                setDraft((d) => ({ ...d, active: e.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Active
          </label>

          <div className="flex justify-end gap-2">
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
              {saving ? "Saving…" : editingId ? "Update" : "Save"}
            </button>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-200 px-3 py-2"
      />
    </label>
  );
}
