// === НАСТРОЙТЕ ЭТИ ПАРАМЕТРЫ ===
const API_KEY = "YeqBjBJJA6AHrNTulASeIIgtY2AqloOS";
const LAT = 50.4501;     // Ваши координаты (Киев)
const LON = 30.5234;
const FORECAST_HOURS = 24; // Сколько часов вперед прогноз
const ALTITUDES = [10, 100, 200, 500]; // В метрах, можно скорректировать

/**
 * Основная функция: обновить прогноз погоды в Google Таблице
 */
function updateWeatherReport() {
  try {
    Logger.log("=== Start updateWeatherReport ===");

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

    Logger.log("Запрос к API: " + JSON.stringify(payload));
    const response = UrlFetchApp.fetch(url, options);

    Logger.log("HTTP code: " + response.getResponseCode());
    if (response.getResponseCode() != 200) {
      Logger.log("Ошибка запроса: " + response.getContentText());
      throw new Error("API Error: " + response.getContentText());
    }

    const data = JSON.parse(response.getContentText());
    Logger.log("Ответ API (коротко): " + JSON.stringify(data, null, 2));

    // ====== Проверки и баг-репорты ======
    let bugReports = [];
    if (!data.days || !Array.isArray(data.days) || data.days.length === 0) {
      bugReports.push("В ответе API отсутствует поле 'days' или оно пустое.");
    }

    // ====== Очищаем старые строки, оставляя заголовки ======
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const last = sheet.getLastRow();
    if (last > 1) {
      sheet.getRange(2, 1, last - 1, 15).clearContent();
      Logger.log("Старые данные удалены, осталось только шапка.");
    } else {
      Logger.log("Только шапка, очищать нечего.");
    }

    // ====== Заполняем данными или баг-репортами ======
    let rowIdx = 2;
    if (bugReports.length === 0) {
      // Ищем первый день с непустым rows
      let today = null;
      for (let d of data.days) {
        if (d.rows && d.rows.length > 0) {
          today = d;
          break;
        }
      }
      if (!today) {
        bugReports.push("В ответе API нет ни одного дня с rows!");
        sheet.getRange(rowIdx, 1, 1, 2).setValues([[ "BUG REPORT", bugReports.join("; ") ]]);
      } else {
        for (const row of today.rows) {
          try {
            // Берём данные с самого нижнего (ground) уровня
            const surfaceWind = row.wind_profile && row.wind_profile.length > 0 ? row.wind_profile[0] : {};
            const hour = Utilities.formatDate(new Date(row.time.local), Session.getScriptTimeZone(), "HH:00");
            sheet.getRange(rowIdx, 1, 1, 15).setValues([[
              hour, // Час
              formatWind(surfaceWind.wind_speed_ms, surfaceWind.wind_bearing_deg), // Вітер
              formatWind(surfaceWind.gust_speed_ms, surfaceWind.gust_bearing_deg), // Пориви
              "1 500+ м", // Макс. висота (пример, укажите ваше правило)
              formatTemp(row.temp_c), // Температура
              formatTemp(row.humidity_pct), // Вологість
              percentOrDash(row.precip_prob_pct), // Вірогідність опадів
              row.precip_intensity_mmh ? row.precip_intensity_mmh + " мм/г" : "-", // Опади
              percentOrDash(row.cloud_cover_pct), // Хмарність
              row.cloudbase_m ? Math.round(row.cloudbase_m) + " м" : "-", // База хмар
              row.visibility_m ? Math.round(row.visibility_m/1000) + " км" : "-", // Видимість
              row.sats && row.sats.gps ? row.sats.gps.count : "-", // Видимі супутн.
              row.kp != undefined ? row.kp.toFixed(2) : "-", // Кр-індекс
              "-", // Оцінка супутн. прибл. (заполните по вашему правилу)
              "так" // Можна літати? (заполните по вашему правилу)
            ]]);
            rowIdx++;
          } catch (rowErr) {
            Logger.log("Ошибка при обработке строки прогноза: " + rowErr + " Исходные данные: " + JSON.stringify(row));
            sheet.getRange(rowIdx, 1, 1, 2).setValues([[ "BUG REPORT", "Ошибка при обработке строки с time: " + (row.time ? row.time.local : "unknown") ]]);
            rowIdx++;
          }
        }
        Logger.log("Данных записано: " + (rowIdx - 2));
      }
    } else {
      // Если есть баг-репорты, выводим их в таблицу
      Logger.log("Баг-репорты: " + bugReports.join("; "));
      sheet.getRange(rowIdx, 1, 1, 2).setValues([[ "BUG REPORT", bugReports.join("; ") ]]);
    }

    Logger.log("=== End updateWeatherReport ===");

  } catch (err) {
    Logger.log("ГЛОБАЛЬНАЯ ОШИБКА: " + err);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.getRange(2, 1, 1, 2).setValues([[ "CRITICAL ERROR", String(err) ]]);
  }
}

function writeCurrentConditions(data, sheet) {
  const current = data.current;
  const surfaceWind = current.wind_profile && current.wind_profile.length > 0 ? current.wind_profile[0] : {};
  const nowRow = [
    Utilities.formatDate(new Date(current.time.local), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"),
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
    current.sats?.gps?.count || "-",
    current.sats?.glonass?.count || "-",
    current.sats?.galileo?.count || "-",
    current.sats?.beidou?.count || "-",
    current.kp != undefined ? current.kp.toFixed(2) : "-",
    // Можно добавить "Можно летать?" по вашему правилу
  ];
  sheet.getRange(2, 1, 1, nowRow.length).setValues([nowRow]);
}

/**
 * Форматирование ветра
 */
function formatWind(speed, bearing) {
  if (speed == null) return "-";
  const dirs = ["↑","↗","→","↘","↓","↙","←","↖"];
  let dir = "-";
  if (bearing != null) {
    dir = dirs[Math.round(((bearing % 360) / 45)) % 8];
  }
  return Math.round(speed) + " м/с" + dir;
}

/**
 * Форматирование температуры и влажности
 */
function formatTemp(val) {
  return val != null ? Math.round(val) + "°C" : "-";
}

/**
 * Форматирование процентов
 */
function percentOrDash(val) {
  return val != null ? Math.round(val) + "%" : "-";
}
