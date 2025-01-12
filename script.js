/* --------------------------------------------------
   GLOBAL VARIABLES & KOTH LOGIC
-------------------------------------------------- */
let movies = [];
const votes = {};
let champion = null;
let challengerIndex = 0;
let shuffledMovies = [];

// For final top 5
let top5Movies = [];
// For champion face-off
let finalChamp = null;
let finalFifth = null;

// For DnD
let draggedItem = null;
let dragStartIndex = null;

// Sidebar open/close state
let sidebarOpen = false;

/**
 * Load CSV (from GitHub).
 */

function loadCSVFromGoogle() {
  const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQKtP3BFvIRR8gRStw4Hf07giwQlg_WfBdj--bmXCwwUpHpASDLMzZ5oZHfWhlrb6iMJyQl6AAIupzJ/pub?output=csv';
  
  Papa.parse(url, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      movies = results.data;
      movies.forEach((movie, idx) => {
        if (!movie.ID) movie.ID = String(idx);
        votes[movie.ID] = 0;
      });

      // Shuffle
      shuffledMovies = [...movies];
      for (let i = shuffledMovies.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledMovies[i], shuffledMovies[j]] = [shuffledMovies[j], shuffledMovies[i]];
      }

      champion = shuffledMovies[0] || null;
      challengerIndex = 1;

      console.log("CSV loaded, ready to start!");
    },
    error: function(err) {
      console.error("Papa Parse error:", err);
      alert("Failed to read the CSV. Check console for details.");
    }
  });
}

document.addEventListener('DOMContentLoaded', loadCSVFromGoogle);

/* --------------------------------------------------
   WRITING RESULTS TO GOOGLE SHEETS
-------------------------------------------------- */
/*
function handleClientLoad() {
  gapi.load('client:auth2', initClient);
}
*/
function initClient() {
  gapi.client.init({
    apiKey: 'AIzaSyDQAfQqd0amONt3fEXg7stS1lvbQhD7OWA',
    clientId: '866522257651-645mjjbmugbiqoerc8m7ve4ear4fuec8.apps.googleusercontent.com',
    discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
    scope: "https://www.googleapis.com/auth/spreadsheets"
  }).then(function () {
    gapi.auth2.getAuthInstance().signIn();
  });
}

function writePollResultsToSheet() {
  const results = [["Movie ID", "Votes"]];
  for (const [movieID, voteCount] of Object.entries(votes)) {
    results.push([movieID, voteCount]);
  }
  const params = {
    spreadsheetId: '1lUvFx3vsbaFL4xzchsvYlzjbtx9Jy-2EIuA3eKPo1ww',
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
  };

  const valueRangeBody = {
    "majorDimension": "ROWS",
    "values": results
  };

  gapi.client.sheets.spreadsheets.values.update(params, valueRangeBody).then((response) => {
    console.log(response.result);
  }).catch((error) => {
    console.error("Error writing to the sheet:", error);
  });
}

/**
 * Load CSV (via file input).
 */
/* function loadCSV(event) {
   const file = event.target.files[0];
   if (!file) {
     alert("No file selected!");
     return;
   }

   Papa.parse(file, {
     header: true,
     skipEmptyLines: true,
     complete: function(results) {
       movies = results.data;
       movies.forEach((movie, idx) => {
         if (!movie.ID) movie.ID = String(idx);
         votes[movie.ID] = 0;
       });

      // Shuffle
       shuffledMovies = [...movies];
       for (let i = shuffledMovies.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [shuffledMovies[i], shuffledMovies[j]] = [shuffledMovies[j], shuffledMovies[i]];
       }

       champion = shuffledMovies[0] || null;
       challengerIndex = 1;

       console.log("CSV loaded, ready to start!");
     },
     error: function(err) {
       console.error("Papa Parse error:", err);
       alert("Failed to read the CSV. Check console for details.");
     }
   });
 }*/

/* --------------------------------------------------
   STARTING THE GAME
-------------------------------------------------- */
function startGame() {
  if (!champion || movies.length < 2) {
    alert("Please upload a CSV with at least 2 movies before starting!");
    return;
  }
  // Hide start page
  document.getElementById("startPage").style.display = "none";
  // Show movie container
  document.querySelector(".movie-container").style.display = "flex";
  // Show match counter & toggle sidebar button
  document.getElementById("matchCounter").style.display = "block";
  document.getElementById("toggleSidebarBtn").style.display = "block";

  updateMatchCounter();
  renderPair();
  updateSidebarRankings();
}

