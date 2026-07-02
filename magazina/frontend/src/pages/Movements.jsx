import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Plus, Search } from "lucide-react";
import api from "../api/client";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { Badge, Field } from "../components/ui";
import { fmtDateTime, fmtNum, MOVEMENT_LABELS } from "../utils/format";

const TYPE_META = {
  in: { tone: "pine", icon: ArrowDownToLine },
  out: { tone: "amber", icon: ArrowUpFromLine },
  transfer: { tone: "ink", icon: ArrowLeftRight }
};

const EMPTY = { product_id: "", type: "in", quantity: "", from_location: "", to_location: "", note: "" };

export default function Movements() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProducts = () => api.get("/products/all").then((r) => setProducts(r.data)).catch(() => {});
  useEffect(() => { loadProducts(); }, []);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/movements", {
      params: {
        page, limit: 10,
        search: search || undefined,
        type: type || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined
      }
    })
      .then((r) => { setRows(r.data.data); setMeta(r.data); })
      .finally(() => setLoading(false));
  }, [page, search, type, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, type, dateFrom, dateTo]);

  const selectedProduct = products.find((p) => String(p.id) === String(form.product_id));

  const openCreate = (t = "in") => { setForm({ ...EMPTY, type: t }); setFormError(""); setModalOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await api.post("/movements", form);
      setModalOpen(false);
      load();
      loadProducts(); // rifresko sasitë në dropdown
    } catch (err) {
      setFormError(err.response?.data?.error || "Regjistrimi dështoi");
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const columns = [
    { key: "created_at", header: "Data", render: (m) => <span className="whitespace-nowrap text-xs text-ink/60">{fmtDateTime(m.created_at)}</span> },
    {
      key: "type", header: "Lloji",
      render: (m) => {
        const { tone, icon: Icon } = TYPE_META[m.type];
        return (
          <Badge tone={tone}>
            <Icon size={12} className="mr-1" /> {MOVEMENT_LABELS[m.type]}
          </Badge>
        );
      }
    },
    {
      key: "product", header: "Produkti",
      render: (m) => (
        <div className="min-w-[160px]">
          <p className="font-semibold">{m.product_name}</p>
          <p className="font-mono text-xs text-ink/50">{m.product_code}</p>
        </div>
      )
    },
    { key: "quantity", header: "Sasia", render: (m) => <span className="font-semibold tabular-nums">{fmtNum(m.quantity)} <span className="text-xs font-normal text-ink/45">{m.unit}</span></span> },
    {
      key: "route", header: "Nga → Te",
      render: (m) => (
        <span className="text-xs text-ink/60">
          {m.from_location || "—"} → {m.to_location || "—"}
        </span>
      )
    },
    { key: "user_name", header: "Përdoruesi", render: (m) => m.user_name || <span className="text-ink/35">—</span> },
    { key: "note", header: "Koment", render: (m) => <span className="block max-w-[200px] truncate text-xs text-ink/55">{m.note || "—"}</span> }
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Lëvizjet e inventarit</h1>
          <p className="text-sm text-ink/55">Historiku i plotë i hyrjeve, daljeve dhe transferimeve</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openCreate("in")} className="btn-primary"><ArrowDownToLine size={16} /> Hyrje</button>
          <button onClick={() => openCreate("out")} className="btn-ghost"><ArrowUpFromLine size={16} /> Dalje</button>
          <button onClick={() => openCreate("transfer")} className="btn-ghost"><ArrowLeftRight size={16} /> Transferim</button>
        </div>
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
          <input className="input !pl-8" placeholder="Kërko produkt…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Të gjitha llojet</option>
          <option value="in">Hyrje</option>
          <option value="out">Dalje</option>
          <option value="transfer">Transferime</option>
        </select>
        <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Nga data" />
        <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Deri më" />
      </div>

      <DataTable
        columns={columns} rows={rows} loading={loading}
        page={meta.page} pages={meta.pages} total={meta.total} onPage={setPage}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Regjistro ${MOVEMENT_LABELS[form.type]?.toLowerCase()}`}>
        <form onSubmit={save} className="space-y-4">
          {formError && <p className="rounded-lg bg-brick-100 px-3 py-2 text-sm text-brick-700">{formError}</p>}

          <Field label="Lloji i lëvizjes" required>
            <select className="input" value={form.type} onChange={set("type")}>
              <option value="in">Hyrje në magazinë</option>
              <option value="out">Dalje nga magazina</option>
              <option value="transfer">Transferim i brendshëm</option>
            </select>
          </Field>

          <Field label="Produkti" required>
            <select className="input" value={form.product_id} onChange={set("product_id")} required>
              <option value="">Zgjidh produktin…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name} (stok: {fmtNum(p.quantity)} {p.unit})
                </option>
              ))}
            </select>
          </Field>

          <Field label={form.type === "transfer" ? "Sasia e transferuar" : "Sasia"} required>
            <input type="number" min="0.001" step="any" className="input" value={form.quantity} onChange={set("quantity")} required />
          </Field>

          {form.type === "in" && (
            <Field label="Vendndodhja e vendosjes">
              <input className="input" value={form.to_location} onChange={set("to_location")}
                     placeholder={selectedProduct?.location || "p.sh. A-01-3"} />
            </Field>
          )}
          {form.type === "transfer" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nga vendndodhja">
                <input className="input" value={form.from_location} onChange={set("from_location")}
                       placeholder={selectedProduct?.location || ""} />
              </Field>
              <Field label="Te vendndodhja" required>
                <input className="input" value={form.to_location} onChange={set("to_location")} required />
              </Field>
            </div>
          )}

          <Field label="Koment">
            <textarea className="input" rows={2} value={form.note} onChange={set("note")}
                      placeholder="p.sh. faturë nr. 1024, klienti X…" />
          </Field>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>Anulo</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Duke regjistruar…" : "Regjistro lëvizjen"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
