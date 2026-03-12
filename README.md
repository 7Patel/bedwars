# 🛏️ BedWars War Room

A full-stack squad stats tracker for Fortnite BedWars.

## Features
- 🔑 Player self-registration & login (JWT auth)
- 📝 Each player updates their own stats
- 🏆 Live leaderboard with dynamic sparklines
- 📅 Weekly / Monthly progress tracker
- 👑 Admin panel (edit/delete/add any player)
- 🎨 3 card themes per player (Fire, Ice, Void)
- 🌐 English / Japanese translation
- 📱 Fully mobile responsive

---

## 🚀 Deploy FREE on Railway (Recommended)

1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo → Railway auto-detects `railway.toml`
4. Add environment variables in Railway dashboard:
   - `JWT_SECRET` = any long random string (e.g. `mySuperSecret123XYZ`)
   - `NODE_ENV` = `production`
5. Done! Railway gives you a public URL

---

## 🚀 Deploy FREE on Render

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service → connect your repo
3. Render reads `render.yaml` automatically
4. Set `JWT_SECRET` environment variable in dashboard
5. Done!

---

## 💻 Run Locally

```bash
# Install all dependencies
npm run install-all

# Terminal 1 — start backend (port 3001)
npm run dev-server

# Terminal 2 — start React frontend (port 3000)
npm run dev-client
```

Open http://localhost:3000

---

## 🔑 Default Credentials

| User | Password | Role |
|------|----------|------|
| admin | bedwars123 | Admin (full access) |
| StormKing | demo123 | Player |
| ShadowBlade | demo123 | Player |
| NightReaper | demo123 | Player |
| IronFang | demo123 | Player |

> ⚠️ Change `bedwars123` in `server/index.js` before deploying!

---

## 📁 Project Structure

```
bedwars/
├── package.json          ← Root scripts
├── railway.toml          ← Railway config
├── render.yaml           ← Render config
├── server/
│   ├── package.json
│   └── index.js          ← Express + SQLite backend
└── client/
    ├── package.json
    ├── public/index.html
    └── src/
        ├── index.js
        └── App.js        ← Full React frontend
```

---

## 🛠️ Tech Stack

- **Backend**: Node.js + Express + better-sqlite3 + JWT + bcrypt
- **Frontend**: React 18 + CSS-in-JS (no extra libraries)
- **Database**: SQLite (file-based, zero setup, persists on Railway/Render)
- **Auth**: JWT tokens stored in localStorage
