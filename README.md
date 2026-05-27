# OOTD AI

> A vector-DB outfit recommender that turns a user's mood, weather, and closet into ranked outfit picks — with online feedback learning that personalizes the ranking over time.

🏆 **1st place — YBIGTA cohort showcase**

---

## Overview

OOTD AI ("Outfit of the Day") is a full-stack AI fashion assistant. Users upload pieces of their wardrobe, type a mood ("minimal date look", "rainy commute"), and the system returns top-K outfits ranked by a learned embedding + color-harmony score. Every like / dislike updates the recommendation hyperparameters in a bandit-style explore-exploit loop.

The retrieval mechanism is the same one that powers RAG systems: **encode the user query and the closet items into a shared vector space, then rank by similarity** — with a few fashion-specific extras (LAB color harmony, MMR diversity, season/temperature gating).

I built this end-to-end as a core contributor — ML model, FastAPI serving layer, Next.js application, and deployment infra.

---

## Architecture

```
                          ┌────────────────────────────────┐
                          │  Browser (/ootd)                │
                          │  mood · upload · feedback       │
                          └────────────┬───────────────────┘
                                       │
                          ┌────────────▼───────────────────┐
                          │  Vercel — Next.js App Router    │
                          │  /api/closet · /api/recommend   │
                          │  /api/feedback · /api/weather   │
                          └─┬─────────────┬──────────────┬──┘
                            │             │              │
              ┌─────────────▼──┐  ┌──────▼──────┐  ┌────▼──────────────┐
              │ Neon Postgres  │  │ Cloudinary  │  │ Railway (Docker)  │
              │ + pgvector     │  │ image CDN   │  │ FastAPI + ONNX RT │
              │  closet_items  │  │             │  │   /recommend      │
              │  rec_history   │  │             │  │   /analyze        │
              │  hyperparams   │  │             │  │                   │
              └────────────────┘  └─────────────┘  └───────────────────┘
```

---

## ML Pipeline

### Dual-encoder retrieval (the "vector DB" part)

A **text encoder** projects mood text into a 128-d embedding; an **item encoder** projects clothing attributes (category, color, material, style, …) into a 256-d embedding. All 85k catalog items are pre-encoded once into `item_embs.npy`, so retrieval at request time is a NumPy similarity lookup.

Both encoders were trained with **contrastive learning** — similar (mood, outfit) pairs pulled together, mismatched pairs pushed apart — so the final ranking reflects *semantic* fit rather than keyword overlap.

### 4-stage outfit composition

```
1. Candidate selection
   text-embedding similarity + season/temperature gating
   → top-7 per category (top / bottom / outer / dress)

2. Top-bottom pairing
   for every (top, bottom) candidate pair:
     score = α_tb · color_harmony(LAB) + (1 - α_tb) · embedding_sim
   → top-L pairs

3. Inner-set assembly
   merge top-bottom pairs + dresses into "inner" candidates

4. Outer + MMR rerank
   pair every (outer, inner) candidate; rerank with
   MMR (λ = mmr_lambda) for quality / diversity tradeoff
```

### Color harmony

Korean color names are mapped to CIE LAB and scored by analogous (ΔE), complementary (120°–180° hue), and neutrals (black / white / gray as universal matchers).

### Online feedback learning (bandit explore-exploit)

```
explore:  θ_used  = clip(θ_baseline + N(0, σ²),   bounds)
exploit:  θ_new   = clip(θ + η · (θ_used − θ),    bounds)    # 👍
          θ_new   = clip(θ − η · (θ_used − θ),    bounds)    # 👎
```

Each recommendation logs the noisy `θ_used` it ran with. When the user reacts, that `θ_used` is rewarded or penalized — the baseline drifts toward configurations the user actually likes.

### Image attribute extraction

An **EfficientNet-B0** classifier (ONNX, 16 MB) labels uploaded clothing images across 12 attributes (9 single-label + 3 multi-label), so users don't have to fill out a long form when adding an item.

---

## ML Server (FastAPI · ONNX Runtime · Docker)

