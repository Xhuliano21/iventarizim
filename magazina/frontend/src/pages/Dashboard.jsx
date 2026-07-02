import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Boxes, Package, PackagePlus } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import api from "../api/client";
import { Badge, EmptyState, StatCard } from "../components/ui";
import { fmtDate, fmtNum } from "../utils/format";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/dashboard")
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || "Nuk u ngarkuan të dhënat"));
  }, []);

  if (error) return <p className="rounded-lg bg-brick-100 p-4 text-brick-700">{error}</p>;
  if (!data) return <p className="py-10 text-center text-ink/50">Duke ngarkuar panelin…</p>;

  const { totals, lowStock, recentProducts, chart } = data;
  const chartData = chart.map((d) => ({
    day: new Date(d.day).toLocaleDateString("sq-AL", { day: "2-digit", month: "2-digit" }),
    Hyrje: Number(d.total_in),
    Dalje: Number(d.total_out)
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Paneli kryesor</h1>
        <p className="text-sm text-ink/55">Pamje e përgjithshme e gjendjes së magazinës</p>
      </div>

      {/* Statistikat */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Package} label="Produkte gjithsej" value={fmtNum(totals.total_products)} />
        <StatCard icon={Boxes} label="Sasia në magazinë" value={fmtNum(totals.total_quantity)} hint="njësi gjithsej" />
        <StatCard
          icon={AlertTriangle}
          label="Stok i ulët"
          value={fmtNum(totals.low_stock_count)}
          tone={totals.low_stock_count > 0 ? "amber" : "pine"}
          hint={totals.low_stock_count > 0 ? "kërkon vëmendje" : "gjithçka në rregull"}
        />
        <StatCard
          icon={PackagePlus}
          label="Vlera e stokut"
          value={fmtNum(Math.round(totals.stock_value)) + " L"}
          tone="ink"
          hint="me çmim blerjeje"
        />
      </div>

      {/* Grafiku i hyrje-daljeve */}
      <div className="card p-5">
        <h2 className="mb-4 font-display text-base font-bold">Hyrjet dhe daljet — 30 ditët e fundit</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1F6F54" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#1F6F54" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#DFA321" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#DFA321" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#18242012" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="Hyrje" stroke="#1F6F54" fill="url(#gIn)" strokeWidth={2} />
              <Area type="monotone" dataKey="Dalje" stroke="#DFA321" fill="url(#gOut)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stok i ulët */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Produktet me stok të ulët</h2>
            <Link to="/produktet?stock=low" className="text-xs font-semibold text-pine-600 hover:underline">
              Shiko të gjitha
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <EmptyState message="Asnjë produkt nën stokun minimal. 👍" />
          ) : (
            <ul className="divide-y divide-ink/5">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-ink/50">{p.code} · {p.category_name || "Pa kategori"}</p>
                  </div>
                  <Badge tone="amber">{fmtNum(p.quantity)} / min {fmtNum(p.min_stock)} {p.unit}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Produktet e fundit */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Produktet e shtuara së fundmi</h2>
            <Link to="/produktet" className="text-xs font-semibold text-pine-600 hover:underline">
              Shiko të gjitha
            </Link>
          </div>
          {recentProducts.length === 0 ? (
            <EmptyState message="Ende nuk është shtuar asnjë produkt." />
          ) : (
            <ul className="divide-y divide-ink/5">
              {recentProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-ink/50">{p.code} · {p.category_name || "Pa kategori"}</p>
                  </div>
                  <span className="text-xs text-ink/50">{fmtDate(p.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
