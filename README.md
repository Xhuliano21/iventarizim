# Magazina — Sistemi i Menaxhimit të Inventarit

Aplikacion web modern për menaxhimin e magazinës dhe inventarit të një kompanie të vogël (2–10 përdorues).

**Teknologjitë:** React 18 + Tailwind CSS · Node.js + Express · PostgreSQL 14+

---

## Funksionalitetet

| Modul | Përshkrimi |
|---|---|
| **Paneli kryesor** | Numri total i produkteve, sasia totale, vlera e stokut, produktet me stok të ulët, produktet e fundit, grafiku i hyrje-daljeve për 30 ditët e fundit |
| **Produktet** | CRUD i plotë me kod unik, kategori, njësi matëse, stok minimal, çmime blerje/shitje, vendndodhje në magazinë; kërkim, filtrim (kategori, stok, datë), sortim dhe pagination nga serveri |
| **Kategoritë** | Krijim, modifikim, fshirje (fshirja vetëm nga admini) |
| **Lëvizjet** | Hyrje, dalje dhe transferime të brendshme me datë, përdorues dhe komente; historik i plotë i filtruesehëm; kontroll automatik i stokut të pamjaftueshëm |
| **Raportet** | Inventari aktual, stoku i ulët, hyrje-daljet e periudhës — të gjitha me eksport në **Excel** dhe **PDF** |
| **Përdoruesit** | Dy role: **Administrator** (akses i plotë) dhe **Përdorues** (sheh dhe regjistron lëvizje, nuk fshin dot të dhëna); menaxhohen vetëm nga admini |
| **Njoftimet** | Njoftim automatik në kohë reale kur një produkt bie nën stokun minimal (zilja në krye të faqes) |
| **Backup** | Krijim, shkarkim, rikthim dhe fshirje e kopjeve rezervë të plota me `pg_dump` / `pg_restore` (vetëm admin) |

## Struktura e projektit

```
magazina/
├── database/
│   ├── schema.sql          # Skema e plotë e databazës (tabela, indekse, trigger, view)
│   └── diagram.mermaid     # Diagrama ER e tabelave
├── backend/                # API me Node.js + Express
│   ├── src/
│   │   ├── index.js        # Hyrja e aplikacionit, montimi i rrugëve
│   │   ├── config/db.js    # Pool-i i PostgreSQL + ndihmës për transaksione
│   │   ├── middleware/     # requireAuth (JWT), requireAdmin, asyncHandler
│   │   ├── services/       # Logjika e biznesit (lëvizjet e stokut + njoftimet)
│   │   └── routes/         # auth, products, categories, movements,
│   │                       # dashboard, reports, users, notifications, backup
│   └── scripts/seed.js     # Të dhënat fillestare (përdorues + produkte shembull)
├── frontend/               # React + Vite + Tailwind CSS
│   └── src/
│       ├── api/client.js   # Axios me token JWT dhe trajtim 401
│       ├── context/        # AuthContext (login / logout / roli)
│       ├── components/     # Layout (sidebar + njoftimet), DataTable, Modal, UI
│       └── pages/          # Dashboard, Products, Categories, Movements,
│                           # Reports, Users, Backup, Login
└── docker-compose.yml      # PostgreSQL i gatshëm për zhvillim
```

**Arkitektura:** shtresa të ndara qartë — rrugët (HTTP) → shërbimet (logjika e biznesit) → databaza (SQL me parametra). Lëvizjet e stokut ekzekutohen brenda **transaksioneve me `SELECT … FOR UPDATE`**, kështu që sasitë mbeten të sakta edhe kur disa përdorues punojnë njëkohësisht. Frontend-i komunikon vetëm me API-në REST, ndaj mund të shkallëzohet ose zëvendësohet i pavarur.

---

## Instalimi hap pas hapi

### 1. Databaza (PostgreSQL)

Mënyra më e shpejtë — me Docker:

```bash
docker compose up -d        # ngre PostgreSQL 16 dhe aplikon schema.sql automatikisht
```

Ose manualisht, në një PostgreSQL ekzistues:

```bash
createdb magazina
psql magazina -f database/schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env        # pershtat DATABASE_URL dhe JWT_SECRET
npm install
npm run seed                # krijon perdoruesit dhe te dhenat shembull
npm run dev                 # API ne http://localhost:4000
```

Llogaritë e krijuara nga seed:

| Roli | Email | Fjalëkalimi |
|---|---|---|
| Administrator | `admin@magazina.al` | `Admin123!` |
| Përdorues | `punonjes@magazina.al` | `Perdorues1!` |

> Ndryshojini këto fjalëkalime menjëherë pas hyrjes së parë (Përdoruesit → Modifiko).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxy automatik drejt API-se)
```

Për prodhim: `npm run build` gjeneron `dist/`, që mund të shërbehet nga Nginx ose nga vetë Express-i.

---

## API — përmbledhje

| Metoda | Rruga | Përshkrimi | Roli |
|---|---|---|---|
| POST | `/api/auth/login` | Hyrja, kthen token JWT | publik |
| GET | `/api/dashboard` | Statistikat + grafiku 30-ditor | të gjithë |
| GET/POST/PUT | `/api/products` | Lista (kërkim, filtra, sortim, pagination), shto, modifiko | të gjithë |
| DELETE | `/api/products/:id` | Fshi produkt | admin |
| GET/POST/PUT | `/api/categories` | Kategoritë | të gjithë |
| DELETE | `/api/categories/:id` | Fshi kategori | admin |
| GET/POST | `/api/movements` | Historiku + regjistrim hyrje/dalje/transferim | të gjithë |
| GET | `/api/reports/{inventory,low-stock,movements}?format=xlsx\|pdf` | Raportet me eksport | të gjithë |
| GET | `/api/notifications`, `/unread-count` | Njoftimet e stokut të ulët | të gjithë |
| CRUD | `/api/users` | Menaxhimi i llogarive | admin |
| GET/POST | `/api/backup`, `/:name/restore`, `/:name/download` | Kopjet rezervë | admin |

## Backup dhe rikthim

Nga ndërfaqja (menuja **Backup**, vetëm admin) ose nga API. Kërkon që `pg_dump` dhe `pg_restore` të jenë të instaluara në serverin ku ekzekutohet backend-i. Kopjet ruhen në `BACKUP_DIR` (parazgjedhje `backend/backups/`).

Automatizim me cron (çdo natë në 02:00):

```bash
0 2 * * * curl -s -X POST http://localhost:4000/api/backup -H "Authorization: Bearer <TOKEN_ADMIN>"
```

## Siguria

- Fjalëkalimet ruhen me **bcrypt** (10 rounds), kurrë në tekst të hapur.
- Autentikimi me **JWT** me skadencë (parazgjedhje 8 orë); çdo rrugë e API-së është e mbrojtur.
- Rolet zbatohen **në server** (`requireAdmin`), jo vetëm në ndërfaqe.
- Të gjitha query-t përdorin **parametra** (`$1, $2…`) — pa SQL injection; kolonat e sortimit vijnë nga një listë e bardhë.
- Emrat e file-ve të backup-it validohen kundër path traversal.

Për prodhim rekomandohet gjithashtu: HTTPS (Nginx + Let's Encrypt), `JWT_SECRET` i gjatë dhe i rastësishëm, rate limiting në `/api/auth/login` (p.sh. `express-rate-limit`), dhe kufizim i CORS te domain-i juaj.

## Ide për zgjerim

Furnitorët dhe porositë e blerjes · barkod/QR për produktet · disa magazina fizike · njoftime me email · log auditimi për çdo ndryshim · import produktesh nga Excel.
