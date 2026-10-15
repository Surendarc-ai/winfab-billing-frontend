"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { api, type Company } from "@/lib/api";

type Draft = {
  name: string;
  logo: string;
  address: string;
  gstin: string;
  email: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  panNo: string;
};

const emptyDraft = (): Draft => ({
  name: "",
  logo: "",
  address: "",
  gstin: "",
  email: "",
  bankName: "Union Bank Perungudi",
  accountNo: "158613100000177",
  ifscCode: "UBIN0815861",
  panNo: "CVFPM7467R",
});

function toDraft(company: Company): Draft {
  return {
    name: company.name || "",
    logo: company.logo || "",
    address: company.address || "",
    gstin: company.gstin || "",
    email: company.email || "",
    bankName: company.bankName || "Union Bank Perungudi",
    accountNo: company.accountNo || "158613100000177",
    ifscCode: company.ifscCode || "UBIN0815861",
    panNo: company.panNo || "CVFPM7467R",
  };
}

export default function CompanyPage() {
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const company = await api.getCompany();
      setDraft(toDraft(company));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load company");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function onLogoChange(file: File | null) {
    setError("");
    setSaved(false);
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file for the logo");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("Logo must be under 500KB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setField("logo", String(reader.result || ""));
    };
    reader.onerror = () => setError("Failed to read logo file");
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const company = await api.updateCompany(draft);
      setDraft(toDraft(company));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Company</h1>
        <p className="mt-1 text-sm text-slate-500">
          Company profile, GSTIN, and bank details used on invoices.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Company details saved.
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="max-w-3xl space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Company details
            </h2>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
                {draft.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.logo}
                    alt="Company logo"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="px-2 text-center text-xs text-slate-400">
                    No logo
                  </span>
                )}
              </div>
              <div className="grid flex-1 gap-3">
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-500">Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onLogoChange(e.target.files?.[0] || null)}
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1"
                  />
                </label>
                {draft.logo ? (
                  <button
                    type="button"
                    onClick={() => setField("logo", "")}
                    className="w-fit text-sm text-slate-500 underline hover:text-slate-800"
                  >
                    Remove logo
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="text-slate-500">Company name</span>
                <input
                  required
                  value={draft.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2"
                  placeholder="e.g. WinFab"
                />
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="text-slate-500">Address</span>
                <textarea
                  rows={3}
                  value={draft.address}
                  onChange={(e) => setField("address", e.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-500">GSTIN</span>
                <input
                  value={draft.gstin}
                  onChange={(e) => setField("gstin", e.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-500">Email</span>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setField("email", e.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2"
                />
              </label>
            </div>
          </section>

          <section className="space-y-4 border-t border-slate-100 pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Bank details
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="text-slate-500">Bank name</span>
                <input
                  value={draft.bankName}
                  onChange={(e) => setField("bankName", e.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-500">Account no</span>
                <input
                  value={draft.accountNo}
                  onChange={(e) => setField("accountNo", e.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-500">IFSC code</span>
                <input
                  value={draft.ifscCode}
                  onChange={(e) => setField("ifscCode", e.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="text-slate-500">PAN no</span>
                <input
                  value={draft.panNo}
                  onChange={(e) => setField("panNo", e.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2"
                />
              </label>
            </div>
          </section>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save company"}
            </button>
          </div>
        </form>
      )}
    </AppShell>
  );
}
