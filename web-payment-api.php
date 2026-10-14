<?php
declare(strict_types=1);

const GATEWAY_API = 'https://payment.happysatta.com/api';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $path = getenv('MAMA567_PAYMENT_CONFIG');
    if (!$path) {
        $documentRoot = (string) ($_SERVER['DOCUMENT_ROOT'] ?? '');
        if ($documentRoot !== '') {
            $path = dirname(rtrim($documentRoot, DIRECTORY_SEPARATOR)) .
                DIRECTORY_SEPARATOR . 'private' . DIRECTORY_SEPARATOR . 'mama567-payment-config.json';
        }
    }
    if (!$path || !is_file($path) || !is_readable($path)) {
        throw new RuntimeException('Payment server configuration is missing.');
    }
    $decoded = json_decode((string) file_get_contents($path), true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Payment server configuration is invalid.');
    }
    $mysqlConfigPath = dirname($path) . DIRECTORY_SEPARATOR . 'mama567-mysql-config.json';
    if (!is_file($mysqlConfigPath) || !is_readable($mysqlConfigPath)) {
        throw new RuntimeException('Private Hostinger MySQL configuration is missing.');
    }
    $mysqlSettings = json_decode((string) file_get_contents($mysqlConfigPath), true);
    if (!is_array($mysqlSettings)) {
        throw new RuntimeException('Private Hostinger MySQL configuration is invalid.');
    }
    $decoded = array_merge($decoded, array_intersect_key($mysqlSettings, array_flip([
        'mysql_host', 'mysql_port', 'mysql_database', 'mysql_username', 'mysql_password',
    ])));
    foreach (['realtime_database_url', 'gateway_token', 'service_account_file', 'return_url',
        'mysql_host', 'mysql_database', 'mysql_username', 'mysql_password'] as $key) {
        if (empty($decoded[$key]) || !is_string($decoded[$key])) {
            throw new RuntimeException('Payment server configuration is incomplete.');
        }
    }
    if (!preg_match('/^[A-Za-z0-9.-]+$/', $decoded['mysql_host']) ||
        !preg_match('/^[A-Za-z0-9_$-]+$/', $decoded['mysql_database']) ||
        !preg_match('/^[A-Za-z0-9_$-]+$/', $decoded['mysql_username']) ||
        (isset($decoded['mysql_port']) && (!is_numeric($decoded['mysql_port']) ||
            (int) $decoded['mysql_port'] < 1 || (int) $decoded['mysql_port'] > 65535)) ||
        !filter_var($decoded['realtime_database_url'], FILTER_VALIDATE_URL) ||
        !filter_var($decoded['return_url'], FILTER_VALIDATE_URL) ||
        strtolower((string) parse_url($decoded['realtime_database_url'], PHP_URL_SCHEME)) !== 'https' ||
        strtolower((string) parse_url($decoded['return_url'], PHP_URL_SCHEME)) !== 'https' ||
        !is_file($decoded['service_account_file']) ||
        !is_readable($decoded['service_account_file'])) {
        throw new RuntimeException('Payment server configuration is invalid.');
    }
    $GLOBALS['mama567GatewayToken'] = $decoded['gateway_token'];
    $config = $decoded;
    return $config;
}

function safeErrorMessage(string $message): string
{
    $secret = $GLOBALS['mama567GatewayToken'] ?? '';
    if (is_string($secret) && $secret !== '') {
        $message = str_replace($secret, '[redacted]', $message);
    }
    return substr($message, 0, 240);
}

