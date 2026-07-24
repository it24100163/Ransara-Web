from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    discount_percentage: float = Field(default=0.0, ge=0.0, le=100.0)

class CategoryCreate(CategoryBase):
    pass

class ProductBase(BaseModel):
    product_name: str
    sku: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    unit_of_measure: str = "Units"
    keywords: Optional[str] = None
    supplier_id: int
    category_ids: List[int] = []

class ProductCreate(ProductBase):
    pass

class KeywordRequest(BaseModel):
    name: str
    description: Optional[str] = None

class StockBatchCreate(BaseModel):
    product_id: int
    batch_number: Optional[str] = None
    buying_price: float = Field(..., ge=0.0)
    retail_price: float = Field(..., ge=0.0)
    current_quantity: float = Field(..., ge=0.0)
    unit_weight_kg: Optional[float] = Field(default=None, ge=0.0)
    manufacture_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    image_url: Optional[str] = None

class StockBatchUpdate(BaseModel):
    buying_price: Optional[float] = Field(default=None, ge=0.0)
    retail_price: Optional[float] = Field(default=None, ge=0.0)
    current_quantity: Optional[float] = Field(default=None, ge=0.0)
