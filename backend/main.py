from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from sqlalchemy import text
from sqlalchemy.orm import Session

from passlib.context import CryptContext

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import os


# ── Database ──────────────────────────────────────────────────────────────────
from database import engine, get_db, Base


# ── Routers ───────────────────────────────────────────────────────────────────
from routers.chat_router import router as chat_router
from routers.auth_router import router as auth_router
from routers.inventory_router import router as inventory_router
from routers.supplier_router import router as supplier_router
from routers.cart_router import router as cart_router
from routers.order_router import router as order_router
from routers.feedback_router import router as feedback_router
from routers.ml_router import router as ml_router
from routers.recommendation_router import router as recommendation_router
from routers.payment_router import router as payment_router


# ── WebSocket Manager ─────────────────────────────────────────────────────────
from websocket_manager import manager as ws_manager


# ── Models ────────────────────────────────────────────────────────────────────
# Import models so SQLAlchemy knows all tables.
from models import (
    orders,
    chat,
    cart,
    feedback,
    feedback_product,
    inventory,
    suppliers,
    user,
)


# ── Create Database Tables ────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)


# ── FastAPI Application ───────────────────────────────────────────────────────
app = FastAPI(title="Ransara Supermarket API")


# ── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app.state.limiter = limiter

app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler,
)


# ── Validation Error Handler ──────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    print(f"Validation Error for {request.url}: {exc.errors()}")
    print(f"Body: {exc.body}")

    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


# ── HTTP Error Handler ────────────────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request, exc):
    print(
        f"HTTP Exception at {request.url}: "
        f"{exc.status_code} - {exc.detail}"
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


# ── Static Files ──────────────────────────────────────────────────────────────
if os.path.exists("/app/pictures"):
    app.mount(
        "/pictures",
        StaticFiles(directory="/app/pictures"),
        name="pictures",
    )

if os.path.exists("/app/payment_slips"):
    app.mount(
        "/payment-slips",
        StaticFiles(directory="/app/payment_slips"),
        name="payment_slips",
    )


# ── CORS Configuration ────────────────────────────────────────────────────────
frontend_url = (
    os.environ
    .get("FRONTEND_PUBLIC_URL", "")
    .strip()
    .rstrip("/")
)

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://ransara-web.netlify.app",
]

if frontend_url and frontend_url not in allowed_origins:
    allowed_origins.append(frontend_url)

print(f"[CORS] Allowed origins: {allowed_origins}")


# ── Include Routers ───────────────────────────────────────────────────────────
app.include_router(chat_router)
app.include_router(auth_router)
app.include_router(inventory_router)
app.include_router(supplier_router)
app.include_router(cart_router)
app.include_router(order_router)
app.include_router(feedback_router)
app.include_router(ml_router)
app.include_router(recommendation_router)
app.include_router(payment_router)


# ── Seed Admin Account ────────────────────────────────────────────────────────
def seed_admin():
    from database import SessionLocal
    from models.user import User

    db = SessionLocal()

    try:
        admin_email = os.getenv(
            "ADMIN_EMAIL",
            "admin@ransara.com",
        )

        existing_admin = (
            db.query(User)
            .filter(User.email == admin_email)
            .first()
        )

        if existing_admin:
            print(
                f"[SEED] Admin account already exists: "
                f"{admin_email}"
            )
            return

        password_context = CryptContext(
            schemes=["bcrypt"],
            deprecated="auto",
        )

        admin_password = os.getenv("ADMIN_PASSWORD")

        if not admin_password:
            import secrets
            import string

            alphabet = (
                string.ascii_letters
                + string.digits
                + string.punctuation
            )

            admin_password = "".join(
                secrets.choice(alphabet)
                for _ in range(16)
            )

            print(
                "[SECURITY] ADMIN_PASSWORD is not set. "
                "A random admin password was generated."
            )

        admin = User(
            email=admin_email,
            password_hash=password_context.hash(admin_password),
            first_name=os.getenv(
                "ADMIN_FIRSTNAME",
                "Market",
            ),
            last_name=os.getenv(
                "ADMIN_LASTNAME",
                "Admin",
            ),
            role="admin",
            is_active=True,
        )

        db.add(admin)
        db.commit()

        print(
            f"[SEED] Admin account created: "
            f"{admin_email}"
        )

    except Exception as error:
        db.rollback()
        print(f"[SEED] Error seeding admin: {error}")

    finally:
        db.close()


# ── Application Startup ───────────────────────────────────────────────────────
@app.on_event("startup")
def startup_event():
    seed_admin()

    if not os.environ.get("BACKEND_PUBLIC_URL"):
        print(
            "[WARNING] BACKEND_PUBLIC_URL is not set. "
            "PayHere notify_url and product image URLs "
            "will default to http://localhost:8000. "
            "Set BACKEND_PUBLIC_URL to the Render backend URL."
        )

    import threading

    from database import SessionLocal
    from ml import forecaster

    def train_in_background():
        db = None

        try:
            db = SessionLocal()

            print("[ML] Background training started…")

            forecaster.train_forecaster(db)

            print("[ML] Background training complete.")

        except Exception as error:
            print(
                f"[ML] Background training failed: "
                f"{error}"
            )

        finally:
            if db is not None:
                db.close()

    threading.Thread(
        target=train_in_background,
        daemon=True,
    ).start()


# ── Admin WebSocket ───────────────────────────────────────────────────────────
@app.websocket("/ws/admin")
async def websocket_admin(
    websocket: WebSocket,
    token: str = Query(...),
):
    from routers.auth_router import get_current_user
    from database import SessionLocal

    db = SessionLocal()

    try:
        user_obj = get_current_user(
            token=token,
            db=db,
        )

        if user_obj.role != "admin":
            await websocket.close(code=4003)
            return

    except Exception:
        await websocket.close(code=4001)
        return

    finally:
        db.close()

    await ws_manager.connect_admin(websocket)

    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        ws_manager.disconnect_admin(websocket)


# ── Customer WebSocket ────────────────────────────────────────────────────────
@app.websocket("/ws/notifications")
async def websocket_customer(
    websocket: WebSocket,
    token: str = Query(...),
):
    from routers.auth_router import get_current_user
    from database import SessionLocal

    db = SessionLocal()

    try:
        user_obj = get_current_user(
            token=token,
            db=db,
        )

        user_id = user_obj.user_id

    except Exception:
        await websocket.close(code=4001)
        return

    finally:
        db.close()

    await ws_manager.connect_user(
        websocket,
        user_id,
    )

    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        ws_manager.disconnect_user(
            websocket,
            user_id,
        )


# ── Root Endpoint ──────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "message": (
            "Welcome to the "
            "Ransara Supermarket API backend!"
        )
    }


# ── Database Test Endpoint ────────────────────────────────────────────────────
@app.get("/test-db")
def test_database_connection(
    db: Session = Depends(get_db),
):
    try:
        db.execute(text("SELECT 1"))

        return {
            "status": "success",
            "message": (
                "Successfully connected "
                "to PostgreSQL!"
            ),
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=(
                "Database connection failed: "
                f"{str(error)}"
            ),
        )


# ── Global CORS Wrapper ───────────────────────────────────────────────────────
# Keep this section at the very bottom of this file.
# Do not add routes below this section.

app = CORSMiddleware(
    app=app,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)