from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db
from models.inventory import Product, Category, StockBatch, StockBatchEditHistory
from schemas.inventory import ProductCreate, KeywordRequest, StockBatchCreate, StockBatchUpdate
from pydantic import BaseModel
import uuid
import os
import cloudinary
import cloudinary.uploader
from sqlalchemy import func
from models.feedback import Feedback
from models.feedback_product import FeedbackProduct
from routers.auth_router import get_current_user, require_admin
from models.user import User

def get_cloudinary_public_id(image_url: str):
    if not image_url or "res.cloudinary.com" not in image_url:
        return None

    try:
        upload_part = image_url.split("/upload/")[1]
        parts = upload_part.split("/")

        if parts[0].startswith("v") and parts[0][1:].isdigit():
            parts = parts[1:]

        public_id_with_extension = "/".join(parts)
        public_id = os.path.splitext(public_id_with_extension)[0]

        return public_id

    except Exception:
        return None

cloudinary.config(
        cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
        api_key=os.environ.get("CLOUDINARY_API_KEY"),
        api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
        secure=True
    )

    

class CategoryCreate(BaseModel):
    name: str
    description: str = None
    discount_percentage: float = 0.0

    

router = APIRouter(prefix="/inventory", tags=["inventory"])

def get_product_rating_summary(db: Session, product_id: int):
    row = (
        db.query(
            func.avg(Feedback.rating).label("average_rating"),
            func.count(Feedback.id).label("rating_count")
        )
        .join(FeedbackProduct, FeedbackProduct.feedback_id == Feedback.id)
        .filter(FeedbackProduct.product_id == product_id)
        .first()
    )

    avg_rating = float(row.average_rating) if row and row.average_rating is not None else 0.0
    rating_count = int(row.rating_count) if row and row.rating_count is not None else 0

    return {
        "average_rating": round(avg_rating, 1),
        "rating_count": rating_count
    }

@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).all()

