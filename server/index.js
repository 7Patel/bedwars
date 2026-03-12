const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "bedwars-secret-key-change-in-prod";
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "bedwars.db");

app.use(cors());
app.use(express.json());

// ── Serve React build in production ──────────────────────────────────────────
const clientBuild = path.join(__dirname, "../client/build");
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
}

// ── Database setup ────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username  TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password  TEXT NOT NULL,
    avatar    TEXT DEFAULT '🎮',
    theme     TEXT DEFAULT 'fire',
    is_admin  INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stats (
    user_id            INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    level              REAL DEFAULT 0,
    wins               REAL DEFAULT 0,
    eliminations       REAL DEFAULT 0,
    final_eliminations REAL DEFAULT 0,
    assists            REAL DEFAULT 0,
    kd                 REAL DEFAULT 0,
    diamonds           REAL DEFAULT 0,
    gold               REAL DEFAULT 0,
    bed_destroyed      REAL DEFAULT 0,
    vaults_opened      REAL DEFAULT 0,
    upgrades           REAL DEFAULT 0,
    damage_dealt       REAL DEFAULT 0,
    clutch_eliminations REAL DEFAULT 0,
    updated_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS progress (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    period     TEXT NOT NULL,
    period_type TEXT NOT NULL CHECK(period_type IN ('weekly','monthly')),
    wins       REAL DEFAULT 0,
    eliminations REAL DEFAULT 0,
    bed_destroyed REAL DEFAULT 0,
    recorded_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, period)
  );
`);

// Seed admin if not exists
const adminExists = db.prepare("SELECT id FROM users WHERE is_admin=1").get();
if (!adminExists) {
  const hash = bcrypt.hashSync("bedwars123", 10);
  const adminId = db.prepare("INSERT INTO users (username,password,avatar,is_admin) VALUES (?,?,?,1)")
    .run("admin", hash, "👑").lastInsertRowid;
  db.prepare("INSERT INTO stats (user_id) VALUES (?)").run(adminId);
}

// Seed demo players if empty
const playerCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE is_admin=0").get().c;
if (playerCount === 0) {
  const demos = [
    { username:"StormKing", avatar:"⚡", theme:"ice", stats:{ level:55,wins:51,eliminations:489,final_eliminations:223,assists:134,kd:4.6,diamonds:11200,gold:42000,bed_destroyed:91,vaults_opened:31,upgrades:198,damage_dealt:224100,clutch_eliminations:62 } },
    { username:"ShadowBlade", avatar:"🗡️", theme:"fire", stats:{ level:47,wins:38,eliminations:412,final_eliminations:189,assists:97,kd:3.8,diamonds:8420,gold:31200,bed_destroyed:74,vaults_opened:22,upgrades:145,damage_dealt:187400,clutch_eliminations:43 } },
    { username:"NightReaper", avatar:"💀", theme:"void", stats:{ level:39,wins:29,eliminations:334,final_eliminations:141,assists:78,kd:2.9,diamonds:6130,gold:24800,bed_destroyed:58,vaults_opened:18,upgrades:112,damage_dealt:143200,clutch_eliminations:31 } },
    { username:"IronFang", avatar:"🔱", theme:"fire", stats:{ level:28,wins:17,eliminations:198,final_eliminations:89,assists:55,kd:1.9,diamonds:3800,gold:16400,bed_destroyed:38,vaults_opened:11,upgrades:76,damage_dealt:92300,clutch_eliminations:18 } },
  ];
  demos.forEach(({ username, avatar, theme, stats }) => {
    const hash = bcrypt.hashSync("demo123", 10);
    const uid = db.prepare("INSERT INTO users (username,password,avatar,theme) VALUES (?,?,?,?)")
      .run(username, hash, avatar, theme).lastInsertRowid;
    db.prepare(`INSERT INTO stats (user_id,level,wins,eliminations,final_eliminations,assists,kd,diamonds,gold,bed_destroyed,vaults_opened,upgrades,damage_dealt,clutch_eliminations)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(uid,
      stats.level,stats.wins,stats.eliminations,stats.final_eliminations,stats.assists,stats.kd,
      stats.diamonds,stats.gold,stats.bed_destroyed,stats.vaults_opened,stats.upgrades,stats.damage_dealt,stats.clutch_eliminations);
    // seed some progress
    const weeks = [
      { period:"2024-W01",period_type:"weekly",wins:Math.floor(stats.wins*0.2),eliminations:Math.floor(stats.eliminations*0.2),bed_destroyed:Math.floor(stats.bed_destroyed*0.2) },
      { period:"2024-W02",period_type:"weekly",wins:Math.floor(stats.wins*0.35),eliminations:Math.floor(stats.eliminations*0.35),bed_destroyed:Math.floor(stats.bed_destroyed*0.35) },
      { period:"2024-W03",period_type:"weekly",wins:Math.floor(stats.wins*0.55),eliminations:Math.floor(stats.eliminations*0.55),bed_destroyed:Math.floor(stats.bed_destroyed*0.55) },
      { period:"2024-W04",period_type:"weekly",wins:Math.floor(stats.wins*0.8),eliminations:Math.floor(stats.eliminations*0.8),bed_destroyed:Math.floor(stats.bed_destroyed*0.8) },
      { period:"2024-M01",period_type:"monthly",wins:Math.floor(stats.wins*0.5),eliminations:Math.floor(stats.eliminations*0.5),bed_destroyed:Math.floor(stats.bed_destroyed*0.5) },
      { period:"2024-M02",period_type:"monthly",wins:stats.wins,eliminations:stats.eliminations,bed_destroyed:stats.bed_destroyed },
    ];
    weeks.forEach(w => {
      try { db.prepare("INSERT INTO progress (user_id,period,period_type,wins,eliminations,bed_destroyed) VALUES (?,?,?,?,?,?)").run(uid,w.period,w.period_type,w.wins,w.eliminations,w.bed_destroyed); } catch(e){}
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
}
function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (!req.user.isAdmin) return res.status(403).json({ error: "Admin only" });
    next();
  });
}
function getFullPlayers() {
  return db.prepare(`
    SELECT u.id,u.username,u.avatar,u.theme,u.is_admin,u.created_at,
      s.level,s.wins,s.eliminations,s.final_eliminations,s.assists,s.kd,
      s.diamonds,s.gold,s.bed_destroyed,s.vaults_opened,s.upgrades,
      s.damage_dealt,s.clutch_eliminations,s.updated_at
    FROM users u LEFT JOIN stats s ON u.id=s.user_id
    WHERE u.is_admin=0
    ORDER BY s.wins DESC
  `).all();
}

