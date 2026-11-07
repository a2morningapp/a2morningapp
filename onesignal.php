<?php
declare(strict_types=1);

const ONESIGNAL_APP_ID = 'e1183bae-f7b7-4122-90a7-10d72adf87e2';
const ADMIN_DATABASE_URL = 'https://a2morning-in-website-new-db-default-rtdb.firebaseio.com/Admin/Admin.json';
const ONESIGNAL_API_URL = 'https://api.onesignal.com/notifications';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: DENY');
ini_set('display_errors', '0');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function requireSameOrigin(): void
{
    $origin = filter_var($_SERVER['HTTP_ORIGIN'] ?? '', FILTER_VALIDATE_URL);
    $host = strtolower(parse_url('https://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST) ?: '');
    $originHost = strtolower(parse_url($origin ?: '', PHP_URL_HOST) ?: '');
    $originPort = parse_url($origin ?: '', PHP_URL_PORT);
    $originScheme = strtolower(parse_url($origin ?: '', PHP_URL_SCHEME) ?: '');
    $requestPort = parse_url('https://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_PORT);
    $configuredHosts = getenv('ADMIN_ALLOWED_HOSTS') ?: '';
    $allowedHosts = array_values(array_filter(array_map(
        static fn($allowedHost) => strtolower(trim($allowedHost)),
        explode(',', $configuredHosts)
    )));
    $isLocal = in_array($host, ['localhost', '127.0.0.1'], true);

    if (($allowedHosts && !in_array($host, $allowedHosts, true))
        || $originHost !== $host || $originPort !== $requestPort
        || ($originScheme !== 'https' && !$isLocal)) {
        respond(403, ['ok' => false, 'error' => 'Requests must come from the admin website over HTTPS.']);
    }
}

function decodeLegacyValue($value)
{
    for ($depth = 0; $depth < 2 && is_string($value); $depth++) {
        $decoded = json_decode($value, true);
        if (json_last_error() !== JSON_ERROR_NONE || $decoded === $value) {
            break;
        }
        $value = $decoded;
    }
    return $value;
}

function enforceLoginRateLimit(): void
{
    $clientIp = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    $path = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'm555-onesignal-login-' . hash('sha256', $clientIp) . '.json';
    $file = @fopen($path, 'c+');
    if ($file === false || !flock($file, LOCK_EX)) {
        if (is_resource($file)) {
            fclose($file);
        }
        respond(503, ['ok' => false, 'error' => 'Could not verify the admin sign-in right now.']);
    }

    $attempts = json_decode(stream_get_contents($file) ?: '[]', true);
    $now = time();
    $recentAttempts = is_array($attempts)
        ? array_values(array_filter($attempts, static fn($attempt) => is_numeric($attempt) && $now - (int) $attempt < 900))
        : [];
    if (count($recentAttempts) >= 8) {
        flock($file, LOCK_UN);
        fclose($file);
        respond(429, ['ok' => false, 'error' => 'Too many sign-in attempts. Try again in 15 minutes.']);
    }

    $recentAttempts[] = $now;
    rewind($file);
    ftruncate($file, 0);
    fwrite($file, json_encode($recentAttempts));
    fflush($file);
    chmod($path, 0600);
    flock($file, LOCK_UN);
    fclose($file);
}

function loadAdminCredentials(): array
{
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 8,
            'ignore_errors' => true,
            'header' => "Accept: application/json\r\n",
        ],
    ]);
    $response = @file_get_contents(ADMIN_DATABASE_URL, false, $context);
    if ($response === false) {
        error_log('OneSignal sender could not read admin credentials from Firebase.');
        respond(503, ['ok' => false, 'error' => 'Could not verify the admin account with Firebase.']);
    }

    $credentials = decodeLegacyValue($response);
    if (!is_array($credentials)) {
        respond(503, ['ok' => false, 'error' => 'Admin credentials are unavailable.']);
    }

    $phone = preg_replace('/\D+/', '', (string) decodeLegacyValue($credentials['NumAdmin'] ?? ''));
    $password = (string) decodeLegacyValue($credentials['PassAdmin'] ?? '');
    if ($phone === '' || $password === '') {
        respond(503, ['ok' => false, 'error' => 'Admin credentials are not configured.']);
    }
    return [$phone, $password];
}

function verifySessionAdmin(): void
{
    $phone = (string) ($_SESSION['adminPhone'] ?? '');
    $fingerprint = (string) ($_SESSION['adminFingerprint'] ?? '');
    if ($phone === '' || $fingerprint === '') {
        respond(401, ['ok' => false, 'error' => 'Sign in to the admin panel again to enable notifications.']);
    }
    if (time() - (int) ($_SESSION['adminAuthAt'] ?? 0) > 28800) {
        $_SESSION = [];
        session_destroy();
        respond(401, ['ok' => false, 'error' => 'Notification session expired. Sign in again.']);
    }

    [$currentPhone, $currentPassword] = loadAdminCredentials();
    $currentFingerprint = hash('sha256', $currentPhone . "\0" . $currentPassword);
    if (!hash_equals($currentPhone, $phone) || !hash_equals($currentFingerprint, $fingerprint)) {
        $_SESSION = [];
        session_destroy();
        respond(401, ['ok' => false, 'error' => 'Admin credentials changed. Sign in again.']);
    }
}

