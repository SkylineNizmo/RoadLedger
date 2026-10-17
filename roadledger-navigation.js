/* RoadLedger Navigation Highlight Fix */

(function () {
  "use strict";

  function updateActiveTab(name) {

    document.querySelectorAll("[data-tab]").forEach(function (button) {

      const active = button.dataset.tab === name;

      button.classList.toggle("tabActive", active);

      button.setAttribute(
        "aria-current",
        active ? "page" : "false"
      );

    });

  }

  document.addEventListener("click", function (event) {

    const button = event.target.closest("[data-tab]");

    if (!button) return;

    updateActiveTab(button.dataset.tab);

  });

  console.log("RoadLedger navigation highlighting ready.");

})();
