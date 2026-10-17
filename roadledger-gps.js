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
