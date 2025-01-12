document.addEventListener("DOMContentLoaded", function() {
  // 1) Start button => load CSV from Google, then startGame
  document.getElementById("startButton").addEventListener("click", function() {
    // Show the loading overlay
    const loadingPopup = document.getElementById("loadingPopupOverlay");
    loadingPopup.classList.add('active');

    // Actually load CSV from Google (the real Papa Parse function)
    loadCSVFromGoogle()
      .then(() => {
        // done => hide popup
        loadingPopup.classList.remove('active');
        startGame();
      })
      .catch(() => {
        loadingPopup.classList.remove('active');
        alert("Failed to load CSV. Please try again.");
      });
  });

  // 2) Champion & Challenger direct clicks
  document.getElementById("champion").addEventListener("click", voteChampion);
  document.getElementById("challenger").addEventListener("click", voteChallenger);

  // 3) Sidebar toggles
  document.getElementById("toggleSidebarBtn").addEventListener("click", toggleSidebar);
  document.getElementById("hideSidebarBtn").addEventListener("click", toggleSidebar);

  // 4) Delegated click on document.body for face-off & links
  document.body.addEventListener("click", function(e) {
    // A) Face-off champion
    if (e.target.closest(".face-off-champion")) {
      faceOffChampionWins();
      return;
    }

    // B) Face-off challenger
    if (e.target.closest(".face-off-challenger")) {
      faceOffChallengerWins();
      return;
    }

    // C) Trailer link
    if (e.target.classList.contains("trailer-link")) {
      e.stopPropagation();
      e.preventDefault();
      window.open(e.target.href, "_blank");
      return;
    }

    // D) RT link
    if (e.target.classList.contains("rt-link")) {
      e.stopPropagation();
      e.preventDefault();
      window.open(e.target.href, "_blank");
      return;
    }

    // E) "Submit my Top 5" button from top5DndHTML
    if (e.target.classList.contains("submit-top5-btn")) {
      e.stopPropagation();
      e.preventDefault(); // not strictly necessary for a button, but harmless
      saveFinalTop5Order();
      return;
    }
  });

  // 5) Poster fallback logic for <img> with data-fallback
  const allPosters = document.querySelectorAll("img.poster");
  allPosters.forEach((img) => {
    img.addEventListener("error", function handleError() {
      // fallback to 'posters/default.jpg' or what's in data-fallback
      img.src = img.getAttribute("data-fallback") || "posters/default.jpg";
      // Remove the listener to prevent infinite loops
      img.removeEventListener("error", handleError);
    });
  });

  // If you have handleClientLoad for Google Sheets
  if (typeof window.handleClientLoad === "function") {
    window.handleClientLoad();
  }

  console.log("All event listeners attached via one DOMContentLoaded.");
});
