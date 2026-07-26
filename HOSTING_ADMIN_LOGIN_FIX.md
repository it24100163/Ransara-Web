# Hosted Admin Login Fix

Set these environment variables on the hosted BACKEND service:

ADMIN_EMAIL=admin@ransara.com
ADMIN_PASSWORD=choose-a-strong-password
ADMIN_FIRSTNAME=Market
ADMIN_LASTNAME=Admin
JWT_SECRET_KEY=use-a-long-random-secret
FRONTEND_PUBLIC_URL=https://YOUR-FRONTEND-DOMAIN
DATABASE_URL=your-production-postgresql-url

Set this build environment variable on the hosted FRONTEND service, then redeploy/rebuild:

VITE_API_URL=https://YOUR-BACKEND-DOMAIN

Important: Vite variables are embedded at build time. Changing VITE_API_URL without rebuilding the frontend will not update the deployed website.

After deploying this fixed backend, startup will repair an existing ADMIN_EMAIL row by:
- changing its role to admin,
- activating it,
- and updating its password to ADMIN_PASSWORD when provided.
