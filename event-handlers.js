document.addEventListener("DOMContentLoaded", function() {
  // 1) Start button => fetch CSV, then startGame
  document.getElementById("startButton").addEventListener("click", function() {
    fetchCSV().then(() => {
      startGame();
    }).catch(() => {
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

  if (typeof window.handleClientLoad === "function") {
    window.handleClientLoad();
  }
});
console.log("All event listeners attached via one DOMContentLoaded.");


/**
 * A mock CSV fetch function (2s delay). 
 * In real code, replace with Papa Parse or your actual CSV logic.
 */
function fetchCSV() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate success
      let csvLoaded = true;
      if (csvLoaded) {
        resolve();
      } else {
        reject();
      }
    }, 2000);
  });
}