function respond(array $payload, ?string $callback = null): never
{
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('X-Content-Type-Options: nosniff');
    if ($callback !== null && preg_match('/^[A-Za-z_$][A-Za-z0-9_$]{0,80}$/', $callback)) {
        header('Content-Type: application/javascript; charset=utf-8');
        $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
        echo $callback . '(' . ($json === false ? '{"ok":false,"message":"Response encoding failed."}' : $json) . ');';
        exit;
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function accessToken(): string
{
    static $token = null;
    if ($token !== null) {
        return $token;
    }
    $config = config();
    $serviceAccount = json_decode((string) file_get_contents($config['service_account_file']), true);
    if (!is_array($serviceAccount) ||
        empty($serviceAccount['client_email']) ||
        empty($serviceAccount['private_key'])) {
        throw new RuntimeException('The Firebase service account file is invalid.');
    }
    $now = time();
    $base64Url = static function (string $value): string {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    };
    $claims = [
        'iss' => $serviceAccount['client_email'],
        'scope' => 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
        'aud' => OAUTH_TOKEN_URL,
        'iat' => $now,
        'exp' => $now + 3600,
    ];
    $unsigned = $base64Url(json_encode(['alg' => 'RS256', 'typ' => 'JWT'])) . '.' .
        $base64Url(json_encode($claims));
    $signature = '';
    if (!openssl_sign($unsigned, $signature, $serviceAccount['private_key'], OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('Could not sign the Firebase service authorization.');
    }
    $jwt = $unsigned . '.' . $base64Url($signature);
    $result = requestForm(OAUTH_TOKEN_URL, [
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt,
    ]);
    $token = $result['access_token'] ?? null;
    if (!is_string($token) || $token === '') {
        throw new RuntimeException('Google did not issue a Firebase access token.');
    }
    return $token;
}

function requestForm(string $url, array $fields): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($fields, '', '&', PHP_QUERY_RFC3986),
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    if ($body === false) {
        throw new RuntimeException('Could not contact Google authorization: ' . substr($curlError, 0, 160));
    }
    $decoded = json_decode((string) $body, true);
    if (!is_array($decoded) || $status < 200 || $status >= 300) {
        throw new RuntimeException('Google authorization failed (HTTP ' . $status . ').');
    }
    return $decoded;
}

function paymentDatabase(): PDO
{
    static $database = null;
    if ($database instanceof PDO) return $database;
    if (!extension_loaded('pdo_mysql') || !in_array('mysql', PDO::getAvailableDrivers(), true)) {
        throw new RuntimeException('PHP pdo_mysql is required for Hostinger payment storage.');
    }
    $settings = config();
    $port = (int) ($settings['mysql_port'] ?? 3306);
    $dsn = 'mysql:host=' . $settings['mysql_host'] . ';port=' . $port .
        ';dbname=' . $settings['mysql_database'] . ';charset=utf8mb4';
    try {
        $database = new PDO($dsn, $settings['mysql_username'], $settings['mysql_password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 10,
        ]);
        $database->exec(
            'CREATE TABLE IF NOT EXISTS payment_orders (
                order_id VARCHAR(24) NOT NULL PRIMARY KEY,
                phone CHAR(10) NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                status VARCHAR(24) NOT NULL,
                credited TINYINT(1) NOT NULL DEFAULT 0,
                poll_token_hash CHAR(64) NOT NULL,
                gateway_order_id VARCHAR(150) NULL,
                gateway_order_id_source VARCHAR(40) NULL,
                gateway_status VARCHAR(50) NULL,
                transaction_id VARCHAR(150) NULL,
                create_error VARCHAR(240) NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NULL,
                gateway_checked_at DATETIME NULL,
                completed_at DATETIME NULL,
                KEY payment_orders_phone_created (phone, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        $database->exec(
            'CREATE TABLE IF NOT EXISTS payment_rate_limits (
                phone CHAR(10) NOT NULL PRIMARY KEY,
                last_created_at BIGINT UNSIGNED NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    } catch (PDOException $error) {
        throw new RuntimeException('Could not connect to or initialize Hostinger MySQL payment storage.');
    }
    return $database;
}

function databaseTimestamp(?string $value = null): string
{
    if ($value === null || $value === '') return gmdate('Y-m-d H:i:s');
    try {
        return (new DateTimeImmutable($value))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    } catch (Throwable $error) {
        throw new RuntimeException('Payment timestamp is invalid.');
    }
}

function paymentOrderGet(string $orderId): ?array
{
    $query = paymentDatabase()->prepare('SELECT * FROM payment_orders WHERE order_id = :order_id');
    $query->execute(['order_id' => $orderId]);
    $order = $query->fetch();
    if (!is_array($order)) return null;
    return [
        'phone' => $order['phone'],
        'amount' => (float) $order['amount'],
        'status' => $order['status'],
        'credited' => (bool) $order['credited'],
        'pollTokenHash' => $order['poll_token_hash'],
        'gatewayOrderId' => $order['gateway_order_id'],
        'gatewayOrderIdSource' => $order['gateway_order_id_source'],
        'gatewayStatus' => $order['gateway_status'],
        'transactionId' => $order['transaction_id'],
        'createError' => $order['create_error'],
        'createdAt' => $order['created_at'],
        'updatedAt' => $order['updated_at'],
        'gatewayCheckedAt' => $order['gateway_checked_at'],
        'completedAt' => $order['completed_at'],
    ];
}

function paymentOrderCreateAndThrottle(string $orderId, string $phone, array $order): void
{
    $database = paymentDatabase();
    $lockName = 'mama567_pay_' . substr(hash('sha256', $phone), 0, 40);
    $lock = $database->prepare('SELECT GET_LOCK(:lock_name, 10)');
    $lock->execute(['lock_name' => $lockName]);
    if ((int) $lock->fetchColumn() !== 1) {
        throw new RuntimeException('Could not safely start a payment. Please try again.');
    }
    try {
        $database->beginTransaction();
        $query = $database->prepare('SELECT last_created_at FROM payment_rate_limits WHERE phone = :phone');
        $query->execute(['phone' => $phone]);
        $lastCreatedAt = $query->fetchColumn();
        $now = (int) floor(microtime(true) * 1000);
        if ($lastCreatedAt !== false && $now - (int) $lastCreatedAt < 10000) {
            throw new RuntimeException('Please wait a few seconds before starting another payment.');
        }
        $insert = $database->prepare(
            'INSERT INTO payment_orders
                (order_id, phone, amount, status, credited, poll_token_hash, created_at, updated_at)
             VALUES (:order_id, :phone, :amount, :status, 0, :poll_token_hash, :created_at, :updated_at)'
        );
        $insert->execute([
            'order_id' => $orderId,
            'phone' => $phone,
            'amount' => $order['amount'],
            'status' => $order['status'],
            'poll_token_hash' => $order['pollTokenHash'],
            'created_at' => databaseTimestamp($order['createdAt']),
            'updated_at' => databaseTimestamp(),
        ]);
        $rateLimit = $database->prepare(
            'INSERT INTO payment_rate_limits (phone, last_created_at) VALUES (:phone, :created_at)
             ON DUPLICATE KEY UPDATE last_created_at = VALUES(last_created_at)'
        );
        $rateLimit->execute(['phone' => $phone, 'created_at' => $now]);
        $database->commit();
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    } finally {
        $release = $database->prepare('SELECT RELEASE_LOCK(:lock_name)');
        $release->execute(['lock_name' => $lockName]);
    }
}

function paymentOrderUpdate(string $orderId, array $updates): array
{
    $columns = [
        'status' => 'status',
        'credited' => 'credited',
        'gatewayOrderId' => 'gateway_order_id',
        'gatewayOrderIdSource' => 'gateway_order_id_source',
        'gatewayStatus' => 'gateway_status',
        'transactionId' => 'transaction_id',
        'createError' => 'create_error',
        'gatewayCheckedAt' => 'gateway_checked_at',
        'completedAt' => 'completed_at',
    ];
    $sets = ['updated_at = :updated_at'];
    $values = ['updated_at' => databaseTimestamp(), 'order_id' => $orderId];
    foreach ($updates as $key => $value) {
        if (!isset($columns[$key])) continue;
        $column = $columns[$key];
        $parameter = 'value_' . $key;
        if (in_array($key, ['gatewayCheckedAt', 'completedAt'], true) && $value !== null) {
            $value = databaseTimestamp((string) $value);
        }
        if ($key === 'credited') $value = $value ? 1 : 0;
        $sets[] = $column . ' = :' . $parameter;
        $values[$parameter] = $value;
    }
    $query = paymentDatabase()->prepare(
        'UPDATE payment_orders SET ' . implode(', ', $sets) . ' WHERE order_id = :order_id'
    );
    $query->execute($values);
    $order = paymentOrderGet($orderId);
    if ($order === null) throw new RuntimeException('Payment order was not found in Hostinger storage.');
    return $order;
}

function gatewayCall(string $endpoint, string $token, array $fields): array
{
    $payload = array_merge(['user_token' => $token], $fields);
    $ch = curl_init(GATEWAY_API . '/' . $endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($payload, '', '&', PHP_QUERY_RFC3986),
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded; charset=utf-8'],
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    if ($body === false) {
        throw new RuntimeException('Could not reach the payment gateway: ' . substr($curlError, 0, 160));
    }
    $data = json_decode((string) $body, true);
    if (!is_array($data)) {
        throw new RuntimeException('Gateway returned an unreadable response (HTTP ' . $status . ').');
    }
    if ($status < 200 || $status >= 300) {
        throw new RuntimeException(substr((string) ($data['message'] ?? ('Gateway request failed (HTTP ' . $status . ').')), 0, 240));
    }
    return $data;
}

function gatewayRejected(array $response): bool
{
    return ($response['success'] ?? null) === false ||
        strtolower((string) ($response['success'] ?? '')) === 'false' ||
        in_array(strtolower((string) ($response['status'] ?? '')), ['error', 'false'], true) ||
        !empty($response['error']);
}

function findValue($value, array $keys, int $depth = 0): string
{
    if ($depth > 7) return '';
    if (is_string($value)) {
        $trimmed = trim($value);
        if ($trimmed !== '' && ($trimmed[0] === '{' || $trimmed[0] === '[')) {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded)) return findValue($decoded, $keys, $depth + 1);
        }
        return '';
    }
    if (!is_array($value)) return '';
    foreach ($value as $key => $child) {
        if (in_array(strtolower((string) $key), $keys, true) && (is_string($child) || is_numeric($child))) {
            return (string) $child;
        }
    }
    foreach ($value as $child) {
        $found = findValue($child, $keys, $depth + 1);
        if ($found !== '') return $found;
    }
    return '';
}

function normalizePaymentStatus($value): string
{
    if (!is_string($value) && !is_numeric($value)) return '';
    $status = strtoupper(str_replace([' ', '-'], '_', trim((string) $value)));
    if (in_array($status, ['COMPLETED', 'SUCCESS', 'SUCCESSFUL', 'PAID', 'APPROVED', 'SETTLED'], true)) return 'COMPLETED';
    if (in_array($status, ['FAILED', 'FAILURE', 'DECLINED', 'REJECTED'], true)) return 'FAILED';
    if (in_array($status, ['CANCELLED', 'CANCELED'], true)) return 'CANCELLED';
    if (in_array($status, ['PENDING', 'PROCESSING', 'INITIATED', 'IN_PROGRESS', 'WAITING'], true)) return 'PENDING';
    return '';
}

function findPaymentStatus($value, int $depth = 0): string
{
    if ($depth > 7) return '';
    if (is_string($value)) {
        $trimmed = trim($value);
        if ($trimmed !== '' && ($trimmed[0] === '{' || $trimmed[0] === '[')) {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded)) return findPaymentStatus($decoded, $depth + 1);
        }
        return '';
    }
    if (!is_array($value)) return '';
    $paymentKeys = ['paymentstatus', 'orderstatus', 'transactionstatus', 'txnstatus'];
    $specific = [];
    $nestedGeneric = [];
    $rootGeneric = [];
    foreach ($value as $key => $child) {
        $normalizedKey = strtolower(preg_replace('/[_\s-]/', '', (string) $key));
        $status = normalizePaymentStatus($child);
        if (in_array($normalizedKey, $paymentKeys, true) && $status !== '') {
            $specific[$status] = true;
        } elseif ($normalizedKey === 'status' && $status !== '') {
            if ($depth > 0) $nestedGeneric[$status] = true;
            else $rootGeneric[$status] = true;
        }
    }
    if (count($specific) > 0) return count($specific) === 1 ? (string) array_key_first($specific) : 'PENDING';
    $nested = [];
    foreach ($value as $child) {
        $status = findPaymentStatus($child, $depth + 1);
        if ($status !== '') $nested[$status] = true;
    }
    if (count($nested) === 1) return (string) array_key_first($nested);
    if (count($nested) > 1) return 'PENDING';
    if (count($nestedGeneric) === 1) return (string) array_key_first($nestedGeneric);
    if (count($nestedGeneric) > 1) return 'PENDING';
    if (count($rootGeneric) === 1) {
        $status = (string) array_key_first($rootGeneric);
        return $status === 'COMPLETED' ? '' : $status;
    }
    return count($rootGeneric) > 1 ? 'PENDING' : '';
}

function firebaseUrl(string $path): string
{
    $base = rtrim(config()['realtime_database_url'], '/');
    $parts = array_map('rawurlencode', explode('/', $path));
    return $base . '/' . implode('/', $parts) . '.json';
}

function realtimeGet(string $path, bool $withEtag = false): array
{
    $headers = ['Authorization: Bearer ' . accessToken()];
    if ($withEtag) $headers[] = 'X-Firebase-ETag: true';
    $ch = curl_init(firebaseUrl($path));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HEADER => true,
    ]);
    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($response === false) throw new RuntimeException('Could not read Firebase Realtime Database: ' . substr($error, 0, 160));
    $headerText = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);
    if ($status < 200 || $status >= 300) throw new RuntimeException('Realtime Database read failed (HTTP ' . $status . ').');
    $decoded = json_decode($body, true);
    $etag = '';
    foreach (preg_split('/\r\n|\r|\n/', $headerText) as $line) {
        if (stripos($line, 'ETag:') === 0) $etag = trim(substr($line, 5));
    }
    if ($withEtag && $etag === '') throw new RuntimeException('Realtime Database did not return an ETag.');
    return ['value' => $decoded, 'etag' => $etag];
}

