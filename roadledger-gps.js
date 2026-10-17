/* ==========================================
   ROADLEDGER GPS ROUTE PLANNER
   Version 1.0
   Commercial Truck Routing Foundation
   ========================================== */

(function () {
  "use strict";

  const GPS_VERSION = "1.0";

  let currentLocation = null;
  let plannedStops = [];
      // Read saved equipment information from RoadLedger.
  function getSavedEquipment() {
    try {
      const saved = localStorage.getItem("roadledger-v1");
      if (!saved) return null;

      const data = JSON.parse(saved);
      return data.equipment || null;
    } catch (error) {
      console.warn("Unable to load saved equipment.", error);
      return null;
    }
  }

  const weatherTab =
    document.getElementById("routeweatherTab");

  if (!weatherTab) {
    console.warn("RoadLedger GPS tab not found.");
    return;
  }

  // Create GPS planning interface.
  const gpsPanel = document.createElement("section");

  gpsPanel.className = "card";
  gpsPanel.id = "roadledgerGpsPlanner";

  gpsPanel.innerHTML = `
    <h2>🗺️ RoadLedger GPS Route Planner</h2>

    <p class="muted">
      Commercial truck route planning
    </p>

    <div class="stats">

      <div class="stat">
        📍 Current Location
        <strong id="gpsCurrentLocation">
          Not detected
        </strong>
      </div>

      <div class="stat">
        🚛 Routing Mode
        <strong>
          Commercial Truck
        </strong>
      </div>

      <div class="stat">
        🛣️ Route Distance
        <strong id="gpsDistance">
          Not calculated
        </strong>
      </div>

      <div class="stat">
        ⏱️ Estimated Travel Time
        <strong id="gpsTravelTime">
          Not calculated
        </strong>
      </div>

    </div>

    <h3>📍 Starting Location</h3>

    <button type="button" id="gpsDetectLocation">
      Use My Current GPS Location
    </button>

    <p id="gpsLocationStatus" class="muted">
      Waiting for GPS.
    </p>

    <h3>🏁 Destination</h3>

    <input
      type="text"
      id="gpsDestination"
      placeholder="Enter delivery address or city"
      autocomplete="street-address"
    >

    <h3>📍 Additional Stops</h3>

    <input
      type="text"
      id="gpsStopInput"
      placeholder="Enter pickup, fuel stop, or delivery"
    >

    <button type="button" id="gpsAddStop">
      + Add Stop
    </button>

    <div id="gpsStopsList"></div>

    <h3>🚛 Truck Specifications</h3>

    <p class="muted">
      Enter the measurements for your current
      truck and trailer combination.
    </p>

    <label for="gpsTruckHeight">
      Overall Height (feet)
    </label>

    <input
      type="number"
      id="gpsTruckHeight"
      placeholder="Example: 13.5"
      min="0"
      step="0.1"
    >

    <label for="gpsTruckWeight">
      Gross Vehicle Weight (lbs)
    </label>

    <input
      type="number"
      id="gpsTruckWeight"
      placeholder="Example: 26000"
      min="0"
      step="1"
    >

    <label for="gpsTruckLength">
      Total Combination Length (feet)
    </label>

    <input
      type="number"
      id="gpsTruckLength"
      placeholder="Example: 55"
      min="0"
      step="0.1"
    >

    <label for="gpsTruckWidth">
      Overall Width (feet)
    </label>

    <input
      type="number"
      id="gpsTruckWidth"
      placeholder="Example: 8.5"
      min="0"
      step="0.1"
    >

    <label for="gpsTruckAxles">
      Total Axles
    </label>

    <input
      type="number"
      id="gpsTruckAxles"
      placeholder="Example: 4"
      min="1"
      step="1"
    >

    <br><br>

    <button type="button" id="gpsPlanRoute">
      🛣️ Prepare Truck Route
    </button>

    <p id="gpsRouteStatus" class="muted">
      Enter your destination to begin planning.
    </p>

    <div id="gpsRouteSummary"></div>

    <p class="notice">
      ⚠️ Commercial routing service not yet connected.
      No route clearance, road restriction,
      or bridge clearance has been verified.
    </p>
  `;

  // Add planner inside existing Road Weather tab.
  weatherTab.appendChild(gpsPanel);

  function getElement(id) {
    return document.getElementById(id);
  }

  function setText(id, message) {
    const element = getElement(id);

    if (element) {
      element.textContent = message;
    }
  }

  // GPS location detection.
  getElement("gpsDetectLocation").addEventListener(
    "click",
    function () {

      if (!navigator.geolocation) {
        setText(
          "gpsLocationStatus",
          "GPS is not supported by this browser."
        );
        return;
      }

      setText(
        "gpsLocationStatus",
        "📡 Detecting your location..."
      );

      navigator.geolocation.getCurrentPosition(
        function (position) {

          currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };

          const coordinates =
            currentLocation.latitude.toFixed(4) +
            ", " +
            currentLocation.longitude.toFixed(4);

          setText(
            "gpsCurrentLocation",
            coordinates
          );

          setText(
            "gpsLocationStatus",
            "✅ GPS location detected."
          );

        },

        function (error) {

          let message =
            "Unable to retrieve GPS location.";

          if (error.code === 1) {
            message =
              "Location permission denied. " +
              "Enable location access in browser settings.";
          }

          if (error.code === 2) {
            message =
              "GPS location unavailable.";
          }

          if (error.code === 3) {
            message =
              "GPS request timed out.";
          }

          setText("gpsLocationStatus", message);

        },

        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 30000
        }
      );

    }
  );

  // Add additional stops.
  getElement("gpsAddStop").addEventListener(
    "click",
    function () {

      const input = getElement("gpsStopInput");

      const stop = input.value.trim();

      if (!stop) {
        return;
      }

      plannedStops.push(stop);

      input.value = "";

      renderStops();

    }
  );

  function renderStops() {

    const container = getElement("gpsStopsList");

    container.replaceChildren();

    plannedStops.forEach(function (stop, index) {

      const row = document.createElement("div");

      row.style.margin = "10px 0";

      const label = document.createElement("span");

      label.textContent =
        (index + 1) + ". " + stop + " ";

      const removeButton =
        document.createElement("button");

      removeButton.type = "button";

      removeButton.textContent = "Remove";

      removeButton.addEventListener(
        "click",
        function () {

          plannedStops.splice(index, 1);

          renderStops();

        }
      );

      row.appendChild(label);

      row.appendChild(removeButton);

      container.appendChild(row);

    });

  }

  // Prepare truck routing information.
  getElement("gpsPlanRoute").addEventListener(
    "click",
    function () {

      const destination =
        getElement("gpsDestination").value.trim();

      if (!destination) {

        setText(
          "gpsRouteStatus",
          "⚠️ Please enter a destination."
        );

        return;
      }

      const truck = {

        height:
          getElement("gpsTruckHeight").value,

        weight:
          getElement("gpsTruckWeight").value,

        length:
          getElement("gpsTruckLength").value,

        width:
          getElement("gpsTruckWidth").value,

        axles:
          getElement("gpsTruckAxles").value

      };

      const measurements = Object.values(truck);

      const invalidMeasurement =
        measurements.some(function (value) {

          return value !== "" &&
            (
              !Number.isFinite(Number(value)) ||
              Number(value) <= 0
            );

        });

      if (invalidMeasurement) {

        setText(
          "gpsRouteStatus",
          "⚠️ Enter positive truck measurements."
        );

        return;
      }

      if (
        truck.axles !== "" &&
        !Number.isInteger(Number(truck.axles))
      ) {

        setText(
          "gpsRouteStatus",
          "⚠️ Axle count must be a whole number."
        );

        return;
      }

      const routeInformation = {

        startingLocation: currentLocation,

        destination: destination,

        stops: [...plannedStops],

        truck: truck,

        routingMode: "commercial-truck",

        status: "provider-not-connected"

      };

      setText(
        "gpsRouteStatus",
        "✅ Route details prepared. " +
        "Commercial routing connection is still required."
      );

      const summary =
        getElement("gpsRouteSummary");

      summary.replaceChildren();

      const heading =
        document.createElement("h3");

      heading.textContent = "Route Planning Summary";

      summary.appendChild(heading);

      const details = [
        ["Destination", destination],
        [
          "Starting Location",
          currentLocation
            ? currentLocation.latitude.toFixed(4) +
              ", " +
              currentLocation.longitude.toFixed(4)
            : "Not selected"
        ],
        [
          "Additional Stops",
          plannedStops.length
            ? plannedStops.join(" → ")
            : "None"
        ],
        [
          "Routing Status",
          "Awaiting commercial routing provider"
        ]
      ];

      details.forEach(function (item) {

        const paragraph =
          document.createElement("p");

        paragraph.textContent =
          item[0] + ": " + item[1];

        summary.appendChild(paragraph);

      });

      console.log(
        "RoadLedger route planning data:",
        routeInformation
      );

    }
  );

  console.log(
    "RoadLedger GPS Route Planner v" +
    GPS_VERSION +
    " initialized."
  );

})();
/* ==========================================
   ROADLEDGER LIVE GPS MAP
   Interactive Map - Version 1.0
   ========================================== */

