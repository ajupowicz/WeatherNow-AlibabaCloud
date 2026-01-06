(function(){
  const $ = (sel) => document.querySelector(sel);
  const cityInput = $("#city");
  const btn = $("#checkBtn");
  const alertBox = $("#alert");
  const result = $("#result");
  const rCity = $("#r-city");
  const rDesc = $("#r-desc");
  const rTemp = $("#r-temp");
  const rHumidity = $("#r-humidity");
  const rWind = $("#r-wind");
  const rFeels = $("#r-feels");
  const rIcon = $("#r-icon");

  // Defensive checks: if critical elements are missing, warn and disable interactions
  if(!cityInput || !btn){
    console.warn('WeatherNow: required UI elements (#city or #checkBtn) not found — aborting setup.');
    return;
  }

  function backendUrl(city){
    const base = (window.BACKEND_BASE_URL || "").replace(/\/$/, "");
    const path = "/weather?city=" + encodeURIComponent(city.trim());
    return base ? base + path : path;
  }

  function showAlert(msg){
    if(!alertBox){
      // fallback: log when alert box not present
      if(msg) console.warn('Alert message (no #alert element):', msg);
      return;
    }
    alertBox.textContent = msg;
    alertBox.hidden = !msg;
  }

  function renderData(data){
    if(rCity) rCity.textContent = data.city;
    if(rDesc) rDesc.textContent = data.description;
    if(rTemp) rTemp.textContent = Number(data.temperature).toFixed(1);
    // feels_like (odczuwalna temperatura)
    if(rFeels){
      if(data.feels_like == null || isNaN(Number(data.feels_like))){
        rFeels.textContent = "—";
      }else{
        rFeels.textContent = Number(data.feels_like).toFixed(1);
      }
    }
    if(rHumidity) rHumidity.textContent = data.humidity;
    // wind speed may be null/undefined — handle gracefully
    if(rWind){
      if(data.wind_speed == null || isNaN(Number(data.wind_speed))){
        rWind.textContent = "—";
      }else{
        rWind.textContent = Number(data.wind_speed).toFixed(1);
      }
    }
    if(rIcon && data.icon) rIcon.src = data.icon;
    if(result) result.hidden = false;
  }

async function loadConfig(){
  const base = (window.BACKEND_BASE_URL || "").replace(/\/$/, "");
  const url = base ? base + "/config" : "/config";

  try{
    const res = await fetch(url);
    if(!res.ok) return null;
    return await res.json();
  }catch(e){
    console.warn("Config load failed", e);
    return null;
  }
}

let map = null;
let weatherLayer = null;

async function initMap(lat, lon){
  const mapEl = document.getElementById("map");
  if(!mapEl){
    console.warn("Map container #map not found.");
    return;
  }
  if(typeof L === "undefined"){
    console.warn("Leaflet (L) not loaded.");
    return;
  }

  const base = (window.BACKEND_BASE_URL || "").replace(/\/$/, "");
  const url = base ? base + "/map/config" : "/map/config";

  const res = await fetch(url);
  const cfg = await res.json();
  if(!res.ok){
    console.warn("Map config error:", cfg);
    return;
  }

  if(!map){
    map = L.map("map").setView([lat, lon], 7);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap"
    }).addTo(map);
    map.createPane("weatherPane");
    map.getPane("weatherPane").style.zIndex = 650;
  }else{
    map.setView([lat, lon], 7);
  }

  // usuń poprzednią warstwę pogodową
  if(weatherLayer){
    map.removeLayer(weatherLayer);
  }

  const layerCode = cfg.layers[cfg.default_layer]; // np. precipitation_new
  const tileUrl = cfg.tile_url_template
    .replace("{layer}", layerCode)
    .replace("{apiKey}", cfg.apiKey);

  weatherLayer = L.tileLayer(tileUrl, { opacity: 0.75, pane: "weatherPane" }).addTo(map);

  // ważne, gdy kontener dopiero co się wyrenderował / zmienił rozmiar
  setTimeout(() => map.invalidateSize(), 50);
}

  async function handleCheck(){
    const city = cityInput.value;
    if(!city || !city.trim()){
      showAlert("Podaj nazwę miasta.");
      return;
    }
    showAlert("");
    btn.disabled = true;
    try{
      const res = await fetch(backendUrl(city), { method: "GET" });
      // Try to parse JSON response for both success and error cases
      let payload = null;
      try{
        payload = await res.json();
      }catch(parseErr){
        // ignore parse errors; payload stays null
      }

      if(!res.ok){
        // Prefer provider error message if present
        const errMsg = (payload && (payload.error || payload.message)) || (await res.text().catch(()=> "")) || "Błąd zapytania";
        throw new Error(errMsg);
      }

      if(!payload){
        throw new Error("Pusty response od serwera");
      }

      renderData(payload);
      if(payload && payload.coord && typeof payload.coord.lat === "number" && typeof payload.coord.lon === "number"){
  initMap(payload.coord.lat, payload.coord.lon);
}else{
  console.warn("No coord in weather payload; map cannot be centered.", payload);
}
    }catch(err){
      console.error(err);
      const msg = (err && err.message) ? err.message : "Nie udało się pobrać danych pogodowych.";
      // Present friendly messages for common server responses
      if(msg.toLowerCase().includes("city not found")){
        showAlert("Miasto nie znalezione.");
      }else if(msg.toLowerCase().includes("openweather") || msg.toLowerCase().includes("missing_openweather_apikey") || msg.toLowerCase().includes("missing openweather_api_key") ){
        showAlert("Brakuje klucza API (OPENWEATHER_API_KEY). Sprawdź konfigurację backendu.");
      }else{
        // Show provider message if it's short, otherwise a generic Polish message
        showAlert(msg.length < 200 ? msg : "Nie udało się pobrać danych pogodowych.");
      }
      

    }finally{
      btn.disabled = false;
    }
  }

  btn.addEventListener("click", handleCheck);
  cityInput.addEventListener("keydown", (e)=>{ if(e.key==="Enter") handleCheck(); });

(async function init(){
  const cfg = await loadConfig();
  if(cfg && cfg.default_city){
    cityInput.value = cfg.default_city;
    handleCheck(); // automatyczne pobranie pogody
  }
})();

})();