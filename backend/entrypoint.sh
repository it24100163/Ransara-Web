#!/usr/bin/env bash
# =============================================================================
# entrypoint.sh  —  Ransara Supermarket Backend Startup
# =============================================================================
# This script is the single entrypoint for the backend Docker container.
#
# What it does:
#   1. Waits for PostgreSQL to be ready
#   2. Runs Alembic migrations (schema-only, always safe to re-run)
#   3. Checks whether the database already has historical data
#   4. If EMPTY  → runs the full 6-step ML pipeline automatically:
#                   clean → features → seed DB → train → select best model
#   5. If SEEDED → skips the pipeline (subsequent starts are instant)
#   6. Starts uvicorn with 4 workers for high-throughput production serving
#
# No manual steps needed on a fresh machine — just `docker compose up`.
# =============================================================================

set -e

SCRIPTS="/app/ml/scripts"
LOG_PREFIX="[startup]"

# ─────────────────────────────────────────────────────────────────────────────
# 1. Wait for Postgres
# ─────────────────────────────────────────────────────────────────────────────
echo "$LOG_PREFIX Waiting for PostgreSQL…"
MAX_TRIES=30
COUNT=0
until python3 -c "
import os, psycopg2, sys
try:
    conn = psycopg2.connect(os.environ['DATABASE_URL'], connect_timeout=3)
    conn.close()
    sys.exit(0)
except Exception as e:
    print(e)
    sys.exit(1)
" ; do
    
    COUNT=$((COUNT + 1))
    if [ "$COUNT" -ge "$MAX_TRIES" ]; then
        echo "$LOG_PREFIX ✗ PostgreSQL not available after ${MAX_TRIES}s — aborting."
        exit 1
    fi
    echo "$LOG_PREFIX   … still waiting (${COUNT}/${MAX_TRIES})"
    sleep 1
done
echo "$LOG_PREFIX ✓ PostgreSQL is ready."

# ─────────────────────────────────────────────────────────────────────────────
# 2. Apply DB migrations
# ─────────────────────────────────────────────────────────────────────────────
echo "$LOG_PREFIX Running database migrations…"
python3 -c "
import sys; sys.path.insert(0, '/app')
from database import engine, Base
# Import all models so SQLAlchemy metadata is fully populated
import models.user, models.inventory, models.orders, models.suppliers
import models.feedback, models.feedback_product, models.cart, models.chat
Base.metadata.create_all(bind=engine)
print('  Tables OK.')
" 2>&1

# ─── Column migrations (idempotent ALTER TABLE for new columns) ──────────────
echo "$LOG_PREFIX Running column migrations…"
python3 -c "
import sys; sys.path.insert(0, '/app')
from sqlalchemy import text
from database import engine

migrations = [
    # Add rating_count to drivers if not present (added in v2 audit)
    '''ALTER TABLE drivers ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;''',
    # SEC-2: OTP brute-force protection counter (added in v3 audit)
    '''ALTER TABLE orders ADD COLUMN IF NOT EXISTS otp_attempts INTEGER NOT NULL DEFAULT 0;''',
    # BUG-6: Admin messages table for chat rate-limit fallback (added in v3 audit)
    '''CREATE TABLE IF NOT EXISTS admin_messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        subject VARCHAR(255) NOT NULL,
        message VARCHAR(2000) NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );''',
]
with engine.connect() as conn:
    for stmt in migrations:
        try:
            conn.execute(text(stmt))
            conn.commit()
        except Exception as e:
            print(f'  Migration notice: {e}')
print('  Column migrations OK.')
" 2>&1

# ─────────────────────────────────────────────────────────────────────────────
# 3. Optional historical data / ML pipeline
# ─────────────────────────────────────────────────────────────────────────────
# Historical products and orders must NOT be inserted automatically.
# Set AUTO_SEED_HISTORICAL_DATA=true only when you intentionally want to rebuild
# the demo/historical dataset. The default is false.
AUTO_SEED_HISTORICAL_DATA="${AUTO_SEED_HISTORICAL_DATA:-false}"

if [ "$AUTO_SEED_HISTORICAL_DATA" = "true" ]; then
    echo "$LOG_PREFIX AUTO_SEED_HISTORICAL_DATA=true — running ML pipeline…"

    echo "$LOG_PREFIX ── Step 1/6: Cleaning selling data"
    python3 "$SCRIPTS/01_clean_selling.py"

    echo "$LOG_PREFIX ── Step 2/6: Parsing buying invoices"
    python3 "$SCRIPTS/02_clean_buying.py"

    echo "$LOG_PREFIX ── Step 3/6: Building training features"
    python3 "$SCRIPTS/03_build_features.py"

    echo "$LOG_PREFIX ── Step 4/6: Seeding historical orders into PostgreSQL"
    python3 "$SCRIPTS/04_seed_historical_data.py"

    echo "$LOG_PREFIX ── Step 5/6: Training forecasting models"
    python3 "$SCRIPTS/05_train_models.py"

    echo "$LOG_PREFIX ── Step 6/6: Selecting best model"
    python3 "$SCRIPTS/06_select_best_model.py"

    echo "$LOG_PREFIX ✓ ML pipeline complete!"
else
    echo "$LOG_PREFIX ✓ Historical auto-seeding is disabled. Starting with your own data only."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 4. Start the API server
#    4 workers = parallelism for the heavy /orders/ and /ml/ endpoints.
#    Use --reload only in dev (detected via ENV). In production keep workers.
# ─────────────────────────────────────────────────────────────────────────────
echo "$LOG_PREFIX Starting Uvicorn (4 workers)…"
exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers 2 \
    --timeout-keep-alive 75
