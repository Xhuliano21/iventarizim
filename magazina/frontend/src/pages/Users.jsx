import { useEffect, useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2, User } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";
import { Badge, Field } from "../components/ui";
import { fmtDate } from "../utils/format";

const EMPTY = { name: "", email: "", password: "", role: "user", is_active: true };

export default function UsersPage() {
  const { user: me } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");

  const load = () => {
    setLoading(true);
    api.get("/users").then((r) => setItems(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormError(""); setModalOpen(true); };
  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, is_active: u.is_active });
    setFormError("");
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, {
          name: form.name,
          role: form.role,
          is_active: form.is_active,
          password: form.password || undefined
        });
      } else {
        await api.post("/users", form);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || "Ruajtja dështoi");
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Të fshihet përdoruesi "${u.name}"?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
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
          <h1 className="font-display text-2xl font-bold">Përdoruesit</h1>
          <p className="text-sm text-ink/55">Llogaritë dhe të drejtat e aksesit në sistem</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Shto përdorues</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-paper/60 text-left">
                {["Përdoruesi", "Roli", "Statusi", "Krijuar", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink/55">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-ink/50">Duke ngarkuar…</td></tr>
              ) : items.map((u) => (
                <tr key={u.id} className="border-b border-ink/5 last:border-0 hover:bg-pine-50/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`grid h-9 w-9 place-items-center rounded-full ${u.role === "admin" ? "bg-pine-50 text-pine-600" : "bg-ink/5 text-ink/50"}`}>
                        {u.role === "admin" ? <ShieldCheck size={17} /> : <User size={17} />}
                      </div>
                      <div>
                        <p className="font-semibold">{u.name} {u.id === me.id && <span className="text-xs text-ink/45">(ju)</span>}</p>
                        <p className="text-xs text-ink/50">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.role === "admin" ? "pine" : "ink"}>
                      {u.role === "admin" ? "Administrator" : "Përdorues"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.is_active ? "pine" : "brick"}>{u.is_active ? "Aktiv" : "Çaktivizuar"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink/55">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(u)} className="rounded-lg p-1.5 text-ink/50 hover:bg-pine-50 hover:text-pine-600" aria-label="Modifiko">
                        <Pencil size={15} />
                      </button>
                      {u.id !== me.id && (
                        <button onClick={() => remove(u)} className="rounded-lg p-1.5 text-ink/50 hover:bg-brick-100 hover:text-brick-700" aria-label="Fshi">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifiko përdoruesin" : "Shto përdorues të ri"}>
        <form onSubmit={save} className="space-y-4">
          {formError && <p className="rounded-lg bg-brick-100 px-3 py-2 text-sm text-brick-700">{formError}</p>}

          <Field label="Emri i plotë" required>
            <input className="input" value={form.name} onChange={set("name")} required />
          </Field>
          <Field label="Email" required>
            <input type="email" className="input" value={form.email} onChange={set("email")} required disabled={!!editing} />
          </Field>
          <Field label={editing ? "Fjalëkalim i ri (lëreni bosh për ta mbajtur)" : "Fjalëkalimi"} required={!editing}>
            <input type="password" className="input" value={form.password} onChange={set("password")}
                   required={!editing} minLength={8} placeholder="Të paktën 8 karaktere" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Roli">
              <select className="input" value={form.role} onChange={set("role")}>
                <option value="user">Përdorues — regjistron hyrje/dalje</option>
                <option value="admin">Administrator — akses i plotë</option>
              </select>
            </Field>
            <Field label="Statusi">
              <select className="input" value={String(form.is_active)}
                      onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === "true" }))}>
                <option value="true">Aktiv</option>
                <option value="false">Çaktivizuar</option>
              </select>
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>Anulo</button>
            <button type="submit" className="btn-primary">{editing ? "Ruaj ndryshimet" : "Shto përdoruesin"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
