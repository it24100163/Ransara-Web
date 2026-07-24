from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import date

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: str 
    password: str 
    role: Optional[str] = "customer"

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        if not any(c in "!@#$%^&*()_+-=[]{}|;':,.<>/?`~" for c in v):
            raise ValueError('Password must contain at least one special character')
        return v

class UserProfileUpdate(BaseModel):
    first_name: str
    last_name: str
    phone_number: str

    @field_validator('phone_number')
    @classmethod
    def validate_phone(cls, v):
        import re
        v = v.strip()
        local = re.fullmatch(r'07\d{8}', v)
        intl  = re.fullmatch(r'\+\d{7,15}', v)
        if not local and not intl:
            raise ValueError(
                'Phone number must be a 10-digit local number (07XXXXXXXX) '
                'or a valid international number (+94XXXXXXXXX)'
            )
        return v

class UserAddressUpdate(BaseModel):
    house_no_lane: str
    street_name: str
    city: str
    postal_code: str

# --- NEW: Driver Schemas ---
class DriverCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone_number: str
    license_number: str
    vehicle_type: str
    assigned_city: str

    @field_validator('phone_number')
    @classmethod
    def validate_phone(cls, v):
        import re
        v = v.strip()
        local = re.fullmatch(r'07\d{8}', v)
        intl  = re.fullmatch(r'\+\d{7,15}', v)
        if not local and not intl:
            raise ValueError(
                'Phone number must be a 10-digit local number (07XXXXXXXX) '
                'or a valid international number (+94XXXXXXXXX)'
            )
        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        if not any(c in "!@#$%^&*()_+-=[]{}|;':,.<>/?`~" for c in v):
            raise ValueError('Password must contain at least one special character')
        return v

class DriverProfileResponse(BaseModel):
    driver_id: int
    license_number: str
    vehicle_type: str
    is_available: bool
    rating: float
    total_deliveries: int

    class Config:
        from_attributes = True

class DriverUserResponse(BaseModel):
    user_id: int
    first_name: str
    last_name: str
    email: str
    role: str
    driver_profile: Optional[DriverProfileResponse]

    class Config:
        from_attributes = True