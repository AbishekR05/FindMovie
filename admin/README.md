Admin area
===========

This folder contains a small, self-contained admin service scaffold separate from the main `backend/` and `frontend/` apps in the repo. It's intended to host tools for privileged operators (admins) to inspect rooms and chat messages stored in MongoDB.

Structure
- admin/backend  — small Express server that talks directly to MongoDB and exposes admin-only endpoints.
- admin/frontend — (placeholder) where a dedicated admin frontend app could live if you want it separate from the regular front-end.

Security
- Admin endpoints are protected by an environment variable ADMIN_TOKEN. Do not commit that token to source control.
- When deploying, always put this service behind authentication (VPN, firewall, or proper auth middleware).

Quick start (backend)
1. Set environment variables (PowerShell example):
   $env:MONGODB_URI = 'your-mongodb-uri'
   $env:ADMIN_TOKEN = 'a-strong-secret'
2. From this folder run the server: node admin/backend/server.js
<!-- No-op placeholder to ensure README updated -->
3. Endpoints:
   GET /api/admin/rooms
   GET /api/admin/rooms/:roomId/messages

Notes
- This is a small scaffold to get started. You can adapt it to reuse the main project's `db.js` module or plug it into an existing admin UI in `frontend/`.
- Consider adding logging, rate-limiting and stronger auth before exposing this to the public internet.
