import { useEffect, useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";
import { EmptyState, Field } from "../components/ui";

export default function Categories() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [formError, setFormError] = useState("");

  const load = () => {
    setLoading(true);
    api.get("/categories").then((r) => setItems(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); setForm({ name: "", description: "" }); setFormError(""); setModalOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, description: c.description || "" }); setFormError(""); setModalOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/categories/${editing.id}`, form);
      else await api.post("/categories", form);
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || "Ruajtja dështoi");
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Të fshihet kategoria "${c.name}"? Produktet e saj do të mbeten pa kategori.`)) return;
    try {
      await api.delete(`/categories/${c.id}`);
      load();
    } catch (err) {
      window.alert(err.response?.data?.error || "Fshirja dështoi");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Kategoritë</h1>
          <p className="text-sm text-ink/55">Grupimi i produkteve në magazinë</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Shto kategori</button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-ink/50">Duke ngarkuar…</p>
      ) : items.length === 0 ? (
        <div className="card p-6"><EmptyState message="Ende nuk ka kategori. Shtoni të parën për të organizuar produktet." /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <div key={c.id} className="card flex flex-col p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-pine-50 text-pine-600">
                  <Tags size={17} />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-ink/50 hover:bg-pine-50 hover:text-pine-600" aria-label="Modifiko">
                    <Pencil size={15} />
                  </button>
                  {isAdmin && (
                    <button onClick={() => remove(c)} className="rounded-lg p-1.5 text-ink/50 hover:bg-brick-100 hover:text-brick-700" aria-label="Fshi">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
              <h2 className="font-display font-bold">{c.name}</h2>
              <p className="mt-1 flex-1 text-sm text-ink/55">{c.description || "Pa përshkrim"}</p>
              <p className="mt-3 text-xs font-semibold text-pine-600">{c.product_count} produkte</p>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifiko kategorinë" : "Shto kategori të re"}>
        <form onSubmit={save} className="space-y-4">
          {formError && <p className="rounded-lg bg-brick-100 px-3 py-2 text-sm text-brick-700">{formError}</p>}
          <Field label="Emri i kategorisë" required>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Përshkrimi">
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>Anulo</button>
            <button type="submit" className="btn-primary">{editing ? "Ruaj ndryshimet" : "Shto kategorinë"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
