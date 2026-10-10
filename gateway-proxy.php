<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

function respond(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function redactSecret($value, string $secret)
{
    if (is_string($value)) {
        return str_replace($secret, '[redacted]', $value);
    }
    if (is_array($value)) {
        foreach ($value as $key => $child) {
            $value[$key] = redactSecret($child, $secret);
        }
    }
    return $value;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['error' => 'POST requests only.']);
}

$configFile = __DIR__ . DIRECTORY_SEPARATOR . 'gateway-config.php';
if (!is_file($configFile)) {
    respond(503, ['error' => 'Gateway server configuration is missing.']);
}
$config = require $configFile;
if (!is_array($config)) {
    respond(500, ['error' => 'Gateway server configuration is invalid.']);
}

$apiToken = trim((string)($config['api_token'] ?? ''));
$apiBase = rtrim(trim((string)($config['api_base_url'] ?? '')), '/');
$allowedOrigin = rtrim(trim((string)($config['app_origin'] ?? '')), '/');
if ($apiToken === '' || strlen($apiToken) < 16 || stripos($apiToken, 'replace_with_') !== false) {
    respond(503, ['error' => 'Set a valid gateway API token in the server-only gateway-config.php file.']);
}

$apiBaseParts = parse_url($apiBase);
$originParts = parse_url($allowedOrigin);
if (
    !is_array($apiBaseParts) ||
    strtolower((string)($apiBaseParts['scheme'] ?? '')) !== 'https' ||
    empty($apiBaseParts['host']) ||
    isset($apiBaseParts['user']) ||
    isset($apiBaseParts['pass']) ||
    isset($apiBaseParts['query']) ||
    isset($apiBaseParts['fragment']) ||
    !is_array($originParts) ||
    strtolower((string)($originParts['scheme'] ?? '')) !== 'https' ||
    empty($originParts['host']) ||
    isset($originParts['user']) ||
    isset($originParts['pass']) ||
    isset($originParts['path']) ||
    isset($originParts['query']) ||
    isset($originParts['fragment'])
) {
    respond(500, ['error' => 'Set valid HTTPS API and website origins in gateway-config.php.']);
}

$requestOrigin = rtrim(trim((string)($_SERVER['HTTP_ORIGIN'] ?? '')), '/');
if ($requestOrigin === '' || !hash_equals(strtolower($allowedOrigin), strtolower($requestOrigin))) {
    respond(403, ['error' => 'Request origin is not allowed. Open the payment page from the configured website domain.']);
}

$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > 16384) {
    respond(413, ['error' => 'Request body is too large.']);
}
$rawBody = file_get_contents('php://input');
$request = json_decode($rawBody === false ? '' : $rawBody, true);
if (!is_array($request)) {
    respond(400, ['error' => 'Expected a JSON request body.']);
}

$action = $request['action'] ?? '';
if (!in_array($action, ['create-order', 'check-order-status'], true)) {
    respond(400, ['error' => 'Unsupported gateway action.']);
}

$fields = ['user_token' => $apiToken];
if ($action === 'create-order') {
    $phone = preg_replace('/\D/', '', (string)($request['customer_mobile'] ?? ''));
    $amount = trim((string)($request['amount'] ?? ''));
    $orderId = (string)($request['order_id'] ?? '');
    $redirectUrl = (string)($request['redirect_url'] ?? '');
    if (!preg_match('/^[6-9][0-9]{9}$/', $phone)) {
        respond(400, ['error' => 'Enter a valid 10-digit Indian payer mobile number.']);
    }
    if (!preg_match('/^[0-9]{1,7}(?:\.[0-9]{1,2})?$/', $amount) || (float)$amount < 1 || (float)$amount > 1000000) {
        respond(400, ['error' => 'Amount must be from ₹1 to ₹10,00,000 with at most two decimal places.']);
    }
    if (!preg_match('/^[0-9]{13,24}$/', $orderId)) {
        respond(400, ['error' => 'Invalid order reference.']);
    }
    $redirectParts = parse_url($redirectUrl);
    if (
        !is_array($redirectParts) ||
        strtolower((string)($redirectParts['scheme'] ?? '')) !== 'https' ||
        strtolower((string)($redirectParts['host'] ?? '')) !== strtolower((string)$originParts['host']) ||
        (int)($redirectParts['port'] ?? 443) !== (int)($originParts['port'] ?? 443) ||
        isset($redirectParts['user']) ||
        isset($redirectParts['pass'])
    ) {
        respond(400, ['error' => 'Return URL must use the configured HTTPS website domain.']);
    }
    parse_str((string)($redirectParts['query'] ?? ''), $redirectQuery);
    if (($redirectQuery['orderId'] ?? '') !== $orderId) {
        respond(400, ['error' => 'Return URL must include this order reference.']);
    }

    $fields += [
        'customer_mobile' => $phone,
        'amount' => $amount,
        'order_id' => $orderId,
        'redirect_url' => $redirectUrl,
        'remark1' => 'website-demo',
        'remark2' => $orderId,
    ];
} else {
    $orderId = (string)($request['order_id'] ?? '');
    if (!preg_match('/^[0-9]{13,24}$/', $orderId)) {
        respond(400, ['error' => 'Invalid order reference.']);
    }
    $fields['order_id'] = $orderId;
}

if (!function_exists('curl_init')) {
    respond(503, ['error' => 'PHP cURL is not enabled on this hosting account.']);
}

$url = $apiBase . '/' . $action;
$curl = curl_init($url);
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query($fields, '', '&', PHP_QUERY_RFC1738),
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/x-www-form-urlencoded',
        'Accept: application/json',
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
]);
$responseBody = curl_exec($curl);
$curlError = curl_errno($curl);
$upstreamStatus = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
curl_close($curl);

if ($responseBody === false || $curlError !== 0) {
    respond(502, ['error' => 'Could not connect to the payment gateway from the hosting server.']);
}

$gatewayResponse = json_decode($responseBody, true);
if (!is_array($gatewayResponse)) {
    respond(502, ['error' => 'Gateway returned an invalid response.']);
}
if ($upstreamStatus < 200 || $upstreamStatus >= 300) {
    respond($upstreamStatus >= 400 && $upstreamStatus < 500 ? $upstreamStatus : 502, [
        'error' => (string)redactSecret(
            $gatewayResponse['message'] ?? $gatewayResponse['error'] ?? 'Gateway request failed.',
            $apiToken
        ),
    ]);
}

respond(200, redactSecret($gatewayResponse, $apiToken));
