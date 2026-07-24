from fastapi import FastAPI, Form, UploadFile, File
from fastapi.testclient import TestClient
from typing import Optional

app = FastAPI()

@app.post("/checkout")
def checkout(
    customer_name: str = Form(...),
    delivery_type: str = Form("Home Delivery"),
    delivery_address: str = Form(""),
    delivery_lat: Optional[float] = Form(0.0),
    delivery_lng: Optional[float] = Form(0.0),
    distance_km: Optional[float] = Form(0.0),
    payment_method: str = Form("Card"),
    payment_slip: Optional[UploadFile] = File(None),
):
    return "OK"

client = TestClient(app)

res = client.post("/checkout", data={
    "customer_name": "Test User",
    "delivery_type": "Store Pickup",
    "delivery_address": "Store Pickup",
    "delivery_lat": "0",
    "delivery_lng": "0",
    "distance_km": "0",
    "payment_method": "Card"
})
print("Test 1 (Normal):", res.status_code, res.json())

res = client.post("/checkout", data={
    "customer_name": "",
    "delivery_type": "Store Pickup",
    "delivery_address": "Store Pickup",
    "delivery_lat": "0",
    "delivery_lng": "0",
    "distance_km": "0",
    "payment_method": "Card"
})
print("Test 2 (Empty name):", res.status_code, res.json())

res = client.post("/checkout", data={
    "customer_name": "Test User",
    "delivery_type": "Store Pickup",
    "delivery_address": "Store Pickup",
    "delivery_lat": "NaN",
    "delivery_lng": "NaN",
    "distance_km": "NaN",
    "payment_method": "Card"
})
print("Test 3 (NaN):", res.status_code, res.json())

res = client.post("/checkout", data={
    "customer_name": "Test User",
    "delivery_type": "Store Pickup",
    "delivery_address": "Store Pickup",
    "payment_method": "Card"
})
print("Test 4 (Missing optional floats):", res.status_code, res.json())