(function () {
  "use strict";

  const planner = document.getElementById("roadledgerGpsPlanner");

  if (!planner) {
    console.warn("RoadLedger GPS planner not found.");
    return;
  }

  // Create map container.
  const mapSection = document.createElement("section");

  mapSection.innerHTML = `
    <h3>🗺️ Live GPS Map</h3>

    <p class="muted">
      Interactive road map with live GPS positioning.
    </p>

    <div
      id="roadledgerLiveMap"
      style="
        width:100%;
        height:420px;
        border-radius:12px;
        overflow:hidden;
        background:#202b38;
      "
    ></div>

    <button
      type="button"
      id="roadledgerFollowGps"
      style="margin-top:12px;"
    >
      📍 Follow My Location
    </button>

    <p id="roadledgerMapStatus" class="muted">
      Loading interactive map...
    </p>
  `;

  planner.prepend(mapSection);

  function setStatus(message) {
    document.getElementById("roadledgerMapStatus").textContent = message;
  }

  // Load Leaflet mapping library.
  function loadLeaflet() {
    return new Promise(function (resolve, reject) {

      if (window.L) {
        resolve();
        return;
      }

      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href =
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

      document.head.appendChild(css);

      const script = document.createElement("script");
      script.src =
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

      script.onload = resolve;
      script.onerror = function () {
        reject(new Error("Unable to load map library."));
      };

      document.head.appendChild(script);
    });
  }

  let map = null;
  let truckMarker = null;
  let following = true;
  let watchId = null;

  async function initializeMap() {
    try {
      await loadLeaflet();

      map = L.map("roadledgerLiveMap").setView(
        [39.5, -98.35],
        4
      );

      L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; OpenStreetMap contributors'
        }
      ).addTo(map);

      setStatus(
        "Map loaded. Tap Follow My Location to activate GPS."
      );

      // Refresh map dimensions when displayed.
      setTimeout(function () {
        map.invalidateSize();
      }, 500);

    } catch (error) {
      setStatus("Map loading failed: " + error.message);
    }
  }

  function startTracking() {
    if (!map) {
      setStatus("Map is still loading.");
      return;
    }

    if (!navigator.geolocation) {
      setStatus("GPS is not supported on this device.");
      return;
    }

    if (watchId !== null) {
      following = true;
      setStatus("Following your current location.");
      return;
    }

    setStatus("Requesting GPS location...");

    watchId = navigator.geolocation.watchPosition(
      function (position) {

        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        if (!truckMarker) {
          truckMarker = L.marker([lat, lon])
            .addTo(map)
            .bindPopup("🚛 Your current location");
        } else {
          truckMarker.setLatLng([lat, lon]);
        }

        if (following) {
          map.setView([lat, lon], 15);
        }

        setStatus(
          "GPS active • Accuracy: " +
          Math.round(position.coords.accuracy) +
          " meters"
        );
      },

      function (error) {
        let message = "GPS location unavailable.";

        if (error.code === 1) {
          message = "Location permission denied.";
        } else if (error.code === 2) {
          message = "Unable to determine your location.";
        } else if (error.code === 3) {
          message = "GPS request timed out.";
        }

        setStatus(message);
      },

      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000
      }
    );
  }

  document
    .getElementById("roadledgerFollowGps")
    .addEventListener("click", function () {
      following = true;
      startTracking();
    });

  initializeMap();

})();

