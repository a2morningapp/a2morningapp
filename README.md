# Sridevi Matka Cafe Website

This is a standalone static website copy of the Sridevi Matka app. It keeps the existing HTML, CSS, colors, layouts, and browser-side interactions, and includes the market results page.

Upload the contents of this folder to a static web host with `index2.html` as the player entry point. Firebase's browser SDKs are loaded from Google's CDN. The copied admin console is in [`A2Morning Matka Admin`](./A2Morning%20Matka%20Admin/).

The main site uses the supplied Sridevi Matka Firebase configuration. `result.html` uses the supplied Sridevi Matka web-result Firebase configuration.

Bet entry uses the site's existing browser-side Firebase write path. Number, session, amount, and wallet checks in this flow are client-side; this path does not provide authoritative server validation, atomic balance deduction, or cross-device duplicate protection. The betting grid intentionally reuses the existing market rules and bid/history records. Run its focused checks from this folder with `node --test tests\betting-grid.test.cjs`.

Gateway deposits require `payment-backend/hostinger/payment-api.php` on a PHP-capable host and `Admin/Admin/payment_api_url` set to its HTTPS URL. Checkout is displayed in an in-page iframe; the configured gateway must allow iframe embedding. Keep `sridevi-payment-config.json` and `sridevi-mysql-config.json` in the private directory expected by the endpoint, outside the public web root.

The admin console also contains a PHP endpoint for OneSignal broadcasts; that endpoint needs a PHP-capable host and its allowed-host list configured for the deployed website domain.

The admin Markets page can hide or restore a market on the player website without deleting its record. This stores `websiteVisible` in the legacy market metadata; deploy the matching admin and `site-app.webjs` changes together for the player list to honor it.

The admin Markets page can hide or restore a market on the player website without deleting its record. This stores `websiteVisible` in the legacy market metadata; deploy the matching admin and `WebPlay/WebPlay/web-app.js` changes together for the player list to honor it.
