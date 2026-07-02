import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight, Bell, Boxes, DatabaseBackup, FileBarChart2,
  LayoutDashboard, LogOut, Menu, Package, Tags, Users, Warehouse, X
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import { fmtDateTime } from "../utils/format";

const NAV = [
  { to: "/", label: "Paneli kryesor", icon: LayoutDashboard, end: true },
  { to: "/produktet", label: "Produktet", icon: Package },
  { to: "/kategorite", label: "Kategoritë", icon: Tags },
  { to: "/levizjet", label: "Lëvizjet", icon: ArrowLeftRight },
  { to: "/raportet", label: "Raportet", icon: FileBarChart2 },
  { to: "/perdoruesit", label: "Përdoruesit", icon: Users, adminOnly: true },
  { to: "/backup", label: "Backup", icon: DatabaseBackup, adminOnly: true }
];

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const ref = useRef(null);

  const loadCount = () => api.get("/notifications/unread-count").then((r) => setCount(r.data.count)).catch(() => {});
  const loadItems = () => api.get("/notifications").then((r) => setItems(r.data)).catch(() => {});

  useEffect(() => {
    loadCount();
    const t = setInterval(loadCount, 30000); // rifresko çdo 30 sekonda
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = () => {
    if (!open) loadItems();
    setOpen(!open);
  };

  const markAll = async () => {
    await api.put("/notifications/read-all");
    loadItems();
    setCount(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative rounded-lg p-2 text-ink/60 hover:bg-ink/5" aria-label="Njoftimet">
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brick-500 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-80 overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-2.5">
            <p className="text-sm font-bold">Njoftimet</p>
            {items.some((n) => !n.is_read) && (
              <button onClick={markAll} className="text-xs font-semibold text-pine-600 hover:underline">
                Shëno të gjitha si të lexuara
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink/50">Nuk ka njoftime.</p>
            ) : (
              items.map((n) => (
                <div key={n.id} className={`border-b border-ink/5 px-4 py-3 last:border-0 ${n.is_read ? "opacity-60" : "bg-amber-100/40"}`}>
                  <p className="text-sm">{n.message}</p>
                  <p className="mt-1 text-xs text-ink/45">{fmtDateTime(n.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const nav = NAV.filter((item) => !item.adminOnly || isAdmin);

  const sidebar = (
    <div className="flex h-full flex-col bg-pine-900 text-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/90 text-pine-900">
          <Warehouse size={22} strokeWidth={2.4} />
        </div>
        <div>
          <p className="font-display text-lg font-bold leading-tight">Magazina</p>
          <p className="text-[11px] uppercase tracking-widest text-white/50">Inventari</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="truncate text-sm font-semibold">{user?.name}</p>
        <p className="text-xs text-white/50">{isAdmin ? "Administrator" : "Përdorues"}</p>
        <button
          onClick={handleLogout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
        >
          <LogOut size={16} /> Dil nga sistemi
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar për desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>

      {/* Sidebar për celular */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">
            {sidebar}
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-white/70 hover:bg-white/10"
              aria-label="Mbyll menunë"
            >
              <X size={20} />
            </button>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink/10 bg-paper/85 px-4 py-3 backdrop-blur lg:px-8">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 hover:bg-ink/5 lg:hidden" aria-label="Hap menunë">
            <Menu size={20} />
          </button>
          <div className="hidden items-center gap-2 text-sm text-ink/50 lg:flex">
            <Boxes size={16} />
            Sistemi i menaxhimit të magazinës
          </div>
          <NotificationsBell />
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
