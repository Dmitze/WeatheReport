
const API_KEY = "YeqBjBJJA6AHrNTulASeIIgtY2AqloOS";
const FORECAST_HOURS = 24;
const ALTITUDES = [10, 100, 200, 500];


function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Погода")
    .addItem("Оновити прогноз погоди для цього листа", "updateWeatherForActiveSheet")
    .addToUi();
}

function updateWeatherForActiveSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lat = parseFloat(sheet.getRange("A1").getValue());
  const lon = parseFloat(sheet.getRange("B1").getValue());
  if (isNaN(lat) || isNaN(lon)) {
    SpreadsheetApp.getUi().alert("Введите координаты в ячейки A1 (LAT), B1 (LON)!");
    return;
  }
  updateWeatherReportForSheet(sheet, lat, lon);
}


// Запускайте updateWeatherForAllSheets! (не updateWeatherReport)
function updateWeatherForAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  for (const sheet of sheets) {
    // Получаем координаты из ячеек A1 и B1 на каждом листе
    const lat = parseFloat(sheet.getRange("A1").getValue());
    const lon = parseFloat(sheet.getRange("B1").getValue());
    if (isNaN(lat) || isNaN(lon)) {
      sheet.appendRow(["ERROR: Введите координаты в ячейки A1 (LAT), B1 (LON)"]);
      continue;
    }
    // Можно очистить старые данные, если нужно, кроме первой строки (координаты)
    // sheet.getRange(2,1,sheet.getMaxRows()-1,sheet.getMaxColumns()).clearContent();

    updateWeatherReportForSheet(sheet, lat, lon);
    SpreadsheetApp.flush(); // чтобы не зависал интерфейс
  }
}

