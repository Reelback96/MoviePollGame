/********************************************
 * event-handlers.js
 ********************************************/
document.addEventListener("DOMContentLoaded", function() {
  // 1) Start button => fetch CSV, then startGame
  document.getElementById("startButton").addEventListener("click", function() {
    const loadingPopup = document.getElementById("loadingPopupOverlay");
    loadingPopup.classList.add("active");

    // Actually load CSV from Google (the real Papa Parse function)
    loadCSVFromGoogle()
      .then(() => {
        // done => hide popup
        loadingPopup.classList.remove("active");
        startGame();
      })
      .catch(() => {
        loadingPopup.classList.remove("active");
        alert("Failed to load CSV. Please try again.");
      });
  }); // <--- Only one closing brace for the startButton click

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

  console.log("All event listeners attached via one DOMContentLoaded.");

  /***********************************************************
   * 6) NEW GOOGLE IDENTITY SERVICES (GIS) TOKEN-BASED APPROACH
   ***********************************************************/

  // A variable to store the user's access token
  let accessToken = null;

  // Step A: Initialize the token client. We'll do this once DOM is loaded.
  // Use your actual client_id and scope:
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: "866522257651-645mjjbmugbiqoerc8m7ve4ear4fuec8.apps.googleusercontent.com",
    scope: "https://www.googleapis.com/auth/spreadsheets",
    callback: (tokenResponse) => {
      // This callback fires once we have the token
      if (tokenResponse && tokenResponse.access_token) {
        console.log("Got GIS access token:", tokenResponse.access_token);
        accessToken = tokenResponse.access_token;
        // Now we can call the function that writes to Sheets, for example:
        actuallyWriteTop5AndTallies();
      } else {
        console.error("Token response was missing access_token:", tokenResponse);
        alert("Could not get token for Sheets. Check console.");
      }
    },
  });

  // Step B: We define a function that requests a token if we don’t have one, or it’s expired.
  // We'll call this from "submit top 5" or "write top 5 & tallies" logic
  window.requestSheetsTokenAndWrite = function() {
    // If we already have a token, we can call the logic directly:
    if (accessToken) {
      console.log("Already have an access token, calling actuallyWriteTop5AndTallies...");
      actuallyWriteTop5AndTallies();
      return;
    }
    console.log("Requesting new token via GIS...");
    tokenClient.requestAccessToken({ prompt: "consent" });
  };

  // Step C: A function that does the actual Sheets calls using fetch
  function actuallyWriteTop5AndTallies() {
    console.log("actuallyWriteTop5AndTallies: we have a token, let's do the writes.");

    // For example usage:
    const userName = "Alice";
    const userTop5 = ["MovieA", "MovieB", "MovieC", "MovieD", "MovieE"];
    const fullTallyObj = { MovieA: 10, MovieB: 5 };

    // We'll do 2 separate calls. 
    // 1) writeTop5Sheet, 2) writeTotalTallySheet.

    writeTop5Sheet(userName, userTop5)
      .then(() => writeTotalTallySheet(fullTallyObj))
      .then(() => {
        alert("All sheets written successfully!");
      })
      .catch(err => {
        console.error("Failed writing to Sheets:", err);
        alert("Error writing to Sheets. Check console.");
      });
  }

  // Step D: Actually define the helper functions that do fetch to Sheets 
  function writeTop5Sheet(name, top5Array) {
    // e.g. format the data as you want
    const timestamp = new Date().toISOString();
    const rowValues = [name, ...top5Array, timestamp];

    const body = {
      majorDimension: "ROWS",
      values: [rowValues],
    };
    // We'll do a fetch to the REST endpoint:
    return fetch("https://sheets.googleapis.com/v4/spreadsheets/1lUvFx3vsbaFL4xzchsvYlzjbtx9Jy-2EIuA3eKPo1ww/values/Top5Sheet!A2:append?valueInputOption=RAW", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })
    .then(resp => {
      if (!resp.ok) {
        throw new Error(`writeTop5Sheet failed: HTTP ${resp.status}`);
      }
      return resp.json();
    })
    .then(data => {
      console.log("writeTop5Sheet success:", data);
    });
  }

  function writeTotalTallySheet(movieTallyObj) {
    const timestamp = new Date().toISOString();
    const rowValues = [];
    for (const [movieTitle, count] of Object.entries(movieTallyObj)) {
      rowValues.push(movieTitle, count);
    }
    rowValues.push(timestamp);

    const body = {
      majorDimension: "ROWS",
      values: [rowValues],
    };

    // Here, I'm using append to add a new row. You can do an update if you prefer.
    return fetch("https://sheets.googleapis.com/v4/spreadsheets/1lUvFx3vsbaFL4xzchsvYlzjbtx9Jy-2EIuA3eKPo1ww/values/FullTallySheet!A2:append?valueInputOption=RAW", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })
    .then(resp => {
      if (!resp.ok) {
        throw new Error(`writeTotalTallySheet failed: HTTP ${resp.status}`);
      }
      return resp.json();
    })
    .then(data => {
      console.log("writeTotalTallySheet success:", data);
    });
  }

}); // End of DOMContentLoaded
