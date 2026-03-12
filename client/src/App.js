import { useState, useEffect, useCallback } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API = process.env.REACT_APP_API_URL || "";

// ─── TRANSLATIONS ─────────────────────────────────────────────────────────────
const T = {
  en: {
    appTitle:"BED WARS", appSub:"WAR ROOM",
    nav:{ cards:"🃏 Cards", board:"🏆 Board", progress:"📅 Progress", players:"👤 Players", login:"🔑 Login", logout:"Logout", myStats:"📝 My Stats" },
    home:{ title:"SQUAD ROSTER", subtitle:"Tap a card to view full profile" },
    leaderboard:{ crown:"👑 CROWN BOARD", rankings:"📊 RANKINGS" },
    progress:{ title:"Progress Tracker", weekly:"Weekly", monthly:"Monthly", mostImproved:"⬆️ Most Improved", noData:"No data yet.", rivalry:"⚔️ Rivalry" },
    profile:{ back:"← Back", allPlayers:"All Players", overview:"Stat Overview", achievements:"Achievements", winProg:"Win Progression", rank:"Rank", level:"Level", overallRating:"Overall Rating" },
    login:{ title:"PLAYER LOGIN", username:"Username", password:"Password", loginBtn:"LOGIN", noAccount:"No account?", register:"Register", regTitle:"CREATE ACCOUNT", avatar:"Avatar (emoji)", createBtn:"CREATE ACCOUNT", hasAccount:"Have an account?", signIn:"Sign in", wrongPass:"Wrong username or password.", userExists:"Username already taken.", welcome:"Welcome back,", loggedAs:"Logged in as:" },
    myStats:{ title:"Update My Stats", saveBtn:"SAVE STATS", saved:"✅ Saved!", subtitle:"Enter your latest cumulative stats" },
    theme:{ label:"Theme", fire:"🔥 Inferno", ice:"❄️ Frostbite", void:"🌀 Void" },
    stats:{ level:"Level", wins:"Wins", eliminations:"Eliminations", finalEliminations:"Final Elims", assists:"Assists", kd:"K/D", diamonds:"Diamonds", gold:"Gold", bedDestroyed:"Beds Destroyed", vaultsOpened:"Vaults Opened", upgrades:"Upgrades", damageDealt:"Damage Dealt", clutchEliminations:"Clutch Elims" },
  },
  jp: {
    appTitle:"ベッドウォーズ", appSub:"ウォールーム",
    nav:{ cards:"🃏 カード", board:"🏆 ランキング", progress:"📅 進捗", players:"👤 プレイヤー", login:"🔑 ログイン", logout:"ログアウト", myStats:"📝 スタッツ更新" },
    home:{ title:"チームロスター", subtitle:"カードをタップしてプロフィールを見る" },
    leaderboard:{ crown:"👑 クラウンボード", rankings:"📊 ランキング" },
    progress:{ title:"進捗トラッカー", weekly:"週間", monthly:"月間", mostImproved:"⬆️ 最も成長", noData:"データなし", rivalry:"⚔️ ライバル" },
    profile:{ back:"← 戻る", allPlayers:"全プレイヤー", overview:"スタッツ概要", achievements:"実績", winProg:"勝利推移", rank:"ランク", level:"レベル", overallRating:"総合レーティング" },
    login:{ title:"プレイヤーログイン", username:"ユーザー名", password:"パスワード", loginBtn:"ログイン", noAccount:"アカウントがない？", register:"登録", regTitle:"アカウント作成", avatar:"アバター（絵文字）", createBtn:"アカウント作成", hasAccount:"アカウントをお持ち？", signIn:"サインイン", wrongPass:"ユーザー名またはパスワードが違います。", userExists:"このユーザー名は使われています。", welcome:"おかえり、", loggedAs:"ログイン中:" },
    myStats:{ title:"スタッツを更新", saveBtn:"保存", saved:"✅ 保存しました！", subtitle:"最新のスタッツを入力" },
    theme:{ label:"テーマ", fire:"🔥 インフェルノ", ice:"❄️ フロスト", void:"🌀 ボイド" },
    stats:{ level:"レベル", wins:"勝利数", eliminations:"キル", finalEliminations:"フィナルキル", assists:"アシスト", kd:"K/D", diamonds:"ダイヤ", gold:"ゴールド", bedDestroyed:"ベッド破壊", vaultsOpened:"金庫開封", upgrades:"アップグレード", damageDealt:"ダメージ", clutchEliminations:"クラッチキル" },
  }
};

// ─── THEMES ───────────────────────────────────────────────────────────────────
const THEMES = {
  fire:{ name:"fire", bg:"linear-gradient(145deg,#1a0500,#2d0800,#1a0500)", border:"#ff6b1a", glow:"#ff4400", accent:"#ff6b1a" },
  ice: { name:"ice",  bg:"linear-gradient(145deg,#00101a,#001825,#00101a)", border:"#4dd9ff", glow:"#00c8ff", accent:"#4dd9ff" },
  void:{ name:"void", bg:"linear-gradient(145deg,#0a0014,#100020,#0a0014)", border:"#b44dff", glow:"#9900ff", accent:"#b44dff" },
};

// ─── STAT META ────────────────────────────────────────────────────────────────
const STAT_KEYS = ["level","wins","eliminations","finalEliminations","assists","kd","diamonds","gold","bedDestroyed","vaultsOpened","upgrades","damageDealt","clutchEliminations"];
const STAT_ICONS = { level:"⭐",wins:"🏆",eliminations:"⚔️",finalEliminations:"💥",assists:"🤝",kd:"📊",diamonds:"💎",gold:"🪙",bedDestroyed:"🛏️",vaultsOpened:"🔓",upgrades:"⬆️",damageDealt:"💢",clutchEliminations:"🔥" };
// maps camelCase -> snake_case DB key
const DB_KEY = { level:"level",wins:"wins",eliminations:"eliminations",finalEliminations:"final_eliminations",assists:"assists",kd:"kd",diamonds:"diamonds",gold:"gold",bedDestroyed:"bed_destroyed",vaultsOpened:"vaults_opened",upgrades:"upgrades",damageDealt:"damage_dealt",clutchEliminations:"clutch_eliminations" };
function fmtStat(key,val) {
  const v = parseFloat(val)||0;
  if (key==="kd") return v.toFixed(1);
  if (["diamonds","gold","damageDealt"].includes(key)) return Math.round(v).toLocaleString();
  return Math.round(v);
}
function norm(player) {
  // normalise DB snake_case -> camelCase stats
  return {
    ...player,
    stats:{
      level: player.level||0, wins: player.wins||0, eliminations: player.eliminations||0,
      finalEliminations: player.final_eliminations||0, assists: player.assists||0,
      kd: player.kd||0, diamonds: player.diamonds||0, gold: player.gold||0,
      bedDestroyed: player.bed_destroyed||0, vaultsOpened: player.vaults_opened||0,
      upgrades: player.upgrades||0, damageDealt: player.damage_dealt||0,
      clutchEliminations: player.clutch_eliminations||0,
    }
  };
}
function getScore(p) {
  const s=p.stats||{};
  return Math.round((s.wins||0)*4+(s.kd||0)*10+(s.bedDestroyed||0)*2+(s.clutchEliminations||0)*3+(s.finalEliminations||0)*2);
}
function getRank(players,player) {
  return [...players].sort((a,b)=>getScore(b)-getScore(a)).findIndex(x=>x.id===player.id)+1;
}
function getBadges(p) {
  const s=p.stats||{}, b=[];
  if((s.kd||0)>=4)b.push({icon:"🎯",label:"Sharpshooter"});
  if((s.bedDestroyed||0)>=80)b.push({icon:"🛏️",label:"Bed Destroyer"});
  if((s.diamonds||0)>=10000)b.push({icon:"💎",label:"Diamond Hoarder"});
  if((s.clutchEliminations||0)>=50)b.push({icon:"🔥",label:"Clutch King"});
  if((s.wins||0)>=40)b.push({icon:"👑",label:"Victory Royale"});
  if((s.assists||0)>=100)b.push({icon:"🤝",label:"Team Player"});
  if((s.finalEliminations||0)>=200)b.push({icon:"💥",label:"Finisher"});
  return b;
}

