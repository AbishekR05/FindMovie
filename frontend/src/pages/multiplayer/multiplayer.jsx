import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import PuzzleGrid from "../../components/puzzlegrid/puzzlegrid";
import VoiceChat from "../../components/voicechat";
import "./multiplayer.css";

export default function Multiplayer() {
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);
  const [mode, setMode] = useState(null); // 'create' | 'join' | null

  // movie filter for puzzle (same as SinglePlayer)
  const [difficulty, setDifficulty] = useState("all"); // all | easy | medium | difficult
  const [movie, setMovie] = useState(null);
  const [loadingMovie, setLoadingMovie] = useState(false);
  const [movieError, setMovieError] = useState(null);

  const [socketStatus, setSocketStatus] = useState("idle");
  const [socketUrlString, setSocketUrlString] = useState("");

  // text chat states
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // initialize socket once
  const socketUrl = process.env.REACT_APP_SOCKET_URL || `http://${window.location.hostname || "localhost"}:4000`;
  setSocketUrlString(socketUrl);
  setSocketStatus("connecting");
  socketRef.current = io(socketUrl);

  // quick health check (HTTP GET /health) to help diagnose connectivity
  try {
    fetch(`${socketUrl.replace(/\/$/, "")}/health`).then((res) => {
      if (res.ok) setSocketStatus((s) => (s === "connecting" ? "connected" : s));
    }).catch(() => {
      // ignore - socket events will provide status
    });
  } catch (e) {
    // noop
  }

    const handleNewMessage = (data) => {
      console.debug("<-- incoming newMessage", data);
      setMessages((prev) => [...prev, data]);
    };

    const handleRoomUpdate = (room) => {
      if (room && room.messages) setMessages(room.messages);
    };

  socketRef.current.on("newMessage", handleNewMessage);
  socketRef.current.on("roomUpdate", handleRoomUpdate);

  socketRef.current.on("connect", () => setSocketStatus("connected"));
  socketRef.current.on("connect_error", () => setSocketStatus("error"));
  socketRef.current.on("disconnect", () => setSocketStatus("disconnected"));

    return () => {
      if (socketRef.current) {
        socketRef.current.off("newMessage", handleNewMessage);
        socketRef.current.off("roomUpdate", handleRoomUpdate);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // fetch a random movie for the multiplayer puzzle (when joined or when difficulty changes)
  useEffect(() => {
    let mounted = true;
    const base = process.env.REACT_APP_SOCKET_URL || `http://${window.location.hostname || "localhost"}:4000`;
    const fetchMovie = async () => {
      setLoadingMovie(true);
      setMovieError(null);
      try {
        const q = difficulty && difficulty !== "all" ? `?difficulty=${encodeURIComponent(difficulty)}` : "";
        const res = await fetch(`${base}/api/movies/random${q}`);
        const ct = res.headers.get("content-type") || "";
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0,200)}`);
        }
        if (!ct.includes("application/json")) {
          const text = await res.text();
          throw new Error(`non_json_response: ${text.slice(0,200)}`);
        }
        const data = await res.json();
        if (!mounted) return;
        if (data && data.movie) setMovie(data.movie);
        else setMovieError("no_movie_returned");
      } catch (err) {
        console.error("fetch movie failed", err);
        if (mounted) setMovieError(err && err.message ? err.message : String(err));
      } finally {
        if (mounted) setLoadingMovie(false);
      }
    };

    // only fetch when user has joined the room (so multiplayer puzzle is meaningful),
    // however allow fetching even before join so host can prepare
    fetchMovie();

    return () => { mounted = false };
  }, [difficulty]);

  // legacy single-click join removed; use handleCreate / handleJoin instead

  function makeRoomId() {
    // generate a 6-digit numeric code with leading zeros allowed
    return Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
  }

  const handleCreate = () => {
    if (!userName.trim() || !socketRef.current) return;
    const newId = makeRoomId();
    setRoomId(newId);
    console.debug("--> emit createRoom", { roomId: newId, username: userName });
    socketRef.current.emit("createRoom", { roomId: newId, username: userName }, (ack) => {
      console.debug("createRoom ack", ack);
    });
    // ensure server registers us
    socketRef.current.emit("joinRoom", { roomId: newId, username: userName });
    setJoined(true);
  };

  const handleJoin = () => {
    if (!roomId.trim() || !userName.trim() || !socketRef.current) return;
    console.debug("--> emit joinRoom", { roomId, username: userName });
    socketRef.current.emit("joinRoom", { roomId, username: userName }, (ack) => {
      console.debug("joinRoom ack", ack);
    });
    setJoined(true);
  };

  const sendMessage = () => {
    if (!message.trim() || !socketRef.current) return;
    console.debug("--> emit chatMessage", { roomId, username: userName, message });
    socketRef.current.emit("chatMessage", { roomId, username: userName, message }, (ack) => {
      console.debug("ack for chatMessage", ack);
    });
    setMessage("");
  };

  return (
    <div className="multi-page">
      {/* connection status display */}
      <div className="conn-status">
        Socket: <code className="code-chip">{socketUrlString}</code>
        Status: <strong className={`status-${socketStatus}`}>{socketStatus}</strong>
      </div>
      {!joined ? (
        <div className="join-container centered-join">
          <h2>🧩 Create or Join a Room</h2>
          {mode === null ? (
            <div className="mode-switch">
              <button onClick={() => setMode("create")}>Create Room</button>
              <button onClick={() => setMode("join")}>Join Room</button>
            </div>
          ) : (
            <div className="back-row">
              <button onClick={() => setMode(null)} className="back-button">← Back</button>
            </div>
          )}
          {mode === "create" && (
            <div className="v-stack">
              <input placeholder="Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} />
              <button onClick={handleCreate} disabled={!userName.trim()}>Create</button>
              {roomId && (
                <div className="room-info">
                  Created Room ID: <code>{roomId}</code>
                </div>
              )}
            </div>
          )}

          {mode === "join" && (
            <div className="v-stack">
              <input placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
              <input placeholder="Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} />
              <button onClick={handleJoin} disabled={!roomId.trim() || !userName.trim()}>Join</button>
            </div>
          )}
        </div>
      ) : (
        <>
          <h3>🎮 Room: {roomId}</h3>

          <div className="game-layout">
            <div className="puzzle-panel">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                  <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label htmlFor="mp-difficulty" style={{ fontWeight: 600 }}>Filter:</label>
                    <select id="mp-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd' }}>
                      <option value="all">All</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="difficult">Difficult</option>
                    </select>
                    <button onClick={() => {
                      // manual refresh: fetch a new movie with current difficulty
                      const base = process.env.REACT_APP_SOCKET_URL || `http://${window.location.hostname || "localhost"}:4000`;
                      setLoadingMovie(true);
                      setMovieError(null);
                      const q = difficulty && difficulty !== "all" ? `?difficulty=${encodeURIComponent(difficulty)}` : "";
                      fetch(`${base}/api/movies/random${q}`)
                        .then(async (res) => {
                          const ct = res.headers.get("content-type") || "";
                          if (!res.ok) {
                            const text = await res.text();
                            throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0,200)}`);
                          }
                          if (!ct.includes("application/json")) {
                            const text = await res.text();
                            throw new Error(`non_json_response: ${text.slice(0,200)}`);
                          }
                          return res.json();
                        })
                        .then((data) => { if (data && data.movie) setMovie(data.movie); else setMovieError('no_movie_returned') })
                        .catch((err) => { console.error('fetch movie failed', err); setMovieError(err && err.message ? err.message : String(err)) })
                        .finally(() => setLoadingMovie(false));
                    }} style={{ padding: '6px 10px', borderRadius: 6 }}>Refresh</button>
                  </div>
                  <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    {loadingMovie ? <div>Loading puzzle movie…</div> : movieError ? <div style={{ color: 'crimson' }}>Error: {String(movieError)}</div> : movie ? <div style={{ fontSize: 14, color: '#444' }}>Puzzle: <strong>{movie.title}</strong> <span style={{ color: '#777', fontSize: 12 }}>• {movie.difficulty || 'n/a'}</span></div> : null}
                  </div>
                  <PuzzleGrid movie={movie} />
                </div>
            </div>

            <div className="sidebar-panel">
              <div className="voice-section">
                <VoiceChat roomId={roomId} userName={userName} socket={socketRef.current} />
              </div>

              {/* Inline text chat area (not floating) */}
              <div className="chat-container">
                <div className="chat-header">Chat</div>
                <div className="chat-messages">
                  {messages.map((m) => (
                    <div key={m.id || m.timestamp || Math.random()} className={m.username === userName ? "message self" : "message other"}>
                      <strong>{m.username}:</strong> {m.message}
                      <div className="time">{m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) : m.time}</div>
                    </div>
                  ))}
                </div>
                <div className="chat-input">
                  <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type message..." onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
                  <button onClick={sendMessage} disabled={!message.trim()}>
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
