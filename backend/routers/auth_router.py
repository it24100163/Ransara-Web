from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
from models.user import User, Address, Driver
from schemas.user import UserCreate, UserProfileUpdate, UserAddressUpdate, DriverCreate
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests
import os
from slowapi import Limiter
from slowapi.util import get_remote_address

class RateDriverRequest(BaseModel):
    rating: float

router = APIRouter(prefix="/users", tags=["users"])
limiter = Limiter(key_func=get_remote_address)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise RuntimeError(
        "JWT_SECRET_KEY is not set or too short (< 32 chars). "
        "Set JWT_SECRET_KEY in .env to a strong 32+ character secret key. "
        "Example: JWT_SECRET_KEY=your-secure-random-key-here-with-32-chars-minimum"
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    user = db.query(User).filter(User.user_id == user_id).first()
    if user is None or not user.is_active or user.is_deleted:
        raise credentials_exception
    return user

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ── Admin: list all drivers (PII-filtered) ────────────────────────────────────
@router.get("/drivers")
def get_all_drivers(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    users = db.query(User).filter(User.role == "driver", User.is_deleted == False).all()
    res = []
    for u in users:
        dp = u.driver_profile
        res.append({
            "user_id": u.user_id, "first_name": u.first_name,
            "last_name": u.last_name, "email": u.email,
            "phone_number": u.phone_number, "is_active": u.is_active,
            "driver_profile": {
                "license_number": dp.license_number,
                "vehicle_type": dp.vehicle_type,
                "is_available": dp.is_available,
                "rating": dp.rating,
                "total_deliveries": dp.total_deliveries
            } if dp else None
        })
    return res

# ── Register ──────────────────────────────────────────────────────────────────
@router.post("/register")
@limiter.limit("10/hour")
def register_user(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = pwd_context.hash(user.password)
    new_user = User(
        email=user.email,
        password_hash=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
        role="customer",  # SECURITY: role is always customer — never trust client input
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully", "user_id": new_user.user_id}

# ── Login ─────────────────────────────────────────────────────────────────────
@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # me login session eke start time save karanawa
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.user_id, "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "is_active": user.is_active,
        "user": {"id": user.user_id, "email": user.email, "name": f"{user.first_name} {user.last_name}"},
    }

class GoogleLoginRequest(BaseModel):
    credential: str

@router.post("/google-login")
@limiter.limit("20/minute")
def google_login(request: Request, body: GoogleLoginRequest, db: Session = Depends(get_db)):
    try:
        client_id = os.getenv("GOOGLE_AUTH_CLIENT_ID")
        if not client_id:
            raise HTTPException(status_code=500, detail="Google OAuth not configured. Set GOOGLE_AUTH_CLIENT_ID in .env")
        idinfo = id_token.verify_oauth2_token(body.credential, requests.Request(), client_id)
        
        email = idinfo.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Google token missing email")

        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            # Create new user
            import secrets as _secrets
            first_name = idinfo.get("given_name", "Google")
            last_name = idinfo.get("family_name", "User")
            # Use a cryptographically random placeholder — OAuth users cannot log in via password
            random_password = pwd_context.hash(_secrets.token_hex(32))
            
            user = User(
                email=email,
                password_hash=random_password,
                first_name=first_name,
                last_name=last_name,
                role="customer",
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        user.last_login = datetime.now(timezone.utc)
        db.commit()
        
        access_token = create_access_token(
            data={"sub": user.email, "user_id": user.user_id, "role": user.role},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": user.role,
            "is_active": user.is_active,
            "user": {"id": user.user_id, "email": user.email, "name": f"{user.first_name} {user.last_name}"},
        }
    except ValueError as e:
        print(f"Google login error: {e}")
        raise HTTPException(status_code=400, detail="Invalid Google token")

# ── Me ────────────────────────────────────────────────────────────────────────
@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    addr = current_user.addresses[0] if current_user.addresses else None
    return {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "phone_number": current_user.phone_number,
        "address": {
            "house_no_lane": addr.house_no_lane,
            "street_name": addr.street_name,
            "city": addr.city,
            "postal_code": addr.postal_code
        } if addr else None,
        "name": f"{current_user.first_name} {current_user.last_name}",
        "role": current_user.role,
        "is_active": current_user.is_active,
    }

@router.put("/me")
def update_my_profile(profile: UserProfileUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check for phone number uniqueness before committing
    if profile.phone_number and profile.phone_number != current_user.phone_number:
        existing = db.query(User).filter(
            User.phone_number == profile.phone_number,
            User.user_id != current_user.user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="This phone number is already registered to another account")
    current_user.first_name = profile.first_name
    current_user.last_name = profile.last_name
    current_user.phone_number = profile.phone_number
    db.commit()
    db.refresh(current_user)
    return {"message": "Profile updated successfully"}

@router.put("/me/address")
def update_my_address(address_data: UserAddressUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    addr = db.query(Address).filter(Address.user_id == current_user.user_id, Address.is_default == True).first()
    if not addr:
        addr = Address(user_id=current_user.user_id, is_default=True)
        db.add(addr)
    addr.house_no_lane = address_data.house_no_lane
    addr.street_name = address_data.street_name
    addr.city = address_data.city
    addr.postal_code = address_data.postal_code
    db.commit()
    return {"message": "Address updated successfully"}

# ── Admin: List All Users ─────────────────────────────────────────────────────
@router.get("/")
def list_users(skip: int = 0, limit: int = 200, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    users = db.query(User).filter(User.is_deleted == False).offset(skip).limit(limit).all()
    return [
        {
            "user_id": u.user_id,
            "email": u.email,
            "name": f"{u.first_name or ''} {u.last_name or ''}".strip(),
            "first_name": u.first_name,
            "last_name": u.last_name,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": str(u.last_login) if u.last_login else None,
        }
        for u in users
    ]

# ── Admin: User Stats ─────────────────────────────────────────────────────────
@router.get("/stats")
def user_stats(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    total = db.query(User).filter(User.is_deleted == False).count()
    active = db.query(User).filter(User.is_deleted == False, User.is_active == True).count()
    admins = db.query(User).filter(User.is_deleted == False, User.role == "admin").count()
    customers = db.query(User).filter(User.is_deleted == False, User.role == "customer").count()
    return {"total": total, "active": active, "admins": admins, "customers": customers}

# ── Admin: Toggle Active ──────────────────────────────────────────────────────
@router.put("/{user_id}/status")
def toggle_user_status(user_id: int, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    if user_id == _admin.user_id:
        raise HTTPException(status_code=400, detail="Admins cannot suspend themselves")
    user = db.query(User).filter(User.user_id == user_id, User.is_deleted == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    return {"user_id": user_id, "is_active": user.is_active}

# ── Admin: Delete User ────────────────────────────────────────────────────────
@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    if user_id == _admin.user_id:
        raise HTTPException(status_code=400, detail="Admins cannot delete themselves")
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_deleted = True
    user.is_active = False # Keep them suspended too
    db.commit()
    return {"message": "User soft deleted"}

@router.post("/register-driver")
def register_driver(driver_data: DriverCreate, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    existing_user = db.query(User).filter(User.email == driver_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    new_user = User(
        email=driver_data.email,
        password_hash=pwd_context.hash(driver_data.password),
        first_name=driver_data.first_name,
        last_name=driver_data.last_name,
        phone_number=driver_data.phone_number,
        role="driver"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    new_driver_profile = Driver(
        user_id=new_user.user_id,
        license_number=driver_data.license_number,
        vehicle_type=driver_data.vehicle_type,
        assigned_city=driver_data.assigned_city
    )
    db.add(new_driver_profile)
    db.commit()
    
    return {"message": "Driver registered successfully"}

@router.post("/drivers/{driver_id}/rate")
def rate_driver(
    driver_id: int,
    request: RateDriverRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models.orders import Order
    # Ensure the current user has actually received a delivery from this driver
    delivered_order = db.query(Order).filter(
        Order.user_id == current_user.user_id,
        Order.driver_id == driver_id,
        Order.current_status == "Delivered"
    ).first()
    if not delivered_order:
        raise HTTPException(
            status_code=403,
            detail="You can only rate a driver after a completed delivery"
        )
    if request.rating < 1.0 or request.rating > 5.0:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    driver = db.query(Driver).filter(Driver.user_id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    # Use a dedicated rating_count for accurate weighted average
    old_count = driver.rating_count or 0
    driver.rating = round(((driver.rating * old_count) + request.rating) / (old_count + 1), 1)
    driver.rating_count = old_count + 1
    db.commit()
    return {"message": "Driver rated successfully"}
