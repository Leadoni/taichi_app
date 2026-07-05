# Tai Motion — Members' App (`app.taimotion.com`)

The paid product members land in after completing the funnel. A Supabase-backed,
hash-routed single-page app covering guided **exercises**, a **meal plan**,
**tracking**, an **academy**, and **challenges**.

Static site, no framework, no build step. Deployed via **GitHub Pages**
(`CNAME` → `app.taimotion.com`) with a retrying deploy workflow.

## Boot sequence (`app.js`)

```
auth session? ──no──▶ renderAuth()   (email → Supabase magic link)
     │yes
     ▼
load profile ──▶ hasAccess()? ──no──▶ renderGate()  (subscription required)
                     │yes
                     ▼
   load content + user state (Supabase, falls back to CONTENT mock)
                     │
                     ▼
                  route()  ──▶  hash-based views
```

Sign-in uses Supabase **magic links** (implicit flow — tokens arrive in the URL
hash, which is required because the funnel generates the link server-side). The
funnel typically drops the member in already authenticated.

## Routes / views

Hash router in `app.js` → `route()`. Nav items: Home, Meals, Exercises, Tracking,
Academy, Challenges, Favorites (mobile bottom-nav is a subset).

| Hash | View |
|------|------|
| `#/home` | Dashboard: today's next meal, calories, academy progress, tracker tiles, settings |
| `#/exercises`, `#/workout/:id` | Exercise library by category + session player (video moves, 3-2-1 countdown between moves) |
| `#/meals`, `#/recipe/:id` | Weekly meal plan + recipes |
| `#/tracking`, `#/track/:metric` | Weight, water, steps, balance, mood, fasting check-ins |
| `#/academy`, `#/lesson/:id` | Lessons with completion + tasks |
| `#/challenges`, `#/challenge/:id` | Multi-day challenges |
| `#/favorites` | Saved sessions & recipes |
| `#/profile` | Profile, units, palette toggle (brown/green) |
| `#/subscription`, `#/install` | Manage subscription; PWA/install help |

## Files (`assets/`)

| File | Purpose |
|------|---------|
| `config.js` | Theme engine (brown/green via `tm_theme` cookie shared with the funnel; `window.TM.set` flips it live) **and** the Supabase client + `window.AUTH` helpers. Loads after the supabase-js UMD bundle. |
| `app.js` | The whole SPA: nav, auth/subscription gates, every view, the session/video player, and the hash router. Largest file. |
| `db.js` | `window.DB` — the data layer. Supabase reads/writes (RLS-scoped), with a fallback to the `CONTENT` mock so the UI renders during setup. Also holds per-day UI checklist state in `localStorage` (`tc_<key>_<date>`). |
| `content.js` | `window.CONTENT` — mock exercise/meal/tracker data (Lorem Picsum placeholder images) used until Supabase tables are populated, and as the offline fallback. |
| `plan.js` | `window.PLAN` — the **meal-plan engine**: Mifflin-St Jeor BMR → TDEE → moderate deficit calorie targets (with safe floors), plus deterministic weekly recipe generation (seeded RNG so a given user+week is reproducible). Not medical advice. |
| `style.css` | All app styling (sidebar + mobile bottom-nav responsive layout). |
| `videos/*.mp4` | Session move videos (currently a couple of Calm Chair Flex test clips). |
| `tai-chi-walking.pdf` | The 7-day walking guide asset. |

## Data model (Supabase)

Same project as the funnel (`pixtozeghxwiidpnloih`). Tables referenced by `db.js`:

- **Identity/billing:** `users`, `quiz_sessions`, `subscriptions`
- **Content:** `sessions`, `media_sessions`, `recipes`, `lessons`, `challenges`
- **Member state:** `user_session_progress`, `favorites`, `progress_checkins`,
  `fasting_logs`, `user_lesson_progress`, `user_challenges`,
  `meal_plan_runs`, `meal_plan_items`

Access is gated on `subscription_status` (`active`/`trialing`) and
`current_period_end`. When a member's profile lacks a field, `db.js` falls back to
their most recent `quiz_sessions` answers (height, goal weight, gender, age band).

## Local development

```bash
cd taichi_app
python3 -m http.server 8000
# open http://localhost:8000/
```

Requires network access to the Supabase project and the supabase-js CDN bundle.
Without a valid session you'll see the sign-in gate. Append `?t=g` for the green
palette. Bump `?v=NN` on a changed asset in `index.html` to bust the Pages cache.

## Deploy

Push to `main`. `.github/workflows/pages.yml` builds and deploys to GitHub Pages,
**retrying up to 3 times** to absorb transient `deploy-pages` failures. Served at
`app.taimotion.com` (per `CNAME`).