/* --------------------------------------------------
   MATCH COUNTER
-------------------------------------------------- */
function updateMatchCounter() {
  const totalMatches = (shuffledMovies.length - 1);
  const matchesLeft = (shuffledMovies.length - challengerIndex);
  document.getElementById("matchCounter").textContent = 
    `Matches left: ${matchesLeft} of ${totalMatches}`;
}

/* --------------------------------------------------
   KOTH RENDER & VOTING
-------------------------------------------------- */
function renderPair() {
  if (!champion) return;

  if (challengerIndex >= shuffledMovies.length) {
    alert("No more challengers! Final champion is " + champion.Title);
    finalizeTop5();
    return;
  }

  const championElem = document.getElementById("champion");
  const challengerElem = document.getElementById("challenger");
  const challenger = shuffledMovies[challengerIndex];

  championElem.innerHTML = movieCardHTML(champion);
  challengerElem.innerHTML = movieCardHTML(challenger);

  championElem.setAttribute("data-id", champion.ID);
  challengerElem.setAttribute("data-id", challenger.ID);

  updateMatchCounter();
  updateSidebarRankings();
}

/**
 * Returns HTML for a single movie card, including hover buttons.
 * 
 * CRITICAL FIX: We add onclick="event.stopPropagation()" to the links,
 * so that clicking those links won't trigger the parent's vote click.
 */
function movieCardHTML(movie) {
  if (!movie) return "";
  const trailerLink = movie.Trailer || "#";
  const rtLink = movie["Rotten Tomatoes"] || "#";
  const posterSrc = posterPath(movie);

  return `
    <div class="poster-container">
      <img class="poster" src="${posterSrc}" 
           onerror="this.onerror=null; this.src='posters/default.jpg';" />
      <div class="hover-buttons">
        <a href="${trailerLink}" target="_blank" onclick="event.stopPropagation()">Watch Trailer</a>
        <a href="${rtLink}" target="_blank" onclick="event.stopPropagation()">Rotten Tomatoes</a>
      </div>
    </div>
    <div class="details">
      <h3>${movie.Title} (${movie.Year})</h3>
      <p><strong>Director:</strong> ${movie.Director}</p>
      <p><strong>Genres:</strong> ${movie.Genres}</p>
    </div>
  `;
}

function voteChampion() {
  if (!champion) return;
  votes[champion.ID]++;
  challengerIndex++;
  renderPair();
}

function voteChallenger() {
  if (challengerIndex >= shuffledMovies.length) return;
  const challenger = shuffledMovies[challengerIndex];
  votes[challenger.ID]++;
  champion = challenger;
  challengerIndex++;
  renderPair();
}

function posterPath(movie) {
  const safeTitle = (movie.Title || "unknown")
    .replace(/^The\s+/i, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/gi, "")
    .toLowerCase();
  return `posters/${safeTitle}.jpg`;
}

/* --------------------------------------------------
   SIDEBAR & LIVE RANKINGS
-------------------------------------------------- */
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("open", sidebarOpen);
}

function updateSidebarRankings() {
  const rankingList = document.getElementById("rankingList");
  rankingList.innerHTML = "";

  const sortedArr = [...movies].sort((a, b) => (votes[b.ID] || 0) - (votes[a.ID] || 0));
  sortedArr.forEach((m) => {
    const li = document.createElement("li");
    li.textContent = `${m.Title} - ${votes[m.ID] || 0} votes`;
    rankingList.appendChild(li);
  });
}

/* --------------------------------------------------
   FINALIZING TOP 5 (POPUP)
-------------------------------------------------- */
function finalizeTop5() {
  const sorted = [...movies].sort((a, b) => (votes[b.ID] || 0) - (votes[a.ID] || 0));
  let provisionalTop5 = sorted.slice(0, 5);

  const champIndex = provisionalTop5.findIndex(m => m.ID === champion.ID);
  if (champIndex >= 0) {
    top5Movies = provisionalTop5;
    openPopup_faceOffOrDnd(false);
    return;
  }

  const championVotes = votes[champion.ID] || 0;
  const fifth = provisionalTop5[provisionalTop5.length - 1];
  const fifthVotes = votes[fifth.ID] || 0;

  if (championVotes > fifthVotes) {
    provisionalTop5.pop();
    provisionalTop5.push(champion);
    provisionalTop5.sort((a, b) => (votes[b.ID] || 0) - (votes[a.ID] || 0));
    top5Movies = provisionalTop5;
    openPopup_faceOffOrDnd(false);
  } else if (championVotes < fifthVotes) {
    finalChamp = champion;
    finalFifth = fifth;
    top5Movies = provisionalTop5;
    openPopup_faceOffOrDnd(true);
  } else {
    finalChamp = champion;
    finalFifth = fifth;
    top5Movies = provisionalTop5;
    openPopup_faceOffOrDnd(true);
  }
}

