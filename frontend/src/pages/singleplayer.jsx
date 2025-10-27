import React, { useEffect, useState } from "react";
import PuzzleGrid from "../components/puzzlegrid/puzzlegrid";

const SinglePlayer = () => {
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [difficulty, setDifficulty] = useState("all"); // all | easy | medium | difficult

  useEffect(() => {
    let mounted = true;
    const base = process.env.REACT_APP_SOCKET_URL || "http://localhost:4000";

    const fetchMovie = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = difficulty && difficulty !== "all" ? `?difficulty=${encodeURIComponent(difficulty)}` : "";
        const res = await fetch(`${base}/api/movies/random${q}`);
        const ct = res.headers.get("content-type") || "";
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
        }
        if (!ct.includes("application/json")) {
          const text = await res.text();
          throw new Error(`non_json_response: ${text.slice(0, 200)}`);
        }
        const data = await res.json();
        if (!mounted) return;
        if (data && data.movie) setMovie(data.movie);
        else setError("no_movie_returned");
      } catch (err) {
        console.error("fetch movie failed", err);
        if (mounted) setError(err && err.message ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchMovie();

    return () => {
      mounted = false;
    };
  }, [difficulty]);

  const handleRefresh = () => {
    // bump difficulty (re-run effect) by re-setting same value — call fetch manually
    const base = process.env.REACT_APP_SOCKET_URL || "http://localhost:4000";
    setLoading(true);
    setError(null);
    const q = difficulty && difficulty !== "all" ? `?difficulty=${encodeURIComponent(difficulty)}` : "";
    fetch(`${base}/api/movies/random${q}`)
      .then(async (res) => {
        const ct = res.headers.get("content-type") || "";
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
        }
        if (!ct.includes("application/json")) {
          const text = await res.text();
          throw new Error(`non_json_response: ${text.slice(0, 200)}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.movie) setMovie(data.movie);
        else setError("no_movie_returned");
      })
      .catch((err) => {
        console.error("fetch movie failed", err);
        setError(err && err.message ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="single-wrapper">
      {/* Floating filter in top-right below header */}
      <div className="page-filter">
        <label htmlFor="difficulty-select" style={{ marginRight: 8, fontWeight: 600 }}>Filter</label>
        <select id="difficulty-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd' }}>
          <option value="all">All</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="difficult">Difficult</option>
        </select>
        <button onClick={handleRefresh} style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 6 }}>Refresh</button>
      </div>
      <h2 className="section-title">🎬 Single Player Mode</h2>
      <p className="section-subtitle">Flip the tiles and guess the movie.</p>
      {/* Inline filter removed — using floating filter at top-right */}

      {loading ? (
        <p>Loading movie…</p>
      ) : error ? (
        <div>
          <p>Error loading movie: {String(error)}</p>
          <PuzzleGrid /> {/* fallback to internal sample */}
        </div>
      ) : (
        <div>
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 16, color: "#444" }}>Now showing: <strong>{movie.title}</strong></div>
            <div style={{ fontSize: 13, color: "#777" }}>{movie.year} • difficulty: {movie.difficulty || "n/a"}</div>
          </div>
          <PuzzleGrid movie={movie} />
        </div>
      )}
    </div>
  );
};

export default SinglePlayer;
