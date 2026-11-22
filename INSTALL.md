# Install the API on a fresh Vultr server

Target: a fresh **Ubuntu 26.04** Vultr instance, logged in as `root` over SSH.

**Prerequisite:** the instance must have been created with your SSH key attached (Vultr: Orchestration, SSH Keys). Step 2 copies root's key to the new user and step 3 disables password logins, so without a key you would lock yourself out. See [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) for how the pieces fit together.

## 1. Update the system (as root)

```bash
apt update && apt upgrade -y
apt install -y git curl ufw
```

## 2. Create a non-root user

```bash
adduser --disabled-password --gecos "" app
usermod -aG sudo app
echo "app ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/app
mkdir -p /home/app/.ssh
cp /root/.ssh/authorized_keys /home/app/.ssh/authorized_keys
chown -R app:app /home/app/.ssh
chmod 700 /home/app/.ssh && chmod 600 /home/app/.ssh/authorized_keys
```

From now on, work as `app`. Either open a new terminal with `ssh app@<server-ip>` (check it works first), or run `su - app`.

## 3. Harden SSH

**First open a second terminal and confirm `ssh app@<server-ip>` works.** Keep your root session open until you have. Then, as `app`:

```bash
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sshd -t && sudo systemctl restart ssh
```

Ubuntu cloud images may override these in `/etc/ssh/sshd_config.d/*.conf`; check with `sudo sshd -T | grep -Ei 'permitrootlogin|passwordauthentication'` (both should say `no`). Test `ssh app@<server-ip>` again in a new terminal.

## 4. Firewall

**Allow OpenSSH before enabling ufw, or you lock yourself out.**

```bash
sudo ufw allow OpenSSH
sudo ufw allow 3000/tcp
sudo ufw --force enable   # --force skips the y/n prompt so the block can be pasted
sudo ufw status
```

## 5. Node 24

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # must print v24.x
```

## 6. Get the code

The repo is public, so a plain HTTPS clone works with no token or key. The clone uses the default branch (`main`); the backend must be merged and pushed there first. Until then, clone the backend branch instead: `git clone -b feat/backend https://github.com/srozman123/Wheahs-It-At.git`.

```bash
cd ~
git clone https://github.com/srozman123/Wheahs-It-At.git
cd Wheahs-It-At/apps/server
npm ci
```

## 7. Configure `.env`

```bash
cp .env.example .env
chmod 600 .env
```

Then edit it on its own (Ctrl+O, Enter to save, Ctrl+X to exit):

```bash
nano .env
```

- `DATABASE_URL`: the Tiger Data **direct** connection string, ending in `?sslmode=require&uselibpqcompat=true` (Tiger uses its own CA; without the flag `pg` rejects the cert).
- `PORT`: leave at `3000`.
- If Tiger Data's IP allow-list is on, add this server's IPv4 to it (Tiger Cloud console).

## 8. Create the tables (first time only)

```bash
npm run db:setup -- --yes    # WARNING: drops and recreates ALL tables, wiping all data
npm run db:seed              # optional: fake users and events for demos
```

Seed users log in with `<name>@seed.test` / `password123` (e.g. `alex@seed.test`).

### Remove demo data later

Removes only the fake data (`seed://` events and `@seed.test` users); real data is untouched.

```bash
npm run db:clear-seed
```

## 9. Run with pm2

```bash
sudo npm i -g pm2
pm2 start npm --name wheahs-api -- start
pm2 save
pm2 startup          # prints a command starting with "sudo env PATH=..."; copy and run it
pm2 logs wheahs-api  # Ctrl+C to leave
```

## 10. Verify

On the server:

```bash
curl localhost:3000/health
```

From your laptop:

```bash
curl http://<server-ip>:3000/health
curl http://<server-ip>:3000/tags
```

Expected: `{"ok":true}` and a list of tags.

## Updating

```bash
cd ~/Wheahs-It-At && git pull
cd apps/server && npm ci
pm2 restart wheahs-api
```

## Troubleshooting

- **Laptop can't reach port 3000:** check `sudo ufw status` shows 3000/tcp, and that nothing else blocks it (some Wi-Fi networks do; try a phone hotspot). `curl localhost:3000/health` on the server tells you whether the API itself is up.
- **Database connection refused or timeout:** the server's IPv4 is probably missing from Tiger Data's allow-list, or `DATABASE_URL` is wrong. Check `pm2 logs wheahs-api`.
- **SSL errors:** make sure the connection string ends with `?sslmode=require&uselibpqcompat=true` and is the direct connection string. `self-signed certificate in certificate chain` means the flag is missing.
- **API doesn't come back after a reboot:** run `pm2 save` after starting it, and make sure you ran the command `pm2 startup` printed. Check with `pm2 status`.

## Security note

This setup is for the hackathon only. Traffic is plain HTTP, and auth is a bare `x-user-id` header with no tokens, so anyone who learns a user id can act as that user. These weaknesses are accepted. **Destroy the instance afterwards** (a stopped server is still billed); see [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md).
