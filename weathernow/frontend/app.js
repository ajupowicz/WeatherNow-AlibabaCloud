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
      result.hidden = true;
    }finally{
      btn.disabled = false;
    }
  }

  btn.addEventListener("click", handleCheck);
  cityInput.addEventListener("keydown", (e)=>{ if(e.key==="Enter") handleCheck(); });
})();