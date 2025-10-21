import React from "react";
import { useNavigate } from "react-router-dom";
import "./homepage.css";

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <main className="hp-hero">
      <div className="hp-inner">
        <div className="hp-logo">🎞️</div>
        <h1 className="hp-title">Movie Guess Game</h1>
        <p className="hp-sub">Quick, minimal, and fun — guess the movie from the clues.</p>

        <div className="hp-actions">
          <button className="hp-btn primary" onClick={() => navigate("/single")}>🎮 Single Player</button>
          <button className="hp-btn" onClick={() => navigate("/multi")}>🧑‍🤝‍🧑 Multiplayer</button>
        </div>
      </div>
    </main>
  );
};

export default HomePage;
