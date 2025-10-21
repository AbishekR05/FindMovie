import React, { useState } from "react";
import "./puzzlegrid.css";

const PuzzleGrid = () => {
  const [selectedCells, setSelectedCells] = useState([]);

  const handleCellClick = (index) => {
    setSelectedCells((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  return (
    <div className="puzzle-container">
      <h2>🎬 Movie Guess Grid (2×2)</h2>
      <div className="grid grid-2x2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`cell ${selectedCells.includes(i) ? "active" : ""}`}
            onClick={() => handleCellClick(i)}
          >
            {selectedCells.includes(i) ? "🎥" : ""}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PuzzleGrid;
