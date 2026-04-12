This folder is a placeholder for a dedicated admin frontend application.

You can either:
- Reuse the existing admin React component under the main `frontend/` app (recommended for simplicity), or
- Create a separate frontend app here (e.g., `create-react-app`) that talks to the admin backend (see `admin/backend/server.js`).

If you create a separate app, set `REACT_APP_ADMIN_API` pointing at the admin backend URL and use `x-admin-token` header to authenticate requests.
