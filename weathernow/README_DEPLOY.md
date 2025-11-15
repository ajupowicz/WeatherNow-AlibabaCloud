# WeatherNow — Deployment Guide (Alibaba Cloud)

This guide deploys WeatherNow with **OSS (frontend)** + **Function Compute (backend)**.

> Runtime tested with Python 3.9. Use HTTP Trigger.

---

## 1) Prepare OpenWeatherMap API key
- Create API key at https://openweathermap.org/api
- Keep it as `OPENWEATHER_API_KEY`

---

## 2) Backend — Function Compute
1. **Create Service** → name `weathernow-svc`.
2. **Create Function**:
   - Runtime: **Python 3.9**
   - Trigger: **HTTP Trigger** (GET, OPTIONS)
   - Handler: **index.handler**
   - Code upload: zip from `/backend` folder, or upload whole project and set working dir.
   - Environment variable: `OPENWEATHER_API_KEY=<your_key>`
3. **CORS**: In code it returns `Access-Control-Allow-Origin: *`.
4. **Save URL**: copy the function public endpoint (e.g. `https://<account>.<region>.fcapp.run`).
   - Your full API endpoint will be: `https://<...>/weather?city=Katowice`

> Test in console:
```
curl -i "https://<...>.fcapp.run/weather?city=Katowice"
```

---

## 3) Frontend — OSS Static Website
1. **Create OSS bucket** (Region close to you, e.g., `eu-central-1`), ACL: **Public Read**.
2. **Enable Static Website Hosting**:
   - Index document: `index.html`
3. **Upload files** from `/frontend` (`index.html`, `style.css`, `app.js`).
4. **Configure backend URL** in `index.html`:
   - Set `window.BACKEND_BASE_URL = "https://<...>.fcapp.run";`
5. Access the **Static Website URL** from OSS and open it.

---

## 4) Optional — Geo blocking (RU, TH, CN)
Use **Alibaba Cloud WAF** (or Cloud Firewall for egress) in front of Function Compute or OSS:
- Create a policy → **Geo restriction** → block **Russia, Thailand, China**.
- Bind the WAF to your function custom domain / OSS static site.

> Simpler alternative: if you use **CDN** in front of OSS, set Geo-Blocking rule in CDN.

---

## 5) Architecture Diagram (ASCII)

```
+-------------+         GET /weather?city=...           +---------------------+
|  Browser    |  ------------------------------------>  |  Function Compute   |
|  (OSS site) |                                         |  Python 3.9 (Flask) |
+------+------+                                         +-----------+---------+
       |                                                              |
       |  Static HTML/CSS/JS (public)                                 |  HTTPS
       |                                                              v
       |                                                   +---------------------+
       |                                                   | OpenWeatherMap API  |
       |                                                   +---------------------+
       v
+-------------+
|  OSS Bucket |
| Static Host |
+-------------+
```

---

## 6) Local development
Backend:
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export OPENWEATHER_API_KEY=YOUR_KEY
python index.py  # http://localhost:8000/weather?city=Warsaw
```
Frontend:
- Open `frontend/index.html` in browser
- Or serve statically: `python -m http.server 8080`
- For cross-origin local test set:
  ```html
  <script>window.BACKEND_BASE_URL="http://localhost:8000";</script>
  ```

---

## 7) Troubleshooting
- **401/403**: check API key and Function Compute permissions.
- **404 city not found**: verify city spelling.
- **CORS**: ensure you call the function URL and not OSS domain on `/weather`.
- **Timeouts**: Function Compute timeout ≥ 10s; retries off for idempotent GET.
- **Icons**: OWM icons served from `openweathermap.org` (allow external images).

---

## 8) Presenting at University
- Explain serverless: static frontend (OSS) + scalable backend (Function Compute).
- Show request flow with DevTools → Network.
- Demo input validation & error states.
