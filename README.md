# A2Morning Admin

Deploy this folder's contents together to a PHP-capable web host. Open `index.html` or `admin.html`; the console is configured to use the A2Morning Realtime Database and its separate web-result database. PHP must execute `onesignal.php` on the same HTTPS origin as the admin page.

The sign-in screen reads the administrator phone and password from `/Admin/Admin/NumAdmin` and `/Admin/Admin/PassAdmin`. Set these values through a trusted Firebase administration path. The page's password check is client-side only: do not treat it as authorization, and do not enable public database writes. Protect reads and writes with Firebase Authentication/admin claims or a trusted server before production.

After a successful sign-in, this browser remembers the session and checks that the admin password has not changed when the console is reopened. A valid session opens the dashboard directly; signing out or changing the admin password returns the console to the sign-in screen.

This admin project reads and writes only the configured A2Morning databases. Set the hosted result-chart URL in Game settings after deployment.

In Players and New users, WebPlay approval controls read/write `DATA/<phone>/WV` in the separate `a2moring` Realtime Database. Game settings → Global WebPlay access reads/writes `Admin/WV2` in that same database. When `Admin/WV2` is `true`, the Native App's global access flag allows all signed-in users to open WebPlay regardless of their individual `WV` value. Keep that global setting disabled unless this is intentional, and configure Realtime Database rules to restrict writes to administrators.

In Admin → Settings → Player website configuration, the optional **UPI payment link template (Admin Upi)** is stored at `/Admin/Admin/Admin Upi`. Use the complete `upi://pay?...` link and put `###` in the `am` parameter where the player's entered amount belongs. Direct UPI app responses are not bank-verified; deposit requests remain pending until an administrator verifies the transfer. Use the secure payment gateway flow for automatic wallet credit after server-side payment confirmation.

For the Happysatta server-side gateway deployment steps and private API-token location, see [`payment-backend/README.md`](../payment-backend/README.md).

## OneSignal push sender

Admin broadcasts, winner alerts, and individual messages are sent through [`onesignal.php`](./onesignal.php). The browser does not need the OneSignal REST API key. The endpoint checks the admin login, reads the key from the server-only `onesignal-secret.php` file (or `ONESIGNAL_REST_API_KEY` in the PHP environment), and sends using the configured OneSignal App ID. Use the same App ID as the app that owns the players' subscriptions.

### GitHub Actions deployment to Hostinger

The workflow at [`../.github/workflows/deploy-admin.yml`](../.github/workflows/deploy-admin.yml) deploys this folder to Hostinger over FTPS and creates `onesignal-secret.php` from a GitHub Actions secret during deployment. The generated file is ignored by Git and removed from the runner after the upload.

1. **Rotate the OneSignal REST API key.** The previous key was present in browser JavaScript, so treat it as exposed. Create a replacement key in OneSignal and revoke the old key.
2. Push this project to GitHub with `a2WebPlay` as the repository root. Do not commit any real API key or `onesignal-secret.php`.
3. In GitHub, open **Settings → Secrets and variables → Actions → Secrets** and create:
   - `ONESIGNAL_REST_API_KEY`: the newly rotated OneSignal REST API key.
   - `HOSTINGER_FTP_SERVER`: the Hostinger FTP hostname, without `ftp://`.
   - `HOSTINGER_FTP_USERNAME`: the FTP account username.
   - `HOSTINGER_FTP_PASSWORD`: the FTP account password.
4. Under **Settings → Secrets and variables → Actions → Variables**, create `HOSTINGER_FTP_SERVER_DIR` with the exact remote directory for the admin site, including the final `/` (for example `/domains/example.com/public_html/admin/`). Find the correct path in Hostinger File Manager; the workflow deploys this admin folder's contents directly into that directory.
5. In **Settings → Branches**, protect `main` or `master` and require review for changes to the deployment workflow. The workflow can access FTP and OneSignal secrets, so only trusted changes should be merged to those branches.
6. Push a reviewed change to `main`/`master`, or use **Actions → Deploy A2Morning admin → Run workflow** on one of those branches. Confirm the deployment job succeeds.
7. Open the deployed admin over HTTPS, sign in, and use **Notices → Test broadcast**. Check the message on a subscribed device and the Hostinger PHP error log if the endpoint reports a failure.

The workflow assumes `a2WebPlay` is the GitHub repository root and that Hostinger FTP accepts explicit FTPS on port 21. If your FTP service uses another port or protocol, update the workflow accordingly. The PHP sender enforces same-origin HTTPS; `ADMIN_ALLOWED_HOSTS` can optionally be set on the PHP host as a comma-separated hostname allowlist.

The legacy [`onesignal-sender.gs`](./onesignal-sender.gs) is not used by the admin after this PHP integration.

## A2Morning scheduled market maintenance

[`a2morning-scheduled-market-maintenance.gs`](./a2morning-scheduled-market-maintenance.gs) is adapted for the primary `a2morning-in-website-new-db` Realtime Database. It is not installed or run automatically by this website. Run `installMinuteFirebaseUpdateTrigger` once in Apps Script to install a per-minute update for `/Date` and execute it immediately. It writes plain date/time/day strings and verifies the values after writing. Check **Executions** for any Firebase permission or configuration errors; set `FIREBASE_DATABASE_AUTH_TOKEN` in Script Properties if the database rules require authentication. `removeMinuteFirebaseUpdateTrigger` removes the minute updater trigger. `installNightlyMarketResetTrigger` separately schedules the daily reset for approximately 05:00–06:00 Asia/Kolkata.

