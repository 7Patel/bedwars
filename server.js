const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "bedwars-dev-secret-change-me";
const DB_FILE = process.env.DB_PATH || path.join(__dirname, "db.json");

app.use(cors());
app.use(express.json());

// ── Pure JSON database ────────────────────────────────────────────────────────
function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return { users: [], stats: [], progress: [] }; }
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
function nextId(arr) {
  return arr.length === 0 ? 1 : Math.max(...arr.map(x => x.id)) + 1;
}

// ── Seed initial data ─────────────────────────────────────────────────────────
function seedIfEmpty() {
  const db = readDB();
  if (db.users.length > 0) return;

  // Admin
  const adminHash = bcrypt.hashSync("bedwars123", 10);
  db.users.push({ id: 1, username: "admin", password: adminHash, avatar: "👑", theme: "fire", isAdmin: true });
  db.stats.push({ userId: 1, level:0,wins:0,eliminations:0,finalEliminations:0,assists:0,kd:0,diamonds:0,gold:0,bedDestroyed:0,vaultsOpened:0,upgrades:0,damageDealt:0,clutchEliminations:0 });

  // Demo players
  const demos = [
    { id:2, u:"StormKing",   av:"⚡", th:"ice",  s:{level:55,wins:51,eliminations:489,finalEliminations:223,assists:134,kd:4.6,diamonds:11200,gold:42000,bedDestroyed:91,vaultsOpened:31,upgrades:198,damageDealt:224100,clutchEliminations:62}},
    { id:3, u:"ShadowBlade", av:"🗡️", th:"fire", s:{level:47,wins:38,eliminations:412,finalEliminations:189,assists:97, kd:3.8,diamonds:8420, gold:31200,bedDestroyed:74,vaultsOpened:22,upgrades:145,damageDealt:187400,clutchEliminations:43}},
    { id:4, u:"NightReaper", av:"💀", th:"void", s:{level:39,wins:29,eliminations:334,finalEliminations:141,assists:78, kd:2.9,diamonds:6130, gold:24800,bedDestroyed:58,vaultsOpened:18,upgrades:112,damageDealt:143200,clutchEliminations:31}},
    { id:5, u:"IronFang",    av:"🔱", th:"fire", s:{level:28,wins:17,eliminations:198,finalEliminations:89, assists:55, kd:1.9,diamonds:3800, gold:16400,bedDestroyed:38,vaultsOpened:11,upgrades:76, damageDealt:92300, clutchEliminations:18}},
  ];
  const hash = bcrypt.hashSync("demo123", 10);
  demos.forEach(({ id, u, av, th, s }) => {
    db.users.push({ id, username: u, password: hash, avatar: av, theme: th, isAdmin: false });
    db.stats.push({ userId: id, ...s });
    const pcts = [0.2, 0.4, 0.65, 0.85];
    pcts.forEach((p, i) => {
      db.progress.push({ id: db.progress.length + 1, userId: id, period: `2024-W0${i+1}`, periodType: "weekly",
        wins: Math.floor(s.wins*p), eliminations: Math.floor(s.eliminations*p), bedDestroyed: Math.floor(s.bedDestroyed*p) });
    });
    [0.45, 1].forEach((p, i) => {
      db.progress.push({ id: db.progress.length + 1, userId: id, period: `2024-M0${i+1}`, periodType: "monthly",
        wins: Math.floor(s.wins*p), eliminations: Math.floor(s.eliminations*p), bedDestroyed: Math.floor(s.bedDestroyed*p) });
    });
  });
  writeDB(db);
}
seedIfEmpty();

// ── Helpers ───────────────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const t = req.headers.authorization?.split(" ")[1];
  if (!t) return res.status(401).json({ error: "No token" });
  try { req.user = jwt.verify(t, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
};
const adminAuth = (req, res, next) => auth(req, res, () => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Admin only" });
  next();
});

function getPlayers() {
  const db = readDB();
  return db.users
    .filter(u => !u.isAdmin)
    .map(u => {
      const s = db.stats.find(x => x.userId === u.id) || {};
      return { id: u.id, username: u.username, avatar: u.avatar, theme: u.theme,
        level: s.level||0, wins: s.wins||0, eliminations: s.eliminations||0,
        final_eliminations: s.finalEliminations||0, assists: s.assists||0, kd: s.kd||0,
        diamonds: s.diamonds||0, gold: s.gold||0, bed_destroyed: s.bedDestroyed||0,
        vaults_opened: s.vaultsOpened||0, upgrades: s.upgrades||0,
        damage_dealt: s.damageDealt||0, clutch_eliminations: s.clutchEliminations||0 };
    })
    .sort((a, b) => b.wins - a.wins);
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post("/api/register", (req, res) => {
  const { username, password, avatar } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: "Username must be 2-20 chars" });
  const db = readDB();
  if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase()))
    return res.status(409).json({ error: "Username already taken" });
  const id = nextId(db.users);
  const hash = bcrypt.hashSync(password, 10);
  db.users.push({ id, username: username.trim(), password: hash, avatar: avatar||"🎮", theme: "fire", isAdmin: false });
  db.stats.push({ userId: id, level:0,wins:0,eliminations:0,finalEliminations:0,assists:0,kd:0,diamonds:0,gold:0,bedDestroyed:0,vaultsOpened:0,upgrades:0,damageDealt:0,clutchEliminations:0 });
  writeDB(db);
  const token = jwt.sign({ id, username, isAdmin: false }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id, username, avatar: avatar||"🎮", theme: "fire", isAdmin: false } });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.username.toLowerCase() === username?.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: "Wrong username or password" });
  const token = jwt.sign({ id: user.id, username: user.username, isAdmin: !!user.isAdmin }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: user.id, username: user.username, avatar: user.avatar, theme: user.theme, isAdmin: !!user.isAdmin } });
});

// ── Player routes ─────────────────────────────────────────────────────────────
app.get("/api/players", (_, res) => res.json(getPlayers()));

app.get("/api/players/:id/progress", (req, res) => {
  const db = readDB();
  res.json(db.progress.filter(p => p.userId === parseInt(req.params.id)).sort((a,b) => a.period.localeCompare(b.period)));
});

app.put("/api/me/stats", auth, (req, res) => {
  if (req.user.isAdmin) return res.status(403).json({ error: "Admins don't have stats" });
  const db = readDB();
  const idx = db.stats.findIndex(s => s.userId === req.user.id);
  const { level,wins,eliminations,finalEliminations,assists,kd,diamonds,gold,bedDestroyed,vaultsOpened,upgrades,damageDealt,clutchEliminations } = req.body;
  const newStats = { userId: req.user.id, level:level||0,wins:wins||0,eliminations:eliminations||0,finalEliminations:finalEliminations||0,assists:assists||0,kd:kd||0,diamonds:diamonds||0,gold:gold||0,bedDestroyed:bedDestroyed||0,vaultsOpened:vaultsOpened||0,upgrades:upgrades||0,damageDealt:damageDealt||0,clutchEliminations:clutchEliminations||0 };
  if (idx >= 0) db.stats[idx] = newStats; else db.stats.push(newStats);

  // Record progress snapshot
  const now = new Date();
  const wk = `${now.getFullYear()}-W${String(now.getMonth()+1).padStart(2,"0")}-${Math.ceil(now.getDate()/7)}`;
  const mo = `${now.getFullYear()}-M${String(now.getMonth()+1).padStart(2,"0")}`;
  [{ period:wk, periodType:"weekly" }, { period:mo, periodType:"monthly" }].forEach(({ period, periodType }) => {
    const ei = db.progress.findIndex(p => p.userId === req.user.id && p.period === period);
    const entry = { id: ei >= 0 ? db.progress[ei].id : nextId(db.progress), userId: req.user.id, period, periodType, wins:wins||0, eliminations:eliminations||0, bedDestroyed:bedDestroyed||0 };
    if (ei >= 0) db.progress[ei] = entry; else db.progress.push(entry);
  });
  writeDB(db);
  res.json({ ok: true });
});

app.put("/api/me/theme", auth, (req, res) => {
  const { theme } = req.body;
  if (!["fire","ice","void"].includes(theme)) return res.status(400).json({ error: "Invalid theme" });
  const db = readDB();
  const u = db.users.find(x => x.id === req.user.id);
  if (u) u.theme = theme;
  writeDB(db);
  res.json({ ok: true });
});

