A2 MORNING ADMIN PANEL

This is a flat, self-contained copy of the Mama567 admin panel adapted for A2
MORNING. Upload every file in this folder into one hosting directory; do not
put the files into separate subfolders. Open index.html or admin.html.

FIREBASE

The admin panel uses the A2 MORNING Realtime Database. The result chart and
expert-guessing publisher use the separate a2morning-web-result Realtime
Database. The panel does not migrate Mama567 player, balance, request, market,
or history data.

After an administrator signs in, the panel creates /adminData with the
dashboard's default schema and rates when it is missing. It adds the default
withdrawal schedule at /Admin/Admin/WRTiming only when that setting is absent.
Missing ExpertGuessing entries are initialized for existing markets in the
result database. These are new defaults; they do not copy Mama567's live data.

Admin sign-in still reads /Admin/Admin/NumAdmin and /Admin/Admin/PassAdmin in
the A2 database. Those credentials must already be configured by an authorized
administrator; this website does not copy or create credentials.

RESULT CHART

The result chart is result.html and uses the A2 MORNING result database
configuration. The panel defaults the result chart URL to result.html in the
same hosting directory. Public chart access requires read permission for
/results; writes must remain restricted to trusted administrators.

PUSH NOTIFICATIONS

code2.gs is the optional Google Apps Script sender for admin broadcasts. It
uses the OneSignal app ID currently configured in the native app. Configure
ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY, and a unique BROADCAST_TOKEN of at
least 24 characters in Apps Script Script Properties. Keep the REST key and
token out of this folder. Deploy the Apps Script as a web app and configure
its /exec URL and token in Notices → Configure sender. If A2 MORNING uses a
different OneSignal app, update the expected ID in code2.gs before deployment.

SECURITY

The phone/password page is a client-side convenience gate, not Firebase
Authentication. Realtime Database security rules must independently restrict
read and write access to authorized administrators. Never enable public writes
to the admin or result databases.
