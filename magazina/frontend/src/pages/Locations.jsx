import { useEffect, useState } from "react";
import { Boxes, DoorOpen, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";
import { Badge, EmptyState, Field } from "../components/ui";
import { fmtNum, LOCATION_TYPE_LABELS } from "../utils/format";

const EMPTY = { name: "", type: "dhome", description: "", is_active: true };

export default function Locations() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal shto / modifiko
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");

  // Modal i gjendjes (produktet brenda lokacionit)
  const [stockOpen, setStockOpen] = useState(false);
  const [stockLoc, setStockLoc] = useState(null);
  const [stockRows, setStockRows] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/locations").then((r) => setItems(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormError(""); setModalOpen(true); };
  const openEdit = (l) => {
    setEditing(l);
    setForm({ name: l.name, type: l.type, description: l.description || "", is_active: l.is_active });
    setFormError("");
    setModalOpen(true);
  };

  const openStock = (l) => {
    setStockLoc(l);
    setStockOpen(true);
    setStockLoading(true);
    api.get(`/locations/${l.id}/stock`)
      .then((r) => setStockRows(r.data))
      .catch(() => setStockRows([]))
      .finally(() => setStockLoading(false));
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/locations/${editing.id}`, form);
      else await api.post("/locations", form);
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || "Ruajtja dështoi");
    }
  };

  const remove = async (l) => {
    if (!window.confirm(`Të fshihet lokacioni "${l.name}"?`)) return;
    try {
      await api.delete(`/locations/${l.id}`);
      load();
    } catch (err) {
      window.alert(err.response?.data?.error || "Fshirja dështoi");
    }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Lokacionet</h1>
          <p className="text-sm text-ink/55">Gjendja aktuale aktive për çdo kat, dhomë dhe zyrë të magazinës</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Shto lokacion</button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-ink/50">Duke ngarkuar…</p>
      ) : items.length === 0 ? (
        <div className="card p-6"><EmptyState message="Ende nuk ka lokacione. Shtoni katet, dhomat ose zyrat e magazinës." /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((l) => (
            <div key={l.id} className={`card flex flex-col p-5 ${l.is_active ? "" : "opacity-60"}`}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-pine-50 text-pine-600">
                  <DoorOpen size={17} />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(l)} className="rounded-lg p-1.5 text-ink/50 hover:bg-pine-50 hover:text-pine-600" aria-label="Modifiko">
                    <Pencil size={15} />
                  </button>
                  {isAdmin && (
                    <button onClick={() => remove(l)} className="rounded-lg p-1.5 text-ink/50 hover:bg-brick-100 hover:text-brick-700" aria-label="Fshi">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold">{l.name}</h2>
                <Badge tone="ink">{LOCATION_TYPE_LABELS[l.type] || l.type}</Badge>
                {!l.is_active && <Badge tone="amber">Joaktiv</Badge>}
              </div>
              <p className="mt-1 flex-1 text-sm text-ink/55">{l.description || "Pa përshkrim"}</p>

              {/* Gjendja aktuale aktive */}
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-paper/70 p-3 text-center">
                <div>
                  <p className="font-display text-lg font-bold tabular-nums">{fmtNum(l.product_count)}</p>
                  <p className="text-[11px] uppercase tracking-wide text-ink/50">Produkte</p>
                </div>
                <div>
                  <p className="font-display text-lg font-bold tabular-nums">{fmtNum(l.total_quantity)}</p>
                  <p className="text-[11px] uppercase tracking-wide text-ink/50">Njësi</p>
                </div>
                <div>
                  <p className="font-display text-lg font-bold tabular-nums">{fmtNum(Math.round(l.stock_value))} L</p>
                  <p className="text-[11px] uppercase tracking-wide text-ink/50">Vlera</p>
                </div>
              </div>

              <button onClick={() => openStock(l)} className="btn-ghost mt-3 justify-center">
                <Eye size={15} /> Shiko gjendjen
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal shto / modifiko */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifiko lokacionin" : "Shto lokacion të ri"}>
        <form onSubmit={save} className="space-y-4">
          {formError && <p className="rounded-lg bg-brick-100 px-3 py-2 text-sm text-brick-700">{formError}</p>}
          <Field label="Emri i lokacionit" required>
            <input className="input" value={form.name} onChange={set("name")} required placeholder="p.sh. Kati 2, Dhoma B, Zyra e shitjeve…" />
          </Field>
          <Field label="Lloji" required>
            <select className="input" value={form.type} onChange={set("type")}>
              {Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Përshkrimi">
            <textarea className="input" rows={2} value={form.description} onChange={set("description")} />
          </Field>
          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Lokacion aktiv (shfaqet te lëvizjet e reja)
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>Anulo</button>
            <button type="submit" className="btn-primary">{editing ? "Ruaj ndryshimet" : "Shto lokacionin"}</button>
          </div>
        </form>
      </Modal>

      {/* Modal i gjendjes së lokacionit */}
      <Modal open={stockOpen} onClose={() => setStockOpen(false)} title={stockLoc ? `Gjendja aktuale — ${stockLoc.name}` : ""} wide>
        {stockLoading ? (
          <p className="py-8 text-center text-sm text-ink/50">Duke ngarkuar…</p>
        ) : stockRows.length === 0 ? (
          <EmptyState message="Ky lokacion nuk ka stok aktualisht." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-xs font-bold uppercase tracking-wide text-ink/55">
                  <th className="px-3 py-2">Kodi</th>
                  <th className="px-3 py-2">Produkti</th>
                  <th className="px-3 py-2">Kategoria</th>
                  <th className="px-3 py-2 text-right">Sasia</th>
                  <th className="px-3 py-2 text-right">Vlera</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((r) => (
                  <tr key={r.id} className="border-b border-ink/5 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs font-semibold">{r.code}</td>
                    <td className="px-3 py-2 font-semibold">{r.name}</td>
                    <td className="px-3 py-2 text-ink/60">{r.category_name || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtNum(r.quantity)} <span className="text-xs text-ink/45">{r.unit}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(Math.round(r.stock_value))} L</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink/10 font-bold">
                  <td className="px-3 py-2" colSpan={3}>
                    <span className="inline-flex items-center gap-1.5"><Boxes size={14} /> Totali</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtNum(stockRows.reduce((s, r) => s + Number(r.quantity), 0))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtNum(Math.round(stockRows.reduce((s, r) => s + Number(r.stock_value), 0)))} L
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
