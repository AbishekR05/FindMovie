import React, { useState, useMemo } from "react";
import "./puzzlegrid.css";
import sampleMovie from "../../data/sampleMovie.json";

// contract: accepts optional `movie` prop. If not provided, falls back to sampleMovie.
// grid positions (row,col) -> index mapping:
// 0 -> (0,0) maleLead initial
// 1 -> (0,1) femaleLead initial
// 2 -> (1,0) movie title initial
// 3 -> (1,1) song initial (first song)
const PuzzleGrid = ({ movie }) => {
  const [selectedCells, setSelectedCells] = useState([]);

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
    setSelectedCells((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  };

  const labels = ["Male Lead", "Female Lead", "Movie Title", "Song"];

  return (
    <div className="puzzle-container">
      <div className="grid grid-2x2">
        {initials.map((letter, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            className={`cell ${selectedCells.includes(i) ? "active" : ""}`}
            onClick={() => handleCellClick(i)}
            onKeyPress={(e) => e.key === "Enter" && handleCellClick(i)}
            title={selectedCells.includes(i) ? labels[i] : "Click to reveal"}
          >
            <div className="cell-inner">
              {selectedCells.includes(i) ? (
                <span className="initial">{letter}</span>
              ) : (
                <span className="covered">?</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PuzzleGrid;
