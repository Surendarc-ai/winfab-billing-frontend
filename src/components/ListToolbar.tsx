"use client";

export default function ListToolbar({
  addLabel,
  onAdd,
  search,
  onSearch,
  searchPlaceholder,
  totalLabel,
  onExportExcel,
  exportDisabled,
}: {
  addLabel: string;
  onAdd: () => void;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  totalLabel: string;
  onExportExcel?: () => void;
  exportDisabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <span className="text-base leading-none">+</span>
          {addLabel}
        </button>

        {onExportExcel ? (
          <button
            type="button"
            disabled={exportDisabled}
            onClick={onExportExcel}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden>▦</span>
            Export Excel
          </button>
        ) : null}

        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
            ⌕
          </span>
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </div>
      <p className="text-sm text-slate-500">{totalLabel}</p>
    </div>
  );
}