// ─── MINI SPARKLINE ───────────────────────────────────────────────────────────
function Sparkline({ data, color }) {
  if (!data||data.length<2) return null;
  const max=Math.max(...data),min=Math.min(...data),range=max-min||1;
  const w=60,h=22;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-min)/range)*h}`).join(" ");
  return (
    <svg width={w} height={h} style={{overflow:"visible",flexShrink:0}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
      {data.map((v,i)=>{ const x=(i/(data.length-1))*w,y=h-((v-min)/range)*h; return <circle key={i} cx={x} cy={y} r="2.5" fill={color}/>; })}
    </svg>
  );
}

// ─── STAT ARC ─────────────────────────────────────────────────────────────────
function StatArc({ value, max, color, label, icon }) {
  const pct=Math.min((value||0)/max,1),r=26,cx=32,cy=32,sw=5;
  const circ=2*Math.PI*r,dash=pct*circ;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
      <svg width={64} height={64}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a2e" strokeWidth={sw}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} style={{transition:"stroke-dasharray 1s ease"}}/>
        <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="10" fontWeight="bold">{icon}</text>
      </svg>
      <span style={{fontSize:8,color:"#888",textTransform:"uppercase",letterSpacing:1,textAlign:"center"}}>{label}</span>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [lang, setLang] = useState("en");
  const t = T[lang];

  const [players, setPlayers] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [loading, setLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bw_user")); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem("bw_token") || null);

  const [page, setPage] = useState("home");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [leaderStat, setLeaderStat] = useState("wins");
  const [progressMode, setProgressMode] = useState("weekly");
  const [rivalry, setRivalry] = useState({ a:0, b:1 });
  const [notification, setNotification] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  // Auth forms
  const [authMode, setAuthMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ username:"", password:"" });
  const [regForm, setRegForm] = useState({ username:"", password:"", avatar:"🎮" });
  const [authError, setAuthError] = useState("");

  // My stats form
  const [myStatsForm, setMyStatsForm] = useState({});
  const [statsSaved, setStatsSaved] = useState(false);

  // Admin panel
  const [adminOpen, setAdminOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newPF, setNewPF] = useState({ username:"", password:"", avatar:"🎮", theme:"fire" });
  const [adminError, setAdminError] = useState("");

  // ── API helper ──────────────────────────────────────────────────────────────
  async function apiFetch(path, opts={}) {
    const headers = { "Content-Type":"application/json", ...(token ? { Authorization:`Bearer ${token}` } : {}) };
    const res = await fetch(`${API}${path}`, { ...opts, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error||"Request failed");
    return data;
  }

  // ── Load players ────────────────────────────────────────────────────────────
  const loadPlayers = useCallback(async () => {
    try {
      const data = await apiFetch("/api/players");
      const normed = data.map(norm);
      setPlayers(normed);
      // load progress for each
      const map = {};
      await Promise.all(normed.map(async p => {
        try {
          const prog = await apiFetch(`/api/players/${p.id}/progress`);
          map[p.id] = prog;
        } catch {}
      }));
      setProgressMap(map);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadPlayers(); }, [loadPlayers]);

  // Populate myStats when user logs in
  useEffect(() => {
    if (currentUser && !currentUser.isAdmin) {
      const p = players.find(x=>x.id===currentUser.id);
      if (p) setMyStatsForm({...p.stats});
    }
  }, [currentUser, players]);

  function notify(msg) { setNotification(msg); setTimeout(()=>setNotification(""),2800); }

  // ── AUTH ────────────────────────────────────────────────────────────────────
  async function handleLogin() {
    setAuthError("");
    try {
      const { token:tk, user } = await apiFetch("/api/login", { method:"POST", body:JSON.stringify(loginForm) });
      localStorage.setItem("bw_token", tk);
      localStorage.setItem("bw_user", JSON.stringify(user));
      setToken(tk); setCurrentUser(user);
      setPage("home"); setMenuOpen(false);
      notify(`${t.login.welcome} ${user.username}!`);
    } catch(e) { setAuthError(e.message||t.login.wrongPass); }
  }
  async function handleRegister() {
    setAuthError("");
    if (!regForm.username||!regForm.password) return;
    try {
      const { token:tk, user } = await apiFetch("/api/register", { method:"POST", body:JSON.stringify(regForm) });
      localStorage.setItem("bw_token", tk);
      localStorage.setItem("bw_user", JSON.stringify(user));
      setToken(tk); setCurrentUser(user);
      setPage("home"); setMenuOpen(false);
      notify(`${t.login.welcome} ${user.username}!`);
      loadPlayers();
    } catch(e) { setAuthError(e.message||t.login.userExists); }
  }
  function handleLogout() {
    localStorage.removeItem("bw_token"); localStorage.removeItem("bw_user");
    setToken(null); setCurrentUser(null); setPage("home");
  }

  // ── MY STATS ────────────────────────────────────────────────────────────────
  async function saveMyStats() {
    const body = {};
    STAT_KEYS.forEach(k=>{ body[k]=parseFloat(myStatsForm[k])||0; });
    try {
      await apiFetch("/api/me/stats", { method:"PUT", body:JSON.stringify(body) });
      setStatsSaved(true); setTimeout(()=>setStatsSaved(false),2500);
      notify(t.myStats.saved);
      loadPlayers();
    } catch(e) { notify("❌ "+e.message); }
  }

  // ── THEME ───────────────────────────────────────────────────────────────────
  async function changeTheme(playerId, themeName) {
    // Only the owner or admin can change theme
    if (!currentUser) return;
    if (!currentUser.isAdmin && currentUser.id !== playerId) return;
    try {
      if (currentUser.id === playerId) {
        await apiFetch("/api/me/theme", { method:"PUT", body:JSON.stringify({ theme:themeName }) });
      } else if (currentUser.isAdmin) {
        // admin changes theme via editing? Just update locally for now
      }
      setPlayers(prev=>prev.map(p=>p.id===playerId?{...p,theme:themeName}:p));
    } catch {}
  }

  // ── ADMIN ───────────────────────────────────────────────────────────────────
  function startEdit(p) { setEditingId(p.id); setEditForm({...p.stats}); }
  async function saveEdit() {
    try {
      await apiFetch(`/api/admin/players/${editingId}/stats`, { method:"PUT", body:JSON.stringify(editForm) });
      setEditingId(null); notify("✅ Stats updated!"); loadPlayers();
    } catch(e) { notify("❌ "+e.message); }
  }
  async function removePlayer(id) {
    try {
      await apiFetch(`/api/admin/players/${id}`, { method:"DELETE" });
      notify("🗑️ Player removed"); loadPlayers();
    } catch(e) { notify("❌ "+e.message); }
  }
  async function addNewPlayer() {
    if (!newPF.username||!newPF.password) { setAdminError("Username and password required"); return; }
    try {
      await apiFetch("/api/admin/players", { method:"POST", body:JSON.stringify(newPF) });
      setNewPF({ username:"",password:"",avatar:"🎮",theme:"fire" }); setAdminError("");
      notify("✅ Player added!"); loadPlayers();
    } catch(e) { setAdminError(e.message); }
  }

  // ── DERIVED ─────────────────────────────────────────────────────────────────
  const sortedByStat = [...players].sort((a,b)=>((b.stats||{})[leaderStat]||0)-((a.stats||{})[leaderStat]||0));
  const playerA = players[rivalry.a]||players[0];
  const playerB = players[rivalry.b]||players[1];
  const isWeekly = progressMode==="weekly";

  function getPlayerProgress(pid) {
    return (progressMap[pid]||[]).filter(x=>isWeekly?/W/.test(x.period):/M/.test(x.period)).sort((a,b)=>a.period.localeCompare(b.period));
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{minHeight:"100vh",background:"#07080f",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{fontFamily:"Orbitron,sans-serif",color:"#ff3c3c",fontSize:18,letterSpacing:4}}>LOADING...</div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#07080f",color:"#e8e8f0",fontFamily:"'Rajdhani','Orbitron',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;background:#0d0d1a;}
        ::-webkit-scrollbar-thumb{background:#ff3c3c44;border-radius:3px;}
        .nb{background:none;border:none;cursor:pointer;font-family:inherit;}
        .card-hover{transition:transform 0.25s,box-shadow 0.25s;cursor:pointer;}
        .card-hover:hover{transform:translateY(-5px);}
        @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .fi{animation:fadeIn 0.3s ease forwards;}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .shim{background:linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent);background-size:200%;animation:shimmer 2.5s infinite;}
        input,select{background:#111;border:1px solid #ffffff18;color:#e8e8f0;padding:9px 12px;border-radius:8px;font-family:inherit;font-size:14px;outline:none;width:100%;}
        input:focus,select:focus{border-color:#ff3c3c88;}
        .btn{background:linear-gradient(135deg,#ff3c3c,#c0392b);border:none;color:#fff;padding:11px 22px;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:700;font-size:13px;letter-spacing:1px;transition:all 0.2s;width:100%;}
        .btn:hover{box-shadow:0 4px 18px #ff3c3c44;transform:translateY(-1px);}
        .btn-sm{padding:7px 14px;font-size:11px;width:auto;}
        .btn-danger{background:linear-gradient(135deg,#c0392b,#7b0000);}
        .btn-ghost{background:transparent;border:1px solid #333;color:#888;padding:7px 14px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:11px;transition:all 0.2s;width:auto;}
        .btn-ghost:hover{border-color:#666;color:#ccc;}
        .srow{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #ffffff07;}
        .rhover{transition:background 0.15s;}
        .rhover:hover{background:#ffffff05;}
        @keyframes notif{0%{opacity:0;transform:translateX(20px)}10%{opacity:1;transform:translateX(0)}85%{opacity:1}100%{opacity:0}}
        .na{animation:notif 2.8s ease forwards;}
        /* MOBILE */
        @media(max-width:768px){
          .grid-cards{grid-template-columns:repeat(2,1fr)!important;gap:12px!important;}
          .grid-profile{grid-template-columns:1fr!important;}
          .grid-2{grid-template-columns:1fr!important;}
          .desktop-nav{display:none!important;}
          .mobile-menu{display:flex!important;}
          .crown-grid{grid-template-columns:repeat(3,1fr)!important;}
          .stat-grid{grid-template-columns:1fr!important;}
          .arcs-wrap{gap:10px!important;}
        }
        @media(max-width:480px){
          .grid-cards{grid-template-columns:1fr!important;}
          .crown-grid{grid-template-columns:repeat(2,1fr)!important;}
        }
        .mobile-menu{display:none;}
      `}</style>

      {notification && (
        <div className="na" style={{position:"fixed",top:16,right:16,zIndex:9999,background:"#1a1a2e",border:"1px solid #ff3c3c55",borderRadius:10,padding:"11px 18px",fontSize:13,color:"#fff",boxShadow:"0 4px 20px #00000099",pointerEvents:"none",maxWidth:"calc(100vw - 32px)"}}>
          {notification}
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{background:"linear-gradient(180deg,#0d0010,#07080f)",borderBottom:"1px solid #ff3c3c1a",padding:"0 16px",position:"sticky",top:0,zIndex:200}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",height:56,gap:12}}>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flexShrink:0}} onClick={()=>{setPage("home");setMenuOpen(false);}}>
            <span style={{fontSize:22,filter:"drop-shadow(0 0 6px #ff3c3c)"}}>🛏️</span>
            <div>
              <div style={{fontFamily:"Orbitron",fontSize:13,fontWeight:900,letterSpacing:2,color:"#fff",lineHeight:1}}>{t.appTitle}</div>
              <div style={{fontSize:7,color:"#ff3c3c",letterSpacing:3}}>{t.appSub}</div>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="desktop-nav" style={{display:"flex",gap:2,flex:1,justifyContent:"center"}}>
            {[["home","cards"],["leaderboard","board"],["progress","progress"],["profile","players"]].map(([pg,key])=>(
              <button key={pg} className="nb" onClick={()=>setPage(pg)} style={{padding:"7px 13px",borderRadius:6,fontSize:11,fontWeight:700,letterSpacing:1,color:page===pg?"#fff":"#555",background:page===pg?"linear-gradient(135deg,#ff3c3c,#8b0000)":"transparent",border:page===pg?"none":"1px solid transparent",transition:"all 0.2s"}}>
                {t.nav[key]}
              </button>
            ))}
            {currentUser&&!currentUser.isAdmin&&(
              <button className="nb" onClick={()=>setPage("mystats")} style={{padding:"7px 13px",borderRadius:6,fontSize:11,fontWeight:700,color:page==="mystats"?"#fff":"#4ade80",border:"1px solid #4ade8022",background:page==="mystats"?"#4ade8022":"transparent"}}>
                {t.nav.myStats}
              </button>
            )}
            {currentUser?.isAdmin&&(
              <button className="nb" onClick={()=>setAdminOpen(true)} style={{padding:"7px 13px",borderRadius:6,fontSize:11,fontWeight:700,color:"#ffd700",border:"1px solid #ffd70022",background:"#ffd70011"}}>⚙️ ADMIN</button>
            )}
          </nav>

          {/* Right controls */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto",flexShrink:0}}>
            {/* Lang */}
            <div style={{display:"flex",background:"#0d0d1a",borderRadius:16,border:"1px solid #ffffff0f",overflow:"hidden"}}>
              {["en","jp"].map(l=>(
                <button key={l} className="nb" onClick={()=>setLang(l)} style={{padding:"4px 10px",fontSize:10,fontWeight:700,background:lang===l?"#ff3c3c":"transparent",color:lang===l?"#fff":"#555",transition:"all 0.2s"}}>{l.toUpperCase()}</button>
              ))}
            </div>
            {/* Auth */}
            {currentUser ? (
              <button className="nb" onClick={handleLogout} style={{fontSize:11,color:"#ff6666",border:"1px solid #ff666622",borderRadius:6,padding:"5px 10px",background:"transparent",whiteSpace:"nowrap"}}>
                {t.nav.logout}
              </button>
            ) : (
              <button className="nb" onClick={()=>{setPage("login");setMenuOpen(false);}} style={{padding:"6px 12px",borderRadius:6,fontSize:11,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#ff3c3c,#8b0000)",border:"none",whiteSpace:"nowrap"}}>
                {t.nav.login}
              </button>
            )}
            {/* Hamburger */}
            <button className="nb mobile-menu" onClick={()=>setMenuOpen(m=>!m)} style={{flexDirection:"column",gap:4,padding:6}}>
              {[0,1,2].map(i=><span key={i} style={{display:"block",width:20,height:2,background:menuOpen?"#ff3c3c":"#888",borderRadius:2,transition:"all 0.2s",transform:menuOpen&&i===0?"rotate(45deg) translate(4px,4px)":menuOpen&&i===2?"rotate(-45deg) translate(4px,-4px)":menuOpen&&i===1?"scaleX(0)":"none"}}/>)}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div style={{background:"#0d0d1a",borderTop:"1px solid #ffffff08",padding:"12px 16px",display:"flex",flexDirection:"column",gap:4}}>
            {[["home","cards"],["leaderboard","board"],["progress","progress"],["profile","players"]].map(([pg,key])=>(
              <button key={pg} className="nb" onClick={()=>{setPage(pg);setMenuOpen(false);}} style={{padding:"10px 14px",borderRadius:8,fontSize:13,fontWeight:700,color:page===pg?"#fff":"#888",background:page===pg?"linear-gradient(135deg,#ff3c3c,#8b0000)":"transparent",textAlign:"left",letterSpacing:1}}>
                {t.nav[key]}
              </button>
            ))}
            {currentUser&&!currentUser.isAdmin&&(
              <button className="nb" onClick={()=>{setPage("mystats");setMenuOpen(false);}} style={{padding:"10px 14px",borderRadius:8,fontSize:13,fontWeight:700,color:"#4ade80",background:"#4ade8011",textAlign:"left"}}>
                {t.nav.myStats}
              </button>
            )}
            {currentUser?.isAdmin&&(
              <button className="nb" onClick={()=>{setAdminOpen(true);setMenuOpen(false);}} style={{padding:"10px 14px",borderRadius:8,fontSize:13,fontWeight:700,color:"#ffd700",background:"#ffd70011",textAlign:"left"}}>⚙️ ADMIN</button>
            )}
            {currentUser&&(
              <div style={{fontSize:11,color:"#555",padding:"8px 14px"}}>{t.login.loggedAs} <span style={{color:"#aaa"}}>{currentUser.username}</span></div>
            )}
          </div>
        )}
      </header>

      <main style={{maxWidth:1200,margin:"0 auto",padding:"24px 16px"}}>

        {/* ════ HOME — CARDS ════════════════════════════════════════════════ */}
        {page==="home"&&(
          <div className="fi">
            <div style={{textAlign:"center",marginBottom:28}}>
              <h1 style={{fontFamily:"Orbitron",fontSize:"clamp(18px,5vw,28px)",fontWeight:900,letterSpacing:4,background:"linear-gradient(90deg,#ff3c3c,#ff8888,#ff3c3c)",backgroundClip:"text",WebkitBackgroundClip:"text",color:"transparent",marginBottom:6}}>{t.home.title}</h1>
              <p style={{color:"#444",fontSize:12,letterSpacing:2}}>{t.home.subtitle}</p>
            </div>
            <div className="grid-cards" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16}}>
              {[...players].sort((a,b)=>getScore(b)-getScore(a)).map(player=>{
                const th=THEMES[player.theme]||THEMES.fire;
                const rank=getRank(players,player);
                const badges=getBadges(player);
                const score=getScore(player);
                const isMe=currentUser&&currentUser.id===player.id;
                const canChangeTheme=currentUser&&(currentUser.id===player.id||currentUser.isAdmin);
                return (
                  <div key={player.id} className="card-hover" style={{background:th.bg,border:`1.5px solid ${th.border}44`,borderRadius:14,padding:"18px 14px",position:"relative",overflow:"hidden",boxShadow:`0 0 24px ${th.glow}1a`}}
                    onClick={()=>{setSelectedPlayer(player);setPage("profile");}}>
                    <div className="shim" style={{position:"absolute",inset:0,borderRadius:14,pointerEvents:"none"}}/>
                    {isMe&&<div style={{position:"absolute",top:7,left:8,background:"#4ade8033",border:"1px solid #4ade8055",borderRadius:10,padding:"1px 6px",fontSize:9,color:"#4ade80",letterSpacing:1}}>YOU</div>}
                    {rank===1&&<span style={{position:"absolute",top:7,right:10,fontSize:16}}>👑</span>}
                    <div style={{textAlign:"center",marginTop:10}}>
                      <div style={{fontSize:40,filter:`drop-shadow(0 0 12px ${th.glow})`,marginBottom:6}}>{player.avatar}</div>
                      <div style={{fontFamily:"Orbitron",fontSize:13,fontWeight:700,color:"#fff",letterSpacing:1,marginBottom:2}}>{player.username}</div>
                      <div style={{fontSize:10,color:"#666",marginBottom:10}}>LVL {player.stats.level} · #{rank}</div>
                      <div style={{background:`${th.accent}1a`,border:`1px solid ${th.accent}33`,borderRadius:8,padding:"3px 10px",display:"inline-block",marginBottom:10}}>
                        <span style={{fontFamily:"Orbitron",fontSize:17,fontWeight:900,color:th.accent}}>{score}</span>
                        <span style={{fontSize:8,color:"#555",marginLeft:3}}>OVR</span>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                        {[["🏆",player.stats.wins,t.stats.wins],["⚔️",player.stats.eliminations,t.stats.eliminations],["🛏️",player.stats.bedDestroyed,t.stats.bedDestroyed],["📊",parseFloat(player.stats.kd||0).toFixed(1),"K/D"]].map(([ic,v,lb])=>(
                          <div key={lb} style={{background:"#ffffff07",borderRadius:6,padding:"4px 2px"}}>
                            <div style={{fontSize:12}}>{ic}</div>
                            <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{v}</div>
                            <div style={{fontSize:7,color:"#444",letterSpacing:1}}>{lb}</div>
                          </div>
                        ))}
                      </div>
                      {badges.length>0&&(
                        <div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:3,justifyContent:"center"}}>
                          {badges.slice(0,3).map(b=><span key={b.label} title={b.label} style={{fontSize:13}}>{b.icon}</span>)}
                          {badges.length>3&&<span style={{fontSize:9,color:"#555"}}>+{badges.length-3}</span>}
                        </div>
                      )}
                      {/* Theme picker — only for card owner or admin */}
                      {canChangeTheme&&(
                        <div style={{marginTop:10,borderTop:"1px solid #ffffff08",paddingTop:8}} onClick={e=>e.stopPropagation()}>
                          <div style={{fontSize:8,color:"#444",letterSpacing:2,marginBottom:5}}>{t.theme.label}</div>
                          <div style={{display:"flex",gap:6,justifyContent:"center"}}>
                            {Object.values(THEMES).map(th2=>(
                              <button key={th2.name} onClick={()=>changeTheme(player.id,th2.name)} title={t.theme[th2.name]} style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${player.theme===th2.name?th2.accent:"#333"}`,background:th2.glow,cursor:"pointer",transition:"all 0.2s",transform:player.theme===th2.name?"scale(1.25)":"scale(1)",boxShadow:player.theme===th2.name?`0 0 8px ${th2.glow}`:"none"}}/>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════ LOGIN / REGISTER ═══════════════════════════════════════════ */}
        {page==="login"&&(
          <div className="fi" style={{display:"flex",justifyContent:"center",paddingTop:32}}>
            <div style={{background:"#0d0d1a",border:"1px solid #ff3c3c22",borderRadius:16,padding:"28px 24px",width:"100%",maxWidth:380}}>
              <h2 style={{fontFamily:"Orbitron",fontSize:18,fontWeight:900,letterSpacing:3,marginBottom:22,color:"#fff",textAlign:"center"}}>{authMode==="login"?t.login.title:t.login.regTitle}</h2>
              {authMode==="login" ? (
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div>
                    <div style={{fontSize:11,color:"#555",marginBottom:5,letterSpacing:1}}>{t.login.username}</div>
                    <input value={loginForm.username} onChange={e=>setLoginForm(f=>({...f,username:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="StormKing"/>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:"#555",marginBottom:5,letterSpacing:1}}>{t.login.password}</div>
                    <input type="password" value={loginForm.password} onChange={e=>setLoginForm(f=>({...f,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="••••••"/>
                  </div>
                  {authError&&<p style={{color:"#ff6666",fontSize:12,margin:0}}>{authError}</p>}
                  <button className="btn" onClick={handleLogin}>{t.login.loginBtn}</button>
                  <p style={{textAlign:"center",fontSize:12,color:"#555",margin:0}}>
                    {t.login.noAccount} <span style={{color:"#ff8888",cursor:"pointer"}} onClick={()=>{setAuthMode("register");setAuthError("");}}>{t.login.register}</span>
                  </p>
                  <p style={{textAlign:"center",fontSize:10,color:"#333",borderTop:"1px solid #ffffff07",paddingTop:10,margin:0}}>
                    Demo: StormKing / demo123 · Admin: admin / bedwars123
                  </p>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div>
                    <div style={{fontSize:11,color:"#555",marginBottom:5,letterSpacing:1}}>{t.login.username}</div>
                    <input value={regForm.username} onChange={e=>setRegForm(f=>({...f,username:e.target.value}))} placeholder="YourName"/>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:"#555",marginBottom:5,letterSpacing:1}}>{t.login.avatar}</div>
                    <input value={regForm.avatar} onChange={e=>setRegForm(f=>({...f,avatar:e.target.value}))} placeholder="🎮" style={{textAlign:"center",fontSize:20}}/>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:"#555",marginBottom:5,letterSpacing:1}}>{t.login.password}</div>
                    <input type="password" value={regForm.password} onChange={e=>setRegForm(f=>({...f,password:e.target.value}))} placeholder="••••••"/>
                  </div>
                  {authError&&<p style={{color:"#ff6666",fontSize:12,margin:0}}>{authError}</p>}
                  <button className="btn" onClick={handleRegister}>{t.login.createBtn}</button>
                  <p style={{textAlign:"center",fontSize:12,color:"#555",margin:0}}>
                    {t.login.hasAccount} <span style={{color:"#ff8888",cursor:"pointer"}} onClick={()=>{setAuthMode("login");setAuthError("");}}>{t.login.signIn}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ MY STATS ═══════════════════════════════════════════════════ */}
        {page==="mystats"&&currentUser&&!currentUser.isAdmin&&(
          <div className="fi">
            <h2 style={{fontFamily:"Orbitron",fontSize:"clamp(16px,4vw,22px)",fontWeight:900,letterSpacing:3,marginBottom:6,color:"#fff"}}>{t.myStats.title}</h2>
            <p style={{fontSize:13,color:"#555",marginBottom:24}}>{t.myStats.subtitle}</p>
            <div style={{background:"#0d0d1a",borderRadius:14,padding:"24px 20px",border:"1px solid #ffffff09",maxWidth:680}}>
              <div className="grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:22}}>
                {STAT_KEYS.map(k=>(
                  <div key={k}>
                    <div style={{fontSize:11,color:"#555",marginBottom:5,letterSpacing:1}}>{STAT_ICONS[k]} {t.stats[k]||k}</div>
                    <input type="number" value={myStatsForm[k]||""} onChange={e=>setMyStatsForm(f=>({...f,[k]:e.target.value}))} placeholder="0"/>
                  </div>
                ))}
              </div>
              <button className="btn" onClick={saveMyStats} style={{padding:14,fontSize:14,letterSpacing:2}}>{statsSaved?t.myStats.saved:t.myStats.saveBtn}</button>
            </div>
          </div>
        )}

        {/* ════ LEADERBOARD ════════════════════════════════════════════════ */}
        {page==="leaderboard"&&(
          <div className="fi">
            {/* Crown board */}
            <h2 style={{fontFamily:"Orbitron",fontSize:"clamp(14px,3.5vw,20px)",fontWeight:900,letterSpacing:3,marginBottom:14,color:"#ffd700"}}>{t.leaderboard.crown}</h2>
            <div className="crown-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginBottom:32}}>
              {STAT_KEYS.map(key=>{
                const top=[...players].sort((a,b)=>((b.stats||{})[key]||0)-((a.stats||{})[key]||0))[0];
                if(!top)return null;
                const th=THEMES[top.theme]||THEMES.fire;
                return (
                  <div key={key} style={{background:"#0d0d1a",border:`1px solid ${th.border}22`,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                    <div style={{fontSize:15,marginBottom:2}}>{STAT_ICONS[key]}</div>
                    <div style={{fontSize:7,color:"#444",letterSpacing:2,marginBottom:4,textTransform:"uppercase"}}>{t.stats[key]}</div>
                    <div style={{fontSize:16}}>{top.avatar}</div>
                    <div style={{fontSize:10,fontWeight:700,color:th.accent,marginTop:2}}>{top.username}</div>
                    <div style={{fontSize:11,color:"#fff",fontWeight:700}}>{fmtStat(key,top.stats[key])}</div>
                  </div>
                );
              })}
            </div>

            {/* Stat selector */}
            <h2 style={{fontFamily:"Orbitron",fontSize:"clamp(14px,3.5vw,20px)",fontWeight:900,letterSpacing:3,marginBottom:12,color:"#fff"}}>{t.leaderboard.rankings}</h2>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:16}}>
              {STAT_KEYS.map(k=>(
                <button key={k} className="nb" onClick={()=>setLeaderStat(k)} style={{padding:"5px 11px",borderRadius:20,fontSize:10,fontWeight:700,letterSpacing:1,background:leaderStat===k?"linear-gradient(135deg,#ff3c3c,#8b0000)":"#0d0d1a",color:leaderStat===k?"#fff":"#555",border:leaderStat===k?"none":"1px solid #ffffff09",transition:"all 0.2s"}}>
                  {STAT_ICONS[k]} {t.stats[k]}
                </button>
              ))}
            </div>

            {/* Ranking rows */}
            <div style={{background:"#0d0d1a",borderRadius:12,overflow:"hidden",border:"1px solid #ffffff09"}}>
              {sortedByStat.map((player,idx)=>{
                const th=THEMES[player.theme]||THEMES.fire;
                // Dynamic sparkline: use the selected stat's progress if available, else wins
                const prog=getPlayerProgress(player.id);
                const sparkData=prog.length>=2?prog.map(p=>{
                  if(leaderStat==="wins")return p.wins;
                  if(leaderStat==="eliminations")return p.eliminations;
                  if(leaderStat==="bedDestroyed")return p.bed_destroyed;
                  return p.wins; // fallback
                }):null;
                return (
                  <div key={player.id} className="rhover" onClick={()=>{setSelectedPlayer(player);setPage("profile");}}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid #ffffff06",cursor:"pointer",background:idx===0?"#ffd70007":"transparent",flexWrap:"wrap"}}>
                    <div style={{fontFamily:"Orbitron",fontSize:16,fontWeight:900,color:idx===0?"#ffd700":idx===1?"#c0c0c0":idx===2?"#cd7f32":"#2a2a2a",width:26,textAlign:"center",flexShrink:0}}>
                      {idx===0?"👑":idx===1?"🥈":idx===2?"🥉":`#${idx+1}`}
                    </div>
                    <span style={{fontSize:24,flexShrink:0}}>{player.avatar}</span>
                    <div style={{flex:1,minWidth:80}}>
                      <div style={{fontWeight:700,fontSize:15,color:"#fff"}}>{player.username}</div>
                      <div style={{fontSize:9,color:th.accent,letterSpacing:1}}>LVL {player.stats.level}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontFamily:"Orbitron",fontSize:19,fontWeight:900,color:th.accent}}>{fmtStat(leaderStat,(player.stats||{})[leaderStat])}</div>
                      <div style={{fontSize:8,color:"#444",letterSpacing:1}}>{(t.stats[leaderStat]||leaderStat).toUpperCase()}</div>
                    </div>
                    {sparkData&&<Sparkline data={sparkData} color={th.accent}/>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════ PROGRESS ═══════════════════════════════════════════════════ */}
        {page==="progress"&&(
          <div className="fi">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:24}}>
              <h2 style={{fontFamily:"Orbitron",fontSize:"clamp(14px,4vw,20px)",fontWeight:900,letterSpacing:3,color:"#fff",margin:0}}>{t.progress.title}</h2>
              <div style={{display:"flex",background:"#0d0d1a",borderRadius:20,border:"1px solid #ffffff0d",overflow:"hidden"}}>
                {["weekly","monthly"].map(m=>(
                  <button key={m} className="nb" onClick={()=>setProgressMode(m)} style={{padding:"7px 16px",fontSize:11,fontWeight:700,letterSpacing:1,background:progressMode===m?"linear-gradient(135deg,#ff3c3c,#8b0000)":"transparent",color:progressMode===m?"#fff":"#555",transition:"all 0.2s"}}>
                    {m==="weekly"?t.progress.weekly:t.progress.monthly}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid-2" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16,marginBottom:32}}>
              {players.map(player=>{
                const th=THEMES[player.theme]||THEMES.fire;
                const entries=getPlayerProgress(player.id);
                return (
                  <div key={player.id} style={{background:"#0d0d1a",border:`1px solid ${th.border}1a`,borderRadius:12,padding:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                      <span style={{fontSize:24}}>{player.avatar}</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,color:"#fff",fontSize:14}}>{player.username}</div>
                        <div style={{fontSize:10,color:th.accent}}>{progressMode==="weekly"?t.progress.weekly:t.progress.monthly}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontFamily:"Orbitron",fontSize:17,color:th.accent}}>{entries.reduce((s,e)=>s+(e.wins||0),0)}</div>
                        <div style={{fontSize:8,color:"#333"}}>WINS</div>
                      </div>
                    </div>
                    {entries.length===0?(
                      <div style={{fontSize:11,color:"#333",textAlign:"center",padding:"14px 0"}}>{t.progress.noData}</div>
                    ):(
                      <div style={{display:"flex",gap:4,alignItems:"flex-end",height:50}}>
                        {entries.map((e,i)=>{
                          const maxW=Math.max(...entries.map(x=>x.wins||0),1);
                          const label=isWeekly?`W${i+1}`:e.period.replace(/.*-M/,"M");
                          return (
                            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                              <div style={{fontSize:7,color:th.accent}}>{e.wins}</div>
                              <div style={{width:"100%",height:`${((e.wins||0)/maxW)*38}px`,background:`linear-gradient(180deg,${th.accent},${th.accent}44)`,borderRadius:"2px 2px 0 0",transition:"height 0.8s ease"}}/>
                              <div style={{fontSize:7,color:"#333"}}>{label}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Most improved */}
            <h3 style={{fontFamily:"Orbitron",fontSize:13,letterSpacing:2,color:"#ff3c3c",marginBottom:12}}>{t.progress.mostImproved}</h3>
            {(()=>{
              const cands=players.filter(p=>{
                const e=getPlayerProgress(p.id);
                return e.length>=2;
              }).map(p=>{
                const e=getPlayerProgress(p.id);
                const first=e[0].wins||0,last=e[e.length-1].wins||0;
                return {player:p,improvement:last-first,pct:first>0?((last-first)/first*100).toFixed(0):0};
              }).sort((a,b)=>b.improvement-a.improvement);
              if(!cands.length)return <p style={{color:"#333",fontSize:12,marginBottom:28}}>{t.progress.noData}</p>;
              const {player:imp,improvement,pct}=cands[0];
              const th=THEMES[imp.theme]||THEMES.fire;
              return (
                <div style={{background:`linear-gradient(135deg,#0d0d1a,${th.glow}0d)`,border:`1px solid ${th.border}33`,borderRadius:12,padding:20,display:"flex",alignItems:"center",gap:16,marginBottom:28,flexWrap:"wrap"}}>
                  <span style={{fontSize:44}}>{imp.avatar}</span>
                  <div>
                    <div style={{fontFamily:"Orbitron",fontSize:"clamp(14px,4vw,18px)",color:"#fff",fontWeight:900}}>{imp.username}</div>
                    <div style={{color:th.accent,fontSize:12,marginTop:3}}>{t.progress.mostImproved.replace("⬆️ ","")}</div>
                    <div style={{fontSize:11,color:"#666",marginTop:2}}>+{improvement} wins · +{pct}%</div>
                  </div>
                  <div style={{marginLeft:"auto",fontFamily:"Orbitron",fontSize:32,color:th.accent}}>⬆️</div>
                </div>
              );
            })()}

            {/* Rivalry */}
            <h3 style={{fontFamily:"Orbitron",fontSize:13,letterSpacing:2,color:"#ff3c3c",marginBottom:12}}>{t.progress.rivalry}</h3>
            <div style={{background:"#0d0d1a",borderRadius:12,padding:20,border:"1px solid #ff3c3c1a"}}>
              <div style={{display:"flex",gap:8,marginBottom:20,justifyContent:"center",flexWrap:"wrap"}}>
                <select value={rivalry.a} onChange={e=>setRivalry(r=>({...r,a:parseInt(e.target.value)}))}>
                  {players.map((p,i)=><option key={p.id} value={i}>{p.username}</option>)}
                </select>
                <span style={{fontSize:16,alignSelf:"center"}}>⚔️</span>
                <select value={rivalry.b} onChange={e=>setRivalry(r=>({...r,b:parseInt(e.target.value)}))}>
                  {players.map((p,i)=><option key={p.id} value={i}>{p.username}</option>)}
                </select>
              </div>
              {playerA&&playerB&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:10,alignItems:"center"}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:32}}>{playerA.avatar}</div>
                    <div style={{fontFamily:"Orbitron",fontWeight:700,color:"#fff",fontSize:13,marginTop:3}}>{playerA.username}</div>
                  </div>
                  <div style={{textAlign:"center",color:"#ff3c3c",fontFamily:"Orbitron",fontSize:16}}>VS</div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:32}}>{playerB.avatar}</div>
                    <div style={{fontFamily:"Orbitron",fontWeight:700,color:"#fff",fontSize:13,marginTop:3}}>{playerB.username}</div>
                  </div>
                  {["wins","eliminations","bedDestroyed","kd","clutchEliminations","diamonds"].map(key=>{
                    const va=(playerA.stats||{})[key]||0,vb=(playerB.stats||{})[key]||0;
                    const winA=va>vb,winB=vb>va;
                    return (
                      <div key={key} style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:6,alignItems:"center",padding:"5px 0",borderBottom:"1px solid #ffffff06"}}>
                        <div style={{textAlign:"right",fontFamily:"Orbitron",fontSize:14,color:winA?"#4ade80":"#444"}}>{fmtStat(key,va)}</div>
                        <div style={{textAlign:"center",fontSize:8,color:"#333",letterSpacing:1,width:80}}>{STAT_ICONS[key]} {t.stats[key]}</div>
                        <div style={{textAlign:"left",fontFamily:"Orbitron",fontSize:14,color:winB?"#4ade80":"#444"}}>{fmtStat(key,vb)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ PROFILES ═══════════════════════════════════════════════════ */}
        {page==="profile"&&(
          <div className="fi">
            {!selectedPlayer?(
              <div>
                <h2 style={{fontFamily:"Orbitron",fontSize:"clamp(16px,4vw,22px)",fontWeight:900,letterSpacing:3,marginBottom:20,color:"#fff"}}>{t.profile.allPlayers}</h2>
                <div className="grid-cards" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
                  {players.map(p=>{
                    const th=THEMES[p.theme]||THEMES.fire;
                    return (
                      <div key={p.id} className="card-hover" onClick={()=>setSelectedPlayer(p)} style={{background:"#0d0d1a",border:`1px solid ${th.border}22`,borderRadius:12,padding:16,display:"flex",alignItems:"center",gap:12}}>
                        <span style={{fontSize:28}}>{p.avatar}</span>
                        <div>
                          <div style={{fontWeight:700,color:"#fff"}}>{p.username}</div>
                          <div style={{fontSize:10,color:th.accent}}>LVL {p.stats.level}</div>
                          <div style={{fontSize:11,color:"#555",marginTop:2}}>{t.profile.rank} #{getRank(players,p)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ):(()=>{
              const p=players.find(x=>x.id===selectedPlayer.id)||selectedPlayer;
              const th=THEMES[p.theme]||THEMES.fire;
              const badges=getBadges(p);
              const rank=getRank(players,p);
              const score=getScore(p);
              const wentries=(progressMap[p.id]||[]).filter(x=>/W/.test(x.period)).sort((a,b)=>a.period.localeCompare(b.period));
              return (
                <div>
                  <button className="btn-ghost" onClick={()=>setSelectedPlayer(null)} style={{marginBottom:20}}>{t.profile.back}</button>
                  <div className="grid-profile" style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:20}}>
                    {/* Card */}
                    <div>
                      <div style={{background:th.bg,border:`2px solid ${th.border}44`,borderRadius:16,padding:22,textAlign:"center",position:"relative",boxShadow:`0 0 30px ${th.glow}1a`}}>
                        {rank===1&&<span style={{position:"absolute",top:10,right:14,fontSize:20}}>👑</span>}
                        <div style={{fontSize:56,filter:`drop-shadow(0 0 16px ${th.glow})`,marginBottom:8}}>{p.avatar}</div>
                        <div style={{fontFamily:"Orbitron",fontSize:18,fontWeight:900,color:"#fff"}}>{p.username}</div>
                        <div style={{color:th.accent,fontSize:11,letterSpacing:2,margin:"3px 0 10px"}}>{THEMES[p.theme]?.name?.toUpperCase()||""} THEME</div>
                        <div style={{background:`${th.accent}1a`,borderRadius:8,padding:"7px 16px",display:"inline-block",marginBottom:10}}>
                          <div style={{fontFamily:"Orbitron",fontSize:28,fontWeight:900,color:th.accent}}>{score}</div>
                          <div style={{fontSize:7,color:"#555",letterSpacing:2}}>{t.profile.overallRating}</div>
                        </div>
                        <div style={{fontSize:10,color:"#555"}}>{t.profile.rank} #{rank} · {t.profile.level} {p.stats.level}</div>
                        {badges.length>0&&(
                          <div style={{marginTop:14}}>
                            <div style={{fontSize:8,color:"#333",letterSpacing:2,marginBottom:7}}>{t.profile.achievements}</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:4,justifyContent:"center"}}>
                              {badges.map(b=>(
                                <div key={b.label} title={b.label} style={{background:"#ffffff08",borderRadius:20,padding:"3px 8px",fontSize:10,display:"flex",alignItems:"center",gap:3}}>
                                  {b.icon}<span style={{fontSize:9,color:"#999"}}>{b.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {wentries.length>0&&(
                        <div style={{marginTop:12,background:"#0d0d1a",borderRadius:10,padding:14,border:`1px solid ${th.border}1a`}}>
                          <div style={{fontSize:8,color:"#333",letterSpacing:2,marginBottom:8}}>{t.profile.winProg}</div>
                          <div style={{display:"flex",gap:4,alignItems:"flex-end",height:44}}>
                            {wentries.map((e,i)=>{
                              const maxW=Math.max(...wentries.map(x=>x.wins||0),1);
                              return (
                                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                  <div style={{fontSize:7,color:th.accent}}>{e.wins}</div>
                                  <div style={{width:"100%",height:`${((e.wins||0)/maxW)*32}px`,background:`linear-gradient(180deg,${th.accent},${th.accent}33)`,borderRadius:"2px 2px 0 0"}}/>
                                  <div style={{fontSize:6,color:"#333"}}>W{i+1}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Stats */}
                    <div style={{background:"#0d0d1a",borderRadius:12,padding:20,border:"1px solid #ffffff08"}}>
                      <div style={{fontSize:8,color:"#333",letterSpacing:2,marginBottom:14}}>{t.profile.overview}</div>
                      <div className="arcs-wrap" style={{display:"flex",flexWrap:"wrap",gap:12,justifyContent:"center",marginBottom:18}}>
                        {[{key:"wins",max:100},{key:"kd",max:10},{key:"bedDestroyed",max:150},{key:"clutchEliminations",max:100},{key:"diamonds",max:20000},{key:"damageDealt",max:400000}].map(({key,max})=>(
                          <StatArc key={key} value={p.stats[key]} max={max} color={th.accent} label={t.stats[key]||key} icon={STAT_ICONS[key]}/>
                        ))}
                      </div>
                      <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                        {STAT_KEYS.map(k=>(
                          <div key={k} className="srow">
                            <span style={{fontSize:12,color:"#666"}}>{STAT_ICONS[k]} {t.stats[k]||k}</span>
                            <span style={{fontFamily:"Orbitron",fontSize:12,color:th.accent,fontWeight:700}}>{fmtStat(k,p.stats[k])}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {/* ════ ADMIN MODAL ═══════════════════════════════════════════════════ */}
      {adminOpen&&currentUser?.isAdmin&&(
        <div style={{position:"fixed",inset:0,background:"#000000dd",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:20,overflowY:"auto"}} onClick={e=>{if(e.target===e.currentTarget)setAdminOpen(false);}}>
          <div style={{background:"#0d0d1a",border:"1px solid #ffd70033",borderRadius:16,padding:24,width:"100%",maxWidth:560,marginTop:20}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
              <div style={{fontFamily:"Orbitron",fontSize:15,color:"#ffd700",letterSpacing:2}}>⚙️ ADMIN PANEL</div>
              <button className="nb" onClick={()=>setAdminOpen(false)} style={{color:"#555",fontSize:18}}>✕</button>
            </div>
            <div style={{marginBottom:22}}>
              <div style={{fontSize:10,color:"#ffd700",letterSpacing:2,marginBottom:12}}>MANAGE PLAYERS</div>
              {players.map(p=>(
                <div key={p.id} style={{background:"#07080f",borderRadius:10,padding:12,marginBottom:8,border:"1px solid #ffffff07"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:18}}>{p.avatar}</span>
                      <div>
                        <div style={{fontWeight:700,color:"#fff",fontSize:13}}>{p.username}</div>
                        <div style={{fontSize:9,color:THEMES[p.theme]?.accent||"#888"}}>{THEMES[p.theme]?.name?.toUpperCase()||""}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      {editingId===p.id?(
                        <>
                          <button className="btn btn-sm" onClick={saveEdit}>SAVE</button>
                          <button className="btn-ghost" onClick={()=>setEditingId(null)}>CANCEL</button>
                        </>
                      ):(
                        <>
                          <button className="btn btn-sm" onClick={()=>startEdit(p)}>EDIT</button>
                          <button className="btn btn-sm btn-danger" onClick={()=>removePlayer(p.id)}>DEL</button>
                        </>
                      )}
                    </div>
                  </div>
                  {editingId===p.id&&(
                    <div className="grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
                      {STAT_KEYS.map(k=>(
                        <div key={k}>
                          <div style={{fontSize:8,color:"#444",marginBottom:3}}>{STAT_ICONS[k]} {t.stats[k]||k}</div>
                          <input type="number" value={editForm[k]||0} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))} style={{fontSize:12,padding:"6px 8px"}}/>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div>
              <div style={{fontSize:10,color:"#ffd700",letterSpacing:2,marginBottom:12}}>ADD NEW PLAYER</div>
              <div className="grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                {[{k:"username",ph:"Username"},{k:"password",ph:"Password"},{k:"avatar",ph:"🎮"},{k:"theme",isSelect:true}].map(f=>(
                  <div key={f.k}>
                    <div style={{fontSize:8,color:"#444",marginBottom:3,textTransform:"capitalize"}}>{f.k}</div>
                    {f.isSelect?
                      <select value={newPF.theme} onChange={e=>setNewPF(x=>({...x,theme:e.target.value}))}>
                        <option value="fire">🔥 Inferno</option>
                        <option value="ice">❄️ Frostbite</option>
                        <option value="void">🌀 Void</option>
                      </select>:
                      <input value={newPF[f.k]} onChange={e=>setNewPF(x=>({...x,[f.k]:e.target.value}))} placeholder={f.ph} type={f.k==="password"?"password":"text"} style={{fontSize:12,padding:"6px 8px"}}/>
                    }
                  </div>
                ))}
              </div>
              {adminError&&<p style={{color:"#ff6666",fontSize:12,marginBottom:8}}>{adminError}</p>}
              <button className="btn" onClick={addNewPlayer}>ADD PLAYER</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
