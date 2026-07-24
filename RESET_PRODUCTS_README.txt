ONE-TIME RESET COMMAND
======================

Run this from the project root:

docker compose exec backend ./reset_catalog.sh

Then restart only the backend:

docker compose restart backend

Historical/demo products will NOT return because AUTO_SEED_HISTORICAL_DATA=false
and entrypoint.sh no longer seeds data automatically.

User and admin accounts are preserved.
