import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Locations from "./pages/Locations";
import Movements from "./pages/Movements";
import Reports from "./pages/Reports";
import UsersPage from "./pages/Users";
import Backup from "./pages/Backup";

function Protected({ children, adminOnly }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/produktet" element={<Products />} />
        <Route path="/kategorite" element={<Categories />} />
        <Route path="/lokacionet" element={<Locations />} />
        <Route path="/levizjet" element={<Movements />} />
        <Route path="/raportet" element={<Reports />} />
        <Route path="/perdoruesit" element={<Protected adminOnly><UsersPage /></Protected>} />
        <Route path="/backup" element={<Protected adminOnly><Backup /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
