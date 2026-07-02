import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ClipboardList,
  DoorOpen, FileSpreadsheet, FileText, Scale
} from "lucide-react";
import api from "../api/client";
import { StatCard } from "../components/ui";
import { fmtNum } from "../utils/format";

const REPORTS = [
  {
    key: "inventory",
    icon: ClipboardList,
    title: "Inventari aktual",
    description: "Lista e plotë e produkteve me sasi, çmime, vendndodhje dhe vlerën e stokut.",
    hasPeriod: false
  },
  {
    key: "locations",
    icon: DoorOpen,
    title: "Gjendja sipas lokacioneve",
    description: "Stoku aktual i çdo kati, dhome dhe zyre — produktet, sasitë dhe vlera brenda secilit.",
    hasPeriod: false
  },
  {
    key: "low-stock",
    icon: AlertTriangle,
    title: "Stok i ulët",
    description: "Produktet që kanë rënë nën stokun minimal dhe sasia që mungon.",
    hasPeriod: false
  },
  {
    key: "movements",
    icon: ArrowLeftRight,
    title: "Hyrje-daljet e periudhës",
    description: "Të gjitha lëvizjet e inventarit për periudhën e zgjedhur, me përdorues dhe komente.",
    hasPeriod: true
  }
];

const GROUP_OPTIONS = [
  { value: "day", label: "Ditore" },
  { value: "week", label: "Javore" },
  { value: "month", label: "Mujore" },
  { value: "year", label: "Vjetore" }
];

// Datë lokale në format yyyy-mm-dd (pa zhvendosje UTC)
const toISO = (d) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

// Periudhat e shpejta: sot / kjo javë / ky muaj / ky vit
const QUICK_PERIODS = [
  { key: "today", label: "Sot", group: "day", from: (n) => n, to: (n) => n },
  { key: "week", label: "Kjo javë", group: "day", from: (n) => { const d = new Date(n); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d; }, to: (n) => n },
  { key: "month", label: "Ky muaj", group: "day", from: (n) => new Date(n.getFullYear(), n.getMonth(), 1), to: (n) => n },
  { key: "year", label: "Ky vit", group: "month", from: (n) => new Date(n.getFullYear(), 0, 1), to: (n) => n }
];

