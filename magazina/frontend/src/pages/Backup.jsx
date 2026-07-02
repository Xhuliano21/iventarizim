import { useEffect, useState } from "react";
import { DatabaseBackup, Download, RotateCcw, Trash2 } from "lucide-react";
import api from "../api/client";
import { EmptyState } from "../components/ui";
import { fmtDateTime } from "../utils/format";

const fmtSize = (bytes) =>
  bytes > 1048576 ? (bytes / 1048576).toFixed(1) + " MB" : (bytes / 1024).toFixed(0) + " KB";

export default function Backup() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { tone, text }

  const load = () => {
    setLoading(true);
    api.get("/backup").then((r) => setItems(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const create = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await api.post("/backup");
      setMessage({ tone: "pine", text: "Kopja rezervë u krijua me sukses." });
      load();
    } catch (err) {
      setMessage({ tone: "brick", text: err.response?.data?.error || "Krijimi i kopjes dështoi." });
    } finally {
      setBusy(false);
    }
  };

  const download = async (name) => {
    const res = await api.get(`/backup/${name}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restore = async (name) => {
    if (!window.confirm(
      `Të rikthehet databaza nga "${name}"?\n\nKUJDES: të gjitha të dhënat aktuale do të zëvendësohen me ato të kopjes rezervë.`
    )) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.post(`/backup/${name}/restore`);
      setMessage({ tone: "pine", text: "Databaza u rikthye me sukses nga kopja rezervë." });
    } catch (err) {
      setMessage({ tone: "brick", text: err.response?.data?.error || "Rikthimi dështoi." });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (name) => {
    if (!window.confirm(`Të fshihet kopja "${name}"?`)) return;
    await api.delete(`/backup/${name}`);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Backup dhe rikthim</h1>
          <p className="text-sm text-ink/55">Kopje rezervë të plota të databazës (pg_dump)</p>
        </div>
        <button onClick={create} className="btn-primary" disabled={busy}>
          <DatabaseBackup size={16} /> {busy ? "Duke punuar…" : "Krijo kopje rezervë"}
        </button>
      </div>

      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm font-medium ${
          message.tone === "pine" ? "bg-pine-50 text-pine-700" : "bg-brick-100 text-brick-700"
        }`}>
          {message.text}
        </p>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <p className="py-10 text-center text-ink/50">Duke ngarkuar…</p>
        ) : items.length === 0 ? (
          <EmptyState message="Nuk ka ende kopje rezervë. Krijoni të parën me butonin lart." />
        ) : (
          <ul className="divide-y divide-ink/5">
            {items.map((b) => (
              <li key={b.name} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <p className="font-mono text-sm font-semibold">{b.name}</p>
                  <p className="text-xs text-ink/50">{fmtDateTime(b.created_at)} · {fmtSize(b.size)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => download(b.name)} className="btn-ghost !px-2.5 !py-1.5" title="Shkarko">
                    <Download size={15} />
                  </button>
                  <button onClick={() => restore(b.name)} className="btn-ghost !px-2.5 !py-1.5" title="Rikthe databazën" disabled={busy}>
                    <RotateCcw size={15} />
                  </button>
                  <button onClick={() => remove(b.name)} className="btn-danger !px-2.5 !py-1.5" title="Fshi kopjen">
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-ink/45">
        Këshillë: mbani kopjet rezervë edhe jashtë serverit (shkarkoni file-in .dump) dhe automatizoni
        krijimin e tyre me një cron job, p.sh. çdo natë në orën 02:00.
      </p>
    </div>
  );
}