The recommendation and image-analysis logic lives in a separate FastAPI service so the Next.js layer stays stateless. Key choices:

- **FastAPI + Pydantic** for typed request/response schemas (`ml-server/app/main.py`)
- **ONNX Runtime** instead of PyTorch at serve time → **6.6 GB → 0.8 GB Docker image** (~8× smaller), letting the service fit under Railway's free tier
- **Multi-stage Dockerfile** (`Dockerfile.ml`) — builder installs deps into a venv, runtime stage copies the venv + ONNX artifacts only
- **Uvicorn** as the ASGI server, port configurable via `$PORT` for Railway

Endpoints:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/recommend` | Run the 4-stage outfit pipeline |
| `POST` | `/analyze` | EfficientNet → 12 clothing attributes |
| `GET`  | `/health`   | Liveness check |

---

## Tech Stack

| Layer | Tools |
|---|---|
| **Frontend** | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Shadcn/ui · Radix |
| **API / BFF** | Next.js Route Handlers · Vercel |
| **ML server** | Python 3.10 · **FastAPI** · Pydantic · Uvicorn · **ONNX Runtime** |
| **Database** | Neon **PostgreSQL** · **pgvector** (cosine, IVFFlat) |
| **Storage / media** | Cloudinary CDN |
| **External** | OpenAI API (text embeddings) · WeatherAPI.com |
| **Infra** | **Docker** (multi-stage) · Railway · Vercel |

---

## Repo Structure

```
ootd_ai/
├── src/                          Next.js app (App Router)
│   ├── app/
│   │   ├── page.tsx              Landing
│   │   ├── ootd/page.tsx         Recommendation UI
│   │   └── api/                  Route handlers
│   │       ├── closet/           CRUD + upload
│   │       ├── recommend/        ML proxy
│   │       ├── feedback/         Hyperparam update
│   │       └── weather/          WeatherAPI proxy
│   ├── components/               UI + landing + ootd
│   └── lib/db/                   Neon + repository pattern
├── ml-server/                    FastAPI service
│   ├── app/
│   │   ├── main.py               FastAPI entrypoint
│   │   ├── predictor.py          4-stage recommendation
│   │   ├── match_harmony.py      Embedding + MMR
│   │   ├── color_harmony.py      LAB color scoring
│   │   └── efficientnet_*.py     Image classifier
│   └── requirements.txt
├── ml-recommendation/            Training code (PyTorch)
│   └── train/                    preprocess · tokenizer · train
├── model/                        ONNX artifacts (text/item encoders, item_embs)
├── database/schema.sql           PostgreSQL schema (incl. pgvector)
├── Dockerfile.ml                 ML server image (multi-stage)
├── docs/                         Detailed design + status docs
└── README.md
```

For the full system design (DB schema, hyperparameter ranges, deployment internals), see [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md).

---

## Local Development

**Prereqs:** Node 20+, Python 3.10+, a Neon database, Cloudinary + WeatherAPI keys.

```bash
# 1. Frontend
npm install
cp .env.example .env.local   # fill in DATABASE_URL, CLOUDINARY_*, WEATHERAPI_KEY, ML_SERVER_URL
npm run dev                  # http://localhost:3000

# 2. ML server (separate terminal)
cd ml-server
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. (optional) Run ML server in Docker
docker build -f Dockerfile.ml -t ootd-ml:latest .
docker run -p 8000:8000 ootd-ml:latest
```

Seed the catalog:

```bash
npm run bulk-seed
```

---

## Highlights

- **Vector-DB retrieval** with a dual-encoder trained via **contrastive learning** — the same retrieval pattern behind RAG systems
- **Production-aware ML serving**: PyTorch → ONNX migration cut the container image from 6.6 GB to 0.8 GB
- **Online learning loop**: bandit-style hyperparameter updates from real user 👍 / 👎 feedback
- **Full-stack ownership**: ML model · FastAPI service · Next.js app · Postgres schema · Docker / Vercel / Railway deployment

---

## Acknowledgements

Built within **YBIGTA** (Yonsei University data analytics society). Awarded **1st place** at the cohort showcase.
