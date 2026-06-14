# Spreetail — Shared Expenses App

A shared expense tracker for flatmates, with group membership timelines, multi-currency support, and a CSV import pipeline with full anomaly detection.

## Stack

- **Backend**: Django 4.2 + Django REST Framework
- **Frontend**: React (Vite), served as static assets by Django via whitenoise
- **Database**: PostgreSQL (Render managed Postgres)
- **Auth**: Django built-in auth + DRF TokenAuthentication
- **Deploy**: Render (single web service)

## Local development setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL (or use `.env` to point at a remote DB)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Copy and fill in environment variables
cp .env.example .env

python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # Vite dev server on :5173, proxies /api/ to Django on :8000
```

For a full production-like build (Django serves the React bundle):

```bash
cd frontend && npm run build
cd ../backend && python manage.py collectstatic --noinput
python manage.py runserver
```

## Environment variables

See `backend/.env.example` for all required variables.

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Django secret key |
| `DEBUG` | `True` for dev, `False` for prod |
| `DATABASE_URL` | PostgreSQL connection string |
| `ALLOWED_HOSTS` | Comma-separated list of allowed hosts |

## AI tools used

See `AI_USAGE.md` for a full log of AI tool usage and documented mistakes.
