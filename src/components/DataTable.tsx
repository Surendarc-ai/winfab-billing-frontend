"use client";

export function TableShell({
  headers,
  children,
  empty,
  loading,
  colSpan,
}: {
  headers: string[];
  children: React.ReactNode;
  empty?: string;
  loading?: boolean;
  colSpan: number;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {headers.map((header) => (
              <th
                key={header}
                className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={colSpan}
                className="px-4 py-10 text-center text-slate-500"
              >
                Loading…
              </td>
            </tr>
          ) : empty ? (
            <tr>
              <td
                colSpan={colSpan}
                className="px-4 py-10 text-center text-slate-500"
              >
                {empty}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TableRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-slate-100 align-middle hover:bg-slate-50/70">
      {children}
    </tr>
  );
}

export function Cell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`whitespace-nowrap px-4 py-4 text-slate-600 ${className}`}>
      {children}
    </td>
  );
}
