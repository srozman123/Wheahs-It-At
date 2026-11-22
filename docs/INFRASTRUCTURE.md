# Wheahs-it-at: Infrastructure

How the running pieces fit together and how they were set up.

## The pieces

```
📱 Phone (Expo app)  ──HTTP :3000──▶  🖥️ Vultr server (Node API)  ──SQL──▶  ☁️ Tiger Data (Postgres)
```

| Piece | What it is | Notes |
|---|---|---|
| Vultr server | A rented Linux machine with a public IP, always on | Runs `apps/server` |
| Tiger Data | Hosted Postgres database | Only the server talks to it |
| Phone app | Expo app | Only talks to the server, never the DB |

## How a request works

1. **Server `.env`** (`apps/server/.env`, never committed) holds `DATABASE_URL`, including the DB password. It only exists on the server.
2. **App config:** the app knows the server address via `EXPO_PUBLIC_API_URL=http://<server-ip>:3000`. This is **not a secret** (anyone can unpack the app); it's an env var only so it's easy to switch between laptop and Vultr.
3. **Port:** the Node API listens on **3000** (opened in the server firewall). The phone sends requests like `GET http://<server-ip>:3000/feed`.
   - **Port 22 is SSH only**: for us to log in and manage the server. The app never uses it.
4. **On the server:** one long-running Node process (started from `src/index.ts`) waits on port 3000. Hono matches the method + path (e.g. `GET /feed`) to a route, which follows the layers **route → service → db**. The db layer runs SQL on Tiger Data and the JSON result goes back to the phone.
5. **Auth:** the user logs in once; the app stores `user_id` in AsyncStorage and sends it with every request. The `requireUser` middleware checks it before the route runs.
   - Known weakness (accepted for the hackathon): anyone who knows a `user_id` could impersonate that user. A real version would use a server-signed token (e.g. JWT).

## Vultr server setup (done)

- **Credits:** $100 via MLH promo code (entered as a gift code in Billing). Billing page: https://my.vultr.com/billing/
- **Type:** Cloud Compute, Shared CPU, **public** instance
- **Plan:** ~$5/mo plan **with IPv4**
  - Not the cheapest (~$2.50) plan: it's IPv6-only, and many networks (campus Wi-Fi, some phones) can't reach IPv6.
- **Location:** New York (NJ), closest to Boston
- **OS:** Ubuntu 26.04 LTS
- **Login:** SSH key (`~/.ssh/id_ed25519`), added under Orchestration → SSH Keys
  - `ssh root@<server-ip>` (use `ssh -4` to force IPv4)
  - If SSH hangs: wait for boot, try a phone hotspot (some Wi-Fi blocks port 22), or use **View Console** in the Vultr dashboard

## Tiger Data setup (done)

- A Postgres instance is running on Tiger Cloud.
- Its connection string goes in `apps/server/.env` as `DATABASE_URL`.
- If Tiger Data's IP allow-list is on, add the Vultr server's IPv4 to it.

## Still to do (once server code exists)

1. Install Node on the server
2. `git clone` the repo onto it
3. Create `apps/server/.env` by hand on the server
4. Run the API with **pm2** (keeps it running after logout, restarts on crash)
5. Open the port: `ufw allow 3000`
6. Point the app's `EXPO_PUBLIC_API_URL` at `http://<server-ip>:3000`

## ⚠️ After the hackathon

- **Destroy** the Vultr instance (Compute → server → Destroy). A **stopped** server is still billed; only Destroy stops charges.
- When credits run out or expire, Vultr **charges the card**. It never turns off on its own.
- To remove the card fully, close the Vultr account.