// ── Admin routes ──────────────────────────────────────────────────────────────
app.get("/api/admin/players", adminAuth, (_, res) => res.json(getPlayers()));

app.put("/api/admin/players/:id/stats", adminAuth, (req, res) => {
  const pid = parseInt(req.params.id);
  const db = readDB();
  const idx = db.stats.findIndex(s => s.userId === pid);
  const { level,wins,eliminations,finalEliminations,assists,kd,diamonds,gold,bedDestroyed,vaultsOpened,upgrades,damageDealt,clutchEliminations } = req.body;
  const newStats = { userId: pid, level:level||0,wins:wins||0,eliminations:eliminations||0,finalEliminations:finalEliminations||0,assists:assists||0,kd:kd||0,diamonds:diamonds||0,gold:gold||0,bedDestroyed:bedDestroyed||0,vaultsOpened:vaultsOpened||0,upgrades:upgrades||0,damageDealt:damageDealt||0,clutchEliminations:clutchEliminations||0 };
  if (idx >= 0) db.stats[idx] = newStats; else db.stats.push(newStats);
  writeDB(db);
  res.json({ ok: true });
});

app.delete("/api/admin/players/:id", adminAuth, (req, res) => {
  const pid = parseInt(req.params.id);
  const db = readDB();
  db.users = db.users.filter(u => !(u.id === pid && !u.isAdmin));
  db.stats = db.stats.filter(s => s.userId !== pid);
  db.progress = db.progress.filter(p => p.userId !== pid);
  writeDB(db);
  res.json({ ok: true });
});

app.post("/api/admin/players", adminAuth, (req, res) => {
  const { username, password, avatar, theme } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });
  const db = readDB();
  if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase()))
    return res.status(409).json({ error: "Username already taken" });
  const id = nextId(db.users);
  const hash = bcrypt.hashSync(password, 10);
  db.users.push({ id, username: username.trim(), password: hash, avatar: avatar||"🎮", theme: theme||"fire", isAdmin: false });
  db.stats.push({ userId: id, level:0,wins:0,eliminations:0,finalEliminations:0,assists:0,kd:0,diamonds:0,gold:0,bedDestroyed:0,vaultsOpened:0,upgrades:0,damageDealt:0,clutchEliminations:0 });
  writeDB(db);
  res.json({ ok: true, id });
});

app.put("/api/admin/players/:id/theme", adminAuth, (req, res) => {
  const { theme } = req.body;
  if (!["fire","ice","void"].includes(theme)) return res.status(400).json({ error: "Invalid theme" });
  const db = readDB();
  const u = db.users.find(x => x.id === parseInt(req.params.id));
  if (u) u.theme = theme;
  writeDB(db);
  res.json({ ok: true });
});

