"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Cell, TableRow, TableShell } from "@/components/DataTable";
import { api, formatDate, type RecycleBinItem } from "@/lib/api";

export default function RecycleBinPage() {
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getRecycleBin();
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recycle bin");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRestore(item: RecycleBinItem) {
    if (!confirm(`Restore ${item.typeLabel.toLowerCase()} "${item.name}"?`))
      return;
    setBusyId(item.id);
    setError("");
    try {
      await api.restoreRecycleBinItem(item.type, item.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onPurge(item: RecycleBinItem) {
    if (
      !confirm(
        `Permanently delete ${item.typeLabel.toLowerCase()} "${item.name}"? This cannot be undone.`
      )
    )
      return;
    setBusyId(item.id);
    setError("");
    try {
      await api.purgeRecycleBinItem(item.type, item.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900">
          Recycle Bin
        </h1>
        <p className="mb-5 text-sm text-slate-500">
          Soft-deleted customers, purchase orders, sales, and suppliers. Restore
          or permanently delete.
        </p>

        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <TableShell
          headers={["Type", "Name", "Details", "Deleted on", "Actions"]}
          colSpan={5}
          loading={loading}
          empty={
            !loading && !items.length
              ? "Recycle bin is empty."
              : undefined
          }
        >
          {items.map((item) => (
            <TableRow key={`${item.type}-${item.id}`}>
              <Cell>
                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {item.typeLabel}
                </span>
              </Cell>
              <Cell className="font-medium text-slate-800">{item.name}</Cell>
              <Cell>{item.meta || "—"}</Cell>
              <Cell>
                {item.deletedAt ? formatDate(item.deletedAt) : "—"}
              </Cell>
              <Cell>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => onRestore(item)}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => onPurge(item)}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete forever
                  </button>
                </div>
              </Cell>
            </TableRow>
          ))}
        </TableShell>
      </div>
    </AppShell>
  );
}
