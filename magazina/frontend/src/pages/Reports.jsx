import { useState } from "react";
import { AlertTriangle, ArrowLeftRight, ClipboardList, FileSpreadsheet, FileText } from "lucide-react";
import api from "../api/client";

const REPORTS = [
  {
    key: "inventory",
    icon: ClipboardList,
    title: "Inventari aktual",
    description: "Lista e plotë e produkteve me sasi, çmime, vendndodhje dhe vlerën e stokut.",
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const handle = async (key, format, hasPeriod) => {
    setBusy(key + format);
    setError("");
    try {
      const params = hasPeriod ? { date_from: dateFrom || undefined, date_to: dateTo || undefined } : {};
      await download(key, format, params);
    } catch {
      setError("Gjenerimi i raportit dështoi, provoni përsëri.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Raportet</h1>
        <p className="text-sm text-ink/55">Gjeneroni dhe eksportoni raporte në Excel ose PDF</p>
      </div>

      {error && <p className="rounded-lg bg-brick-100 px-3 py-2 text-sm text-brick-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
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
                onClick={() => handle(key, "xlsx", hasPeriod)}
              >
                <FileSpreadsheet size={15} /> Excel
              </button>
              <button
                className="btn-ghost flex-1"
                disabled={busy === key + "pdf"}
                onClick={() => handle(key, "pdf", hasPeriod)}
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
