# ViralCut 🎬✂️

**Turn your long-form YouTube videos into viral short clips — powered by AI.**

ViralCut is a web app that connects to your YouTube channel, analyzes your top-performing videos with AI, and automatically generates 3–5 ready-to-post short clips (YouTube Shorts). No video downloads, no heavy software — everything runs in your browser.

> **Status:** Active development (MVP)

---

## Features

- 🔗 **Google OAuth sign-in** — single-click login with YouTube scopes
- 📊 **Channel Dashboard** — browse your top YouTube videos sorted by views, likes, comments, or date
- 🤖 **AI-powered analysis** — identifies viral-worthy moments (Twelve Labs)
- ✂️ **Browser-side clipping** — lossless video cutting via ffmpeg.wasm (your file never leaves your machine)
- 🎬 **Post to YouTube Shorts** — upload clips directly from the browser
- 💾 **Download clips** — save locally as an alternative

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite 7 |
| **Styling** | Tailwind CSS v4 + Inter font |
| **Auth** | Supabase Auth (Google OAuth) |
| **Database** | Supabase PostgreSQL (clips metadata) |
| **Backend** | Supabase Edge Functions (Deno) |
| **AI** | Twelve Labs Marengo/Pegasus API |
| **Video** | ffmpeg.wasm (browser-side WebAssembly) |
| **YouTube** | YouTube Data API v3 (read + upload) |
| **Icons** | Lucide React + React Icons (Simple Icons) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase account (project linked)
- A Google Cloud Console project with YouTube Data API enabled
- A Twelve Labs account (for AI analysis)

### 1. Clone & Install

```bash
git clone <repo-url>
cd viralcut
npm install
```

### 2. Supabase Configuration

This project uses Supabase for auth and backend. The project is already linked to a Supabase project. Make sure:

1. **Google OAuth provider is enabled** in your Supabase Dashboard → Auth → Providers → Google
2. **Google OAuth redirect URI** is set to: `https://<your-project>.supabase.co/auth/v1/callback`
3. The **Google Cloud OAuth client** has the same redirect URI added under Authorized redirect URIs
4. YouTube API scopes requested: `openid`, `profile`, `email`, `youtube.readonly`, `youtube.upload`

### 3. Environment & Secrets

**Publishable (safe in client source):**
- YouTube Data API key in `src/lib/youtube.ts`

**Secrets (set via Supabase Secret Manager — never in .env or client code):**
- `TWELVELABS_API_KEY` — for AI video analysis

### 4. Running Locally

```bash
npm run dev
```

---

## Project Structure

```
src/
├── main.tsx                    # Entry point
├── App.tsx                     # Router setup
├── index.css                   # Tailwind v4 theme & global styles
├── contexts/
│   └── AuthContext.tsx          # Auth state (Google OAuth + YouTube scopes)
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── youtube.ts              # YouTube Data API v3 client
│   └── database.types.ts       # Generated TypeScript types
├── pages/
│   ├── Login.tsx               # Landing / sign-in page
│   ├── AuthCallback.tsx        # OAuth redirect handler
│   ├── Dashboard.tsx           # Channel overview + video list
│   └── Analyze.tsx             # Video analysis + clip generation
└── edge-functions/
    └── analyze-video/          # Twelve Labs proxy (Supabase Edge Function)
```

---

## Development Roadmap

See [`docs/framework.md`](./docs/framework.md) for the full roadmap and task breakdown.

### MVP Scope (current)

- [x] Supabase auth with Google OAuth + YouTube scopes
- [x] YouTube Data API integration (read channel, videos, stats)
- [x] Channel dashboard with sorting and video grid
- [x] Analyze page scaffold (accepts video ID)
- [ ] Twelve Labs AI analysis via Edge Function
- [ ] Clip review & preview UI
- [ ] ffmpeg.wasm browser-side clipping
- [ ] YouTube Shorts upload / download

---

## License

Private — all rights reserved.