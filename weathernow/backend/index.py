"""
WeatherNow backend for Alibaba Cloud Function Compute (Python 3.9).
- HTTP endpoint: GET /weather?city=<name>
- Uses OpenWeatherMap; API key from env OPENWEATHER_API_KEY.
- Works locally via Flask dev server (`python index.py`).
- Works on Function Compute: export `handler(environ, start_response)`.
"""
import json
import os
from typing import Any, Dict, Tuple
from urllib.parse import quote_plus

import requests
from flask import Flask, jsonify, request, make_response

APP = Flask(__name__)

def build_icon_url(code: str) -> str:
    return f"https://openweathermap.org/img/wn/{code}.png"

def fetch_weather(city: str, api_key: str) -> Dict[str, Any]:
    url = (
        "https://api.openweathermap.org/data/2.5/weather"
        f"?q={quote_plus(city)}&appid={api_key}&units=metric&lang=en"
    )
    r = requests.get(url, timeout=10)
    # Raise for HTTP errors to unify error handling
    r.raise_for_status()
    payload = r.json()
    # Map payload
    main = payload.get("main") or {}
    weather = (payload.get("weather") or [{}])[0]
    wind = payload.get("wind") or {}
    return {
        "city": payload.get("name") or city,
        "temperature": float(main.get("temp")) if main.get("temp") is not None else None,
        # feels_like: perceived temperature (same units as temp)
        "feels_like": float(main.get("feels_like")) if main.get("feels_like") is not None else None,
        "humidity": int(main.get("humidity")) if main.get("humidity") is not None else None,
        # wind speed in m/s (OpenWeather returns wind.speed)
        "wind_speed": float(wind.get("speed")) if wind.get("speed") is not None else None,
        "description": weather.get("description") or "",
        "icon": build_icon_url(weather.get("icon") or "01d"),
    }

@APP.after_request
def add_cors(resp):
    # CORS for OSS-hosted frontend
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp

@APP.route("/weather", methods=["GET", "OPTIONS"])
def weather() -> Tuple[Any, int]:
    if request.method == "OPTIONS":
        return make_response(("", 204))
    api_key = os.environ.get("OPENWEATHER_API_KEY", "").strip()
    if not api_key:
        return jsonify({"error": "Missing OPENWEATHER_API_KEY"}), 500
    city = (request.args.get("city") or "").strip()
    if not city:
        return jsonify({"error": "Missing 'city' parameter"}), 400
    try:
        data = fetch_weather(city, api_key)
        return jsonify(data), 200
    except requests.HTTPError as http_err:
        # OpenWeather returns 404 for unknown city
        status = http_err.response.status_code if http_err.response is not None else 502
        message = http_err.response.text if http_err.response is not None else str(http_err)
        # Avoid leaking provider details, keep it simple for client
        if status == 404:
            return jsonify({"error": "city not found"}), 404
        return jsonify({"error": "upstream error"}), status
    except requests.RequestException:
        return jsonify({"error": "network error"}), 502
    except Exception as exc:  # noqa: BLE001
        # Log in Function Compute logs; keep message generic in response
        print("Unexpected error:", repr(exc))
        return jsonify({"error": "internal error"}), 500

# Alibaba Function Compute entrypoint
def handler(environ, start_response):
    # Delegate to Flask WSGI app for HTTP trigger
    return APP.wsgi_app(environ, start_response)

if __name__ == "__main__":
    # Local dev server
    port = int(os.environ.get("PORT", "8000"))
    APP.run(host="0.0.0.0", port=port)
