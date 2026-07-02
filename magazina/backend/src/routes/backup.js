import { Router } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { asyncHandler, requireAdmin } from "../middleware/auth.js";

const run = promisify(execFile);
const router = Router();

// Backup-i dhe rikthimi janë vetëm për administratorë
router.use(requireAdmin);

const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || "./backups");
fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Mbrojtje nga path traversal: pranohen vetëm emra si backup-2026-07-02T10-30-00.dump
const isValidName = (name) => /^backup-[\w.-]+\.dump$/.test(name);
const fileOf = (name) => path.join(BACKUP_DIR, name);

// GET /api/backup — lista e kopjeve rezervë
router.get("/", asyncHandler(async (_req, res) => {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(isValidName)
    .map((name) => {
      const stat = fs.statSync(fileOf(name));
      return { name, size: stat.size, created_at: stat.mtime };
    })
    .sort((a, b) => b.created_at - a.created_at);
  res.json(files);
}));

// POST /api/backup — krijo kopje rezervë (pg_dump, format custom)
router.post("/", asyncHandler(async (_req, res) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `backup-${stamp}.dump`;
  await run("pg_dump", ["--format=custom", `--file=${fileOf(name)}`, process.env.DATABASE_URL]);
  res.status(201).json({ ok: true, name });
}));

// GET /api/backup/:name/download — shkarko kopjen
router.get("/:name/download", asyncHandler(async (req, res) => {
  const { name } = req.params;
  if (!isValidName(name) || !fs.existsSync(fileOf(name))) {
    return res.status(404).json({ error: "Kopja rezervë nuk u gjet" });
  }
  res.download(fileOf(name));
}));

// POST /api/backup/:name/restore — rikthe databazën nga kopja
router.post("/:name/restore", asyncHandler(async (req, res) => {
  const { name } = req.params;
  if (!isValidName(name) || !fs.existsSync(fileOf(name))) {
    return res.status(404).json({ error: "Kopja rezervë nuk u gjet" });
  }
  // --clean --if-exists rikrijon objektet ekzistuese para rikthimit
  await run("pg_restore", [
    "--clean", "--if-exists", "--no-owner",
    `--dbname=${process.env.DATABASE_URL}`,
    fileOf(name)
  ]);
  res.json({ ok: true, message: "Databaza u rikthye me sukses" });
}));

// DELETE /api/backup/:name — fshi një kopje rezervë
router.delete("/:name", asyncHandler(async (req, res) => {
  const { name } = req.params;
  if (!isValidName(name) || !fs.existsSync(fileOf(name))) {
    return res.status(404).json({ error: "Kopja rezervë nuk u gjet" });
  }
  fs.unlinkSync(fileOf(name));
  res.json({ ok: true });
}));

export default router;
