import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Warehouse } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Hyrja dështoi, provoni përsëri");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-pine-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3 text-white">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/90 text-pine-900">
            <Warehouse size={26} strokeWidth={2.4} />
          </div>
          <div>
            <p className="font-display text-2xl font-bold leading-tight">Magazina</p>
            <p className="text-xs uppercase tracking-widest text-white/50">Menaxhimi i inventarit</p>
          </div>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <h1 className="font-display text-lg font-bold">Hyni në llogarinë tuaj</h1>

          {error && (
            <p className="rounded-lg bg-brick-100 px-3 py-2 text-sm font-medium text-brick-700">{error}</p>
          )}

          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email" type="email" className="input" value={email} required
              autoComplete="username" placeholder="emri@kompania.al"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Fjalëkalimi</label>
            <input
              id="password" type="password" className="input" value={password} required
              autoComplete="current-password" placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Duke hyrë…" : "Hyr"}
          </button>
        </form>
      </div>
    </div>
  );
}
