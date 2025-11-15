# WeatherNow Backend

Python 3.9 Flask app for Alibaba Cloud Function Compute.

## Endpoints
- `GET /weather?city=<name>` → `{ "city": "...", "temperature": 12.3, "humidity": 68, "description": "clear sky", "icon": "https://openweathermap.org/img/wn/01d.png" }`

## Environment
- `OPENWEATHER_API_KEY` (required)

## Local Run
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export OPENWEATHER_API_KEY=YOUR_KEY
python index.py  # http://localhost:8000/weather?city=Katowice
```
