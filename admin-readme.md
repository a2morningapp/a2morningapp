# Kalyan Gold Admin website

The admin page subscribes to the Firebase Realtime Database root, so updates made by the existing AIA app appear without refreshing. It adapts the existing `DATA`, `Blocked`, `GAMES`, `GAMES2`, `GAMES3`, `Rate Chart`, `WR`, `DR`, `Notice`, `Admin`, and `Normal T Data2` nodes for the website's dashboard and management views. The dashboard's **Today's logins** metric and the **New users** view use the AIA app's daily `New Users/DD-MM-YYYY` bucket (matching its `GetTagList` behavior), exclude the `x` placeholder, and refresh when Firebase data changes. Player and new-user lists include WhatsApp links and show game access based on whether `DATA/<mobile>/bal` exists: blue means present, red means missing.

The admin layout adapts to Android/mobile screens with a slide-out navigation drawer, larger touch controls and form fields, compact dashboard cards, horizontally scrollable data tables, and bottom-sheet dialogs.

The **Bid history & played games** view joins each player's `Normal T Data2` history rows to the matching `Normal T Data` bid details, so the admin can review bids by player, market, session, game, number, points, and time as stored by `index2.html` and the AIA app. Tap a market filter to show every matching bid and player, then narrow by player or search by phone, name, market, or number. **Change number** updates both the player's history row and matched bid-detail record; legacy entries whose source records cannot be matched uniquely are shown as not editable rather than risking a different bid. Market schedules use the same player-app buckets: `GAMES` for weekdays, `GAMES2` for Saturday, and `GAMES3` for Sunday. New and edited market times are written in the AM/PM format expected by the player app.

The result publisher follows the AIA screen: choose market/session/date and enter a 3-digit panel. It derives the single digit from the panel's digit sum modulo 10 (`155` → `1`), merges open and close panels into the jodi (`155` + `000` → `10`), and uses the one-panel format for Starline. It previews matching single-digit/panel winners after each session and jodi/sangam winners once both panels are known, uses the current `Rate Chart`, groups bids by winning number, and lets an admin correct a bid number before settlement. **Distribute amount** confirms and credits player balances, records winning transactions, and marks the market/date/session as settled once; settled bids cannot be edited and that session cannot be paid a second time from this panel.

Withdrawal requests reflect the AIA balance reservation: approval does not deduct a second time, **Refund** restores the reserved amount, and **Delete** removes the request without changing the balance. These actions are separate and require confirmation where money may be affected.

Deposit requests in the legacy `DR` node use the AIA array format `[mobile, method, reference, amount, balance, status]`; the admin reads the amount, payment method, reference, and balance-at-request for review. The player website records each app entry under `Last Seen/<mobile>` as an ISO timestamp. Admin player, login, payment, transaction, and bid views show that timestamp; existing AIA `New Users/DD-MM-YYYY` records are used as a date-only fallback.

The transaction table's **Transaction ID** is the unique record key used to identify a transaction; it is not a payment-provider reference or proof of payment. Bid history can be filtered by market and player, with phone number included in search. **My game activity** also supports finding a player by name or phone. Bid exports offer today's bids, the last seven days, or all available history, with player and phone, market/game, bid time, and any available market result and win/loss settlement details.

Player blocks are stored under `Blocked/<mobile>`. The player website checks this on sign-in and restored sessions, then listens for live block changes so an active blocked account is signed out. The player website's admin settings expose the legacy maintenance, registration, open-session, and close-session switches, as well as signup bonus, minimum withdrawal, policy, results, and support links.

Web edits are saved to `/adminData` for the website's own records. Changes to existing player names/balances/statuses, market schedules/results, payout rates, player notice text, maintenance mode, registration/session availability, signup bonus, minimum withdrawal, policy, and player-facing website/support links are also projected back to their corresponding legacy nodes. Published market results update the legacy `GAMES` bucket and the AIA result-chart path `/Results/<market>/<yyyy-MM-dd>`. These settings are consumed by `index2.html`; unrelated legacy fields are left intact. New website-only records remain under `/adminData`.

The **Game settings** page exposes every `Admin/Admin` setting currently consumed by the player website: maintenance, registration/session availability, sign-up bonus, minimum withdrawal, minimum/maximum points per bid number, withdrawal timing message, policy, and player-facing website/support links. Minimum/maximum entry values are enforced when a player adds a number and again when submitting the bid. Other legacy AIA keys that `index2.html` does not consume are not presented as working controls.

The player website loads the OneSignal Web SDK using the public App ID and allows a player to opt this browser into push notifications from **My Profile**. Web push requires HTTPS (localhost is allowed for testing), and the production site origin and square notification icon must be configured in the OneSignal dashboard. `OneSignalSDKWorker.js` must be deployed at the site root.

The admin can send all-subscriber OneSignal pushes through the Google Apps Script service in `Code.gs`. Deploy that script as a web app, running as its owner, accessible to anyone; set script properties `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, and a randomly generated `BROADCAST_TOKEN` of at least 24 characters. Keep the REST key and broadcast token in Script Properties, not in this website or its database. In **Notices → Configure sender**, enter the deployed `/exec` URL and the broadcast token; the endpoint is kept in local storage and the token only in the current admin browser session. Publishing a changed market result sends the market name as the heading and the session/result/date as its message. Saving a notice or composing a broadcast sends its title and message. The site logo is included as the notification icon/image and must have a public HTTPS URL. The admin polls a JSONP status endpoint on Apps Script to report send errors and recipient counts without exposing the REST API key.

Apps Script setup:

1. Create a new project at `https://script.google.com/` and paste `Code.gs` into its script editor.
2. In **Project Settings → Script Properties**, add the three properties above. Use the OneSignal App ID already configured in `app.js`; paste the REST API key directly into the Apps Script property UI, never into a source file. Generate a long random token (at least 24 characters) for `BROADCAST_TOKEN`.
3. Choose **Deploy → New deployment → Web app**, set **Execute as** to your account, and set access to **Anyone**. Deploy, authorize the requested `UrlFetchApp` permission, and copy the web app `/exec` URL.
4. Serve the admin over HTTPS, sign in, open **Notices → Configure sender**, and enter the `/exec` URL and exact broadcast token.

The web app endpoint is public, so use a unique high-entropy broadcast token, do not reuse an account password, and rotate it if disclosed. The token is session-only in the admin page; sign-out clears it. Apps Script protects the OneSignal REST key server-side and rejects unauthenticated/replayed requests. Rotate any REST key previously shared publicly.

## Run

From this folder, start a local web server:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/admin.html` and sign in with the phone number and password stored under `Admin/Admin/NumAdmin` and `Admin/Admin/PassAdmin`. `/adminData` is initialized after successful sign-in if it does not exist. Use **Export data** and **Import backup** for JSON backups.

## Security

The admin sign-in page checks the submitted phone number and password against `Admin/Admin/NumAdmin` and `Admin/Admin/PassAdmin` before opening the admin interface or loading the database root. A successful sign-in is remembered in this browser using `localStorage` until **Sign out** is selected; the Back button stays within the admin panel. Do not use this convenience on a shared or public device.

This is a client-side gate, not server-enforced authentication. Anyone who can read the credential node may retrieve those values, and client code can be bypassed. Database rules must independently require authenticated, administrator-only access; do not rely on this sign-in page to protect data where the database allows public reads/writes. For production, move credential verification to a trusted server or use Firebase Authentication with restrictive database rules.
