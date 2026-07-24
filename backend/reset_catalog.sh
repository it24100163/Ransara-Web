#!/usr/bin/env bash
set -e

LOG_PREFIX="[reset-catalog]"
echo "$LOG_PREFIX Removing all existing products and related business data…"

python3 - <<'PY'
import os
import psycopg2

conn = psycopg2.connect(os.environ["DATABASE_URL"])
conn.autocommit = False

sql = """
TRUNCATE TABLE
    feedback_products,
    feedbacks,
    cart_items,
    carts,
    order_status_history,
    order_deliveries,
    order_items,
    orders,
    stock_batch_edit_history,
    stock_transactions,
    stock_batches,
    product_categories,
    products,
    supplier_edit_history,
    suppliers,
    categories
RESTART IDENTITY CASCADE;
"""

try:
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
    print("[reset-catalog] ✓ Products, categories, suppliers, stock, carts, orders and feedback were removed.")
    print("[reset-catalog] ✓ User/admin accounts were preserved.")
except Exception:
    conn.rollback()
    raise
finally:
    conn.close()
PY