// ── Auth Routes ───────────────────────────────────────────────────────────────
app.post("/api/register", (req, res) => {
  const { username, password, avatar } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: "Username must be 2-20 characters" });
  const exists = db.prepare("SELECT id FROM users WHERE username=?").get(username);
  if (exists) return res.status(409).json({ error: "Username already taken" });
  const hash = bcrypt.hashSync(password, 10);
  const uid = db.prepare("INSERT INTO users (username,password,avatar) VALUES (?,?,?)")
    .run(username.trim(), hash, avatar || "🎮").lastInsertRowid;
  db.prepare("INSERT INTO stats (user_id) VALUES (?)").run(uid);
  const token = jwt.sign({ id: uid, username, isAdmin: false }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: uid, username, avatar: avatar||"🎮", isAdmin: false } });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: "Wrong username or password" });
  const token = jwt.sign({ id: user.id, username: user.username, isAdmin: !!user.is_admin }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: user.id, username: user.username, avatar: user.avatar, theme: user.theme, isAdmin: !!user.is_admin } });
});

// ── Player Routes ─────────────────────────────────────────────────────────────
app.get("/api/players", (_, res) => {
  res.json(getFullPlayers());
});

app.get("/api/players/:id/progress", (req, res) => {
  const rows = db.prepare("SELECT * FROM progress WHERE user_id=? ORDER BY period ASC").all(req.params.id);
  res.json(rows);
});