@router.post("/categories")
def create_category(
    cat: CategoryCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin)
):
    category_name = cat.name.strip()

    if not category_name:
        raise HTTPException(
            status_code=400,
            detail="Category name is required."
        )

    existing = (
        db.query(Category)
        .filter(func.lower(Category.name) == category_name.lower())
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Category already exists."
        )

    new_cat = Category(
        name=category_name,
        description=cat.description,
        discount_percentage=cat.discount_percentage or 0
    )

    try:
        db.add(new_cat)
        db.commit()
        db.refresh(new_cat)
        return new_cat

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.get("/products")
def get_products(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    products = db.query(Product).order_by(Product.id.desc()).offset(skip).limit(limit).all()
    results = []
    for p in products:
        # Get active batch or first
        batch = next((b for b in p.batches if b.current_quantity > 0), None)
        if not batch and p.batches:
            batch = p.batches[0]

        p_dict = {
            "id": p.id,
            "sku": p.sku,
            "product_name": p.product_name,
            "description": p.description,
            "image_url": p.image_url,
            "unit_of_measure": p.unit_of_measure,
            "keywords": p.keywords,
            "supplier_id": p.supplier_id,
            "category_name": p.categories[0].name if p.categories else "General",
            "category_ids": [c.id for c in p.categories],
            "buying_price": float(batch.buying_price) if batch else 0.0,
            "retail_price": float(batch.retail_price) if batch else 0.0,
            "current_quantity": float(batch.current_quantity) if batch else 0.0,
            "has_batch": batch is not None,
        }
        results.append(p_dict)
    return results

@router.get("/storefront/by-category")
def get_by_category(
    category: str,
    exclude_id: int = None,
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """Returns up to `limit` in-stock products from the same category, excluding one product."""
    products = db.query(Product).limit(1000).all()
    results = []
    for product in products:
        if exclude_id and product.id == exclude_id:
            continue
        # Check if product belongs to the requested category
        cat_names = [c.name for c in product.categories]
        if category not in cat_names:
            continue
        batch = next((b for b in product.batches if b.current_quantity > 0), None)
        if not batch:
            continue
        rating_summary = get_product_rating_summary(db, product.id)
        results.append({
            "primary_batch_id": batch.id,
            "group_key": product.id,
            "product_name": product.product_name,
            "category": category,
            "keywords": product.keywords or "",
            "price": float(batch.retail_price),
            "unit": product.unit_of_measure,
            "image": product.image_url or batch.image_url or "",
            "available_qty": batch.current_quantity,
            "average_rating": rating_summary["average_rating"],
            "rating_count": rating_summary["rating_count"],
        })
        if len(results) >= limit:
            break
    return results

@router.get("/storefront")
def get_storefront(db: Session = Depends(get_db)):
    products = db.query(Product).limit(1000).all()
    storefront_items = []
    for product in products:
        # Need active batch
        batch = next((b for b in product.batches if b.current_quantity > 0), None)
        if not batch and product.batches:
            batch = product.batches[0]
            
        if batch:
            cat_name = product.categories[0].name if product.categories else "General"
            rating_summary = get_product_rating_summary(db, product.id)
            storefront_items.append({
                "primary_batch_id": batch.id,
                "group_key": product.id,
                "product_name": product.product_name,
                "category": cat_name,
                "keywords": product.keywords or "",
                "price": float(batch.retail_price),
                "unit": product.unit_of_measure,
                "image": product.image_url or batch.image_url or "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23f3f4f6'/%3E%3Ctext x='75' y='85' text-anchor='middle' font-size='40' fill='%23d1d5db'%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E",
                "available_qty": batch.current_quantity,
                "average_rating": rating_summary["average_rating"],
                "rating_count": rating_summary["rating_count"]
                
            })
    return storefront_items

@router.get("/products/{product_id}/feedbacks")
def get_product_feedbacks(product_id: int, db: Session = Depends(get_db)):
    from models.feedback import Feedback
    from models.feedback_product import FeedbackProduct

    feedbacks = (
        db.query(Feedback)
        .join(FeedbackProduct, FeedbackProduct.feedback_id == Feedback.id)
        .filter(FeedbackProduct.product_id == product_id)
        .order_by(Feedback.created_at.desc())
        .all()
    )

    return [
        {
            "id": fb.id,
            "user_name": fb.user_name,
            "user_id": fb.user_id,
            "message": "This review is hidden due to inappropriate language." if fb.offensive else fb.message,
            "rating": fb.rating,
            "offensive": fb.offensive,
            "created_at": fb.created_at.isoformat() if fb.created_at else None,
            "reply": fb.reply,
            "selected_products_label": fb.selected_products_label,
            "applies_to_all": fb.applies_to_all,
        }
        for fb in feedbacks
    ]
@router.post("/products")
def create_product(product: ProductCreate, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    sku = product.sku if product.sku else f"SKU-{uuid.uuid4().hex[:8].upper()}"
    
    new_product = Product(
        product_name=product.product_name,
        sku=sku,
        description=product.description,
        image_url=product.image_url,
        unit_of_measure=product.unit_of_measure,
        keywords=product.keywords,
        supplier_id=product.supplier_id
    )
    
    if product.category_ids:
        categories = db.query(Category).filter(Category.id.in_(product.category_ids)).all()
        new_product.categories = categories

    db.add(new_product)
    db.commit()
    db.refresh(new_product)

    # Return a plain dict — avoids DetachedInstanceError from lazy-loaded relationships
    return {
        "id": new_product.id,
        "sku": new_product.sku,
        "product_name": new_product.product_name,
        "description": new_product.description,
        "image_url": new_product.image_url,
        "unit_of_measure": new_product.unit_of_measure,
        "keywords": new_product.keywords,
        "supplier_id": new_product.supplier_id,
        "category_ids": product.category_ids or [],
    }

@router.post("/generate-keywords")
def generate_keywords(req: KeywordRequest, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    # Admin-only keyword generator — uses product name/description to build hashtag keywords
    words = req.name.lower().split()
    if req.description:
        words += req.description.lower().split()
    
    # Filter out short words and take unique
    keywords = list(set([f"#{w.capitalize()}" for w in words if len(w) > 3]))
    return {"keywords": ", ".join(keywords[:5])}

@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can upload images"
        )

    allowed_mime_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    }

    if file.content_type not in allowed_mime_types:
        raise HTTPException(
            status_code=400,
            detail="Image must be JPEG, PNG, WEBP, or GIF"
        )

    file_content = await file.read()

    max_image_size = 5 * 1024 * 1024

    if len(file_content) > max_image_size:
        raise HTTPException(
            status_code=400,
            detail="Image must not exceed 5 MB"
        )

    try:
        upload_result = cloudinary.uploader.upload(
            file_content,
            folder="ransara-products",
            resource_type="image",
            transformation=[
                {
                    "width": 1200,
                    "height": 1200,
                    "crop": "limit",
                    "quality": "auto",
                    "fetch_format": "auto"
                }
            ]
        )

        print("UPLOAD RESULT:", upload_result)

        return {
            "image_url": upload_result["secure_url"],
            "public_id": upload_result["public_id"]
        }

    except Exception as error:
        print("CLOUDINARY ERROR:", repr(error))

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )
@router.put("/products/{product_id}")
def update_product(
    product_id: int,
    product: ProductCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin)
):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    db_product.product_name = product.product_name
    db_product.description = product.description
    old_image_url = db_product.image_url
    new_image_url = product.image_url

    if (
        new_image_url
        and old_image_url
        and new_image_url != old_image_url
   ):
        old_public_id = get_cloudinary_public_id(old_image_url)

        if old_public_id:
            try:
                cloudinary.uploader.destroy(old_public_id)
            except Exception as error:
                print(f"Could not delete old Cloudinary image: {error}")

    db_product.image_url = new_image_url
    db_product.unit_of_measure = product.unit_of_measure
    db_product.keywords = product.keywords
    db_product.supplier_id = product.supplier_id

    if product.category_ids is not None:
        categories = db.query(Category).filter(Category.id.in_(product.category_ids)).all()
        db_product.categories = categories

    db.commit()
    db.refresh(db_product)
    
    return {
        "id": db_product.id,
        "sku": db_product.sku,
        "product_name": db_product.product_name,
        "description": db_product.description,
        "image_url": db_product.image_url,
        "unit_of_measure": db_product.unit_of_measure,
        "keywords": db_product.keywords,
        "supplier_id": db_product.supplier_id,
        "category_ids": product.category_ids or [],
    }