let popupStep = 1;

function openPopup_faceOffOrDnd(faceOffNeeded) {
  popupStep = faceOffNeeded ? 1 : 2;
  const overlay = document.getElementById("popupOverlay");
  const popup = document.getElementById("popupContent");

  overlay.classList.add("active");

  if (faceOffNeeded) {
    popup.innerHTML = faceOffHTML();
  } else {
    popup.innerHTML = top5DndHTML();
    renderTop5List();
  }
}

function faceOffHTML() {
  return `
    <h3>Final Face-off: Champion vs. #5</h3>
    <p>Select which one should enter the Top 5!</p>
    <div class="movie-container" style="display:flex; gap:20px;">
      <div class="movie" onclick="faceOffChampionWins()" style="cursor:pointer;">
        ${movieCardHTML(finalChamp)}
      </div>
      <div class="movie" onclick="faceOffChallengerWins()" style="cursor:pointer;">
        ${movieCardHTML(finalFifth)}
      </div>
    </div>
  `;
}

function faceOffChampionWins() {
  const idx = top5Movies.findIndex(m => m.ID === finalFifth.ID);
  if (idx >= 0) {
    top5Movies.splice(idx, 1);
    top5Movies.push(finalChamp);
  }
  top5Movies.sort((a,b)=> (votes[b.ID]||0) - (votes[a.ID]||0));
  nextPopupStep();
}

function faceOffChallengerWins() {
  nextPopupStep();
}

function nextPopupStep() {
  popupStep = 2;
  const popup = document.getElementById("popupContent");
  popup.innerHTML = top5DndHTML();
  renderTop5List();
}

function top5DndHTML() {
  return `
    <h3>Your Top 5 (Drag & Drop to Reorder)</h3>
    <ul id="top5List"></ul>
    <button onclick="saveFinalTop5Order()">Submit my Top 5</button>
  `;
}

function closePopup() {
  const overlay = document.getElementById("popupOverlay");
  overlay.classList.remove("active");
}

/* --------------------------------------------------
   DRAG & DROP FOR TOP 5 (LIVE REORDER)
-------------------------------------------------- */
function renderTop5List() {
  const listEl = document.getElementById("top5List");
  if (!listEl) return;
  listEl.innerHTML = "";

  top5Movies.forEach((movie, index) => {
    const li = document.createElement("li");
    li.textContent = `${movie.Title} (${movie.Year})`;
    li.draggable = true;
    li.dataset.index = index;

    li.addEventListener("dragstart", handleDragStart);
    li.addEventListener("dragend", handleDragEnd);
    li.addEventListener("dragover", handleDragOver);
    li.addEventListener("dragleave", handleDragLeave);
    li.addEventListener("drop", handleDrop);

    listEl.appendChild(li);
  });
}

function handleDragStart(e) {
  draggedItem = e.currentTarget;
  draggedItem.classList.add("dragging");
  dragStartIndex = parseInt(draggedItem.dataset.index, 10);
  e.dataTransfer.effectAllowed = "move";
}

function handleDragEnd(e) {
  if (draggedItem) {
    draggedItem.classList.remove("dragging");
  }
  draggedItem = null;
  dragStartIndex = null;
}

function handleDragOver(e) {
  e.preventDefault();
  if (!draggedItem || draggedItem === e.currentTarget) return;

  const hoveredItem = e.currentTarget;
  hoveredItem.classList.add("drag-over");

  const bounding = hoveredItem.getBoundingClientRect();
  const offset = e.clientY - bounding.top;
  const half = bounding.height / 2;

  let hoveredIndex = parseInt(hoveredItem.dataset.index, 10);
  let newIndex = hoveredIndex;
  if (offset > half) {
    newIndex = hoveredIndex + 1;
  }

  if (newIndex !== dragStartIndex) {
    const itemToMove = top5Movies[dragStartIndex];
    top5Movies.splice(dragStartIndex, 1);
    if (newIndex >= top5Movies.length) {
      top5Movies.push(itemToMove);
    } else {
      top5Movies.splice(newIndex, 0, itemToMove);
    }
    renderTop5List();
    dragStartIndex = newIndex;
  }
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");
}

function saveFinalTop5Order() {
  console.log("Final Top 5 Order:", top5Movies);
  alert("Your final Top 5 order is saved!");
  writePollResultsToSheet();
  closePopup();
}

document.addEventListener('DOMContentLoaded', function() {
  handleClientLoad();
});