// Shkarkon raportin si file duke përdorur token-in e autentikimit
async function download(key, format, params = {}) {
  const res = await api.get(`/reports/${key}`, {
    params: { ...params, format },
    responseType: "blob"
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `raporti-${key}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  // Filtrat e përmbledhjes hyrje-dalje
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [group, setGroup] = useState("day");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [activePeriod, setActivePeriod] = useState("");

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
    api.get("/products/all").then((r) => setProducts(r.data)).catch(() => {});
    api.get("/locations").then((r) => setLocations(r.data)).catch(() => {});
  }, []);

  const summaryParams = (extra = {}) => ({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    group,
    category_id: categoryId || undefined,
    product_id: productId || undefined,
    location_id: locationId || undefined,
    ...extra
  });

  const loadSummary = async (params) => {
    setSummaryLoading(true);
    setError("");
    try {
      const r = await api.get("/reports/summary", { params });
      setSummary(r.data);
    } catch {
      setError("Gjenerimi i përmbledhjes dështoi, provoni përsëri.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const applyQuick = (p) => {
    const now = new Date();
    const from = toISO(p.from(now));
    const to = toISO(p.to(now));
    setDateFrom(from);
    setDateTo(to);
    setGroup(p.group);
    setActivePeriod(p.key);
    loadSummary({
      date_from: from,
      date_to: to,
      group: p.group,
      category_id: categoryId || undefined,
      product_id: productId || undefined,
      location_id: locationId || undefined
    });
  };

  const handleExport = async (key, format, params = {}) => {
    setBusy(key + format);
    setError("");
    try {
      await download(key, format, params);
    } catch {
      setError("Gjenerimi i raportit dështoi, provoni përsëri.");
    } finally {
      setBusy("");
    }
  };

  const totals = summary?.totals;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Raportet</h1>
        <p className="text-sm text-ink/55">Gjeneroni dhe eksportoni raporte në Excel ose PDF</p>
      </div>

      {error && <p className="rounded-lg bg-brick-100 px-3 py-2 text-sm text-brick-700">{error}</p>}

      {/* ---------- Përmbledhja Hyrje-Dalje ---------- */}
      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold">Përmbledhja Hyrje-Dalje</h2>
            <p className="text-sm text-ink/55">Totali i hyrjeve dhe daljeve, me filtra sipas periudhës, kategorisë, produktit dhe lokacionit</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyQuick(p)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  activePeriod === p.key ? "bg-pine-600 text-white" : "bg-ink/5 text-ink/70 hover:bg-ink/10"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input type="date" className="input" value={dateFrom}
                 onChange={(e) => { setDateFrom(e.target.value); setActivePeriod(""); }} title="Nga data" />
          <input type="date" className="input" value={dateTo}
                 onChange={(e) => { setDateTo(e.target.value); setActivePeriod(""); }} title="Deri më" />
          <select className="input" value={group} onChange={(e) => setGroup(e.target.value)} title="Grupimi">
            {GROUP_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Të gjitha kategoritë</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Të gjitha produktet</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
          <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Të gjitha lokacionet</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={summaryLoading} onClick={() => loadSummary(summaryParams())}>
            {summaryLoading ? "Duke gjeneruar…" : "Gjenero përmbledhjen"}
          </button>
          <button className="btn-ghost" disabled={busy === "summaryxlsx"}
                  onClick={() => handleExport("summary", "xlsx", summaryParams())}>
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button className="btn-ghost" disabled={busy === "summarypdf"}
                  onClick={() => handleExport("summary", "pdf", summaryParams())}>
            <FileText size={15} /> PDF
          </button>
        </div>

        {totals && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                icon={ArrowDownToLine} label="Hyrje në total" tone="pine"
                value={fmtNum(totals.total_in)}
                hint={`${fmtNum(totals.in_count)} lëvizje hyrëse`}
              />
              <StatCard
                icon={ArrowUpFromLine} label="Dalje në total" tone="amber"
                value={fmtNum(totals.total_out)}
                hint={`${fmtNum(totals.out_count)} lëvizje dalëse`}
              />
              <StatCard
                icon={Scale} label="Bilanci (hyrje − dalje)"
                tone={totals.balance >= 0 ? "pine" : "brick"}
                value={fmtNum(totals.balance)}
              />
            </div>

            {summary.rows.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink/50">Nuk ka lëvizje për filtrat e zgjedhur.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-left text-xs font-bold uppercase tracking-wide text-ink/55">
                      <th className="px-3 py-2">Periudha</th>
                      <th className="px-3 py-2 text-right">Hyrje</th>
                      <th className="px-3 py-2 text-right">Dalje</th>
                      <th className="px-3 py-2 text-right">Bilanci</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows.map((r) => (
                      <tr key={r.period_label} className="border-b border-ink/5 last:border-0">
                        <td className="px-3 py-2 font-semibold">{r.period_label}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-pine-700">{fmtNum(r.total_in)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-amber-700">{fmtNum(r.total_out)}</td>
                        <td className={`px-3 py-2 text-right font-semibold tabular-nums ${Number(r.balance) < 0 ? "text-brick-700" : ""}`}>
                          {fmtNum(r.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ---------- Raportet e tjera ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {REPORTS.map(({ key, icon: Icon, title, description, hasPeriod }) => (
          <div key={key} className="card flex flex-col p-5">
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-pine-50 text-pine-600">
              <Icon size={19} />
            </div>
            <h2 className="font-display font-bold">{title}</h2>
            <p className="mt-1 flex-1 text-sm text-ink/55">{description}</p>

            {hasPeriod && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Nga data</label>
                  <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="label">Deri më</label>
                  <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                className="btn-ghost flex-1"
                disabled={busy === key + "xlsx"}
                onClick={() => handleExport(key, "xlsx", hasPeriod ? { date_from: dateFrom || undefined, date_to: dateTo || undefined } : {})}
              >
                <FileSpreadsheet size={15} /> Excel
              </button>
              <button
                className="btn-ghost flex-1"
                disabled={busy === key + "pdf"}
                onClick={() => handleExport(key, "pdf", hasPeriod ? { date_from: dateFrom || undefined, date_to: dateTo || undefined } : {})}
              >
                <FileText size={15} /> PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
