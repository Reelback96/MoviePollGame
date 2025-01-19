/********************************************
 * script.js — Manages KOTH logic & final top5
 ********************************************/

/* --------------------------------------------------
   GLOBAL VARIABLES
-------------------------------------------------- */
// We'll store all movies from the CSV here.
let movies = [];

// Tracks champion "win" counts by ID
const votes = {};

// The current champion, next challenger index, etc.
let champion = null;
let challengerIndex = 0;
let shuffledMovies = [];

// We'll also build a sorted list of all movie titles
// from the CSV if needed, e.g. for final tallies.
let MOVIE_LIST = [];

// The user's final top 5 picks after the KOTH process
let top5Movies = [];

// For face-off logic
let finalChamp = null;
let finalFifth = null;

// For drag & drop
let draggedItem = null;
let dragStartIndex = null;

// Tracks whether the sidebar is open
let sidebarOpen = false;

/**
 * loadCSVFromGoogle:
 * Loads a published Google Sheet as CSV (via Papa Parse).
 * Called from the start button in event-handlers.js.
 */
function loadCSVFromGoogle() {
  return new Promise((resolve, reject) => {
    const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQKtP3BFvIRR8gRStw4Hf07giwQlg_WfBdj--bmXCwwUpHpASDLMzZ5oZHfWhlrb6iMJyQl6AAIupzJ/pub?output=csv";

    const loadingPopup = document.getElementById("loadingPopupOverlay");
    loadingPopup.classList.add("active");

    const startTime = Date.now();

    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        const endTime = Date.now();
        // Hide or remove loading popup
        if (endTime - startTime < 1000) {
          loadingPopup.style.display = "none";
        } else {
          loadingPopup.classList.remove("active");
        }

        // Store the CSV data as an array of objects
        movies = results.data;

        // Assign IDs if missing; init vote counts
        movies.forEach((movie, idx) => {
          if (!movie.ID) movie.ID = String(idx);
          votes[movie.ID] = 0;
        });

        // Build MOVIE_LIST from "Title" column
        // (optional if you need a full alphabetical list of titles)
        MOVIE_LIST = movies.map(row => row.Title?.trim() || "Untitled");
        // If you want to sort ignoring leading "The ", do:
        // MOVIE_LIST.sort(compareMoviesIgnoringLeadingThe);

        // Shuffle for champion-challenger
        shuffledMovies = [...movies];
        for (let i = shuffledMovies.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledMovies[i], shuffledMovies[j]] = [shuffledMovies[j], shuffledMovies[i]];
        }

        // The first champion
        champion = shuffledMovies[0] || null;
        challengerIndex = 1;

        console.log("CSV loaded, ready to start!");
        console.log("MOVIE_LIST:", MOVIE_LIST);

        resolve();
      },
      error: function (err) {
        loadingPopup.classList.remove("active");
        console.error("Papa Parse error:", err);
        alert("Failed to read the CSV. Check console for details.");
        reject(err);
      },
    });
  });
}

/* --------------------------------------------------
   START THE GAME
-------------------------------------------------- */
/**
 * Called once CSV is loaded (in event-handlers)
 * or from the code after load is done.
 */
function startGame() {
  if (!champion || movies.length < 2) {
    alert("Please load a CSV with at least 2 movies before starting!");
    return;
  }

  // Hide the start page
  document.getElementById("startPage").style.display = "none";

  // Show the main KOTH container
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
  const totalMatches = shuffledMovies.length - 1;
  const matchesLeft = (shuffledMovies.length - challengerIndex);

  const counterEl = document.getElementById("matchCounter");

  // If on mobile
  if (window.innerWidth <= 600) {
    // "74/74" style
    counterEl.textContent = `${matchesLeft}/${totalMatches}`;
  } else {
    // Desktop: "Matches left: 74 of 74"
    counterEl.textContent = `Matches left: ${matchesLeft} of ${totalMatches}`;
  }
}


