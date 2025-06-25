# WeatheReport

**WeatheReport** is an integration of the UAV Forecast weather API with Google Sheets for planning and analyzing weather conditions. It is ideal for drone pilots and anyone who needs detailed, up-to-date meteorological data for a specific location.

---

## Features

- 📡 Get detailed weather forecasts for any coordinates (latitude/longitude).
- ⏰ Hourly forecast for up to 24 hours ahead (with support for multiple altitudes).
- 🌦️ Automatic recording in Google Sheets: temperature, wind, humidity, cloudiness, precipitation, cloud base, visibility, satellites, Kp index, and more.
- 🎨 Weather icons (emoji) for visual clarity.
- 🛰️ Visible satellite count (GPS/GLONASS/Galileo/Beidou).
- ☑️ Automation: schedule updates (for example, every hour).
- 📅 Check multiple locations on one or several sheets.
- ❌ Error and bug reports are written directly to the table.

---

## How It Works

1. **Install Google Apps Script (`code.js`) in your Google Sheet.**
2. Enter your coordinates into cells `A1` (latitude) and `B1` (longitude) on each sheet.
3. After installation, a **"Weather"** menu will appear for manual updates.
4. For automatic updates, set up a trigger for the function `updateWeatherForAllSheets`.
5. The script calls the UAVForecast API, receives the forecast, and writes it in a structured format to your sheet.
6. Each run adds a new forecast at the end of the sheet—so you always have a history of updates.

---

## Quick Start

1. **Make a copy of the Google Sheet and open the Apps Script editor.**
2. Paste the contents of `code.js`.
3. Enter your coordinates in A1 and B1.
4. Click "Weather → Update weather forecast for this sheet" or schedule automatic updates.
5. Done! Your sheet will be automatically filled with up-to-date weather data.

---

## Example Table Output

| Hour  | Wind  | ... | Can Fly? | Weather |
|-------|-------|-----|----------|---------|
| 08:00 | 3 m/s↑| ... | yes      | ⛅      |
| 09:00 | 4 m/s↑| ... | yes      | ☀️      |
| ...   | ...   | ... | ...      | ...     |

---

## Dependencies

- Google Sheets
- Google Apps Script
- UAVForecast API key (test key available)

---

## API Documentation

Full API documentation is located in the [`api_docs/`](api_docs/) folder.

---

## License

This project is licensed under the MIT License.

---

## Authors

- [Dmitze](https://github.com/Dmitze)

---

**Feel free to ask questions or suggest improvements!**