function realtimeConditionalPut(string $path, array $value, string $etag): int
{
    $ch = curl_init(firebaseUrl($path));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => json_encode($value, JSON_UNESCAPED_SLASHES),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . accessToken(),
            'Content-Type: application/json',
            'If-Match: ' . $etag,
        ],
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($response === false) throw new RuntimeException('Could not update wallet balance: ' . substr($error, 0, 160));
    return $status;
}

function numericValue($value): float
{
    if (is_string($value)) {
        $decoded = json_decode($value, true);
        if (is_string($decoded) || is_numeric($decoded)) $value = $decoded;
    }
    if ($value === null || $value === '') return 0.0;
    if (!is_numeric($value) || !is_finite((float) $value)) {
        throw new RuntimeException('The account points balance is invalid.');
    }
    return (float) $value;
}

function creditOrder(string $orderId, string $transactionId): void
{
    $lock = fopen(sys_get_temp_dir() . '/mama567-payment-credit.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) throw new RuntimeException('Could not lock wallet credit.');
    try {
        $order = paymentOrderGet($orderId);
        if ($order === null || !empty($order['credited'])) return;
        $phone = (string) ($order['phone'] ?? '');
        $amount = (float) ($order['amount'] ?? 0);
        if (!preg_match('/^\d{10}$/', $phone) || !is_finite($amount) || $amount < 1) {
            throw new RuntimeException('Stored payment order is invalid; no points were credited.');
        }
        $transactionKey = 'PAY-' . $orderId;
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $result = realtimeGet('DATA/' . $phone, true);
            $profile = $result['value'];
            if (!is_array($profile)) throw new RuntimeException('Mama567 account for this order was not found.');
            $transactions = is_array($profile['transactions'] ?? null) ? $profile['transactions'] : [];
            if (!isset($transactions[$transactionKey])) {
                $completedAt = gmdate('Y-m-d\TH:i:s\Z');
                $profile['bal'] = numericValue($profile['bal'] ?? 0) + $amount;
                $profile['TD'] = numericValue($profile['TD'] ?? 0) + $amount;
                $transactions[$transactionKey] = [
                    'id' => $transactionKey,
                    'type' => 'Added',
                    'title' => 'Payment deposit',
                    'amount' => $amount,
                    'date' => $completedAt,
                    'createdAt' => $completedAt,
                    'status' => 'Completed',
                    'note' => $transactionId !== '' ? 'Gateway transaction ' . substr($transactionId, 0, 100) : 'Gateway payment',
                ];
                $profile['transactions'] = $transactions;
                $saved = realtimeConditionalPut('DATA/' . $phone, $profile, $result['etag']);
                if ($saved === 412) continue;
                if ($saved < 200 || $saved >= 300) throw new RuntimeException('Could not save confirmed points to the Mama567 account.');
            }
            $completedAt = gmdate('Y-m-d\TH:i:s\Z');
            paymentOrderUpdate($orderId, [
                'status' => 'COMPLETED',
                'credited' => true,
                'transactionId' => $transactionId,
                'completedAt' => $completedAt,
            ]);
            return;
        }
        throw new RuntimeException('Account changed repeatedly; payment credit will retry on the next status check.');
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function createOrder(array $parameters): array
{
    $phone = preg_replace('/\D/', '', (string) ($parameters['phone'] ?? ''));
    if (!preg_match('/^\d{10}$/', $phone)) throw new RuntimeException('A valid 10-digit account phone is required.');
    $amountText = trim((string) ($parameters['amount'] ?? ''));
    if (!preg_match('/^\d+(?:\.\d{1,2})?$/', $amountText)) {
        throw new RuntimeException('Enter an amount from ₹1 to ₹10,00,000 with at most two decimals.');
    }
    $amount = (float) $amountText;
    if (!is_finite($amount) || $amount < 1 || $amount > 1000000) {
        throw new RuntimeException('Enter an amount from ₹1 to ₹10,00,000 with at most two decimals.');
    }
    $profile = realtimeGet('DATA/' . $phone)['value'];
    if (!is_array($profile)) throw new RuntimeException('Mama567 account was not found.');
    if (preg_match('/^(yes|true|1)$/i', trim((string) ($profile['blocked'] ?? '')))) {
        throw new RuntimeException('This account cannot start a payment. Contact support for help.');
    }

    $orderId = (string) floor(microtime(true) * 1000) . str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $pollToken = bin2hex(random_bytes(32));
    $order = [
        'phone' => $phone,
        'amount' => $amount,
        'status' => 'CREATING',
        'credited' => false,
        'pollTokenHash' => hash('sha256', $pollToken),
        'createdAt' => gmdate('Y-m-d\TH:i:s\Z'),
    ];
    paymentOrderCreateAndThrottle($orderId, $phone, $order);
    $checkoutUrl = '';
    try {
        $gatewayResponse = gatewayCall('create-order', config()['gateway_token'], [
            'customer_mobile' => $phone,
            'amount' => rtrim(rtrim(number_format($amount, 2, '.', ''), '0'), '.'),
            'order_id' => $orderId,
            'redirect_url' => config()['return_url'],
            'remark1' => 'mama567',
            'remark2' => $orderId,
        ]);
        if (gatewayRejected($gatewayResponse)) {
            throw new RuntimeException((string) ($gatewayResponse['message'] ?? 'The gateway rejected the payment order.'));
        }
        $checkoutUrl = findValue($gatewayResponse, ['payment_url', 'paymenturl', 'checkout_url', 'checkouturl', 'payment_link', 'paymentlink', 'url']);
        if (!filter_var($checkoutUrl, FILTER_VALIDATE_URL) || strtolower((string) parse_url($checkoutUrl, PHP_URL_SCHEME)) !== 'https') {
            throw new RuntimeException('Gateway did not return a secure HTTPS checkout URL.');
        }
        $gatewayOrderId = findValue($gatewayResponse, ['gateway_order_id', 'gatewayorderid', 'provider_order_id', 'providerorderid']);
        $updates = ['status' => 'PENDING'];
        if ($gatewayOrderId !== '') {
            $updates['gatewayOrderId'] = $gatewayOrderId;
            $updates['gatewayOrderIdSource'] = 'explicit_provider_field';
        }
        paymentOrderUpdate($orderId, $updates);
    } catch (Throwable $error) {
        paymentOrderUpdate($orderId, [
            'status' => 'CREATE_FAILED',
            'createError' => safeErrorMessage($error->getMessage()),
        ]);
        throw $error;
    }
    return ['ok' => true, 'orderId' => $orderId, 'pollToken' => $pollToken, 'checkoutUrl' => $checkoutUrl, 'amount' => $amount];
}

function checkOrder(array $parameters): array
{
    $orderId = (string) ($parameters['orderId'] ?? '');
    $pollToken = (string) ($parameters['pollToken'] ?? '');
    if (!preg_match('/^\d{13,24}$/', $orderId) || strlen($pollToken) < 32) {
        throw new RuntimeException('Payment order details are invalid.');
    }
    $order = paymentOrderGet($orderId);
    if ($order === null || !hash_equals((string) ($order['pollTokenHash'] ?? ''), hash('sha256', $pollToken))) {
        throw new RuntimeException('Payment order was not found or access was denied.');
    }
    return reconcileOrder($orderId);
}

function findWebhookOrderId($value, int $depth = 0): string
{
    if ($depth > 8) return '';
    if (is_string($value)) {
        $text = trim($value);
        if ($text !== '' && ($text[0] === '{' || $text[0] === '[')) {
            $decoded = json_decode($text, true);
            if (is_array($decoded)) return findWebhookOrderId($decoded, $depth + 1);
        }
        return '';
    }
    if (!is_array($value)) return '';
    $keys = ['orderid', 'merchantorderid', 'clientorderid', 'remark2'];
    foreach ($value as $key => $child) {
        $normalized = strtolower(preg_replace('/[_\s-]/', '', (string) $key));
        if (in_array($normalized, $keys, true) && (is_string($child) || is_numeric($child))) {
            $candidate = trim((string) $child);
            if (preg_match('/^\d{13,24}$/', $candidate)) return $candidate;
        }
    }
    foreach ($value as $child) {
        $found = findWebhookOrderId($child, $depth + 1);
        if ($found !== '') return $found;
    }
    return '';
}

function reconcileOrder(string $orderId): array
{
    $order = paymentOrderGet($orderId);
    if ($order === null) throw new RuntimeException('Payment order was not found.');
    if (!empty($order['credited'])) {
        return ['ok' => true, 'orderId' => $orderId, 'status' => 'COMPLETED', 'credited' => true, 'amount' => (float) $order['amount']];
    }
    $existingStatus = strtoupper((string) ($order['status'] ?? ''));
    if (in_array($existingStatus, ['FAILED', 'FAILURE', 'CANCELLED', 'CANCELED'], true)) {
        return ['ok' => true, 'orderId' => $orderId, 'status' => $existingStatus, 'credited' => false];
    }
    $gatewayToken = config()['gateway_token'];
    $gatewayOrderId = (($order['gatewayOrderIdSource'] ?? '') === 'explicit_provider_field' && !empty($order['gatewayOrderId']))
        ? (string) $order['gatewayOrderId']
        : $orderId;
    $response = gatewayCall('check-order-status', $gatewayToken, ['order_id' => $gatewayOrderId]);
    if (gatewayRejected($response)) {
        throw new RuntimeException((string) ($response['message'] ?? 'Gateway could not confirm payment status.'));
    }
    $status = findPaymentStatus($response);
    $checkedAt = gmdate('Y-m-d\TH:i:s\Z');
    if ($status === 'COMPLETED') {
        $gatewayAmount = findValue($response, ['paid_amount', 'paidamount', 'txn_amount', 'txnamount', 'amount']);
        if ($gatewayAmount !== '') {
            $normalizedAmount = (float) preg_replace('/[,\s₹]/u', '', $gatewayAmount);
            if (!is_finite($normalizedAmount) || round($normalizedAmount * 100) !== round((float) $order['amount'] * 100)) {
                throw new RuntimeException('Gateway confirmed a different payment amount; no points were credited.');
            }
        }
        $transactionId = findValue($response, ['transaction_id', 'txn_id', 'transactionid', 'utr', 'bank_rrn', 'rrn']);
        creditOrder($orderId, $transactionId);
        $freshOrder = paymentOrderGet($orderId);
        return ['ok' => true, 'orderId' => $orderId, 'status' => 'COMPLETED', 'credited' => !empty($freshOrder['credited']), 'amount' => (float) $order['amount']];
    }
    $terminal = in_array($status, ['FAILED', 'FAILURE', 'CANCELLED', 'CANCELED'], true);
    paymentOrderUpdate($orderId, [
        'status' => $terminal ? $status : 'PENDING',
        'gatewayStatus' => $status !== '' ? $status : 'UNRECOGNIZED',
        'gatewayCheckedAt' => $checkedAt,
    ]);
    return ['ok' => true, 'orderId' => $orderId, 'status' => $status !== '' ? $status : 'PENDING', 'credited' => false];
}

function main(): void
{
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method === 'POST') {
        $payload = $_POST;
        $rawBody = file_get_contents('php://input');
        $jsonBody = is_string($rawBody) ? json_decode($rawBody, true) : null;
        if (is_array($jsonBody)) $payload = array_merge($payload, $jsonBody);
        $orderId = findWebhookOrderId($payload);
        if ($orderId === '') {
            respond(['ok' => false, 'message' => 'Webhook did not include a valid order ID.']);
        }
        try {
            respond(reconcileOrder($orderId));
        } catch (Throwable $error) {
            error_log('[Mama567 payment] webhook failed order=' . $orderId . ': ' . safeErrorMessage($error->getMessage()));
            respond(['ok' => false, 'message' => safeErrorMessage($error->getMessage())]);
        }
    }
    if ($method !== 'GET') {
        http_response_code(405);
        header('Allow: GET, POST');
        respond(['ok' => false, 'message' => 'Method not allowed.']);
    }
    $callback = isset($_GET['callback']) ? (string) $_GET['callback'] : null;
    if ($callback !== null && !preg_match('/^[A-Za-z_$][A-Za-z0-9_$]{0,80}$/', $callback)) {
        respond(['ok' => false, 'message' => 'Invalid callback name.']);
    }
    try {
        $action = (string) ($_GET['action'] ?? '');
        if ($action === 'create') {
            $result = createOrder($_GET);
        } elseif ($action === 'status') {
            $result = checkOrder($_GET);
        } elseif ($callback === null) {
            config();
            paymentDatabase();
            respond(['ok' => true, 'service' => 'Mama567 payment API', 'storage' => 'hostinger-mysql']);
        } else {
            throw new RuntimeException('Unsupported payment action.');
        }
        respond($result, $callback);
    } catch (Throwable $error) {
        $orderId = preg_replace('/[^\w-]/', '', (string) ($_GET['orderId'] ?? $_GET['order_id'] ?? ''));
        error_log('[Mama567 payment] ' . substr((string) ($_GET['action'] ?? 'request'), 0, 20) .
            ' failed order=' . ($orderId !== '' ? substr($orderId, 0, 40) : '[new]') .
            ': ' . safeErrorMessage($error->getMessage()));
        respond(['ok' => false, 'message' => safeErrorMessage($error->getMessage())], $callback);
    }
}

main();
