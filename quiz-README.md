# A2 Morning Web Quiz

This is a static, login-screen-free version of the native Special Quiz. It reads
questions from `Special Quizz/Quiz1` in the A2 Morning Realtime Database and
accepts the native WebView link parameters `name`, `phone`, `coins`, `ls`, and
`push`. For example:

```text
https://your-host/web%20quiz/quiz-index.html?name=Player&phone=9876543210&coins=25
```

The page reads `DATA/<phone>` to show the account name and balance when database
rules permit it. Questions use the native record format, such as
`["2 + 2","3","4===true"]`, and each correct answer awards 5 coins.

The dashboard also includes native-style **My Profile**, **Password**,
**Share**, **WhatsApp**, **Policy**, and **Log Out** options; coupon and embedded
WebViewer pages are intentionally omitted. Profile is read-only. Password
assistance opens the configured WhatsApp support contact, and Policy reads
`Admin/Admin/Policy`. When `phone` and `coins` are in the URL, the page opens
directly without a login screen. Logging out clears that URL context and local
session but still does not display a login screen.

**This version does not write to Firebase.** Quiz progress and earned coins are
stored in the current browser's local storage. The phone in a URL is only
session context, not proof of identity; do not enable client-side balance writes
based only on these parameters. A trusted backend or signed session is needed
before balances can safely be synchronized.

All files in this folder are prefixed with `quiz-` and assets are stored directly
in the folder root. Serve this folder over HTTPS
(or localhost during development); browser module scripts do not run reliably
from `file://`. Run `node --experimental-default-type=module --test
quiz-quiz-core.test.js` to validate quiz record parsing and link parameter
handling.
