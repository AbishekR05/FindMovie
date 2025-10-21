Local HTTPS setup (Windows) for React dev server

This project includes a small PowerShell helper to create a local mkcert certificate and write a `.env` file
that CRA (Create React App) will use to serve the dev server over HTTPS. Use this for testing getUserMedia
from mobile devices on the same LAN.

Prerequisites
- Windows PowerShell
- mkcert (https://github.com/FiloSottile/mkcert). Recommended install via Chocolatey:
  choco install mkcert -y

Usage
1. Open PowerShell as Administrator (mkcert -install may require admin to trust the root CA).
2. From the `frontend` folder run:
   .\setup-https-windows.ps1

What the script does
- Detects your LAN IPv4 address.
- Runs `mkcert -install` to ensure the local CA is trusted on your machine.
- Generates a certificate for `localhost` and your LAN IP.
- Writes `frontend/.env` with entries:
  HTTPS=true
  SSL_CRT_FILE=certs\<cert-file>.pem
  SSL_KEY_FILE=certs\<key-file>.pem
  REACT_APP_SOCKET_URL=https://<your-ip>:4000

3. Restart your frontend dev server:
   npm start

4. Open https://<your-ip>:3000 on your phone. You may need to trust the mkcert root on your phone if prompted.

Notes
- This is for local development only. Do not use these certs in production.
- If your phone still rejects the certificate, you can install the mkcert root CA on the phone manually.
- If you prefer a simpler route, use ngrok to tunnel both frontend and backend via HTTPS.
