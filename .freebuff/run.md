# Run doc — PHYTONEXUS (Vite + React + Tailwind v4)

## Reproduce artifacts

1. Install dependencies with npm (there is no `.env.local` or other secret env file in this project — nothing to copy):
   ```bash
   npm install
   ```
2. (Optional) Verify the build: `npm run typecheck` (runs `tsc -b`).

## Run the server

- Script: `npm run dev` (Vite). Default port **5173**, binds to localhost.
- Start detached on Windows (stdout and stderr must go to DIFFERENT files):
  ```powershell
  powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
  ```
  Note: this command can exceed a 30s tool timeout because PowerShell holds the pipe open — the detached process still starts; verify with the log and `netstat`.
- Confirm it is alive: `powershell -NoProfile -Command "Get-Process -Id <pid>"` and wait for `http://localhost:5173/` to answer HTTP 200.
- Stop: `taskkill /PID <pid> /F` (kill the node PID owning port 5173).