/* --------------------------------------------------
   KOTH RENDER & VOTING
-------------------------------------------------- */
/**
 * Renders champion vs next challenger, updates sidebar, etc.
 * If no challengers left => finalize top 5.
 */
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

  // NEW: highlight champion side
  championElem.classList.add("movie", "current-champion");
  challengerElem.classList.remove("current-champion"); // ensure only champion side has highlight

  updateMatchCounter();
  updateSidebarRankings();
}

/**
 * Builds the HTML for a single movie card,
 * with poster, trailer link, RT link, etc.
 */
function movieCardHTML(movie) {
  if (!movie) return "";

  const posterSrc = posterPath(movie);
  const trailerLink = movie.Trailer || "#";
  const rtLink = movie["Rotten Tomatoes"] || "#";

  return `
    <div class="poster-container">
      <img class="poster" src="${posterSrc}" data-fallback="posters/default.jpg" />

      <!-- Desktop hover buttons (hidden on mobile) -->
      <div class="hover-buttons">
        <a href="${trailerLink}" class="trailer-link" target="_blank">Trailer</a>
        <a href="${rtLink}" class="rt-link" target="_blank">Rotten Tomatoes</a>
      </div>
    </div>

    <!-- Mobile-only separate links -->
    <div class="mobile-links">
      <a href="${trailerLink}" class="trailer-link mobile-button" target="_blank">Trailer</a>
      <a href="${rtLink}" class="rt-link mobile-button" target="_blank">Rotten Tomatoes</a>
    </div>

    <div class="details">
      <h3>${movie.Title} (${movie.Year})</h3>
      <p><strong>Director:</strong> ${movie.Director}</p>
      <p><strong>Genres:</strong> ${movie.Genres}</p>
    </div>
  `;
}

/**
 * If user clicks champion => champion gets a "win" (votes++),
 * move on to next challenger.
 */
function voteChampion() {
  if (!champion) return;
  votes[champion.ID]++;
  challengerIndex++;
  renderPair();
}

/**
 * If user clicks challenger => challenger becomes the new champion,
 * increment that challenger’s votes, move on.
 */
function voteChallenger() {
  if (challengerIndex >= shuffledMovies.length) return;
  const challenger = shuffledMovies[challengerIndex];
  votes[challenger.ID]++;
  champion = challenger;
  challengerIndex++;
  renderPair();
}

/**
 * Poster path logic:
 * e.g. "The Town" => "the_town.jpg"
 */
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
/**
 * Toggles the sidebar showing the current vote counts.
 */
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("open", sidebarOpen);
}

/**
 * Rebuilds the sidebar ranking:
 * Sorts by highest votes => lowest, display Title + count.
 */
function updateSidebarRankings() {
  const rankingList = document.getElementById("rankingList");
  rankingList.innerHTML = "";

  // Sort by vote count descending
  const sortedArr = [...movies].sort(
    (a, b) => (votes[b.ID] || 0) - (votes[a.ID] || 0)
  );
  sortedArr.forEach((m) => {
    const li = document.createElement("li");
    li.textContent = `${m.Title} - ${votes[m.ID] || 0} votes`;
    rankingList.appendChild(li);
  });
}

/* --------------------------------------------------
   FINALIZING TOP 5 (POPUP)
-------------------------------------------------- */
/**
 * Called once all challengers exhausted.
 * We pick top5 from the sorted "votes" data, plus champion if needed.
 * Then show face-off or the final DnD popup.
 */