function updateWeatherReportForSheet(sheet, LAT, LON) {
  try {
    Logger.log(`Start update for ${sheet.getName()} coords: ${LAT}, ${LON}`);

    const url = "https://www.uavforecast.com/api/v1/forecast";
    const payload = {
      lat: LAT,
      lon: LON,
      forecast_hours: FORECAST_HOURS,
      wind_altitudes_m: ALTITUDES,
      gps_elevation_mask: 5,
      include_gps: true,
      include_glonass: true,
      include_galileo: true,
      include_beidou: true
    };

    const options = {
      method: "POST",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      headers: {
        Authorization: "Bearer " + API_KEY
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);

    if (response.getResponseCode() != 200) {
      sheet.appendRow(["API ERROR", response.getContentText()]);
      return;
    }

    const data = JSON.parse(response.getContentText());

    appendCurrentConditionsBlock(data.current, sheet);

    if (!data.days || !Array.isArray(data.days) || data.days.length === 0) {
      sheet.appendRow(["BUG REPORT", "В ответе API отсутствует поле 'days' или оно пустое."]);
      return;
    }

    for (let day of data.days) {
      if (!day.rows || day.rows.length === 0 || !day.rows.some(r => r && r.time && r.time.local)) continue;
      const weekDayName = getUkrWeekday(day.date);
      const sunrise = day.sunrise ? formatTime(day.sunrise.local) : "-";
      const solarNoon = day.solar_noon ? formatTime(day.solar_noon.local) : "-";
      const sunset = day.sunset ? formatTime(day.sunset.local) : "-";
      const header = `${weekDayName} ${day.date}: Схід ${sunrise}, сонячний полудень ${solarNoon}, Захід ${sunset}`;
      sheet.appendRow([header]);
      sheet.appendRow([
        "Час", "Вітер", "Пориви", "Макс. висота", "Температура", "Вологість",
        "Вірогідність опадів", "Опади", "Хмарність", "База хмар", "Видимість",
        "Видимі супутн.", "Кр-індекс", "Оцінка супутн. прибл.", "Можна літати?"
      ]);
      for (let h = 0; h < 24; h++) {
        let hourStr = (h < 10 ? "0" : "") + h + ":00";
        let row = (day.rows || []).find(r => {
          if (!r.time || !r.time.local) return false;
          const d = new Date(r.time.local);
          return d.getHours() === h;
        });
        if (row) {
          const surfaceWind = row.wind_profile && row.wind_profile.length > 0 ? row.wind_profile[0] : {};
          const sat = row.sats && row.sats.gps ? row.sats.gps.count : "-";
          const kp = row.kp != undefined ? row.kp.toFixed(2) : "-";
          const estimate = estimateSatellites(row);
          sheet.appendRow([
            hourStr,
            formatWind(surfaceWind.wind_speed_ms, surfaceWind.wind_bearing_deg),
            formatWind(surfaceWind.gust_speed_ms, surfaceWind.gust_bearing_deg),
            "1 500+ м",
            formatTemp(row.temp_c),
            formatTemp(row.humidity_pct),
            percentOrDash(row.precip_prob_pct),
            row.precip_intensity_mmh ? row.precip_intensity_mmh + " мм/г" : "-",
            percentOrDash(row.cloud_cover_pct),
            row.cloudbase_m ? Math.round(row.cloudbase_m) + " м" : "-",
            row.visibility_m ? Math.round(row.visibility_m/1000) + " км" : "-",
            sat,
            kp,
            estimate,
            "так"
          ]);
        } else {
          sheet.appendRow([
            hourStr, "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"
          ]);
        }
      }
      sheet.appendRow([""]);
    }

    Logger.log("=== End updateWeatherReport for " + sheet.getName() + " ===");

  } catch (err) {
    sheet.appendRow(["CRITICAL ERROR", String(err)]);
  }
}

// --- Добавляет блок "Поточні умови станом" ---
function appendCurrentConditionsBlock(current, sheet) {
  sheet.appendRow(["Поточні умови станом: " + formatTime(current.time.local)]);
  sheet.appendRow([
    "Температура", "Вологість", "Хмарність", "База хмар", "Тиск", "Щільність висоти",
    "Вітер", "Пориви", "Видимість", "Погода", "GPS", "GLONASS", "Galileo", "Beidou", "Kp-індекс"
  ]);
  const surfaceWind = current.wind_profile && current.wind_profile.length > 0 ? current.wind_profile[0] : {};
  sheet.appendRow([
    formatTemp(current.temp_c),
    formatTemp(current.humidity_pct),
    percentOrDash(current.cloud_cover_pct),
    current.cloudbase_m ? Math.round(current.cloudbase_m) + " м" : "-",
    current.pressure_msl_hpa ? Math.round(current.pressure_msl_hpa) + " гПа" : "-",
    current.density_altitude_m ? Math.round(current.density_altitude_m) + " м" : "-",
    formatWind(surfaceWind.wind_speed_ms, surfaceWind.wind_bearing_deg),
    formatWind(surfaceWind.gust_speed_ms, surfaceWind.gust_bearing_deg),
    current.visibility_m ? Math.round(current.visibility_m/1000) + " км" : "-",
    current.weather_icon || "-",
    current.sats && current.sats.gps && current.sats.gps.count !== undefined ? current.sats.gps.count : "-",
    current.sats && current.sats.glonass && current.sats.glonass.count !== undefined ? current.sats.glonass.count : "-",
    current.sats && current.sats.galileo && current.sats.galileo.count !== undefined ? current.sats.galileo.count : "-",
    current.sats && current.sats.beidou && current.sats.beidou.count !== undefined ? current.sats.beidou.count : "-",
    current.kp != undefined ? current.kp.toFixed(2) : "-"
  ]);
  sheet.appendRow([""]);
}

// --- Формула для "Оцінка супутн. прибл." ---
function estimateSatellites(row) {
  const sat = row.sats && row.sats.gps && row.sats.gps.count ? +row.sats.gps.count : 0;
  const kp = row.kp != undefined ? +row.kp : 1.0;
  return sat && kp ? (sat * kp).toFixed(1) : "-";
}

// --- Украинский день недели ---
function getUkrWeekday(date) {
  if (!(date instanceof Date)) date = new Date(date);
  if (isNaN(date.getTime())) return "-";
  const days = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "Пʼятниця", "Субота"];
  return days[date.getDay()];
}

// --- Формат времени (часы:минуты) ---
function formatTime(localStr) {
  const d = new Date(localStr);
  if (isNaN(d.getTime())) return "-";
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "HH:mm");
}

// --- Остальные функции (форматирование) ---
function formatWind(speed, bearing) {
  if (speed == null) return "-";
  const dirs = ["↑","↗","→","↘","↓","↙","←","↖"];
  let dir = "-";
  if (bearing != null) dir = dirs[Math.round(((bearing % 360) / 45)) % 8];
  return Math.round(speed) + " м/с" + dir;
}
function formatTemp(val) {
  return val != null ? Math.round(val) + "°C" : "-";
}
function percentOrDash(val) {
  return val != null ? Math.round(val) + "%" : "-";
}