function oneSignalRestApiKey(): string
{
    $key = getenv('ONESIGNAL_REST_API_KEY') ?: '';
    if ($key === '' && is_file(__DIR__ . '/onesignal-secret.php')) {
        $secret = require __DIR__ . '/onesignal-secret.php';
        if (is_array($secret)) {
            $key = (string) ($secret['restApiKey'] ?? '');
        }
    }
    return trim($key);
}

requireSameOrigin();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'Use POST for notification requests.']);
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false || strlen($rawBody) > 16000) {
    respond(413, ['ok' => false, 'error' => 'Notification request is too large.']);
}
$request = json_decode($rawBody, true);
if (!is_array($request)) {
    respond(400, ['ok' => false, 'error' => 'Invalid notification request.']);
}

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
session_name('sridevi_matka_admin_notifications');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.gc_maxlifetime', '28800');
session_set_cookie_params([
    'lifetime' => 28800,
    'path' => '/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

$action = (string) ($request['action'] ?? '');
if ($action === 'login') {
    $phone = preg_replace('/\D+/', '', (string) ($request['phone'] ?? ''));
    $password = (string) ($request['password'] ?? '');
    if (!preg_match('/^\d{10,15}$/', $phone) || $password === '' || strlen($password) > 512) {
        respond(400, ['ok' => false, 'error' => 'Enter valid admin sign-in details.']);
    }
    enforceLoginRateLimit();
    [$expectedPhone, $expectedPassword] = loadAdminCredentials();
    if (!hash_equals($expectedPhone, $phone) || !hash_equals($expectedPassword, $password)) {
        respond(401, ['ok' => false, 'error' => 'Admin sign-in could not be verified.']);
    }
    session_regenerate_id(true);
    $_SESSION['adminPhone'] = $expectedPhone;
    $_SESSION['adminFingerprint'] = hash('sha256', $expectedPhone . "\0" . $expectedPassword);
    $_SESSION['adminAuthAt'] = time();
    respond(200, ['ok' => true]);
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    respond(200, ['ok' => true]);
}

verifySessionAdmin();
if ($action === 'status') {
    respond(200, ['ok' => true, 'configured' => oneSignalRestApiKey() !== '']);
}
if ($action !== 'send') {
    respond(400, ['ok' => false, 'error' => 'Unsupported notification action.']);
}

$heading = trim((string) ($request['heading'] ?? ''));
$message = trim((string) ($request['message'] ?? ''));
$subscriptionId = trim((string) ($request['subscriptionId'] ?? ''));
$data = $request['data'] ?? null;
if ($heading === '' || strlen($heading) > 240 || $message === '' || strlen($message) > 1000) {
    respond(400, ['ok' => false, 'error' => 'Enter a title and message within the allowed length.']);
}
if ($subscriptionId !== '' && !preg_match('/^[a-f0-9-]{36}$/i', $subscriptionId)) {
    respond(400, ['ok' => false, 'error' => 'The targeted subscription ID is invalid.']);
}
$dataIsList = is_array($data) && $data !== [] && array_keys($data) === range(0, count($data) - 1);
if ($data !== null && (!is_array($data) || $dataIsList)) {
    respond(400, ['ok' => false, 'error' => 'Notification data must be a JSON object.']);
}

$apiKey = oneSignalRestApiKey();
if ($apiKey === '') {
    respond(503, ['ok' => false, 'error' => 'OneSignal REST API key is not configured on the server.']);
}
if (!function_exists('curl_init')) {
    error_log('OneSignal sender requires the PHP cURL extension.');
    respond(503, ['ok' => false, 'error' => 'The server is missing the cURL extension required for push delivery.']);
}

$payload = [
    'app_id' => ONESIGNAL_APP_ID,
    'headings' => ['en' => $heading],
    'contents' => ['en' => $message],
];
if ($subscriptionId !== '') {
    $payload['include_subscription_ids'] = [$subscriptionId];
} else {
    $payload['included_segments'] = ['All'];
}
if (is_array($data) && $data !== []) {
    $payload['data'] = $data;
}

$curl = curl_init(ONESIGNAL_API_URL);
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_HTTPHEADER => [
        'Authorization: Key ' . $apiKey,
        'Content-Type: application/json; charset=utf-8',
        'Accept: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES),
]);
$responseBody = curl_exec($curl);
$curlError = curl_error($curl);
$status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

if ($responseBody === false || $status < 200 || $status >= 300) {
    error_log('OneSignal notification request failed; HTTP ' . $status . '; ' . $curlError . '; response=' . (string) $responseBody);
    respond(502, ['ok' => false, 'error' => 'OneSignal rejected the notification. Check the server-side REST key and app settings.']);
}

$result = json_decode($responseBody, true);
$recipients = is_array($result) ? (int) ($result['recipients'] ?? 0) : 0;
respond(200, [
    'ok' => true,
    'recipients' => $recipients,
    'notificationId' => is_array($result) ? (string) ($result['id'] ?? '') : '',
]);