app.put("/api/me/stats", authMiddleware, (req, res) => {
  if (req.user.isAdmin) return res.status(403).json({ error: "Admins don't have stats" });
  const { level,wins,eliminations,finalEliminations,assists,kd,diamonds,gold,bedDestroyed,vaultsOpened,upgrades,damageDealt,clutchEliminations } = req.body;
  db.prepare(`UPDATE stats SET level=?,wins=?,eliminations=?,final_eliminations=?,assists=?,kd=?,diamonds=?,gold=?,bed_destroyed=?,vaults_opened=?,upgrades=?,damage_dealt=?,clutch_eliminations=?,updated_at=datetime('now') WHERE user_id=?`)
    .run(level||0,wins||0,eliminations||0,finalEliminations||0,assists||0,kd||0,diamonds||0,gold||0,bedDestroyed||0,vaultsOpened||0,upgrades||0,damageDealt||0,clutchEliminations||0,req.user.id);

  // Auto-record progress snapshot
  const now = new Date();
  const weekNum = Math.ceil(now.getDate()/7);
  const wk = `${now.getFullYear()}-W${String(now.getMonth()+1).padStart(2,"0")}-${weekNum}`;
  const mo = `${now.getFullYear()}-M${String(now.getMonth()+1).padStart(2,"0")}`;
  const snap = { wins:wins||0, elims:eliminations||0, beds:bedDestroyed||0 };
  [{ period:wk, type:"weekly" },{ period:mo, type:"monthly" }].forEach(({period,type})=>{
    db.prepare(`INSERT INTO progress (user_id,period,period_type,wins,eliminations,bed_destroyed) VALUES (?,?,?,?,?,?)
      ON CONFLICT(user_id,period) DO UPDATE SET wins=excluded.wins,eliminations=excluded.eliminations,bed_destroyed=excluded.bed_destroyed`)
      .run(req.user.id,period,type,snap.wins,snap.elims,snap.beds);
  });
  res.json({ ok: true });
});

app.put("/api/me/theme", authMiddleware, (req, res) => {
  const { theme } = req.body;
  if (!["fire","ice","void"].includes(theme)) return res.status(400).json({ error: "Invalid theme" });
  db.prepare("UPDATE users SET theme=? WHERE id=?").run(theme, req.user.id);
  res.json({ ok: true });
});

// ── Admin Routes ──────────────────────────────────────────────────────────────
app.get("/api/admin/players", adminMiddleware, (_, res) => {
  res.json(getFullPlayers());
});

app.put("/api/admin/players/:id/stats", adminMiddleware, (req, res) => {
  const { level,wins,eliminations,finalEliminations,assists,kd,diamonds,gold,bedDestroyed,vaultsOpened,upgrades,damageDealt,clutchEliminations } = req.body;
  db.prepare(`UPDATE stats SET level=?,wins=?,eliminations=?,final_eliminations=?,assists=?,kd=?,diamonds=?,gold=?,bed_destroyed=?,vaults_opened=?,upgrades=?,damage_dealt=?,clutch_eliminations=?,updated_at=datetime('now') WHERE user_id=?`)
    .run(level||0,wins||0,eliminations||0,finalEliminations||0,assists||0,kd||0,diamonds||0,gold||0,bedDestroyed||0,vaultsOpened||0,upgrades||0,damageDealt||0,clutchEliminations||0,req.params.id);
  res.json({ ok: true });
});

app.delete("/api/admin/players/:id", adminMiddleware, (req, res) => {
  db.prepare("DELETE FROM users WHERE id=? AND is_admin=0").run(req.params.id);
  res.json({ ok: true });
});

app.post("/api/admin/players", adminMiddleware, (req, res) => {
  const { username, password, avatar, theme } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });
  const exists = db.prepare("SELECT id FROM users WHERE username=?").get(username);
  if (exists) return res.status(409).json({ error: "Username already taken" });
  const hash = bcrypt.hashSync(password, 10);
  const uid = db.prepare("INSERT INTO users (username,password,avatar,theme) VALUES (?,?,?,?)")
    .run(username.trim(), hash, avatar||"🎮", theme||"fire").lastInsertRowid;
  db.prepare("INSERT INTO stats (user_id) VALUES (?)").run(uid);
  res.json({ ok: true, id: uid });
});

// ── Catch-all for React ───────────────────────────────────────────────────────
if (fs.existsSync(clientBuild)) {
  app.get("*", (_, res) => res.sendFile(path.join(clientBuild, "index.html")));
}

app.listen(PORT, () => console.log(`🛏️ BedWars server running on port ${PORT}`));
