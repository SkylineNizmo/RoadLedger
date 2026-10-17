/* =====================================
   ROADLEDGER NAVIGATION SYSTEM
   Active Tab Highlight
   ===================================== */

(function () {
  "use strict";

  function updateActiveTab(clickedButton) {

    // Find the navigation area.
    const navigation = clickedButton.closest("nav");

    if (!navigation) return;

    // Find all navigation buttons.
    const buttons = navigation.querySelectorAll("button");

    // Remove highlighting from every button.
    buttons.forEach(function (button) {

      button.classList.remove("active");

      button.setAttribute(
        "aria-selected",
        "false"
      );

    });

    // Highlight the selected button.
    clickedButton.classList.add("active");

    clickedButton.setAttribute(
      "aria-selected",
      "true"
    );

  }

  // Listen for clicks on navigation buttons.
  document.addEventListener("click", function (event) {

    const button = event.target.closest("nav button");

    if (!button) return;

    updateActiveTab(button);

  });

  console.log(
    "RoadLedger Navigation System Loaded"
  );

})();
