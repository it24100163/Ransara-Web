import requests

API_URL = "http://localhost:8000"

login_data = {
    "username": "sanda@gmail.com",
    "password": "Password123!"
}
res = requests.post(f"{API_URL}/auth/login", data=login_data)
if res.status_code != 200:
    print("Login failed!")
    exit(1)
token = res.json().get("access_token")

headers = {"Authorization": f"Bearer {token}"}

form_data = {
    "customer_name": "Sanda Neethanjali",
    "delivery_type": "Home Delivery",
    "delivery_address": "WRRW+GF4, Colombo, Sri Lanka",
    "delivery_lat": "6.9271",
    "delivery_lng": "79.8612",
    "distance_km": "5.5",
    "payment_method": "Cash on Delivery"
}

res = requests.post(f"{API_URL}/orders/checkout", data=form_data, headers=headers)
print(f"Status: {res.status_code}")
print(f"Response: {res.text}")

