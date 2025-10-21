import React from "react";
import PuzzleGrid from "../components/puzzlegrid/puzzlegrid";

const SinglePlayer = () => {
  return (
    <div className="single-wrapper">
      <h2 className="section-title">🎬 Single Player Mode</h2>
      <p className="section-subtitle">Flip the tiles and guess the movie.</p>
      <PuzzleGrid />
    </div>
  );
};

export default SinglePlayer;
