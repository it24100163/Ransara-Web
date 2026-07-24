import requests

API_URL = "http://localhost:8080"

# Register a user
register_data = {
    "email": "testcheckout422@example.com",
    "password": "Password123!",
    "first_name": "Test",
    "last_name": "User",
    "phone_number": "0771234567"
}
requests.post(f"{API_URL}/auth/register", json=register_data)

# Login
login_data = {
    "username": "testcheckout422@example.com",
    "password": "Password123!"
}
res = requests.post(f"{API_URL}/auth/login", data=login_data)
if res.status_code != 200:
    print("Login failed:", res.text)
    exit(1)

token = res.json().get("access_token")

# Add to cart
headers = {"Authorization": f"Bearer {token}"}
requests.post(f"{API_URL}/cart/add", json={"batch_id": 1, "quantity": 1}, headers=headers)

# Checkout (Simulate Cart.jsx)
form_data = {
    "customer_name": "Test User",
    "delivery_type": "Store Pickup",
    "delivery_address": "Store Pickup",
    "delivery_lat": "0",
    "delivery_lng": "0",
    "distance_km": "0",
    "payment_method": "Card"
}

res = requests.post(f"{API_URL}/orders/checkout", data=form_data, headers=headers)
print(f"Status: {res.status_code}")
print(f"Response: {res.text}")

