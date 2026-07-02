import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import categoryRoutes from "./routes/categories.js";
import productRoutes from "./routes/products.js";
import movementRoutes from "./routes/movements.js";
import dashboardRoutes from "./routes/dashboard.js";
import reportRoutes from "./routes/reports.js";
import userRoutes from "./routes/users.js";
import notificationRoutes from "./routes/notifications.js";
import backupRoutes from "./routes/backup.js";

import { requireAuth } from "./middleware/auth.js";
import { initDb } from "./init-db.js";

const app = express();

app.use(cors());
app.use(express.json());

// Rrugët publike
app.use("/api/auth", authRoutes);

// Rrugët e mbrojtura (kërkojnë token të vlefshëm)
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/categories", requireAuth, categoryRoutes);
app.use("/api/products", requireAuth, productRoutes);
app.use("/api/movements", requireAuth, movementRoutes);
app.use("/api/reports", requireAuth, reportRoutes);
app.use("/api/users", requireAuth, userRoutes);
app.use("/api/notifications", requireAuth, notificationRoutes);
app.use("/api/backup", requireAuth, backupRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// 404 për rrugë API të panjohura
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Rruga nuk u gjet" });
});

// Trajtuesi qendror i gabimeve
app.use((err, _req, res, _next) => {
  console.error(err);

  if (err.code === "23505") {
    return res.status(409).json({
      error: "Vlera ekziston tashmë (duhet të jetë unike)."
    });
  }

  res.status(err.status || 500).json({
    error: err.message || "Gabim i brendshëm i serverit"
  });
});

const PORT = process.env.PORT || 4000;

// Inicializo databazën dhe krijo admin-in në nisjen e parë
(async () => {
  try {
    await initDb();

    app.listen(PORT, () => {
      console.log(`✔ API në http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Gabim gjatë inicializimit të databazës:", err);
    process.exit(1);
  }
})();
