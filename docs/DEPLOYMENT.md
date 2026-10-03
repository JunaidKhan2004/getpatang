# Deploying GetPatang

This guide takes a fresh server to a live platform, then covers updates, backups and the Android release.
Everything except the mobile app runs in Docker on one server.

```
Internet ──► Caddy (HTTPS, ports 80/443)
               ├── WEB_DOMAIN  ──► web  (Next.js, port 3000) ──┐
               └── API_DOMAIN  ──► api  (NestJS, port 4000) ◄──┘ server-side calls on the private network
                                     ├── db       PostgreSQL 17 (volume db-data)
                                     └── uploads  photos, documents, receipts (volume uploads)
Android app ──► API_DOMAIN
```

## 1. What you need

- A Linux server (Ubuntu 24.04 LTS recommended) with **2 vCPU, 4 GB RAM, 40 GB disk** to start.
- **Docker Engine** with the Compose plugin: <https://docs.docker.com/engine/install/ubuntu/>.
- Two DNS **A records** pointing at the server: the website (e.g. `getpatang.pk`) and the API (e.g. `api.getpatang.pk`).
- Ports **80 and 443** open. Nothing else needs to be public.
- An **SMTP account** for email (sign-in codes and notifications). Production will not start without one.

## 2. First deploy

```bash
sudo mkdir -p /opt/getpatang && sudo chown $USER /opt/getpatang
git clone <your repository> /opt/getpatang && cd /opt/getpatang

cp .env.production.example .env.production
nano .env.production            # domains, database password, secrets, SMTP, first admin
chmod 600 .env.production

docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production run --rm api seed   # roles, categories, first Super Admin
```

The API applies database migrations every time it starts. Caddy requests HTTPS certificates on first visit;
open `https://WEB_DOMAIN` and `https://API_DOMAIN/api/v1/health` to check.

Then:

1. Sign in with `SEED_ADMIN_EMAIL`, **change the password**, and delete the two `SEED_ADMIN_*` lines from `.env.production`.
2. Work through the [go-live checklist](#7-go-live-checklist).

Demo data is never loaded in production.

## 3. Updating

```bash
cd /opt/getpatang
./deploy/backup.sh                                   # always back up first
git pull
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps         # api and web should become "healthy"
```

**Rolling back:** check out the previous commit and run the same `up -d --build`. Migrations only move forward, so if
the update changed the database, restore the backup taken before it (see below).

**Changing the database schema (developers):** edit `backend/prisma/schema.prisma`, create the SQLite migration as usual
(`npx prisma migrate dev --name <name>`), then run `npm run db:pg -- <name>` to write the matching PostgreSQL migration in
`backend/prisma/postgres/`. Commit both. CI fails if the PostgreSQL migration is missing.

## 4. Backups and restore

`deploy/backup.sh` dumps the database and archives uploaded files into `./backups`, keeping 14 days. Schedule it daily
and copy the folder to another machine or cloud storage:

```bash
crontab -e
30 2 * * * cd /opt/getpatang && ./deploy/backup.sh >> /var/log/getpatang-backup.log 2>&1
```

Restore (stops the site while it runs):

```bash
docker compose --env-file .env.production stop api web
docker compose --env-file .env.production exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < backups/db-YYYYMMDD-HHMMSS.dump
docker run --rm -v getpatang_uploads:/data -v "$PWD/backups":/backup alpine sh -c 'rm -rf /data/* && tar -xzf /backup/uploads-YYYYMMDD-HHMMSS.tar.gz -C /data'
docker compose --env-file .env.production start api web
```

Test a restore on a spare machine at least once before launch.

## 5. Monitoring and logs

- Health: `https://API_DOMAIN/api/v1/health` returns `{"data":{"status":"ok"}}` when the API and database are up. Point an
  uptime monitor (e.g. UptimeRobot, Better Stack) at it and at the website.
- Logs: `docker compose --env-file .env.production logs -f api` (also `web`, `proxy`, `db`).
- Staff actions are in Admin → Audit logs.

## 6. Android app release

The app talks to the API over HTTPS only in release builds.

**Once:** create the upload key and keep it safe (losing it means you cannot update the app on Google Play):

```bash
keytool -genkey -v -keystore ~/getpatang-upload-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
cp mobile/android/key.properties.example mobile/android/key.properties   # fill in the path and passwords
```

**Each release:** raise `version:` in `mobile/pubspec.yaml` (e.g. `1.0.1+2`), then:

```bash
cd mobile
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://API_DOMAIN/api/v1 \
  --dart-define=WEB_BASE_URL=https://WEB_DOMAIN
# upload build/app/outputs/bundle/release/app-release.aab in Google Play Console
```

Decide the final application ID (`pk.getpatang.app` in `android/app/build.gradle.kts`) **before** the first
upload; it cannot change afterwards. Play Console also needs a privacy policy URL (`https://WEB_DOMAIN/privacy`), the
content rating questionnaire and store screenshots.

## 7. Go-live checklist

Platform settings (Admin):

- [ ] Super Admin password changed; staff accounts created with the right roles (Admin → Users).
- [ ] Settings → Payments: cash on delivery on/off; bank transfer account details (or keep it off).
- [ ] Settings → Delivery methods and fees; commission percentage.
- [ ] Content → About, FAQ, Contact, **Terms of Service** and **Privacy Policy** written (legal text reviewed by your lawyer) and published.
- [ ] Banned words list reviewed for local terms.

Infrastructure:

- [ ] Both domains load over HTTPS; `http://` redirects.
- [ ] Test email received (register a test account).
- [ ] Daily backups running and copied off the server; one restore tested.
- [ ] Uptime monitor on the health URL and the website.

Not yet connected (need accounts from the business):

- [ ] **Push notifications:** create a Firebase project and add `google-services.json`; device registration is already in place.
- [ ] **Online payments** (JazzCash, Easypaisa, cards): need merchant accounts; providers plug into `backend/src/modules/payments/payment-providers.ts`.
- [ ] **File storage:** uploads live on the server volume (backed up by `backup.sh`). Move to object storage (e.g. S3-compatible) when traffic grows.
