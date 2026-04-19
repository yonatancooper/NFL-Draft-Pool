# NFL Draft Pool 2026

A full-stack web app where users predict the 32 first-round picks of the 2026 NFL Draft. Drag-and-drop interface, automatic scoring, leaderboard, and shareable entries.

## Tech Stack

- **Frontend:** React (Vite) + Tailwind CSS + @hello-pangea/dnd (maintained react-beautiful-dnd fork)
- **Backend:** Python FastAPI + SQLAlchemy + SQLite
- **No external DB required** — SQLite runs locally

## Local Development Setup

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The server auto-seeds 150 prospects on first startup from `prospects_seed.json`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` requests to the backend at port 8000.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ADMIN_PASSWORD` | `draftadmin2026` | Password for admin panel and results submission |

Create a `.env` file in `/backend` to override:
```
ADMIN_PASSWORD=your_secret_password
```

## How It Works

1. **Build your mock draft** — drag prospects from the sidebar into the 32 pick slots
2. **Submit** — enter your name and email, one entry per email
3. **Share** — get a unique link to your board at `/entry/{token}`
4. **After the draft** — admin enters actual results at `/admin`
5. **Scores compute automatically** — view the leaderboard at `/leaderboard`

## Scoring System

Configured in `scoring_config.json` (editable without code changes):

| Scenario | Points |
|---|---|
| Exact pick | 10 |
| Off by 1-2 | 7 |
| Off by 3-5 | 4 |
| Off by 6-10 | 2 |
| Off by 11-20 | 1 |
| Off by 21+ | 0 |
| Player appears anywhere on board | +2 bonus |

## Entering Results (Post-Draft)

1. Go to `/admin` and enter the admin password
2. Type the 32 first-round pick names (one per line, in order)
3. Names must match the prospect database exactly — a reference list is shown
4. Click "Submit Results & Score" — all entries are scored automatically

## Deploy to Render

### Backend (Web Service)
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Environment:** Python 3
- Set `ADMIN_PASSWORD` in environment variables

### Frontend (Static Site)
- **Build command:** `cd frontend && npm install && npm run build`
- **Publish directory:** `frontend/dist`
- Update `frontend/src/api/index.js` to point `BASE` to your backend URL, or configure a rewrite rule

### Alternative: Railway
1. Connect your repo
2. Railway auto-detects the services
3. Set environment variables in the dashboard

## Project Structure

```
nfl-draft-pool/
  scoring_config.json        # Scoring thresholds (editable)
  prospects_seed.json         # 150 pre-filled prospects
  backend/
    main.py                   # FastAPI app with all routes
    database.py               # SQLAlchemy engine/session
    models.py                 # ORM models
    schemas.py                # Pydantic request/response schemas
    scoring.py                # Scoring engine
    seed.py                   # DB seeder
    requirements.txt
  frontend/
    src/
      App.jsx                 # Router & layout
      api/index.js            # API client
      components/
        DraftPage.jsx         # Main drag-and-drop board
        EntryView.jsx         # View submitted entry
        Leaderboard.jsx       # Scored rankings
        AdminPanel.jsx        # Enter results
        Countdown.jsx         # Draft countdown timer
        HowToPlay.jsx         # Scoring explanation modal
        PositionBadge.jsx     # Colored position tags
```
