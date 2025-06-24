import requests

API_URL = "https://www.uavforecast.com/api/v1/forecast"
API_KEY = "test-s2SYt1vqS4BNKfLqffyDCbY6Z1Yo2Kmi"

# Request payload
payload = {
    "lat": 21.409,  # Honolulu, Hawaii
    "lon": -157.961,
    "forecast_hours": 24,
    "wind_altitudes_m": [10, 100, 200],
    "gps_elevation_mask": 5,
}

# HTTP headers
headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

# Send request
response = requests.post(API_URL, json=payload, headers=headers)

# Handle response
if response.status_code == 200:
    data = response.json()
    print("Forecast received:")
    print(data)
else:
    status_code = response.status_code
    message = response.json()["detail"]
    print("Error response:")
    print(f"Status code: {status_code}")
    print(f"Message: {message}")
