/********************************************
 * event-handlers.js — Google Sheets logic
 ********************************************/

document.addEventListener("DOMContentLoaded", function() {
  const SPREADSHEET_ID = "1lUvFx3vsbaFL4xzchsvYlzjbtx9Jy-2EIuA3eKPo1ww";
  
  // Step A) Attach your event listeners
  // 1) Start button => load CSV => startGame
  document.getElementById("startButton").addEventListener("click", function() {
    console.log("Start button clicked!");
    loadCSVFromGoogle()
      .then(() => {
        startGame();
      })
      .catch(() => {
        alert("Failed to load CSV. Check console.");
      });
  });

  // 2) champion & challenger direct clicks
  document.getElementById("champion").addEventListener("click", voteChampion);
  document.getElementById("challenger").addEventListener("click", voteChallenger);

  // 3) Sidebar toggles
  document.getElementById("toggleSidebarBtn").addEventListener("click", toggleSidebar);
  document.getElementById("hideSidebarBtn").addEventListener("click", toggleSidebar);

  // 4) Delegated clicks on document.body for face-off & links
  document.body.addEventListener("click", function(e) {
    // face-off champion
    if (e.target.closest(".face-off-champion")) {
      faceOffChampionWins();
      return;
    }
    // face-off challenger
    if (e.target.closest(".face-off-challenger")) {
      faceOffChallengerWins();
      return;
    }
    // trailer link
    if (e.target.classList.contains("trailer-link")) {
      e.stopPropagation();
      e.preventDefault();
      window.open(e.target.href, "_blank");
      return;
    }
    // RT link
    if (e.target.classList.contains("rt-link")) {
      e.stopPropagation();
      e.preventDefault();
      window.open(e.target.href, "_blank");
      return;
    }
    // "Submit my Top 5" button from top5DndHTML
    if (e.target.classList.contains("submit-top5-btn")) {
      e.stopPropagation();
      e.preventDefault();
      saveFinalTop5Order(); 
      return;
    }
  });

  // 5) Poster fallback logic
  const allPosters = document.querySelectorAll("img.poster");
  allPosters.forEach((img) => {
    img.addEventListener("error", function handleError() {
      img.src = img.getAttribute("data-fallback") || "posters/default.jpg";
      img.removeEventListener("error", handleError);
    });
  });

  console.log("All event listeners attached via one DOMContentLoaded.");

  // We assume you have the GIS flow set up:
  let accessToken = null;
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: "866522257651-645mjjbmugbiqoerc8m7ve4ear4fuec8.apps.googleusercontent.com",
    scope: "https://www.googleapis.com/auth/spreadsheets",
    callback: (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        console.log("Got GIS access token:", tokenResponse.access_token);
        accessToken = tokenResponse.access_token;
        actuallyWriteTop5AndTallies();
      } else {
        console.error("Token response missing access_token:", tokenResponse);
        alert("Could not get token for Sheets. Check console.");
      }
    },
  });

  /**
   * If we already have a token, call the final write logic.
   * Otherwise, request it.
   */
  window.requestSheetsTokenAndWrite = function() {
    if (accessToken) {
      console.log("Already have an access token, calling actuallyWriteTop5AndTallies...");
      actuallyWriteTop5AndTallies();
      return;
    }
    console.log("Requesting new token via GIS...");
    tokenClient.requestAccessToken({ prompt: "consent" });
  };

  /**
   * The main flow once we have a token:
   * 1) user ID => check if used
   * 2) write top5 => Top5Sheet
   * 3) build dictionary Title => count from ID-based dictionary
   * 4) write that single row => FullTallySheet
   * 5) log user ID => UserIDs
   */
  function actuallyWriteTop5AndTallies() {
    console.log("actuallyWriteTop5AndTallies: we have a token, let's do the writes.");

    const userId = getOrCreateUserId();
    console.log("User ID:", userId);

    isUserIdAlreadySubmitted(userId)
      .then(alreadySubmitted => {
        if (alreadySubmitted) {
          alert("You have already submitted. One submission per user!");
          throw new Error("Duplicate submission from userId: " + userId);
        }
        // 1) write top5 => "Top5Sheet"
        // top5Movies is from script.js
        const top5Array = top5Movies.map(m => m.Title);
        return writeTop5Sheet(userId, top5Array);
      })
      .then(() => {
        // 2) Build Title => count dictionary from ID-based 'votes'
        const titleDict = buildTitleDictionaryFromID();
        // 3) write single row => FullTallySheet
        return writeFullTallyRow(userId, titleDict);
      })
      .then(() => {
        // 4) log user ID => "UserIDs"
        return logUserId(userId);
      })
      .then(() => {
        alert("All sheets written successfully!");
      })
      .catch(err => {
        console.error("Failed writing to Sheets:", err);
        alert("Error writing to Sheets. Check console.");
      });
  }

  /****************************************************
   * Write top 5 => "Top5Sheet", single row:
   * [ userID, top5_1, top5_2, top5_3, top5_4, top5_5, TIMESTAMP ]
   ****************************************************/
  function writeTop5Sheet(userId, top5Array) {
    const timestamp = new Date().toISOString();
    const rowValues = [ userId, ...top5Array, timestamp ];

    const body = {
      majorDimension: "ROWS",
      values: [ rowValues ]
    };

    return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Top5Sheet!A2:append?valueInputOption=RAW`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
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

  /****************************************************
   * buildTitleDictionaryFromID:
   * For each movie in "movies" (script.js), do:
   *   dict[movie.Title] = votes[movie.ID] || 0
   * Then we can sort ignoring "The" if we want.
   ****************************************************/
  function buildTitleDictionaryFromID() {
    let dict = {};
    for (const movieObj of movies) {
      const id = movieObj.ID;
      const title = movieObj.Title;
      const count = votes[id] || 0;
      dict[title] = count;
    }
    return dict;
  }

  /****************************************************
   * Write a single row to "FullTallySheet":
   * [ userID, <count for each movie in alphabetical ignoring "The">, timestamp ]
   ****************************************************/
  async function writeFullTallyRow(userId, titleDict) {
    // 1) get all Titles from titleDict
    // or we could rely on "MOVIE_LIST"
    let allTitles = Object.keys(titleDict);

    // 2) sort ignoring "The"
    allTitles.sort((a, b) => strippedTitle(a).localeCompare(strippedTitle(b)));

    // 3) build the row: [ userId, ...counts..., timestamp ]
    const row = [ userId ];
    for (const title of allTitles) {
      row.push(titleDict[title] || 0);
    }
    row.push(new Date().toISOString());

    // POST that row
    const body = {
      majorDimension: "ROWS",
      values: [ row ]
    };
    const range = "FullTallySheet!A2";

    try {
      const resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        throw new Error(`writeFullTallyRow failed: HTTP ${resp.status}`);
      }
      const data = await resp.json();
      console.log("writeFullTallyRow success:", data);
      return data;
    } catch (error) {
      console.error("Failed writing full tally row:", error);
      throw error;
    }
  }

  // Helper for ignoring "The"
  function strippedTitle(title) {
    return title.replace(/^the\s+/i, "");
  }

  /****************************************************
   * HELPER FUNCS FOR ID & LOGGING
   ****************************************************/
  function getOrCreateUserId() {
    let userId = localStorage.getItem('pollUserId');
    if (!userId) {
      userId = generateRandomUserId();
      localStorage.setItem('pollUserId', userId);
    }
    return userId;
  }

  function generateRandomUserId() {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  async function isUserIdAlreadySubmitted(userId) {
    const range = 'UserIDs!A:A'; 
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`;
      const resp = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (!resp.ok) {
        throw new Error(`Error fetching user IDs: ${resp.status} - ${resp.statusText}`);
      }
      const data = await resp.json();
      const userIdList = data.values ? data.values.flat() : [];
      return userIdList.includes(userId);
    } catch (error) {
      console.error('Error checking user ID:', error);
      throw error;
    }
  }

  async function logUserId(userId) {
    const range = 'UserIDs!A:A';
    const body = {
      majorDimension: "ROWS",
      values: [[userId]],
    };

    try {
      const resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        throw new Error(`logUserId failed: HTTP ${resp.status}`);
      }
      const result = await resp.json();
      console.log("logUserId success:", result);
      return result;
    } catch (error) {
      console.error("Failed logging user ID:", error);
      throw error;
    }
  }

}); // End DOMContentLoaded