@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete products")
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    public_id = get_cloudinary_public_id(product.image_url)

    if public_id:
        try:
            cloudinary.uploader.destroy(public_id)
        except Exception as error:
            print(f"Could not delete Cloudinary image: {error}")

    db.delete(product)
    db.commit()
    return {"message": "Product deleted"}

@router.get("/products/{product_id}/batches")
def get_product_batches(product_id: int, db: Session = Depends(get_db)):
    return db.query(StockBatch).filter(StockBatch.product_id == product_id).all()

@router.post("/batches")
def create_batch(batch: StockBatchCreate, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    db_batch = StockBatch(**batch.model_dump() if hasattr(batch, 'model_dump') else batch.dict())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch

@router.put("/batches/{batch_id}")
def update_batch(batch_id: int, batch: StockBatchUpdate, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    db_batch = db.query(StockBatch).filter(StockBatch.id == batch_id).first()
    if not db_batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    changes = []
    if batch.buying_price is not None and db_batch.buying_price != batch.buying_price:
        changes.append(f"buying_price: {db_batch.buying_price} -> {batch.buying_price}")
        db_batch.buying_price = batch.buying_price
    if batch.retail_price is not None and db_batch.retail_price != batch.retail_price:
        changes.append(f"retail_price: {db_batch.retail_price} -> {batch.retail_price}")
        db_batch.retail_price = batch.retail_price
    if batch.current_quantity is not None and db_batch.current_quantity != batch.current_quantity:
        changes.append(f"quantity: {db_batch.current_quantity} -> {batch.current_quantity}")
        db_batch.current_quantity = batch.current_quantity
        
    if changes:
        history = StockBatchEditHistory(
            batch_id=db_batch.id,
            edited_by=_admin.user_id,
            changes=", ".join(changes)
        )
        db.add(history)

    db.commit()
    db.refresh(db_batch)
    return db_batch

@router.get("/batches/{batch_id}/history")
def get_batch_history(batch_id: int, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    return db.query(StockBatchEditHistory).filter(StockBatchEditHistory.batch_id == batch_id).order_by(StockBatchEditHistory.timestamp.desc()).all()
