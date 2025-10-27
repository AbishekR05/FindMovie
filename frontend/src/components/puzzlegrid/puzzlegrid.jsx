import React, { useState, useMemo, useRef, useEffect } from "react";
import "./puzzlegrid.css";
import sampleMovie from "../../data/sampleMovie.json";

// contract: accepts optional `movie` prop. If not provided, falls back to sampleMovie.
// grid positions (row,col) -> index mapping:
// 0 -> (0,0) maleLead initial
// 1 -> (0,1) femaleLead initial
// 2 -> (1,0) movie title initial
// 3 -> (1,1) song initial (first song)
const PuzzleGrid = ({ movie, onSubmitGuess, onAllFound }) => {
  const [selectedCells, setSelectedCells] = useState([]);
  const [answerText, setAnswerText] = useState("");
  const inputRef = useRef(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [tileStatus, setTileStatus] = useState([null, null, null, null]); // null | 'success' | 'fail'
  const tileTimeouts = useRef({});
  const [tileLocked, setTileLocked] = useState([false, false, false, false]);
  const containerRef = useRef(null);
  const [confettiPlayed, setConfettiPlayed] = useState(false);

  useEffect(() => {
    const tt = tileTimeouts.current;
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      // clear any per-tile timeouts captured at mount
      Object.values(tt || {}).forEach((t) => t && clearTimeout(t));
    };
  }, []);

  // When all tiles are locked, fire confetti once and notify parent via onAllFound
  useEffect(() => {
    const allLocked = tileLocked.length > 0 && tileLocked.every(Boolean);
    if (allLocked && !confettiPlayed) {
      setConfettiPlayed(true);
      fireConfetti();
      if (typeof onAllFound === "function") {
        try {
          onAllFound();
        } catch (err) {
          console.error('onAllFound handler threw', err);
        }
      }
    }
  }, [tileLocked, confettiPlayed, onAllFound]);

  const fireConfetti = (count = 40) => {
    const colors = ["#ff5e5e", "#ffd54f", "#66d9ff", "#8affc1", "#c78cff"];
    const container = containerRef.current || document.body;
    const pieces = [];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.left = `${30 + Math.random() * 40}%`;
      el.style.transform = `rotate(${Math.random() * 360}deg)`;
      el.style.opacity = `${0.9 + Math.random() * 0.1}`;
      container.appendChild(el);
      pieces.push(el);
      // remove after animation
      setTimeout(() => {
        try { el.remove(); } catch (e) {}
      }, 2200 + Math.random() * 800);
    }
  };

  const showToast = (msg, ms = 2200) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };

  const activeMovie = movie || sampleMovie;

  const initials = useMemo(() => {
    const safe = (s) => (typeof s === "string" && s.trim().length > 0 ? s.trim() : "?");

    const male = safe(activeMovie.maleLead);
    const female = safe(activeMovie.femaleLead);
    const title = safe(activeMovie.title);
    let song = "";
    if (Array.isArray(activeMovie.songs) && activeMovie.songs.length > 0) {
      song = safe(activeMovie.songs[0]);
    } else {
      // fallback to musicDirector or '?' if no songs
      song = safe(activeMovie.musicDirector || "?");
    }

    const firstLetter = (str) => {
      // find first alphabetical / non-space char
      const m = str.match(/[A-Za-z0-9]/);
      return m ? m[0].toUpperCase() : str.charAt(0).toUpperCase() || "?";
    };

    return [firstLetter(male), firstLetter(female), firstLetter(title), firstLetter(song)];
  }, [activeMovie]);

  const handleCellClick = (index) => {
    // don't allow toggling locked tiles
    if (tileLocked[index]) return;

    setSelectedCells((prev) => {
      // single-select behavior: clicking a tile selects it exclusively; clicking again deselects
      const next = prev.includes(index) ? prev.filter((i) => i !== index) : [index];
      // focus input if a cell becomes selected, blur if none selected
      setTimeout(() => {
        if (next.length > 0) {
          inputRef.current?.focus();
        } else {
          inputRef.current?.blur();
        }
      }, 0);
      return next;
    });
  };

  const labels = ["Male Lead", "Female Lead", "Movie Title", "Song"];

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (selectedCells.length === 0) return;
    if (!answerText || answerText.trim().length === 0) return;

    // Validate guess against selected cell initials: only allow guesses starting with that letter(s)
    const allowedLetters = selectedCells.map((i) => initials[i]).filter(Boolean).map((c) => c.toLowerCase());
    const guessFirst = answerText.trim().charAt(0).toLowerCase();
    if (!allowedLetters.includes(guessFirst)) {
      showToast("Wrong. try again.");
      return;
    }

    const payload = {
      guess: answerText.trim(),
      selectedCells: [...selectedCells],
      movie: activeMovie,
    };

    // For each selected tile, validate full answer against that tile's data and show success/fail
    const normalize = (s) => (s && String(s).trim().toLowerCase()) || "";
    const guessNorm = normalize(answerText);
    const guessTokens = answerText.trim().split(/\s+/).filter(Boolean);
    const base = process.env.REACT_APP_SOCKET_URL || "http://localhost:4000";

    // iterate selected cells sequentially to allow async fetch per tile
    for (const idx of selectedCells) {
      // skip tiles which are already locked (already correctly answered)
      if (tileLocked[idx]) continue;
      let actual = "";
      switch (idx) {
        case 0:
          actual = activeMovie.maleLead;
          break;
        case 1:
          actual = activeMovie.femaleLead;
          break;
        case 2:
          actual = activeMovie.title;
          break;
        case 3:
          if (Array.isArray(activeMovie.songs) && activeMovie.songs.length > 0) actual = activeMovie.songs[0];
          else actual = activeMovie.musicDirector || "";
          break;
        default:
          actual = "";
      }

      // direct full match
      const okFull = normalize(actual) === guessNorm;
      let ok = okFull;

      // If not an exact full match, but user entered only a single token (first name),
      // and this tile refers to maleLead/femaleLead, then allow if that first name is unique across dataset.
      if (!ok && guessTokens.length === 1 && (idx === 0 || idx === 1)) {
        const guessFirst = guessTokens[0].toLowerCase();
        const actualFirst = (String(actual || '').split(/\s+/)[0] || '').toLowerCase();
        if (guessFirst === actualFirst) {
          try {
            const res = await fetch(`${base}/api/first-name-count?field=${idx===0? 'maleLead':'femaleLead'}&name=${encodeURIComponent(guessFirst)}`);
            if (res.ok) {
              const j = await res.json();
              const count = Number(j && j.count) || 0;
              if (count === 1) ok = true;
            }
          } catch (err) {
            // network error: fall back to strict matching
            console.warn('first-name-count lookup failed', err);
          }
        }
      }

      const okResult = ok;

      if (okResult) {
        // mark tile permanently locked (correct)
        setTileLocked((prev) => {
          const c = [...prev];
          c[idx] = true;
          return c;
        });
        setTileStatus((prev) => {
          const copy = [...prev];
          copy[idx] = "success";
          return copy;
        });
        // remove this tile from selectedCells so it's not editable further
        setSelectedCells((prev) => prev.filter((i) => i !== idx));
      } else {
        // transient fail
        setTileStatus((prev) => {
          const copy = [...prev];
          copy[idx] = "fail";
          return copy;
        });

        // clear previous timeouts for this tile
        if (tileTimeouts.current[idx]) clearTimeout(tileTimeouts.current[idx]);
        tileTimeouts.current[idx] = setTimeout(() => {
          setTileStatus((prev) => {
            const copy = [...prev];
            copy[idx] = null;
            return copy;
          });
        }, 1000);
      }
    }

    if (typeof onSubmitGuess === "function") {
      try {
        onSubmitGuess(payload);
      } catch (err) {
        console.error("onSubmitGuess handler threw:", err);
      }
    } else {
      // default behaviour: log to console
      console.info("Guess submitted:", payload);
    }

    // Clear input but keep the selection (so user can submit again if desired)
    setAnswerText("");
    // return focus to input for quick subsequent guesses
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="puzzle-container" ref={containerRef}>
      <div className="grid grid-2x2">
        {initials.map((letter, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            className={`cell ${selectedCells.includes(i) ? "active" : ""} ${tileStatus[i] ? tileStatus[i] : ""} ${tileLocked[i] ? "locked" : ""}`}
            onClick={() => handleCellClick(i)}
            onKeyPress={(e) => e.key === "Enter" && handleCellClick(i)}
            title={labels[i]}
          >
            <div className="cell-inner">
              {/* show initials by default; selection still toggles highlight */}
              <span className="initial">{letter}</span>
            </div>
          </div>
        ))}
      </div>
      {/* Answer box: enabled only when at least one tile is selected */}
      <form className="answer-wrapper" onSubmit={handleSubmit} aria-label="Submit answer">
        <label htmlFor="answer-input" className="visually-hidden">Type your guess</label>
        <div className="answer-field">
          {toast ? <div className="puzzle-toast" role="status">{toast}</div> : null}
          <input
            id="answer-input"
            ref={inputRef}
            className="answer-input"
            type="text"
            placeholder={selectedCells.length > 0 ? "Type your answer here..." : "Select a tile to enable typing"}
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            disabled={selectedCells.length === 0}
            aria-disabled={selectedCells.length === 0}
          />
          <button
            type="submit"
            className="answer-submit"
            disabled={selectedCells.length === 0 || answerText.trim().length === 0}
            aria-label="Submit guess"
          >
            Guess
          </button>
        </div>
      </form>
    </div>
  );
};

export default PuzzleGrid;
