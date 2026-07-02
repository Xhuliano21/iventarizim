import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "./ui";

/**
 * Tabelë e ripërdorshme me sortim dhe pagination nga serveri.
 * columns: [{ key, header, sortable, render?(row) }]
 */
export default function DataTable({
  columns,
  rows,
  loading,
  sort,
  order,
  onSort,
  page,
  pages,
  total,
  onPage
}) {
  const handleSort = (col) => {
    if (!col.sortable || !onSort) return;
    if (sort === col.key) onSort(col.key, order === "asc" ? "desc" : "asc");
    else onSort(col.key, "asc");
  };

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 bg-paper/60 text-left">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col)}
                  className={`whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink/55 ${
                    col.sortable ? "cursor-pointer select-none hover:text-pine-600" : ""
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {sort === col.key &&
                      (order === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-ink/50">
                  Duke ngarkuar…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}><EmptyState /></td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-ink/5 last:border-0 hover:bg-pine-50/40">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 align-middle">
                      {col.render ? col.render(row) : row[col.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-ink/10 px-4 py-3 text-sm">
          <p className="text-ink/55">
            Faqja <b>{page}</b> nga <b>{pages}</b> · {total} rreshta gjithsej
          </p>
          <div className="flex gap-2">
            <button
              className="btn-ghost !px-2.5 !py-1.5"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
              aria-label="Faqja e mëparshme"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="btn-ghost !px-2.5 !py-1.5"
              disabled={page >= pages}
              onClick={() => onPage(page + 1)}
              aria-label="Faqja tjetër"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
