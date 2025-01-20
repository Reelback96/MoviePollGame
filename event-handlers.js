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
    // If user clicked a link with class "trailer-link" or "rt-link"
    if (e.target.matches(".trailer-link, .rt-link")) {
      // Stop it from bubbling to .movie parent (which triggers champion selection)
      e.stopPropagation();
      // If you want to override normal link navigation, you can also do e.preventDefault() + window.open...
    }

    // Face-off champion
    if (e.target.closest(".face-off-champion")) {
      faceOffChampionWins();
      return;
    }

    // Face-off challenger
    if (e.target.closest(".face-off-challenger")) {
      faceOffChallengerWins();
      return;
    }

    // Trailer link (explicit check with .contains if you prefer)
    // if (e.target.classList.contains("trailer-link")) {
    //   e.stopPropagation();
    //   e.preventDefault();
    //   window.open(e.target.href, "_blank");
    //   return;
    // }

    // RT link
    // if (e.target.classList.contains("rt-link")) {
    //   e.stopPropagation();
    //   e.preventDefault();
    //   window.open(e.target.href, "_blank");
    //   return;
    // }

    // "Submit my Top 5" button from top5DndHTML
    if (e.target.classList.contains("submit-top5-btn")) {
      e.stopPropagation();
      e.preventDefault();
      saveFinalTop5Order(); 
      return;
    }
    const saveBtn = document.getElementById("saveCsvResultsBtn");
    const reloadBtn = document.getElementById("reloadBtn");
  
    if (saveBtn) {
      saveBtn.addEventListener("click", function() {
        console.log("Save CSV Results clicked");
        saveCsvResults();
      });
    }
  
    if (reloadBtn) {
      reloadBtn.addEventListener("click", function() {
        console.log("Reload clicked");
        window.location.reload();
      });
    }
  
  }, true); // End of document.body.addEventListener(...)

  // 5) Poster fallback logic
  const allPosters = document.querySelectorAll("img.poster");
  allPosters.forEach((img) => {
    img.addEventListener("error", function handleError() {
      img.src = img.getAttribute("data-fallback") || "posters/default.jpg";
      img.removeEventListener("error", handleError);
    });
  });
  
  console.log("All event listeners attached via one DOMContentLoaded.");

  // Then your GIS flow for token:
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

  window.requestSheetsTokenAndWrite = function() {
    if (accessToken) {
      console.log("Already have an access token, calling actuallyWriteTop5AndTallies...");
      actuallyWriteTop5AndTallies();
      return;
    }
    console.log("Requesting new token via GIS...");
    tokenClient.requestAccessToken({ prompt: "consent" });
  };

  function actuallyWriteTop5AndTallies() {
    console.log("actuallyWriteTop5AndTallies: we have a token, let's do the writes.");

    const userId = getOrCreateUserId();
    console.log("User ID:", userId);

    isUserIdAlreadySubmitted(userId)
      .then(alreadySubmitted => {
        if (alreadySubmitted) {
          alert("You have already submitted. One submission per user!");
          closePopup();
          throw new Error("Duplicate submission from userId: " + userId);
        }
        // 1) write top5 => "Top5Sheet"
        const top5Array = top5Movies.map(m => m.Title);
        return writeTop5Sheet(userId, top5Array);
      })
      .then(() => {
        // 2) build Title => count dictionary from ID-based 'votes'
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
      
        // Prepare the popup content
        const popup = document.getElementById("popupContent");
        const topPick = top5Movies.length > 0 ? top5Movies[0] : null;
      
          // Construct HTML for the top pick and buttons

        const postSubmissionHTML = `
        <div class="top-pick-container">
          <div class="headline"><h3>Your Top Pick</h3></div>
          <div class="movie top-pick">
            ${movieCardHTML(topPick)}
          </div>
        </div>
        <div id="postSubmissionButtons">
          <button id="saveCsvResultsBtn">Save CSV Results</button>
          <button id="reloadBtn">Reload</button>
        </div>
      `;
      
        // Inject the HTML into the popup
        popup.innerHTML = postSubmissionHTML;
        // Display the postSubmissionButtons container
        document.getElementById("postSubmissionButtons").style.display = "block";

      })
      .then(() => {
        const saveBtn = document.getElementById("saveCsvResultsBtn");
        const reloadBtn = document.getElementById("reloadBtn");
      
        if (saveBtn) {
          saveBtn.addEventListener("click", function() {
            console.log("Save CSV Results clicked");
            saveCsvResults();
          });
        }
      })
    .catch(err => {
      console.error("Failed writing to Sheets:", err);
      alert("Error writing to Sheets. Check console.");
    });
  }

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

  function buildTitleDictionaryFromID() {
    let dict = {};
    for (const movieObj of movies) {
      const id = movieObj.ID;
      const title = movieObj.Title;
      dict[title] = votes[id] || 0;
    }
    return dict;
  }

  async function writeFullTallyRow(userId, titleDict) {
    let allTitles = Object.keys(titleDict);
    allTitles.sort((a, b) => strippedTitle(a).localeCompare(strippedTitle(b)));

    const row = [ userId ];
    for (const t of allTitles) {
      row.push(titleDict[t]);
    }
    row.push(new Date().toISOString());

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

  function strippedTitle(title) {
    return title.replace(/^the\s+/i, "");
  }

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

  /************************************************
   * saveCsvResults:
   * Builds a CSV string of [MovieID, Title, Votes]
   * for each movie in the global 'movies' array.
   * Then triggers a download in the browser.
   ************************************************/
  function saveCsvResults() {
    let csvLines = [];
    csvLines.push(["ID","Title","Votes"]);

    for (const movieObj of movies) {
      const id = movieObj.ID;
      const title = movieObj.Title || "";
      const voteCount = votes[id] || 0;
      csvLines.push([id, title, voteCount]);
    }

    let csvContent = csvLines
      .map(row => row.map(x => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const csvUrl = URL.createObjectURL(blob);

    const tempLink = document.createElement("a");
    tempLink.href = csvUrl;
    tempLink.setAttribute("download", "PollResults.csv");

    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);

    URL.revokeObjectURL(csvUrl);
  }
}); // End DOMContentLoaded