// ── Frontend (full React app inline) ─────────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
<meta name="theme-color" content="#07080f"/>
<title>BedWars War Room</title>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#07080f;color:#e8e8f0;font-family:'Rajdhani','Orbitron',sans-serif;min-height:100vh;}
::-webkit-scrollbar{width:4px;background:#0d0d1a;}
::-webkit-scrollbar-thumb{background:#ff3c3c44;border-radius:3px;}
</style>
</head>
<body>
<div id="root"><div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Orbitron,sans-serif;color:#ff3c3c;font-size:18px;letter-spacing:4px;">LOADING...</div></div>
<script type="text/babel" data-presets="react">
const {useState,useEffect,useCallback} = React;
const API = "";

const T = {
  en:{
    appTitle:"BED WARS",appSub:"WAR ROOM",
    nav:{cards:"🃏 Cards",board:"🏆 Board",progress:"📅 Progress",players:"👤 Players",login:"🔑 Login",logout:"Logout",myStats:"📝 My Stats"},
    home:{title:"SQUAD ROSTER",subtitle:"Tap a card to view full profile"},
    leaderboard:{crown:"👑 CROWN BOARD",rankings:"📊 RANKINGS"},
    progress:{title:"Progress Tracker",weekly:"Weekly",monthly:"Monthly",mostImproved:"⬆️ Most Improved",noData:"No data yet.",rivalry:"⚔️ Rivalry"},
    profile:{back:"← Back",allPlayers:"All Players",overview:"Stat Overview",achievements:"Achievements",winProg:"Win Progression",rank:"Rank",level:"Level",overallRating:"Overall Rating"},
    login:{title:"PLAYER LOGIN",username:"Username",password:"Password",loginBtn:"LOGIN",noAccount:"No account?",register:"Register",regTitle:"CREATE ACCOUNT",avatar:"Avatar (emoji)",createBtn:"CREATE ACCOUNT",hasAccount:"Have an account?",signIn:"Sign in",wrongPass:"Wrong username or password.",userExists:"Username already taken.",welcome:"Welcome back,",loggedAs:"Logged in as:"},
    myStats:{title:"Update My Stats",saveBtn:"SAVE STATS",saved:"✅ Saved!",subtitle:"Enter your latest cumulative stats"},
    theme:{label:"Theme",fire:"🔥 Inferno",ice:"❄️ Frostbite",void:"🌀 Void"},
    stats:{level:"Level",wins:"Wins",eliminations:"Eliminations",finalEliminations:"Final Elims",assists:"Assists",kd:"K/D",diamonds:"Diamonds",gold:"Gold",bedDestroyed:"Beds Destroyed",vaultsOpened:"Vaults Opened",upgrades:"Upgrades",damageDealt:"Damage Dealt",clutchEliminations:"Clutch Elims"},
  },
  jp:{
    appTitle:"ベッドウォーズ",appSub:"ウォールーム",
    nav:{cards:"🃏 カード",board:"🏆 ランキング",progress:"📅 進捗",players:"👤 プレイヤー",login:"🔑 ログイン",logout:"ログアウト",myStats:"📝 スタッツ"},
    home:{title:"チームロスター",subtitle:"カードをタップ"},
    leaderboard:{crown:"👑 クラウンボード",rankings:"📊 ランキング"},
    progress:{title:"進捗トラッカー",weekly:"週間",monthly:"月間",mostImproved:"⬆️ 最も成長",noData:"データなし",rivalry:"⚔️ ライバル"},
    profile:{back:"← 戻る",allPlayers:"全プレイヤー",overview:"スタッツ概要",achievements:"実績",winProg:"勝利推移",rank:"ランク",level:"レベル",overallRating:"総合レーティング"},
    login:{title:"ログイン",username:"ユーザー名",password:"パスワード",loginBtn:"ログイン",noAccount:"アカウントがない？",register:"登録",regTitle:"アカウント作成",avatar:"アバター",createBtn:"作成",hasAccount:"アカウントをお持ち？",signIn:"サインイン",wrongPass:"ユーザー名またはパスワードが違います。",userExists:"このユーザー名は使われています。",welcome:"おかえり、",loggedAs:"ログイン中:"},
    myStats:{title:"スタッツを更新",saveBtn:"保存",saved:"✅ 保存！",subtitle:"最新スタッツを入力"},
    theme:{label:"テーマ",fire:"🔥 インフェルノ",ice:"❄️ フロスト",void:"🌀 ボイド"},
    stats:{level:"レベル",wins:"勝利数",eliminations:"キル",finalEliminations:"フィナルキル",assists:"アシスト",kd:"K/D",diamonds:"ダイヤ",gold:"ゴールド",bedDestroyed:"ベッド破壊",vaultsOpened:"金庫開封",upgrades:"アップグレード",damageDealt:"ダメージ",clutchEliminations:"クラッチキル"},
  }
};

const THEMES = {
  fire:{name:"fire",bg:"linear-gradient(145deg,#1a0500,#2d0800,#1a0500)",border:"#ff6b1a",glow:"#ff4400",accent:"#ff6b1a"},
  ice: {name:"ice", bg:"linear-gradient(145deg,#00101a,#001825,#00101a)",border:"#4dd9ff",glow:"#00c8ff",accent:"#4dd9ff"},
  void:{name:"void",bg:"linear-gradient(145deg,#0a0014,#100020,#0a0014)",border:"#b44dff",glow:"#9900ff",accent:"#b44dff"},
};

const STAT_KEYS=["level","wins","eliminations","finalEliminations","assists","kd","diamonds","gold","bedDestroyed","vaultsOpened","upgrades","damageDealt","clutchEliminations"];
const ICONS={level:"⭐",wins:"🏆",eliminations:"⚔️",finalEliminations:"💥",assists:"🤝",kd:"📊",diamonds:"💎",gold:"🪙",bedDestroyed:"🛏️",vaultsOpened:"🔓",upgrades:"⬆️",damageDealt:"💢",clutchEliminations:"🔥"};

function fmt(key,val){
  const v=parseFloat(val)||0;
  if(key==="kd")return v.toFixed(1);
  if(["diamonds","gold","damageDealt"].includes(key))return Math.round(v).toLocaleString();
  return Math.round(v);
}
function norm(p){
  return {...p,stats:{level:p.level||0,wins:p.wins||0,eliminations:p.eliminations||0,finalEliminations:p.final_eliminations||0,assists:p.assists||0,kd:p.kd||0,diamonds:p.diamonds||0,gold:p.gold||0,bedDestroyed:p.bed_destroyed||0,vaultsOpened:p.vaults_opened||0,upgrades:p.upgrades||0,damageDealt:p.damage_dealt||0,clutchEliminations:p.clutch_eliminations||0}};
}
function score(p){const s=p.stats||{};return Math.round((s.wins||0)*4+(s.kd||0)*10+(s.bedDestroyed||0)*2+(s.clutchEliminations||0)*3+(s.finalEliminations||0)*2);}
function rank(players,p){return [...players].sort((a,b)=>score(b)-score(a)).findIndex(x=>x.id===p.id)+1;}
function badges(p){
  const s=p.stats||{},b=[];
  if((s.kd||0)>=4)b.push({icon:"🎯",label:"Sharpshooter"});
  if((s.bedDestroyed||0)>=80)b.push({icon:"🛏️",label:"Bed Destroyer"});
  if((s.diamonds||0)>=10000)b.push({icon:"💎",label:"Diamond Hoarder"});
  if((s.clutchEliminations||0)>=50)b.push({icon:"🔥",label:"Clutch King"});
  if((s.wins||0)>=40)b.push({icon:"👑",label:"Victory Royale"});
  if((s.assists||0)>=100)b.push({icon:"🤝",label:"Team Player"});
  if((s.finalEliminations||0)>=200)b.push({icon:"💥",label:"Finisher"});
  return b;
}

function Sparkline({data,color}){
  if(!data||data.length<2)return null;
  const max=Math.max(...data),min=Math.min(...data),range=max-min||1,w=56,h=20;
  const pts=data.map((v,i)=>((i/(data.length-1))*w)+","+(h-((v-min)/range)*h)).join(" ");
  return React.createElement("svg",{width:w,height:h,style:{overflow:"visible",flexShrink:0}},
    React.createElement("polyline",{points:pts,fill:"none",stroke:color,strokeWidth:"2",strokeLinejoin:"round"}),
    ...data.map((v,i)=>{const x=(i/(data.length-1))*w,y=h-((v-min)/range)*h;return React.createElement("circle",{key:i,cx:x,cy:y,r:"2.5",fill:color});})
  );
}

function StatArc({value,max,color,label,icon}){
  const pct=Math.min((value||0)/max,1),r=24,cx=30,cy=30,sw=5,circ=2*Math.PI*r,dash=pct*circ;
  return React.createElement("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:2}},
    React.createElement("svg",{width:60,height:60},
      React.createElement("circle",{cx,cy,r,fill:"none",stroke:"#1a1a2e",strokeWidth:sw}),
      React.createElement("circle",{cx,cy,r,fill:"none",stroke:color,strokeWidth:sw,strokeDasharray:dash+" "+(circ-dash),strokeLinecap:"round",transform:"rotate(-90 "+cx+" "+cy+")"}),
      React.createElement("text",{x:cx,y:cy+1,textAnchor:"middle",dominantBaseline:"middle",fill:color,fontSize:"9",fontWeight:"bold"},icon)
    ),
    React.createElement("span",{style:{fontSize:8,color:"#888",textTransform:"uppercase",letterSpacing:1,textAlign:"center"}},label)
  );
}

const CSS = \`
  .nb{background:none;border:none;cursor:pointer;font-family:inherit;}
  .ch{transition:transform 0.25s;cursor:pointer;}
  .ch:hover{transform:translateY(-5px);}
  @keyframes fi{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .fi{animation:fi 0.3s ease forwards;}
  @keyframes sh{0%{background-position:-200% 0}100%{background-position:200% 0}}
  .sh{background:linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent);background-size:200%;animation:sh 2.5s infinite;}
  input,select{background:#111;border:1px solid #ffffff18;color:#e8e8f0;padding:9px 12px;border-radius:8px;font-family:inherit;font-size:14px;outline:none;width:100%;}
  input:focus,select:focus{border-color:#ff3c3c88;}
  .btn{background:linear-gradient(135deg,#ff3c3c,#c0392b);border:none;color:#fff;padding:11px 22px;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:700;font-size:13px;letter-spacing:1px;transition:all 0.2s;width:100%;}
  .btn:hover{box-shadow:0 4px 18px #ff3c3c44;transform:translateY(-1px);}
  .btsm{padding:6px 13px!important;font-size:11px!important;width:auto!important;}
  .btdng{background:linear-gradient(135deg,#c0392b,#7b0000)!important;}
  .btgh{background:transparent;border:1px solid #333;color:#888;padding:7px 14px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:11px;width:auto;}
  .sr{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #ffffff07;}
  .rh{transition:background 0.15s;} .rh:hover{background:#ffffff05;}
  @keyframes na{0%{opacity:0;transform:translateX(20px)}10%{opacity:1;transform:translateX(0)}85%{opacity:1}100%{opacity:0}}
  .na{animation:na 2.8s ease forwards;}
  @media(max-width:768px){
    .gc{grid-template-columns:repeat(2,1fr)!important;gap:12px!important;}
    .gp{grid-template-columns:1fr!important;}
    .g2{grid-template-columns:1fr!important;}
    .dn{display:none!important;}
    .dm{display:flex!important;}
    .cg{grid-template-columns:repeat(3,1fr)!important;}
    .sg{grid-template-columns:1fr!important;}
  }
  @media(max-width:480px){.gc{grid-template-columns:1fr!important;}.cg{grid-template-columns:repeat(2,1fr)!important;}}
  .dm{display:none;}
\`;

function App(){
  const [lang,setLang]=useState("en");
  const t=T[lang];
  const [players,setPlayers]=useState([]);
  const [progMap,setProgMap]=useState({});
  const [loading,setLoading]=useState(true);
  const [currentUser,setCurrentUser]=useState(()=>{try{return JSON.parse(localStorage.getItem("bw_user"));}catch{return null;}});
  const [token,setToken]=useState(()=>localStorage.getItem("bw_token")||null);
  const [page,setPage]=useState("home");
  const [selPlayer,setSelPlayer]=useState(null);
  const [lStat,setLStat]=useState("wins");
  const [progMode,setProgMode]=useState("weekly");
  const [rivalry,setRivalry]=useState({a:0,b:1});
  const [notif,setNotif]=useState("");
  const [menuOpen,setMenuOpen]=useState(false);
  const [authMode,setAuthMode]=useState("login");
  const [lf,setLf]=useState({username:"",password:""});
  const [rf,setRf]=useState({username:"",password:"",avatar:"🎮"});
  const [authErr,setAuthErr]=useState("");
  const [msf,setMsf]=useState({});
  const [saved,setSaved]=useState(false);
  const [adminOpen,setAdminOpen]=useState(false);
  const [editId,setEditId]=useState(null);
  const [editF,setEditF]=useState({});
  const [npf,setNpf]=useState({username:"",password:"",avatar:"🎮",theme:"fire"});
  const [adminErr,setAdminErr]=useState("");

  async function api(path,opts={}){
    const headers={"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})};
    const res=await fetch(API+path,{...opts,headers});
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||"Error");
    return data;
  }

  const load=useCallback(async()=>{
    try{
      const data=await api("/api/players");
      const np=data.map(norm);
      setPlayers(np);
      const map={};
      await Promise.all(np.map(async p=>{
        try{map[p.id]=await api("/api/players/"+p.id+"/progress");}catch{}
      }));
      setProgMap(map);
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[token]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{
    if(currentUser&&!currentUser.isAdmin){
      const p=players.find(x=>x.id===currentUser.id);
      if(p)setMsf({...p.stats});
    }
  },[currentUser,players]);

  function notify(m){setNotif(m);setTimeout(()=>setNotif(""),2800);}

  async function doLogin(){
    setAuthErr("");
    try{
      const {token:tk,user}=await api("/api/login",{method:"POST",body:JSON.stringify(lf)});
      localStorage.setItem("bw_token",tk);localStorage.setItem("bw_user",JSON.stringify(user));
      setToken(tk);setCurrentUser(user);setPage("home");setMenuOpen(false);
      notify(t.login.welcome+" "+user.username+"!");
    }catch(e){setAuthErr(e.message||t.login.wrongPass);}
  }
  async function doReg(){
    setAuthErr("");
    if(!rf.username||!rf.password)return;
    try{
      const {token:tk,user}=await api("/api/register",{method:"POST",body:JSON.stringify(rf)});
      localStorage.setItem("bw_token",tk);localStorage.setItem("bw_user",JSON.stringify(user));
      setToken(tk);setCurrentUser(user);setPage("home");setMenuOpen(false);
      notify(t.login.welcome+" "+user.username+"!");load();
    }catch(e){setAuthErr(e.message||t.login.userExists);}
  }
  function doLogout(){localStorage.removeItem("bw_token");localStorage.removeItem("bw_user");setToken(null);setCurrentUser(null);setPage("home");}

  async function saveStats(){
    const body={};STAT_KEYS.forEach(k=>{body[k]=parseFloat(msf[k])||0;});
    try{await api("/api/me/stats",{method:"PUT",body:JSON.stringify(body)});setSaved(true);setTimeout(()=>setSaved(false),2500);notify(t.myStats.saved);load();}
    catch(e){notify("❌ "+e.message);}
  }
  async function changeTheme(pid,th){
    if(!currentUser)return;
    try{
      if(currentUser.id===pid)await api("/api/me/theme",{method:"PUT",body:JSON.stringify({theme:th})});
      else if(currentUser.isAdmin)await api("/api/admin/players/"+pid+"/theme",{method:"PUT",body:JSON.stringify({theme:th})});
      setPlayers(prev=>prev.map(p=>p.id===pid?{...p,theme:th}:p));
    }catch{}
  }

  async function saveEdit(){
    try{await api("/api/admin/players/"+editId+"/stats",{method:"PUT",body:JSON.stringify(editF)});setEditId(null);notify("✅ Updated!");load();}
    catch(e){notify("❌ "+e.message);}
  }
  async function delPlayer(id){
    try{await api("/api/admin/players/"+id,{method:"DELETE"});notify("🗑️ Removed");load();}
    catch(e){notify("❌ "+e.message);}
  }
  async function addPlayer(){
    if(!npf.username||!npf.password){setAdminErr("Username and password required");return;}
    try{await api("/api/admin/players",{method:"POST",body:JSON.stringify(npf)});setNpf({username:"",password:"",avatar:"🎮",theme:"fire"});setAdminErr("");notify("✅ Added!");load();}
    catch(e){setAdminErr(e.message);}
  }

  const sorted=[...players].sort((a,b)=>((b.stats||{})[lStat]||0)-((a.stats||{})[lStat]||0));
  const pA=players[rivalry.a]||players[0];
  const pB=players[rivalry.b]||players[1];
  const isW=progMode==="weekly";
  function getProg(pid){return(progMap[pid]||[]).filter(x=>isW?/W/.test(x.period):/M/.test(x.period)).sort((a,b)=>a.period.localeCompare(b.period));}

  if(loading)return React.createElement("div",{style:{minHeight:"100vh",background:"#07080f",display:"flex",alignItems:"center",justifyContent:"center"}},
    React.createElement("div",{style:{fontFamily:"Orbitron",color:"#ff3c3c",fontSize:18,letterSpacing:4}},"LOADING...")
  );

  const NavBtn=({pg,label,color,bg})=>React.createElement("button",{className:"nb",onClick:()=>{setPage(pg);setMenuOpen(false);},style:{padding:"7px 12px",borderRadius:6,fontSize:11,fontWeight:700,letterSpacing:1,color:page===pg?"#fff":(color||"#555"),background:page===pg?(bg||"linear-gradient(135deg,#ff3c3c,#8b0000)"):"transparent",border:page===pg?"none":"1px solid transparent",transition:"all 0.2s",whiteSpace:"nowrap"}},label);

  return React.createElement(React.Fragment,null,
    React.createElement("style",null,CSS),
    // Notification
    notif&&React.createElement("div",{className:"na",style:{position:"fixed",top:16,right:16,zIndex:9999,background:"#1a1a2e",border:"1px solid #ff3c3c55",borderRadius:10,padding:"11px 18px",fontSize:13,color:"#fff",boxShadow:"0 4px 20px #00000099",pointerEvents:"none",maxWidth:"calc(100vw - 32px)"}},notif),

    // HEADER
    React.createElement("header",{style:{background:"linear-gradient(180deg,#0d0010,#07080f)",borderBottom:"1px solid #ff3c3c1a",padding:"0 16px",position:"sticky",top:0,zIndex:200}},
      React.createElement("div",{style:{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",height:56,gap:10}},
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flexShrink:0},onClick:()=>{setPage("home");setMenuOpen(false);}},
          React.createElement("span",{style:{fontSize:22,filter:"drop-shadow(0 0 6px #ff3c3c)"}},"🛏️"),
          React.createElement("div",null,
            React.createElement("div",{style:{fontFamily:"Orbitron",fontSize:13,fontWeight:900,letterSpacing:2,color:"#fff",lineHeight:1}},t.appTitle),
            React.createElement("div",{style:{fontSize:7,color:"#ff3c3c",letterSpacing:3}},t.appSub)
          )
        ),
        React.createElement("nav",{className:"dn",style:{display:"flex",gap:2,flex:1,justifyContent:"center"}},
          React.createElement(NavBtn,{pg:"home",label:t.nav.cards}),
          React.createElement(NavBtn,{pg:"leaderboard",label:t.nav.board}),
          React.createElement(NavBtn,{pg:"progress",label:t.nav.progress}),
          React.createElement(NavBtn,{pg:"profile",label:t.nav.players}),
          currentUser&&!currentUser.isAdmin&&React.createElement(NavBtn,{pg:"mystats",label:t.nav.myStats,color:"#4ade80",bg:"#4ade8022"}),
          currentUser?.isAdmin&&React.createElement("button",{className:"nb",onClick:()=>setAdminOpen(true),style:{padding:"7px 12px",borderRadius:6,fontSize:11,fontWeight:700,color:"#ffd700",border:"1px solid #ffd70022",background:"#ffd70011"}},"\u2699\uFE0F ADMIN")
        ),
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginLeft:"auto",flexShrink:0}},
          React.createElement("div",{style:{display:"flex",background:"#0d0d1a",borderRadius:16,border:"1px solid #ffffff0f",overflow:"hidden"}},
            ["en","jp"].map(l=>React.createElement("button",{key:l,className:"nb",onClick:()=>setLang(l),style:{padding:"4px 10px",fontSize:10,fontWeight:700,background:lang===l?"#ff3c3c":"transparent",color:lang===l?"#fff":"#555"}},l.toUpperCase()))
          ),
          currentUser?React.createElement("button",{className:"nb",onClick:doLogout,style:{fontSize:11,color:"#ff6666",border:"1px solid #ff666622",borderRadius:6,padding:"5px 10px",background:"transparent"}},t.nav.logout)
            :React.createElement("button",{className:"nb",onClick:()=>{setPage("login");setMenuOpen(false);},style:{padding:"6px 12px",borderRadius:6,fontSize:11,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#ff3c3c,#8b0000)",border:"none"}},t.nav.login),
          React.createElement("button",{className:"nb dm",onClick:()=>setMenuOpen(m=>!m),style:{flexDirection:"column",gap:4,padding:6}},
            [0,1,2].map(i=>React.createElement("span",{key:i,style:{display:"block",width:20,height:2,background:menuOpen?"#ff3c3c":"#888",borderRadius:2,transform:menuOpen&&i===0?"rotate(45deg) translate(4px,4px)":menuOpen&&i===2?"rotate(-45deg) translate(4px,-4px)":menuOpen&&i===1?"scaleX(0)":"none",transition:"all 0.2s"}}))
          )
        )
      ),
      menuOpen&&React.createElement("div",{style:{background:"#0d0d1a",borderTop:"1px solid #ffffff08",padding:"10px 14px",display:"flex",flexDirection:"column",gap:4}},
        [["home",t.nav.cards],["leaderboard",t.nav.board],["progress",t.nav.progress],["profile",t.nav.players]].map(([pg,lb])=>
          React.createElement("button",{key:pg,className:"nb",onClick:()=>{setPage(pg);setMenuOpen(false);},style:{padding:"10px 14px",borderRadius:8,fontSize:13,fontWeight:700,color:page===pg?"#fff":"#888",background:page===pg?"linear-gradient(135deg,#ff3c3c,#8b0000)":"transparent",textAlign:"left"}},lb)
        ),
        currentUser&&!currentUser.isAdmin&&React.createElement("button",{className:"nb",onClick:()=>{setPage("mystats");setMenuOpen(false);},style:{padding:"10px 14px",borderRadius:8,fontSize:13,color:"#4ade80",background:"#4ade8011",textAlign:"left"}},t.nav.myStats),
        currentUser?.isAdmin&&React.createElement("button",{className:"nb",onClick:()=>{setAdminOpen(true);setMenuOpen(false);},style:{padding:"10px 14px",borderRadius:8,fontSize:13,color:"#ffd700",background:"#ffd70011",textAlign:"left"}},"\u2699\uFE0F ADMIN"),
        currentUser&&React.createElement("div",{style:{fontSize:11,color:"#555",padding:"6px 14px"}},t.login.loggedAs+" ",React.createElement("span",{style:{color:"#aaa"}},currentUser.username))
      )
    ),

    // MAIN
    React.createElement("main",{style:{maxWidth:1200,margin:"0 auto",padding:"24px 16px"}},

      // HOME
      page==="home"&&React.createElement("div",{className:"fi"},
        React.createElement("div",{style:{textAlign:"center",marginBottom:28}},
          React.createElement("h1",{style:{fontFamily:"Orbitron",fontSize:"clamp(18px,5vw,28px)",fontWeight:900,letterSpacing:4,background:"linear-gradient(90deg,#ff3c3c,#ff8888,#ff3c3c)",backgroundClip:"text",WebkitBackgroundClip:"text",color:"transparent",marginBottom:6}},t.home.title),
          React.createElement("p",{style:{color:"#444",fontSize:12,letterSpacing:2}},t.home.subtitle)
        ),
        React.createElement("div",{className:"gc",style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16}},
          [...players].sort((a,b)=>score(b)-score(a)).map(player=>{
            const th=THEMES[player.theme]||THEMES.fire;
            const r=rank(players,player),bs=badges(player),sc=score(player);
            const isMe=currentUser&&currentUser.id===player.id;
            const canTheme=currentUser&&(currentUser.id===player.id||currentUser.isAdmin);
            return React.createElement("div",{key:player.id,className:"ch",style:{background:th.bg,border:"1.5px solid "+th.border+"44",borderRadius:14,padding:"18px 14px",position:"relative",overflow:"hidden",boxShadow:"0 0 24px "+th.glow+"1a"},onClick:()=>{setSelPlayer(player);setPage("profile");}},
              React.createElement("div",{className:"sh",style:{position:"absolute",inset:0,borderRadius:14,pointerEvents:"none"}}),
              isMe&&React.createElement("div",{style:{position:"absolute",top:7,left:8,background:"#4ade8033",border:"1px solid #4ade8055",borderRadius:10,padding:"1px 6px",fontSize:9,color:"#4ade80",letterSpacing:1}},"YOU"),
              r===1&&React.createElement("span",{style:{position:"absolute",top:7,right:10,fontSize:16}},"👑"),
              React.createElement("div",{style:{textAlign:"center",marginTop:10}},
                React.createElement("div",{style:{fontSize:40,filter:"drop-shadow(0 0 12px "+th.glow+")",marginBottom:6}},player.avatar),
                React.createElement("div",{style:{fontFamily:"Orbitron",fontSize:13,fontWeight:700,color:"#fff",letterSpacing:1,marginBottom:2}},player.username),
                React.createElement("div",{style:{fontSize:10,color:"#666",marginBottom:10}},"LVL "+(player.stats.level||0)+" · #"+r),
                React.createElement("div",{style:{background:th.accent+"1a",border:"1px solid "+th.accent+"33",borderRadius:8,padding:"3px 10px",display:"inline-block",marginBottom:10}},
                  React.createElement("span",{style:{fontFamily:"Orbitron",fontSize:17,fontWeight:900,color:th.accent}},sc),
                  React.createElement("span",{style:{fontSize:8,color:"#555",marginLeft:3}},"OVR")
                ),
                React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}},
                  [["🏆",player.stats.wins,t.stats.wins],["⚔️",player.stats.eliminations,t.stats.eliminations],["🛏️",player.stats.bedDestroyed,t.stats.bedDestroyed],["📊",parseFloat(player.stats.kd||0).toFixed(1),"K/D"]].map(([ic,v,lb])=>
                    React.createElement("div",{key:lb,style:{background:"#ffffff07",borderRadius:6,padding:"4px 2px"}},
                      React.createElement("div",{style:{fontSize:12}},ic),
                      React.createElement("div",{style:{fontSize:13,fontWeight:700,color:"#fff"}},v),
                      React.createElement("div",{style:{fontSize:7,color:"#444",letterSpacing:1}},lb)
                    )
                  )
                ),
                bs.length>0&&React.createElement("div",{style:{marginTop:8,display:"flex",flexWrap:"wrap",gap:3,justifyContent:"center"}},
                  bs.slice(0,3).map(b=>React.createElement("span",{key:b.label,title:b.label,style:{fontSize:13}},b.icon)),
                  bs.length>3&&React.createElement("span",{style:{fontSize:9,color:"#555"}},"+"+( bs.length-3))
                ),
                canTheme&&React.createElement("div",{style:{marginTop:10,borderTop:"1px solid #ffffff08",paddingTop:8},onClick:e=>e.stopPropagation()},
                  React.createElement("div",{style:{fontSize:8,color:"#444",letterSpacing:2,marginBottom:5}},t.theme.label),
                  React.createElement("div",{style:{display:"flex",gap:6,justifyContent:"center"}},
                    Object.values(THEMES).map(th2=>React.createElement("button",{key:th2.name,onClick:()=>changeTheme(player.id,th2.name),title:t.theme[th2.name],style:{width:20,height:20,borderRadius:"50%",border:"2px solid "+(player.theme===th2.name?th2.accent:"#333"),background:th2.glow,cursor:"pointer",transform:player.theme===th2.name?"scale(1.25)":"scale(1)",transition:"all 0.2s"}}))
                  )
                )
              )
            );
          })
        )
      ),

      // LOGIN
      page==="login"&&React.createElement("div",{className:"fi",style:{display:"flex",justifyContent:"center",paddingTop:32}},
        React.createElement("div",{style:{background:"#0d0d1a",border:"1px solid #ff3c3c22",borderRadius:16,padding:"28px 24px",width:"100%",maxWidth:380}},
          React.createElement("h2",{style:{fontFamily:"Orbitron",fontSize:18,fontWeight:900,letterSpacing:3,marginBottom:22,color:"#fff",textAlign:"center"}},authMode==="login"?t.login.title:t.login.regTitle),
          authMode==="login"?React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:14}},
            React.createElement("div",null,React.createElement("div",{style:{fontSize:11,color:"#555",marginBottom:5,letterSpacing:1}},t.login.username),React.createElement("input",{value:lf.username,onChange:e=>setLf(f=>({...f,username:e.target.value})),onKeyDown:e=>e.key==="Enter"&&doLogin(),placeholder:"StormKing"})),
            React.createElement("div",null,React.createElement("div",{style:{fontSize:11,color:"#555",marginBottom:5,letterSpacing:1}},t.login.password),React.createElement("input",{type:"password",value:lf.password,onChange:e=>setLf(f=>({...f,password:e.target.value})),onKeyDown:e=>e.key==="Enter"&&doLogin(),placeholder:"••••••"})),
            authErr&&React.createElement("p",{style:{color:"#ff6666",fontSize:12,margin:0}},authErr),
            React.createElement("button",{className:"btn",onClick:doLogin},t.login.loginBtn),
            React.createElement("p",{style:{textAlign:"center",fontSize:12,color:"#555",margin:0}},t.login.noAccount," ",React.createElement("span",{style:{color:"#ff8888",cursor:"pointer"},onClick:()=>{setAuthMode("register");setAuthErr("");}},t.login.register)),
            React.createElement("p",{style:{textAlign:"center",fontSize:10,color:"#333",borderTop:"1px solid #ffffff07",paddingTop:10,margin:0}},"Demo: StormKing / demo123 · Admin: admin / bedwars123")
          ):React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:14}},
            React.createElement("div",null,React.createElement("div",{style:{fontSize:11,color:"#555",marginBottom:5,letterSpacing:1}},t.login.username),React.createElement("input",{value:rf.username,onChange:e=>setRf(f=>({...f,username:e.target.value})),placeholder:"YourName"})),
            React.createElement("div",null,React.createElement("div",{style:{fontSize:11,color:"#555",marginBottom:5,letterSpacing:1}},t.login.avatar),React.createElement("input",{value:rf.avatar,onChange:e=>setRf(f=>({...f,avatar:e.target.value})),placeholder:"🎮",style:{textAlign:"center",fontSize:20}})),
            React.createElement("div",null,React.createElement("div",{style:{fontSize:11,color:"#555",marginBottom:5,letterSpacing:1}},t.login.password),React.createElement("input",{type:"password",value:rf.password,onChange:e=>setRf(f=>({...f,password:e.target.value})),placeholder:"••••••"})),
            authErr&&React.createElement("p",{style:{color:"#ff6666",fontSize:12,margin:0}},authErr),
            React.createElement("button",{className:"btn",onClick:doReg},t.login.createBtn),
            React.createElement("p",{style:{textAlign:"center",fontSize:12,color:"#555",margin:0}},t.login.hasAccount," ",React.createElement("span",{style:{color:"#ff8888",cursor:"pointer"},onClick:()=>{setAuthMode("login");setAuthErr("");}},t.login.signIn))
          )
        )
      ),

      // MY STATS
      page==="mystats"&&currentUser&&!currentUser.isAdmin&&React.createElement("div",{className:"fi"},
        React.createElement("h2",{style:{fontFamily:"Orbitron",fontSize:"clamp(15px,4vw,22px)",fontWeight:900,letterSpacing:3,marginBottom:6,color:"#fff"}},t.myStats.title),
        React.createElement("p",{style:{fontSize:13,color:"#555",marginBottom:22}},t.myStats.subtitle),
        React.createElement("div",{style:{background:"#0d0d1a",borderRadius:14,padding:"22px 18px",border:"1px solid #ffffff09",maxWidth:660}},
          React.createElement("div",{className:"g2",style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:13,marginBottom:20}},
            STAT_KEYS.map(k=>React.createElement("div",{key:k},
              React.createElement("div",{style:{fontSize:11,color:"#555",marginBottom:4,letterSpacing:1}},ICONS[k]+" "+(t.stats[k]||k)),
              React.createElement("input",{type:"number",value:msf[k]||"",onChange:e=>setMsf(f=>({...f,[k]:e.target.value})),placeholder:"0"})
            ))
          ),
          React.createElement("button",{className:"btn",onClick:saveStats,style:{padding:14,fontSize:14,letterSpacing:2}},saved?t.myStats.saved:t.myStats.saveBtn)
        )
      ),

      // LEADERBOARD
      page==="leaderboard"&&React.createElement("div",{className:"fi"},
        React.createElement("h2",{style:{fontFamily:"Orbitron",fontSize:"clamp(13px,3.5vw,20px)",fontWeight:900,letterSpacing:3,marginBottom:14,color:"#ffd700"}},t.leaderboard.crown),
        React.createElement("div",{className:"cg",style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8,marginBottom:28}},
          STAT_KEYS.map(key=>{
            const top=[...players].sort((a,b)=>((b.stats||{})[key]||0)-((a.stats||{})[key]||0))[0];
            if(!top)return null;
            const th=THEMES[top.theme]||THEMES.fire;
            return React.createElement("div",{key,style:{background:"#0d0d1a",border:"1px solid "+th.border+"22",borderRadius:10,padding:"9px 7px",textAlign:"center"}},
              React.createElement("div",{style:{fontSize:14,marginBottom:2}},ICONS[key]),
              React.createElement("div",{style:{fontSize:7,color:"#444",letterSpacing:2,marginBottom:4,textTransform:"uppercase"}},t.stats[key]),
              React.createElement("div",{style:{fontSize:15}},top.avatar),
              React.createElement("div",{style:{fontSize:10,fontWeight:700,color:th.accent,marginTop:2}},top.username),
              React.createElement("div",{style:{fontSize:11,color:"#fff",fontWeight:700}},fmt(key,top.stats[key]))
            );
          })
        ),
        React.createElement("h2",{style:{fontFamily:"Orbitron",fontSize:"clamp(13px,3.5vw,20px)",fontWeight:900,letterSpacing:3,marginBottom:12,color:"#fff"}},t.leaderboard.rankings),
        React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}},
          STAT_KEYS.map(k=>React.createElement("button",{key:k,className:"nb",onClick:()=>setLStat(k),style:{padding:"5px 10px",borderRadius:20,fontSize:10,fontWeight:700,letterSpacing:1,background:lStat===k?"linear-gradient(135deg,#ff3c3c,#8b0000)":"#0d0d1a",color:lStat===k?"#fff":"#555",border:lStat===k?"none":"1px solid #ffffff09",transition:"all 0.2s"}},ICONS[k]+" "+t.stats[k]))
        ),
        React.createElement("div",{style:{background:"#0d0d1a",borderRadius:12,overflow:"hidden",border:"1px solid #ffffff09"}},
          sorted.map((player,idx)=>{
            const th=THEMES[player.theme]||THEMES.fire;
            const prog=getProg(player.id);
            const sparkData=prog.length>=2?prog.map(p=>lStat==="wins"?p.wins:lStat==="eliminations"?p.eliminations:lStat==="bedDestroyed"?p.bed_destroyed:p.wins):null;
            return React.createElement("div",{key:player.id,className:"rh",onClick:()=>{setSelPlayer(player);setPage("profile");},style:{display:"flex",alignItems:"center",gap:12,padding:"12px 15px",borderBottom:"1px solid #ffffff06",cursor:"pointer",background:idx===0?"#ffd70007":"transparent",flexWrap:"wrap"}},
              React.createElement("div",{style:{fontFamily:"Orbitron",fontSize:15,fontWeight:900,color:idx===0?"#ffd700":idx===1?"#c0c0c0":idx===2?"#cd7f32":"#2a2a2a",width:24,textAlign:"center",flexShrink:0}},idx===0?"👑":idx===1?"🥈":idx===2?"🥉":"#"+(idx+1)),
              React.createElement("span",{style:{fontSize:22,flexShrink:0}},player.avatar),
              React.createElement("div",{style:{flex:1,minWidth:70}},
                React.createElement("div",{style:{fontWeight:700,fontSize:14,color:"#fff"}},player.username),
                React.createElement("div",{style:{fontSize:9,color:th.accent,letterSpacing:1}},"LVL "+player.stats.level)
              ),
              React.createElement("div",{style:{textAlign:"right",flexShrink:0}},
                React.createElement("div",{style:{fontFamily:"Orbitron",fontSize:18,fontWeight:900,color:th.accent}},fmt(lStat,(player.stats||{})[lStat])),
                React.createElement("div",{style:{fontSize:8,color:"#444",letterSpacing:1}},(t.stats[lStat]||lStat).toUpperCase())
              ),
              sparkData&&React.createElement(Sparkline,{data:sparkData,color:th.accent})
            );
          })
        )
      ),

      // PROGRESS
      page==="progress"&&React.createElement("div",{className:"fi"},
        React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:22}},
          React.createElement("h2",{style:{fontFamily:"Orbitron",fontSize:"clamp(13px,4vw,20px)",fontWeight:900,letterSpacing:3,color:"#fff",margin:0}},t.progress.title),
          React.createElement("div",{style:{display:"flex",background:"#0d0d1a",borderRadius:20,border:"1px solid #ffffff0d",overflow:"hidden"}},
            ["weekly","monthly"].map(m=>React.createElement("button",{key:m,className:"nb",onClick:()=>setProgMode(m),style:{padding:"7px 16px",fontSize:11,fontWeight:700,letterSpacing:1,background:progMode===m?"linear-gradient(135deg,#ff3c3c,#8b0000)":"transparent",color:progMode===m?"#fff":"#555"}},m==="weekly"?t.progress.weekly:t.progress.monthly))
          )
        ),
        React.createElement("div",{className:"g2",style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:14,marginBottom:28}},
          players.map(player=>{
            const th=THEMES[player.theme]||THEMES.fire;
            const entries=getProg(player.id);
            return React.createElement("div",{key:player.id,style:{background:"#0d0d1a",border:"1px solid "+th.border+"1a",borderRadius:12,padding:16}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:12}},
                React.createElement("span",{style:{fontSize:24}},player.avatar),
                React.createElement("div",{style:{flex:1}},
                  React.createElement("div",{style:{fontWeight:700,color:"#fff",fontSize:14}},player.username),
                  React.createElement("div",{style:{fontSize:10,color:th.accent}},progMode==="weekly"?t.progress.weekly:t.progress.monthly)
                ),
                React.createElement("div",{style:{textAlign:"right"}},
                  React.createElement("div",{style:{fontFamily:"Orbitron",fontSize:16,color:th.accent}},entries.reduce((s,e)=>s+(e.wins||0),0)),
                  React.createElement("div",{style:{fontSize:8,color:"#333"}},"WINS")
                )
              ),
              entries.length===0?React.createElement("div",{style:{fontSize:11,color:"#333",textAlign:"center",padding:"12px 0"}},t.progress.noData):
              React.createElement("div",{style:{display:"flex",gap:4,alignItems:"flex-end",height:48}},
                entries.map((e,i)=>{
                  const maxW=Math.max(...entries.map(x=>x.wins||0),1);
                  return React.createElement("div",{key:i,style:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}},
                    React.createElement("div",{style:{fontSize:7,color:th.accent}},e.wins),
                    React.createElement("div",{style:{width:"100%",height:((e.wins||0)/maxW)*36+"px",background:"linear-gradient(180deg,"+th.accent+","+th.accent+"44)",borderRadius:"2px 2px 0 0",transition:"height 0.8s"}}),
                    React.createElement("div",{style:{fontSize:7,color:"#333"}},isW?"W"+(i+1):e.period.replace(/.*-M/,"M"))
                  );
                })
              )
            );
          })
        ),

        // Most improved
        React.createElement("h3",{style:{fontFamily:"Orbitron",fontSize:12,letterSpacing:2,color:"#ff3c3c",marginBottom:12}},t.progress.mostImproved),
        (()=>{
          const cands=players.filter(p=>getProg(p.id).length>=2).map(p=>{
            const e=getProg(p.id),first=e[0].wins||0,last=e[e.length-1].wins||0;
            return {player:p,imp:last-first,pct:first>0?((last-first)/first*100).toFixed(0):0};
          }).sort((a,b)=>b.imp-a.imp);
          if(!cands.length)return React.createElement("p",{style:{color:"#333",fontSize:12,marginBottom:24}},t.progress.noData);
          const {player:imp,imp:impv,pct}=cands[0];
          const th=THEMES[imp.theme]||THEMES.fire;
          return React.createElement("div",{style:{background:"linear-gradient(135deg,#0d0d1a,"+th.glow+"0d)",border:"1px solid "+th.border+"33",borderRadius:12,padding:20,display:"flex",alignItems:"center",gap:16,marginBottom:24,flexWrap:"wrap"}},
            React.createElement("span",{style:{fontSize:40}},imp.avatar),
            React.createElement("div",null,
              React.createElement("div",{style:{fontFamily:"Orbitron",fontSize:"clamp(13px,4vw,18px)",color:"#fff",fontWeight:900}},imp.username),
              React.createElement("div",{style:{color:th.accent,fontSize:12,marginTop:3}},t.progress.mostImproved.replace("⬆️ ","")),
              React.createElement("div",{style:{fontSize:11,color:"#666",marginTop:2}},"+"+impv+" wins · +"+pct+"%")
            ),
            React.createElement("div",{style:{marginLeft:"auto",fontFamily:"Orbitron",fontSize:30,color:th.accent}},"⬆️")
          );
        })(),

        // Rivalry
        React.createElement("h3",{style:{fontFamily:"Orbitron",fontSize:12,letterSpacing:2,color:"#ff3c3c",marginBottom:12}},t.progress.rivalry),
        React.createElement("div",{style:{background:"#0d0d1a",borderRadius:12,padding:18,border:"1px solid #ff3c3c1a"}},
          React.createElement("div",{style:{display:"flex",gap:8,marginBottom:18,justifyContent:"center",flexWrap:"wrap"}},
            React.createElement("select",{value:rivalry.a,onChange:e=>setRivalry(r=>({...r,a:parseInt(e.target.value)}))},players.map((p,i)=>React.createElement("option",{key:p.id,value:i},p.username))),
            React.createElement("span",{style:{fontSize:16,alignSelf:"center"}},"⚔️"),
            React.createElement("select",{value:rivalry.b,onChange:e=>setRivalry(r=>({...r,b:parseInt(e.target.value)}))},players.map((p,i)=>React.createElement("option",{key:p.id,value:i},p.username)))
          ),
          pA&&pB&&React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center"}},
            React.createElement("div",{style:{textAlign:"center"}},React.createElement("div",{style:{fontSize:30}},pA.avatar),React.createElement("div",{style:{fontFamily:"Orbitron",fontWeight:700,color:"#fff",fontSize:13,marginTop:3}},pA.username)),
            React.createElement("div",{style:{textAlign:"center",color:"#ff3c3c",fontFamily:"Orbitron",fontSize:16}},"VS"),
            React.createElement("div",{style:{textAlign:"center"}},React.createElement("div",{style:{fontSize:30}},pB.avatar),React.createElement("div",{style:{fontFamily:"Orbitron",fontWeight:700,color:"#fff",fontSize:13,marginTop:3}},pB.username)),
            ...["wins","eliminations","bedDestroyed","kd","clutchEliminations","diamonds"].map(key=>{
              const va=(pA.stats||{})[key]||0,vb=(pB.stats||{})[key]||0,winA=va>vb,winB=vb>va;
              return React.createElement("div",{key,style:{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:6,alignItems:"center",padding:"5px 0",borderBottom:"1px solid #ffffff06"}},
                React.createElement("div",{style:{textAlign:"right",fontFamily:"Orbitron",fontSize:13,color:winA?"#4ade80":"#444"}},fmt(key,va)),
                React.createElement("div",{style:{textAlign:"center",fontSize:8,color:"#333",letterSpacing:1,width:80}},ICONS[key]+" "+t.stats[key]),
                React.createElement("div",{style:{textAlign:"left",fontFamily:"Orbitron",fontSize:13,color:winB?"#4ade80":"#444"}},fmt(key,vb))
              );
            })
          )
        )
      ),

      // PROFILES
      page==="profile"&&React.createElement("div",{className:"fi"},
        !selPlayer?React.createElement("div",null,
          React.createElement("h2",{style:{fontFamily:"Orbitron",fontSize:"clamp(15px,4vw,22px)",fontWeight:900,letterSpacing:3,marginBottom:18,color:"#fff"}},t.profile.allPlayers),
          React.createElement("div",{className:"gc",style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}},
            players.map(p=>{
              const th=THEMES[p.theme]||THEMES.fire;
              return React.createElement("div",{key:p.id,className:"ch",onClick:()=>setSelPlayer(p),style:{background:"#0d0d1a",border:"1px solid "+th.border+"22",borderRadius:12,padding:16,display:"flex",alignItems:"center",gap:12}},
                React.createElement("span",{style:{fontSize:28}},p.avatar),
                React.createElement("div",null,
                  React.createElement("div",{style:{fontWeight:700,color:"#fff"}},p.username),
                  React.createElement("div",{style:{fontSize:10,color:th.accent}},"LVL "+p.stats.level),
                  React.createElement("div",{style:{fontSize:11,color:"#555",marginTop:2}},t.profile.rank+" #"+rank(players,p))
                )
              );
            })
          )
        ):(()=>{
          const p=players.find(x=>x.id===selPlayer.id)||selPlayer;
          const th=THEMES[p.theme]||THEMES.fire,bs=badges(p),r=rank(players,p),sc=score(p);
          const we=(progMap[p.id]||[]).filter(x=>/W/.test(x.period)).sort((a,b)=>a.period.localeCompare(b.period));
          return React.createElement("div",null,
            React.createElement("button",{className:"btgh",onClick:()=>setSelPlayer(null),style:{marginBottom:18}},t.profile.back),
            React.createElement("div",{className:"gp",style:{display:"grid",gridTemplateColumns:"250px 1fr",gap:18}},
              React.createElement("div",null,
                React.createElement("div",{style:{background:th.bg,border:"2px solid "+th.border+"44",borderRadius:16,padding:22,textAlign:"center",position:"relative",boxShadow:"0 0 28px "+th.glow+"1a"}},
                  r===1&&React.createElement("span",{style:{position:"absolute",top:10,right:14,fontSize:20}},"👑"),
                  React.createElement("div",{style:{fontSize:52,filter:"drop-shadow(0 0 16px "+th.glow+")",marginBottom:8}},p.avatar),
                  React.createElement("div",{style:{fontFamily:"Orbitron",fontSize:17,fontWeight:900,color:"#fff"}},p.username),
                  React.createElement("div",{style:{color:th.accent,fontSize:11,letterSpacing:2,margin:"3px 0 10px"}},(p.theme||"fire").toUpperCase()+" THEME"),
                  React.createElement("div",{style:{background:th.accent+"1a",borderRadius:8,padding:"6px 14px",display:"inline-block",marginBottom:10}},
                    React.createElement("div",{style:{fontFamily:"Orbitron",fontSize:26,fontWeight:900,color:th.accent}},sc),
                    React.createElement("div",{style:{fontSize:7,color:"#555",letterSpacing:2}},t.profile.overallRating)
                  ),
                  React.createElement("div",{style:{fontSize:10,color:"#555"}},t.profile.rank+" #"+r+" · "+t.profile.level+" "+p.stats.level),
                  bs.length>0&&React.createElement("div",{style:{marginTop:14}},
                    React.createElement("div",{style:{fontSize:8,color:"#333",letterSpacing:2,marginBottom:7}},t.profile.achievements),
                    React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:4,justifyContent:"center"}},
                      bs.map(b=>React.createElement("div",{key:b.label,title:b.label,style:{background:"#ffffff08",borderRadius:20,padding:"3px 8px",fontSize:10,display:"flex",alignItems:"center",gap:3}},b.icon,React.createElement("span",{style:{fontSize:9,color:"#999"}},b.label)))
                    )
                  )
                ),
                we.length>0&&React.createElement("div",{style:{marginTop:12,background:"#0d0d1a",borderRadius:10,padding:14,border:"1px solid "+th.border+"1a"}},
                  React.createElement("div",{style:{fontSize:8,color:"#333",letterSpacing:2,marginBottom:8}},t.profile.winProg),
                  React.createElement("div",{style:{display:"flex",gap:4,alignItems:"flex-end",height:40}},
                    we.map((e,i)=>{const maxW=Math.max(...we.map(x=>x.wins||0),1);return React.createElement("div",{key:i,style:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}},
                      React.createElement("div",{style:{fontSize:7,color:th.accent}},e.wins),
                      React.createElement("div",{style:{width:"100%",height:((e.wins||0)/maxW)*28+"px",background:"linear-gradient(180deg,"+th.accent+","+th.accent+"33)",borderRadius:"2px 2px 0 0"}}),
                      React.createElement("div",{style:{fontSize:6,color:"#333"}},"W"+(i+1))
                    );})
                  )
                )
              ),
              React.createElement("div",{style:{background:"#0d0d1a",borderRadius:12,padding:18,border:"1px solid #ffffff08"}},
                React.createElement("div",{style:{fontSize:8,color:"#333",letterSpacing:2,marginBottom:14}},t.profile.overview),
                React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:10,justifyContent:"center",marginBottom:16}},
                  [{key:"wins",max:100},{key:"kd",max:10},{key:"bedDestroyed",max:150},{key:"clutchEliminations",max:100},{key:"diamonds",max:20000},{key:"damageDealt",max:400000}].map(({key,max})=>React.createElement(StatArc,{key,value:p.stats[key],max,color:th.accent,label:t.stats[key]||key,icon:ICONS[key]}))
                ),
                React.createElement("div",{className:"sg",style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 18px"}},
                  STAT_KEYS.map(k=>React.createElement("div",{key:k,className:"sr"},
                    React.createElement("span",{style:{fontSize:12,color:"#666"}},ICONS[k]+" "+(t.stats[k]||k)),
                    React.createElement("span",{style:{fontFamily:"Orbitron",fontSize:12,color:th.accent,fontWeight:700}},fmt(k,p.stats[k]))
                  ))
                )
              )
            )
          );
        })()
      )
    ),

    // ADMIN MODAL
    adminOpen&&currentUser?.isAdmin&&React.createElement("div",{style:{position:"fixed",inset:0,background:"#000000dd",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:20,overflowY:"auto"},onClick:e=>{if(e.target===e.currentTarget)setAdminOpen(false);}},
      React.createElement("div",{style:{background:"#0d0d1a",border:"1px solid #ffd70033",borderRadius:16,padding:24,width:"100%",maxWidth:540,marginTop:20}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:18}},
          React.createElement("div",{style:{fontFamily:"Orbitron",fontSize:14,color:"#ffd700",letterSpacing:2}},"⚙️ ADMIN PANEL"),
          React.createElement("button",{className:"nb",onClick:()=>setAdminOpen(false),style:{color:"#555",fontSize:18}},"✕")
        ),
        React.createElement("div",{style:{marginBottom:20}},
          React.createElement("div",{style:{fontSize:10,color:"#ffd700",letterSpacing:2,marginBottom:10}},"MANAGE PLAYERS"),
          players.map(p=>React.createElement("div",{key:p.id,style:{background:"#07080f",borderRadius:10,padding:12,marginBottom:8,border:"1px solid #ffffff07"}},
            React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8}},
                React.createElement("span",{style:{fontSize:18}},p.avatar),
                React.createElement("div",null,
                  React.createElement("div",{style:{fontWeight:700,color:"#fff",fontSize:13}},p.username),
                  React.createElement("div",{style:{fontSize:9,color:THEMES[p.theme]?.accent||"#888"}},(p.theme||"fire").toUpperCase())
                )
              ),
              React.createElement("div",{style:{display:"flex",gap:6}},
                editId===p.id?
                  React.createElement(React.Fragment,null,
                    React.createElement("button",{className:"btn btsm",onClick:saveEdit},"SAVE"),
                    React.createElement("button",{className:"btgh",onClick:()=>setEditId(null)},"CANCEL")
                  ):
                  React.createElement(React.Fragment,null,
                    React.createElement("button",{className:"btn btsm",onClick:()=>{setEditId(p.id);setEditF({...p.stats});}},"EDIT"),
                    React.createElement("button",{className:"btn btsm btdng",onClick:()=>delPlayer(p.id)},"DEL")
                  )
              )
            ),
            editId===p.id&&React.createElement("div",{className:"g2",style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}},
              STAT_KEYS.map(k=>React.createElement("div",{key:k},
                React.createElement("div",{style:{fontSize:8,color:"#444",marginBottom:3}},ICONS[k]+" "+(t.stats[k]||k)),
                React.createElement("input",{type:"number",value:editF[k]||0,onChange:e=>setEditF(f=>({...f,[k]:e.target.value})),style:{fontSize:12,padding:"6px 8px"}})
              ))
            )
          ))
        ),
        React.createElement("div",null,
          React.createElement("div",{style:{fontSize:10,color:"#ffd700",letterSpacing:2,marginBottom:10}},"ADD NEW PLAYER"),
          React.createElement("div",{className:"g2",style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}},
            [{k:"username",ph:"Username"},{k:"password",ph:"Password",type:"password"},{k:"avatar",ph:"🎮"},{k:"theme",isSelect:true}].map(f=>React.createElement("div",{key:f.k},
              React.createElement("div",{style:{fontSize:8,color:"#444",marginBottom:3,textTransform:"capitalize"}},f.k),
              f.isSelect?React.createElement("select",{value:npf.theme,onChange:e=>setNpf(x=>({...x,theme:e.target.value}))},
                React.createElement("option",{value:"fire"},"🔥 Inferno"),React.createElement("option",{value:"ice"},"❄️ Frostbite"),React.createElement("option",{value:"void"},"🌀 Void")
              ):React.createElement("input",{value:npf[f.k],onChange:e=>setNpf(x=>({...x,[f.k]:e.target.value})),placeholder:f.ph,type:f.type||"text",style:{fontSize:12,padding:"6px 8px"}})
            ))
          ),
          adminErr&&React.createElement("p",{style:{color:"#ff6666",fontSize:12,marginBottom:8}},adminErr),
          React.createElement("button",{className:"btn",onClick:addPlayer},"ADD PLAYER")
        )
      )
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
</script>
</body>
</html>`;

app.get("*", (_, res) => res.setHeader("Content-Type","text/html").send(HTML));

app.listen(PORT, () => console.log("🛏️ BedWars War Room on port " + PORT));
