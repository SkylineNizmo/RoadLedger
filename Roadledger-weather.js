/* RoadLedger Weather Dashboard
   Version 1.0
   GPS weather updates every 15 minutes
   Uses existing Tomorrow.io Cloudflare Worker
*/

(function () {
  "use strict";

  const WEATHER_REFRESH_MINUTES = 15;
  const REFRESH_INTERVAL =
    WEATHER_REFRESH_MINUTES * 60 * 1000;

  const WEATHER_URL =
    "https://roadledger-weather.epic-evan7.workers.dev/";

  let weatherTimer = null;
  let weatherLoading = false;
  let weatherStarted = false;
  let lastWeatherUpdate = 0;

  const gpsButton =
    document.getElementById("routeLocation");

  const gpsResult =
    document.getElementById("routeLocationResult");

  const weatherTab =
    document.getElementById("routeweatherTab");

  if (!gpsButton || !gpsResult || !weatherTab) {
    console.warn("RoadLedger weather elements missing.");
    return;
  }

  // Create the weather dashboard.
  const dashboard = document.createElement("section");

  dashboard.className = "card";
  dashboard.id = "roadledgerWeatherDashboard";

  dashboard.innerHTML = `
    <h2>🌤️ Live Weather Conditions</h2>

    <p id="weatherStatus" class="muted">
      Tap the GPS button to load local weather.
    </p>

    <div class="stats">

      <div class="stat">
        🌡️ Temperature
        <strong id="weatherTemp">--°F</strong>
      </div>

      <div class="stat">
        🌡️ Feels Like
        <strong id="weatherFeels">--°F</strong>
      </div>

      <div class="stat">
        💨 Wind Speed
        <strong id="weatherWind">-- mph</strong>
      </div>

      <div class="stat">
        🌬️ Wind Gusts
        <strong id="weatherGust">-- mph</strong>
      </div>

      <div class="stat">
        💧 Humidity
        <strong id="weatherHumidity">--%</strong>
      </div>

      <div class="stat">
        🌧️ Rain Probability
        <strong id="weatherRain">--%</strong>
      </div>

      <div class="stat">
        👁️ Visibility
        <strong id="weatherVisibility">-- mi</strong>
      </div>

      <div class="stat">
        ☁️ Cloud Cover
        <strong id="weatherClouds">--%</strong>
      </div>

    </div>

    <p class="muted" id="weatherUpdated">
      Last updated: Never
    </p>

    <p class="muted">
      Automatic weather refresh: Every 15 minutes
      while RoadLedger remains active.
    </p>

    <p class="notice">
      Weather information is for planning only.
      Always check official warnings and road conditions.
    </p>
  `;

  // Place weather dashboard above the existing route preview.
  weatherTab.insertBefore(
    dashboard,
    weatherTab.firstElementChild
  );

  function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  }

  function formatNumber(value, digits = 0) {
    const number = Number(value);

    if (value === null ||
        value === undefined ||
        !Number.isFinite(number)) {
      return "--";
    }

    return number.toFixed(digits);
  }

  function displayWeather(weather, latitude, longitude) {
    const values = weather?.data?.values;

    if (!values) {
      throw new Error("Weather data unavailable.");
    }

    setText(
      "weatherTemp",
      formatNumber(values.temperature) + "°F"
    );

    setText(
      "weatherFeels",
      formatNumber(values.temperatureApparent) + "°F"
    );

    setText(
      "weatherWind",
      formatNumber(values.windSpeed) + " mph"
    );

    setText(
      "weatherGust",
      formatNumber(values.windGust) + " mph"
    );

    setText(
      "weatherHumidity",
      formatNumber(values.humidity) + "%"
    );

    setText(
      "weatherRain",
      formatNumber(values.precipitationProbability) + "%"
    );

    setText(
      "weatherVisibility",
      formatNumber(values.visibility, 1) + " mi"
    );

    setText(
      "weatherClouds",
      formatNumber(values.cloudCover) + "%"
    );

    setText(
      "weatherUpdated",
      "Last updated: " + new Date().toLocaleString()
    );

    setText(
      "weatherStatus",
      "📍 GPS weather active — " +
      latitude.toFixed(4) + ", " +
      longitude.toFixed(4)
    );
  }

  async function updateWeather() {
    if (weatherLoading || document.hidden) {
      return;
    }

    if (!navigator.geolocation) {
      setText(
        "weatherStatus",
        "GPS is not supported by this browser."
      );
      return;
    }

    weatherLoading = true;

    setText(
      "weatherStatus",
      "📡 Updating GPS and weather..."
    );

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 30000
          }
        );
      });

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      const location = encodeURIComponent(
        latitude + "," + longitude
      );

      const response = await fetch(
        WEATHER_URL + "?location=" + location,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(
          "Weather service error: " + response.status
        );
      }

      const weather = await response.json();

      displayWeather(weather, latitude, longitude);

      lastWeatherUpdate = Date.now();

    } catch (error) {
      setText(
        "weatherStatus",
        "Weather update failed: " + error.message
      );

    } finally {
      weatherLoading = false;
    }
  }

  function startWeatherUpdates() {
    if (!weatherStarted) {
      weatherStarted = true;

      weatherTimer = setInterval(() => {
        updateWeather();
      }, REFRESH_INTERVAL);
    }

    // Avoid unnecessary repeat requests.
    if (
      !lastWeatherUpdate ||
      Date.now() - lastWeatherUpdate >= REFRESH_INTERVAL
    ) {
      updateWeather();
    }
  }

  // Start automatic updates after the GPS button is used.
  // Capture phase prevents the original GPS handler
  // from making a duplicate weather API request.
  gpsButton.addEventListener(
    "click",
    function (event) {
      event.stopImmediatePropagation();

      startWeatherUpdates();
    },
    true
  );

  // Refresh stale weather when returning to RoadLedger.
  document.addEventListener(
    "visibilitychange",
    function () {
      if (
        !document.hidden &&
        weatherStarted &&
        Date.now() - lastWeatherUpdate >= REFRESH_INTERVAL
      ) {
        updateWeather();
      }
    }
  );

  console.log(
    "RoadLedger Weather Dashboard initialized."
  );

})();
