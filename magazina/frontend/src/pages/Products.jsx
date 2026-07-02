import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { Badge, Field, LocationTag } from "../components/ui";
import { fmtDate, fmtMoney, fmtNum } from "../utils/format";

const EMPTY = {
  code: "", name: "", category_id: "", description: "", unit: "copë",
  quantity: 0, min_stock: 0, purchase_price: "", sale_price: "", location_id: ""
};

export default function Products() {
  const { isAdmin } = useAuth();
  const [params] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  // Filtrat
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stock, setStock] = useState(params.get("stock") || "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState("desc");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [locations, setLocations] = useState([]);

  useEffect(() => {
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
    api.get("/locations", { params: { active: 1 } }).then((r) => setLocations(r.data)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/products", {
      params: {
        page, limit: 10, sort, order,
        search: search || undefined,
        category_id: categoryId || undefined,
        stock: stock || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined
      }
    })
      .then((r) => { setRows(r.data.data); setMeta(r.data); })
      .finally(() => setLoading(false));
  }, [page, sort, order, search, categoryId, stock, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, categoryId, stock, dateFrom, dateTo]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormError(""); setModalOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      code: p.code, name: p.name, category_id: p.category_id || "",
      description: p.description || "", unit: p.unit,
      quantity: p.quantity, min_stock: p.min_stock,
      purchase_price: p.purchase_price ?? "", sale_price: p.sale_price ?? "",
      location_id: ""
    });
    setFormError("");
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (editing) await api.put(`/products/${editing.id}`, form);
      else await api.post("/products", form);
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || "Ruajtja dështoi");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Të fshihet produkti "${p.name}"? Ky veprim fshin edhe historikun e lëvizjeve të tij.`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      load();
    } catch (err) {
      window.alert(err.response?.data?.error || "Fshirja dështoi");
    }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const columns = [
    { key: "code", header: "Kodi", sortable: true, render: (p) => <span className="font-mono text-xs font-semibold">{p.code}</span> },
    {
      key: "name", header: "Emërtimi", sortable: true,
      render: (p) => (
        <div className="min-w-[160px]">
          <p className="font-semibold">{p.name}</p>
          {p.description && <p className="max-w-[240px] truncate text-xs text-ink/50">{p.description}</p>}
        </div>
      )
    },
    { key: "category", header: "Kategoria", sortable: true, render: (p) => p.category_name || <span className="text-ink/35">—</span> },
    {
      key: "quantity", header: "Sasia", sortable: true,
      render: (p) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold tabular-nums">{fmtNum(p.quantity)}</span>
          <span className="text-xs text-ink/45">{p.unit}</span>
          {p.is_low_stock && <Badge tone="amber">Stok i ulët</Badge>}
        </div>
      )
    },
    { key: "min_stock", header: "Min.", sortable: true, render: (p) => fmtNum(p.min_stock) },
    { key: "purchase_price", header: "Ç. blerjes", sortable: true, render: (p) => fmtMoney(p.purchase_price) },
    { key: "sale_price", header: "Ç. shitjes", sortable: true, render: (p) => fmtMoney(p.sale_price) },
    {
      key: "location", header: "Vendndodhja",
      render: (p) =>
        p.locations_summary
          ? <span className="block max-w-[220px] truncate text-xs text-ink/60" title={p.locations_summary}>{p.locations_summary}</span>
          : <LocationTag value={p.location} />
    },
    { key: "created_at", header: "Krijuar", sortable: true, render: (p) => <span className="text-xs text-ink/55">{fmtDate(p.created_at)}</span> },
    {
      key: "_actions", header: "",
      render: (p) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-ink/50 hover:bg-pine-50 hover:text-pine-600" aria-label="Modifiko">
            <Pencil size={15} />
          </button>
          {isAdmin && (
            <button onClick={() => remove(p)} className="rounded-lg p-1.5 text-ink/50 hover:bg-brick-100 hover:text-brick-700" aria-label="Fshi">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Produktet</h1>
          <p className="text-sm text-ink/55">{meta.total} produkte në katalog</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Shto produkt
        </button>
      </div>

      {/* Filtrat */}
      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
          <input
            className="input !pl-8" placeholder="Kërko kod ose emërtim…"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Të gjitha kategoritë</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={stock} onChange={(e) => setStock(e.target.value)}>
          <option value="">Çdo nivel stoku</option>
          <option value="low">Vetëm stok të ulët</option>
          <option value="ok">Vetëm stok në rregull</option>
        </select>
        <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Krijuar nga data" />
        <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Krijuar deri më" />
      </div>

      <DataTable
        columns={columns} rows={rows} loading={loading}
        sort={sort} order={order}
        onSort={(s, o) => { setSort(s); setOrder(o); }}
        page={meta.page} pages={meta.pages} total={meta.total}
        onPage={setPage}
      />

      {/* Modal shto / modifiko */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifiko produktin" : "Shto produkt të ri"} wide>
        <form onSubmit={save} className="space-y-4">
          {formError && <p className="rounded-lg bg-brick-100 px-3 py-2 text-sm text-brick-700">{formError}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kodi i produktit" required>
              <input className="input" value={form.code} onChange={set("code")} required placeholder="p.sh. PRD-007" />
            </Field>
            <Field label="Emërtimi" required>
              <input className="input" value={form.name} onChange={set("name")} required />
            </Field>
            <Field label="Kategoria">
              <select className="input" value={form.category_id} onChange={set("category_id")}>
                <option value="">Pa kategori</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Njësia matëse">
              <input className="input" value={form.unit} onChange={set("unit")} placeholder="copë, kg, m, litër…" />
            </Field>
            <Field label={editing ? "Sasia aktuale (vetëm lexim)" : "Sasia fillestare"}>
              <input
                type="number" min="0" step="any" className="input"
                value={form.quantity} onChange={set("quantity")}
                disabled={!!editing}
                title={editing ? "Sasia ndryshohet vetëm përmes lëvizjeve (hyrje / dalje)" : undefined}
              />
              {editing && (
                <p className="mt-1 text-xs text-ink/50">
                  Sasia dhe vendndodhja ndryshohen vetëm përmes lëvizjeve (hyrje / dalje / transferim).
                </p>
              )}
            </Field>
            <Field label="Stoku minimal">
              <input type="number" min="0" step="any" className="input" value={form.min_stock} onChange={set("min_stock")} />
            </Field>
            <Field label="Çmimi i blerjes (L)">
              <input type="number" min="0" step="0.01" className="input" value={form.purchase_price} onChange={set("purchase_price")} />
            </Field>
            <Field label="Çmimi i shitjes (L)">
              <input type="number" min="0" step="0.01" className="input" value={form.sale_price} onChange={set("sale_price")} />
            </Field>
            {!editing ? (
              <Field label="Vendosja fillestare (lokacioni)">
                <select className="input" value={form.location_id} onChange={set("location_id")}>
                  <option value="">Magazina kryesore (parazgjedhje)</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Vendndodhja aktuale">
                <p className="input flex items-center bg-ink/[0.03] text-sm text-ink/60">
                  {editing.locations_summary || editing.location || "—"}
                </p>
              </Field>
            )}
          </div>

          <Field label="Përshkrimi">
            <textarea className="input" rows={2} value={form.description} onChange={set("description")} />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>Anulo</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Duke ruajtur…" : editing ? "Ruaj ndryshimet" : "Shto produktin"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
