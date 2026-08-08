# ViralCut — Framework & Architecture

## Overview

ViralCut is a modern, single-page web application built with **React 18**, **Vite 7**, and **TypeScript**. It helps YouTube content creators automatically generate short-form clips (Shorts/Reels/TikToks) from their long-form videos by leveraging AI-powered video analysis and browser-based video processing.

## Core Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI Framework** | React 18 | Component-based rendering |
| **Build Tool** | Vite 7 | Dev server, HMR, production builds |
| **Language** | TypeScript 5.9 | Type safety across the codebase |
| **Routing** | React Router v7 | Client-side navigation with 4 routes |
| **Styling** | Tailwind CSS v4 | Utility-first CSS with `@theme` tokens |
| **Auth / Backend** | Supabase | Authentication, database, Edge Functions |
| **Icons** | lucide-react + react-icons | UI and brand/social icons |

## Project Structure

```
src/
├── main.tsx              # Entry point — mounts React to #root
├── App.tsx               # Root component — BrowserRouter, AuthProvider, Routes
├── index.css             # Global styles + Tailwind v4 @theme design tokens
├── contexts/
│   └── AuthContext.tsx   # Auth state provider (Supabase session)
├── lib/
│   ├── supabase.ts       # Supabase client singleton
│   ├── database.types.ts # Generated DB type definitions
│   └── youtube.ts        # YouTube Data API client helpers
└── pages/
    ├── Login.tsx          # / — "Connect YouTube" CTA, Google OAuth
    ├── AuthCallback.tsx   # /auth/callback — OAuth redirect handler
    ├── Dashboard.tsx      # /dashboard — ranked list of user's top videos
    └── Analyze.tsx        # /analyze/:videoId — AI analysis, clipping, posting
```

## Route Map

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Login` | Landing page with Google sign-in / YouTube connect |
| `/auth/callback` | `AuthCallback` | OAuth redirect handler — exchanges code for session |
| `/dashboard` | `Dashboard` | Shows user's channel info + ranked video list |
| `/analyze/:videoId` | `Analyze` | AI clip generation, preview, download, and posting |

## Authentication Flow

1. User clicks "Connect YouTube" on the Login page.
2. `supabase.auth.signInWithOAuth({ provider: "google" })` is called with scopes: `openid profile email youtube.readonly youtube.upload`.
3. Supabase redirects to Google's OAuth consent screen.
4. After consent, Google redirects to `/auth/callback` with an authorization code.
5. Supabase exchanges the code for a session and calls `onAuthStateChange`.
6. The `AuthContext` stores the session, including `provider_token` (the Google access token used for all YouTube API calls).
7. User is redirected to `/dashboard`.

> **Note:** `emailRedirectTo` is set to `${window.location.origin}` for preview environment compatibility. Implicit flow is used instead of PKCE.

## Supabase Integration

- **Project ref**: `bmevvqkivylkyzerrhjk` ("Rin0666's Project")
- **Auth**: Google OAuth provider configured in Supabase Dashboard
- **Database**: PostgreSQL with RLS policies (via migrations)
- **Edge Functions**: TypeScript/Deno backend for proxying third-party API calls (e.g., Twelve Labs)
- **Secrets**: Managed via Supabase Secret Manager — never in `.env` files

### Key Credentials

| Secret / Key | Type | Where Used |
|-------------|------|-----------|
| Google OAuth Client ID + Secret | Supabase Dashboard config | Supabase Google provider |
| YouTube Data API Key | Publishable (client source) | YouTube Data API v3 read calls |
| Google provider token | Runtime session (`provider_token`) | Authenticated YouTube API calls |
| Twelve Labs API Key | **SECRET** (Edge Function secret) | `analyze-video` Edge Function only |

## App Flow (Happy Path)

1. **Login** → Google OAuth → `/dashboard`
2. **Dashboard** → YouTube Data API fetches channel + top videos (ranked by views)
3. **Select a video** → navigate to `/analyze/:videoId`
4. **Click "Generate Clips"** → Supabase Edge Function `analyze-video` calls Twelve Labs → returns 3–5 timestamped clip suggestions
5. **Upload original video file** → browser picks the file
6. **Clipping** → ffmpeg.wasm cuts segments at specified timestamps (lossless, keyframe-aligned)
7. **Preview & Post** → user reviews clips, edits titles, posts to YouTube Shorts or downloads locally

## Styling

- **Approach**: Tailwind CSS v4 with a custom `@theme` block in `src/index.css`
- **Design system**: Defined in `design-system/MASTER.md` (docs volume)
- **Palette**: Dark-themed, creator-oriented UI
- **Accessibility**: ARIA roles, keyboard navigation, focus states, `prefers-reduced-motion` respected
- **Responsiveness**: Breakpoints at 375px / 768px / 1024px / 1440px

## Performance Considerations

- AI analysis can take 1–3 minutes — requires good loading UX (progress indicators, skeletons)
- Video clipping runs in-browser via WebAssembly (ffmpeg.wasm) — file size limits (~2GB) communicated to user
- Clip files stay in browser memory as Blobs until posted or downloaded
- Twelve Labs API key never reaches the browser — always proxied through the Edge Function

## Deployment

- **Preview**: `npm run dev` (Vite dev server)
- **Production**: `npm run build` (Vite production build)