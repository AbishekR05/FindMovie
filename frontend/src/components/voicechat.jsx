// src/components/VoiceChat.js
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const VoiceChat = ({ roomId, userName, socket: externalSocket }) => {
  const defaultHost = (typeof window !== "undefined" && window.location && window.location.hostname) ? window.location.hostname : "localhost";
  const socketUrl = process.env.REACT_APP_SOCKET_URL || `http://${defaultHost}:4000`;
  const socket = externalSocket || io(socketUrl);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const joinRoom = async () => {
    // 1. Get mic access (guard for environments without navigator.mediaDevices)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = "getUserMedia is not available. Make sure you're using HTTPS or testing on localhost.";
      console.error(msg);
      setError(msg);
      return;
    }

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Error accessing microphone: " + (err && err.message));
      return;
    }

    // 2. Create PeerConnection
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnectionRef.current = pc;

    // 3. Add local audio to peer
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // 4. Handle incoming audio
    pc.ontrack = (event) => {
      remoteAudioRef.current.srcObject = event.streams[0];
    };

    // 5. Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { roomId, candidate: event.candidate });
      }
    };

    // 6. Handle signaling
    const onUserJoined = async (peerId) => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer });
    };

    const onOffer = async (data) => {
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { roomId, answer });
    };

    const onAnswer = async (data) => {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    };

    const onIce = async (candidate) => {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("❌ Error adding ICE candidate", err);
      }
    };

    socket.on("user-joined", onUserJoined);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIce);

    // 7. Join the room
    socket.emit("join-room", roomId, userName);
    setJoined(true);
  };

  // cleanup on unmount: remove signaling listeners and stop local tracks
  useEffect(() => {
    return () => {
      try {
        socket.off("user-joined");
        socket.off("offer");
        socket.off("answer");
        socket.off("ice-candidate");
      } catch (e) {
        // ignore
      }
      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
        } catch (e) {}
        peerConnectionRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, [socket]);

  return (
    <div className="voice-join">
      {!joined ? (
        <>
          <button onClick={joinRoom}>🎙️ Join Voice Chat</button>
          {error && <div className="error-text">{error}</div>}
        </>
      ) : (
        <p>Connected to voice chat</p>
      )}
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
};

export default VoiceChat;