The daily reset clears result fields in all three legacy market buckets (`/GAMES`, `/GAMES2`, and `/GAMES3`) and `/adminData/markets`; it also resets `/Players`, daily `/Final Amount`, `/Win Amount`, and daily amount/user/winner totals. It reads `/DATA` balances and writes the total to `/Daily Total Money/<date>`; it does not change player balances. This script has no dry-run mode, and its daily reset writes to live Firebase data. Review its writes and export a Firebase backup before installing either trigger.

Set the Apps Script project time zone to `Asia/Kolkata` and configure the required `FIREBASE_DATABASE_AUTH_TOKEN` in Script Properties if the database rules require authentication. Do not put database credentials in the script source. The token must have the database permissions required by the script.

## Weekly Firebase history cleanup

[`weekly-firebase-cleanup.gs`](./weekly-firebase-cleanup.gs) is a separate Google Apps Script for the A2Morning **primary** Realtime Database (`a2morning-in-website-new-db`). It does not connect to or modify the separate `a2morning-web-result` database.

The weekly cleanup removes `/Normal T Data`, `/Normal T Data2`, `/DR`, `/WR`, and `/Results`. It resets published result fields in `/GAMES`, `/GAMES2`, `/GAMES3`, and `/adminData/markets`, and clears the admin panel's derived `/adminData/bets`, `/adminData/transactions`, `/adminData/settlements`, and `/adminData/requests` collections. Player records and balances in `/DATA`, markets and schedules, rates, `/Admin/Admin` settings, and admin credentials are preserved. The deleted deposit/withdrawal records and admin transaction/settlement history cannot be recovered by this script; export a backup first if they may be needed for audit or reconciliation.

### Setup

1. Create a dedicated Google Cloud service account with Realtime Database read/write access to the primary `a2morning-in-website-new-db` database, then download its JSON key. The email must end in `.iam.gserviceaccount.com`. Do not use a personal Gmail address or share a Firebase database secret.
2. Create a standalone Apps Script project, paste in `weekly-firebase-cleanup.gs`, and set its project time zone to `Asia/Kolkata`.
3. In **Project Settings → Script Properties**, set `FIREBASE_SERVICE_ACCOUNT_EMAIL` to the JSON file's `client_email`, and `FIREBASE_PRIVATE_KEY` to its `private_key`. The private key must begin with `-----BEGIN PRIVATE KEY-----`; an API key starting with `AIza...` is not a private key. Keep the private key only in Script Properties; paste the PEM text with newlines (or literal `\n` sequences).
4. Run `runWeeklyCleanup` manually while cleanup is disabled. It only reads Firebase and logs a preview; no data is changed.
5. After reviewing the preview and making any required backups, set `WEEKLY_CLEANUP_ENABLED` to `true` and `WEEKLY_CLEANUP_CONFIRMATION` to `DELETE_SELECTED_HISTORY_KEEP_BALANCES_V1`.
6. Run `installWeeklyCleanupTrigger` once. It creates a Sunday trigger for approximately 02:00 Asia/Kolkata. Apps Script can vary the exact trigger minute. Run `removeWeeklyCleanupTrigger` to stop scheduled runs.

The script refuses to run unless the project time zone is correct before trigger installation, the expected database host matches the primary database, and both cleanup enablement properties are set. Keep `WEEKLY_CLEANUP_ENABLED` unset or set to `false` to return to preview-only mode.

## Daily market result reset

[`daily-market-results-reset.gs`](./daily-market-results-reset.gs) resets current result fields in the primary `a2morning-in-website-new-db` database to `### - ## - ###`. It handles the legacy market buckets `/GAMES`, `/GAMES2`, and `/GAMES3`, the admin console cache at `/adminData/markets`, and removes only result-history entries dated today or yesterday from `/Results` and cached admin market results. Older result history, market schedules, player data, balances, admin settings, and credentials are preserved. It does not connect to or modify `a2morning-web-result`.

### Setup

1. Use a standalone Apps Script project for this file, or keep it in the project containing `weekly-firebase-cleanup.gs`; its helper names are prefixed to avoid collisions.
2. Set the Apps Script project time zone to `Asia/Kolkata`. Reuse `FIREBASE_SERVICE_ACCOUNT_EMAIL` and `FIREBASE_PRIVATE_KEY` Script Properties from the weekly cleanup project, or add the service-account `client_email` and complete `private_key` from its JSON key in this project. Do not share the private key.
3. Run `runDailyMarketResultReset` once while disabled. Confirm the execution log says `DRY_RUN` and review `datesCleared` and the counts.
4. After reviewing the preview, set `DAILY_RESULT_RESET_ENABLED` to `true` and `DAILY_RESULT_RESET_CONFIRMATION` to `RESET_DAILY_MARKET_RESULTS_KEEP_HISTORY_V1`.
5. Run `installDailyMarketResultResetTrigger` once and approve permissions. Check the Apps Script **Triggers** page for the `runDailyMarketResultReset` daily time-driven trigger, approximately 02:00 Asia/Kolkata. Use `removeDailyMarketResultResetTrigger` to remove it.

Installing the trigger while disabled only creates daily previews; actual database updates begin only after both enablement properties match. Apps Script may run within a time window rather than at exactly 02:00.
