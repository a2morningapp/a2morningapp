A2 MORNING WEB PLAY

This flat frontend uses the A2 Morning Firebase project and A2 wallet field
DATA/{mobile}/COINS. Keep index2.html and its web-* files together when
deploying. Open over HTTPS; file:// hosting is not supported.

PAYMENT SETUP

The A2 page reads Admin/Admin/payment_api_url from the A2 Firebase Realtime
Database. It must point to the separate A2 PHP endpoint, never the Mama567
payment-api.php. The A2 PHP endpoint needs its own private config, MySQL
database, Firebase service account, and A2-only gateway token.

For a separate gateway redirect/return URL, use:
https://a2morningapp.vercel.app/index2.html

The gateway webhook is a server-to-server callback and must point to the A2
endpoint URL instead. Do not use the webhook URL as the browser return URL.
The endpoint must be reachable over HTTPS and support PHP 8.1+, cURL, OpenSSL,
PDO, and pdo_mysql. See payment-backend/hostinger/a2-payment-setup.txt for
the hPanel file locations and required private config.

The page saves its pending payment before navigating to the secure HTTPS
checkout and resumes status checks when the WebView returns. The published
A2 app's WebView does not handle UPI-app intent schemes, so use the gateway's
HTTPS checkout option; direct UPI-app handoff would require native-app changes.

Do not publish service-account keys, database passwords, or gateway tokens.
Do not change the Mama567 endpoint or credentials while configuring A2.
