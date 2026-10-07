# Kalyan Gold Admin website

The admin page subscribes to the Firebase Realtime Database root, so updates made by the existing AIA app appear without refreshing. It adapts the existing `DATA`, `Blocked`, `GAMES`, `GAMES2`, `GAMES3`, `Rate Chart`, `WR`, `DR`, `Notice`, `Admin`, and `Normal T Data2` nodes for the website's dashboard and management views. The dashboard's **Today's logins** metric and the **New users** view use the AIA app's daily `New Users/DD-MM-YYYY` bucket (matching its `GetTagList` behavior), exclude the `x` placeholder, and refresh when Firebase data changes. Player and new-user lists include WhatsApp links and show game access based on whether `DATA/<mobile>/bal` exists: blue means present, red means missing.

The admin layout adapts to Android/mobile screens with a slide-out navigation drawer, larger touch controls and form fields, compact dashboard cards, horizontally scrollable data tables, and bottom-sheet dialogs.

The **Bid history & played games** view joins each player's `Normal T Data2` history rows to the matching `Normal T Data` bid details, so the admin can review and filter bids by player, market, session, game, number, points, and time as stored by `index2.html` and the AIA app. **Change number** updates both the player's history row and matched bid-detail record; legacy entries whose source records cannot be matched uniquely are shown as not editable rather than risking a different bid. Market schedules use the same player-app buckets: `GAMES` for weekdays, `GAMES2` for Saturday, and `GAMES3` for Sunday. New and edited market times are written in the AM/PM format expected by the player app.

The result publisher follows the AIA screen: choose market/session/date and enter a 3-digit panel. It derives the single digit from the panel's digit sum modulo 10 (`155` → `1`), merges open and close panels into the jodi (`155` + `000` → `10`), and uses the one-panel format for Starline. It previews matching single-digit/panel winners after each session and jodi/sangam winners once both panels are known, uses the current `Rate Chart`, groups bids by winning number, and lets an admin correct a bid number before settlement. **Distribute amount** confirms and credits player balances, records winning transactions, and marks the market/date/session as settled once; settled bids cannot be edited and that session cannot be paid a second time from this panel.

Withdrawal requests reflect the AIA balance reservation: approval does not deduct a second time, **Refund** restores the reserved amount, and **Delete** removes the request without changing the balance. These actions are separate and require confirmation where money may be affected.

Deposit requests in the legacy `DR` node use the AIA array format `[mobile, method, reference, amount, balance, status]`; the admin reads the amount, payment method, reference, and balance-at-request for review. The player website records each app entry under `Last Seen/<mobile>` as an ISO timestamp. Admin player, login, payment, transaction, and bid views show that timestamp; existing AIA `New Users/DD-MM-YYYY` records are used as a date-only fallback.

Web edits are saved to `/adminData` for the website's own records. Changes to existing player names/balances/statuses, market schedules/results, payout rates, player notice text, maintenance mode, registration/session availability, signup bonus, minimum withdrawal, policy, and player-facing website/support links are also projected back to their corresponding legacy nodes. Published market results update the legacy `GAMES` bucket and the AIA result-chart path `/Results/<market>/<yyyy-MM-dd>`. These settings are consumed by `index2.html`; unrelated legacy fields are left intact. New website-only records remain under `/adminData`.

## Run

From this folder, start a local web server:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/admin.html` and sign in with the phone number and password stored under `Admin/Admin/NumAdmin` and `Admin/Admin/PassAdmin`. `/adminData` is initialized after successful sign-in if it does not exist. Use **Export data** and **Import backup** for JSON backups.

## Security

The admin sign-in page checks the submitted phone number and password against `Admin/Admin/NumAdmin` and `Admin/Admin/PassAdmin` before opening the admin interface or loading the database root. Signing out closes the live root listener. A page refresh requires signing in again.

This is a client-side gate, not server-enforced authentication. Anyone who can read the credential node may retrieve those values, and client code can be bypassed. Database rules must independently require authenticated, administrator-only access; do not rely on this sign-in page to protect data where the database allows public reads/writes. For production, move credential verification to a trusted server or use Firebase Authentication with restrictive database rules.
