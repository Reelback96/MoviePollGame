document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("startButton").addEventListener("click", function() {
    // Show loading indicator
    document.getElementById("loadingIndicator").style.display = "block";
    
    // Simulate fetching CSV and starting game
    fetchCSV().then(() => {
      document.getElementById("loadingIndicator").style.display = "none";
      startGame();
    }).catch(() => {
      document.getElementById("loadingIndicator").style.display = "none";
      alert("Failed to load CSV. Please try again.");
    });
  });
  document.getElementById("champion").addEventListener("click", voteChampion);
  document.getElementById("challenger").addEventListener("click", voteChallenger);
  document.getElementById("toggleSidebarBtn").addEventListener("click", toggleSidebar);
  document.getElementById("hideSidebarBtn").addEventListener("click", toggleSidebar);
});

function fetchCSV() {
  return new Promise((resolve, reject) => {
    // Simulate CSV loading delay
    setTimeout(() => {
      // Replace with actual CSV loading logic
      let csvLoaded = true;
      if (csvLoaded) {
        resolve();
      } else {
        reject();
      }
    }, 2000); // Simulate 2 seconds delay
  });
}
