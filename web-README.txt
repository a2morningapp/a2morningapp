MAMA567 WEBSITE

This folder contains a flat, deployable copy of the existing Mama567 browser app
with the native app's theme. The site reuses the same Firebase project, account
flows, live markets, game screens, history, deposits, withdrawals, and payment
status confirmation as the application's bundled website.

DEPLOY

1. Upload the web-* files and index2.html to the website document root, keeping
   them together. Do not upload this README if you do not want it public.
2. Open the site over HTTPS at /index2.html. If you want it to open at the bare
   domain, configure your host to use index2.html as the directory index.
   Firebase and payment services require an internet connection; opening the
   HTML directly as a file is not a supported setup.
3. The result chart is web-result.html and is included in this folder.
4. Keep all web-* assets beside index2.html with their exact names. Hosting
   file names are case-sensitive. Uploading only index2.html, or placing its
   assets in another folder, will break images and styles.

PAYMENTS

The browser app reads Admin/Admin/payment_api_url from the existing Mama567
Realtime Database. Your already-working payment endpoint is separate from these
renamed website files. Keep its existing server file and private configuration
unchanged. Do not replace it with web-payment-api.php.

The endpoint needs PHP 8.1+ with cURL, OpenSSL, PDO, and pdo_mysql, plus a
MySQL database. It creates its payment tables automatically. Keep the
following files outside the public document root (normally in a sibling
private folder), never in this website folder:

- mama567-payment-config.json: realtime_database_url,
  gateway_token, service_account_file (absolute path), and return_url.
- mama567-mysql-config.json beside it: mysql_host, mysql_port,
  mysql_database, mysql_username, and mysql_password.
- The Firebase service-account JSON referenced by service_account_file.

The payment PHP endpoint looks for
../private/mama567-payment-config.json relative to the document root by
default. Set MAMA567_PAYMENT_CONFIG if your private config is stored elsewhere.
Give private files account-only permissions. Do not put gateway tokens,
database passwords, or service-account keys in public files.

Wallet points are credited only after the payment service confirms completion.
The website cannot complete live payments without the deployed, correctly
configured payment backend and reachable Firebase services.

MOBILE WEBVIEW

Open the HTTPS website URL in the WebView, and enable JavaScript and DOM
storage. If the gateway returns to the domain root, configure the hosting
directory index to index2.html so the return opens the app again and its saved
pending payment can resume checking.

The Mama567 native app has a payment WebView and native UPI-app handoff. A
different host app's WebView must also permit HTTPS checkout navigation and
route UPI schemes (upi:, intent:, phonepe:, paytmmp:, gpay:, and tez:) to
installed payment apps. A static website alone cannot force another app's
WebView to launch those apps. In a normal mobile browser, allow the browser to
open the gateway checkout and payment app when prompted.

The login system and Firebase security rules are shared with the existing app.
Review the Firebase Realtime Database rules before public deployment; do not
enable unrestricted public writes.
