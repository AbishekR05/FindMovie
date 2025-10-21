import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/homepage/homepage";
import SinglePlayer from "./pages/singleplayer";
import MultiPlayer from "./pages/multiplayer/multiplayer";

function App() {
  return (
    <Router>
      <header className="site-header">
        <div className="site-header-inner">
          <a href="/" className="site-logo" aria-label="Movie Guess Game Home">🎞️ Movie Guess</a>
          <nav className="site-nav" aria-label="Main">
            <a className="nav-link" href="/single">Single</a>
            <a className="nav-link" href="/multi">Multiplayer</a>
          </nav>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/single" element={<SinglePlayer />} />
        <Route path="/multi" element={<MultiPlayer />} />
      </Routes>
    </Router>
  );
}

export default App;
