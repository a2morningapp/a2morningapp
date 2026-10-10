# Gateway payment website

This folder contains the browser version of the Android gateway payment demo. It creates an order, opens the returned HTTPS checkout page, and checks order status when the user returns or presses **Check payment status**.

The website folder is flat: keep `index2.html` and this README together. There is no server API or Vercel function. The page asks the user for a gateway API token at runtime and sends form-encoded requests directly to `https://payment.happysatta.com/api/create-order` and `/check-order-status`.

## Run the website

Upload `index2.html` to any HTTPS static web host and open it from that host. Opening it directly from disk (`file://`) or over plain HTTP is not supported for payment requests. A static host cannot work around the browser's cross-origin restrictions: the gateway must allow CORS requests from the website's origin. If the browser reports a CORS/network error, ask the gateway operator to enable CORS for the hosted domain or use an API proxy on a server you control.

The token is not saved by the page; enter it again after reloading. Since the browser sends the token directly to the gateway, it is visible to the person using browser developer tools. Never enter a production merchant token in a public page. Use only a rotated test credential.

The supplied `javascript.zip` examples use a different gateway host (`khilaadixpro.shop`) and contain example credentials. This site follows the HappySatta API host and payload shown in the supplied documentation screenshots instead; do not copy example credentials into this project.

A return URL is only a browser destination. The supplied documentation does not define a webhook callback contract, so this site does not claim to implement a webhook. Gateway order creation may lead to a real payment; test with a rotated test token and a non-production gateway account.
