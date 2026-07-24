import requests

API_URL = "http://localhost:8080"

# Register a user
register_data = {
    "email": "testcheckout400_new@example.com",
    "password": "Password123!",
    "first_name": "Test",
    "last_name": "User",
    "phone_number": "0771234567"
}
requests.post(f"{API_URL}/auth/register", json=register_data)

# Login
login_data = {
    "username": "testcheckout400_new@example.com",
    "password": "Password123!"
}
res = requests.post(f"{API_URL}/auth/login", data=login_data)
token = res.json().get("access_token")

# Add to cart
headers = {"Authorization": f"Bearer {token}"}
requests.post(f"{API_URL}/cart/add", json={"batch_id": 1, "quantity": 1}, headers=headers)

# Checkout
form_data = {
    "customer_name": "Sanda Neethanjali",
    "delivery_type": "Home Delivery",
    "delivery_address": "WRRW+GF4, Colombo, Sri Lanka",
    "delivery_lat": "0",
    "delivery_lng": "0",
    "distance_km": "0",
    "payment_method": "Cash on Delivery"
}

res = requests.post(f"{API_URL}/orders/checkout", data=form_data, headers=headers)
print(f"Status: {res.status_code}")
print(f"Response: {res.text}")