function finalizeTop5() {
  console.log("=== finalizeTop5 CALLED, champion is:", champion);
  const sorted = [...movies].sort(
    (a, b) => (votes[b.ID] || 0) - (votes[a.ID] || 0)
  );
  let provisionalTop5 = sorted.slice(0, 5);

  // If champion is already in top5
  const champIndex = provisionalTop5.findIndex((m) => m.ID === champion.ID);
  if (champIndex >= 0) {
    console.log("Champion is already in the top 5: ", champion);
    top5Movies = provisionalTop5;
    openPopup_faceOffOrDnd(false);
    return;
  }

  // Otherwise, see if champion should displace #5
  const championVotes = votes[champion.ID] || 0;
  const fifth = provisionalTop5[provisionalTop5.length - 1];
  const fifthVotes = votes[fifth.ID] || 0;

  if (championVotes > fifthVotes) {
    // champion auto-enters top5
    console.log("Champion displaces #5 (more votes) => no face-off:", championVotes, fifthVotes);
    provisionalTop5.pop();
    provisionalTop5.push(champion);
    provisionalTop5.sort((a, b) => (votes[b.ID] || 0) - (votes[a.ID] || 0));
    top5Movies = provisionalTop5;
    openPopup_faceOffOrDnd(false);
  } else if (championVotes < fifthVotes) {
    console.log("Champion has FEWER votes => final face-off triggered:", championVotes, fifthVotes);
    finalChamp = champion;
    finalFifth = fifth;
    top5Movies = provisionalTop5;
    openPopup_faceOffOrDnd(true);
  } else {
    console.log("Tie => final face-off triggered:", championVotes, fifthVotes);
    finalChamp = champion;
    finalFifth = fifth;
    top5Movies = provisionalTop5;
    openPopup_faceOffOrDnd(true);
  }
}

let popupStep = 1;

/**
 * If faceOffNeeded is true => final champion vs #5 face-off.
 * Otherwise => show DnD reorder.
 */
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
  console.log("faceOffHTML finalChamp:", finalChamp);
  console.log("Champion poster path:", posterPath(finalChamp));
  console.log("faceOffHTML finalFifth:", finalFifth);
  return `
    <h3>Final Face-off: Champion vs. #5</h3>
    <p>Select which one should enter the Top 5!</p>
    <div class="faceoff-container">
      <div class="movie face-off-champion current-champion">
        ${movieCardHTML(finalChamp)}
      </div>
      <div class="movie face-off-challenger">
        ${movieCardHTML(finalFifth)}
      </div>
    </div>
  `;
}

function faceOffChampionWins() {
  // champion displaces the #5 pick
  const idx = top5Movies.findIndex((m) => m.ID === finalFifth.ID);
  if (idx >= 0) {
    top5Movies.splice(idx, 1);
    top5Movies.push(finalChamp);
  }
  top5Movies.sort((a, b) => (votes[b.ID] || 0) - (votes[a.ID] || 0));
  nextPopupStep();
}

function faceOffChallengerWins() {
  // user picks #5 over champion
  nextPopupStep();
}

function nextPopupStep() {
  popupStep = 2;
  const popup = document.getElementById("popupContent");
  popup.innerHTML = top5DndHTML();
  renderTop5List();
}

/**
 * The drag-and-drop HTML for top5 rearrangement.
 */
function top5DndHTML() {
  return `
    <h3>Your Top 5 (Drag & Drop to Reorder)</h3>
    <ul id="top5List"></ul>
    <button class="submit-top5-btn">Submit my Top 5</button>
  `;
}

function closePopup() {
  const overlay = document.getElementById("popupOverlay");
  overlay.classList.remove("active");
}

/* --------------------------------------------------
   DRAG & DROP FOR TOP 5
-------------------------------------------------- */
/**
 * Rebuilds #top5List with the current order of top5Movies,
 * each item draggable.
 */
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
    // reinsert the item in top5Movies
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

/**
 * Called after user finalizes the DnD order, we:
 *  - log final top5Movies
 *  - then call requestSheetsTokenAndWrite() from event-handlers
 */
function saveFinalTop5Order() {
  console.log("Final Top 5 Order:", top5Movies);
  if (typeof window.requestSheetsTokenAndWrite === 'function') {
    window.requestSheetsTokenAndWrite();
  } else {
    console.error("requestSheetsTokenAndWrite is not defined globally.");
  }
}
