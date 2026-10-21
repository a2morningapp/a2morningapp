<?php
declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'a2-payment-api.php';

function matka60ApiRespond(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('X-Content-Type-Options: nosniff');
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function matka60ApiDatabase(): PDO
{
    $database = paymentDatabase();
    $database->exec(
        'CREATE TABLE IF NOT EXISTS matka60_sessions (
            token_hash CHAR(64) NOT NULL PRIMARY KEY,
            phone CHAR(10) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL,
            KEY matka60_sessions_phone (phone),
            KEY matka60_sessions_expiry (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $database->exec(
        'CREATE TABLE IF NOT EXISTS matka60_login_limits (
            phone CHAR(10) NOT NULL PRIMARY KEY,
            window_started_at DATETIME NOT NULL,
            attempts INT UNSIGNED NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    return $database;
}

function matka60ApiOrigins(): array
{
    $origins = config()['matka60_allowed_origins'] ?? null;
    if (!is_array($origins) || !$origins) {
        throw new RuntimeException('Matka 60 allowed origins are not configured.');
    }
    foreach ($origins as $origin) {
        if (!is_string($origin) || !preg_match('~^https://[A-Za-z0-9.-]+(?::\d{1,5})?$~', $origin)) {
            throw new RuntimeException('Matka 60 allowed origins contain an invalid value.');
        }
    }
    return array_values(array_unique($origins));
}

function matka60ApiProfileValue($value): mixed
{
    if (!is_string($value)) return $value;
    $decoded = json_decode($value, true);
    return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
}

function matka60ApiIsBlocked($value): bool
{
    $value = matka60ApiProfileValue($value);
    if ($value === null || $value === false || $value === 0) return false;
    if (is_array($value) || is_object($value)) return true;
    return !preg_match('/^(false|0|no|off|x)?$/i', trim((string) $value));
}

function matka60ApiRecordLoginAttempt(PDO $database, string $phone): void
{
    $limit = $database->prepare(
        'INSERT INTO matka60_login_limits (phone, window_started_at, attempts)
         VALUES (:phone, UTC_TIMESTAMP(), 1)
         ON DUPLICATE KEY UPDATE
            attempts = IF(window_started_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE), 1, attempts + 1),
            window_started_at = IF(window_started_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE), UTC_TIMESTAMP(), window_started_at)'
    );
    $limit->execute(['phone' => $phone]);
    $attempts = $database->prepare('SELECT attempts FROM matka60_login_limits WHERE phone = :phone');
    $attempts->execute(['phone' => $phone]);
    if ((int) $attempts->fetchColumn() > 15) {
        throw new RuntimeException('Too many sign-in attempts. Please try again in 15 minutes.');
    }
}

function matka60ApiIssueSession(PDO $database, string $phone): string
{
    $token = bin2hex(random_bytes(32));
    $insert = $database->prepare(
        'INSERT INTO matka60_sessions (token_hash, phone, expires_at, created_at)
         VALUES (:token_hash, :phone, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 12 HOUR), UTC_TIMESTAMP())'
    );
    $insert->execute(['token_hash' => hash('sha256', $token), 'phone' => $phone]);
    $database->prepare('DELETE FROM matka60_login_limits WHERE phone = :phone')->execute(['phone' => $phone]);
    return $token;
}

function matka60ApiFirebaseCustomToken(string $phone): string
{
    $config = config();
    $serviceAccountPath = $config['service_account_file'] ?? '';
    $serviceAccount = is_string($serviceAccountPath) && is_readable($serviceAccountPath)
        ? json_decode((string) file_get_contents($serviceAccountPath), true) : null;
    if (!is_array($serviceAccount) ||
        empty($serviceAccount['client_email']) ||
        empty($serviceAccount['private_key']) ||
        empty($serviceAccount['project_id'])) {
        throw new RuntimeException('The Firebase service account cannot create authentication tokens.');
    }
    $databaseHost = strtolower((string) parse_url(
        (string) ($config['realtime_database_url'] ?? ''),
        PHP_URL_HOST
    ));
    if (!preg_match('/^([a-z0-9-]+)-default-rtdb\.firebaseio\.com$/', $databaseHost, $matches) ||
        !hash_equals($matches[1], (string) $serviceAccount['project_id'])) {
        throw new RuntimeException('The Firebase service account does not match the player database project.');
    }
    $base64Url = static fn(string $value): string => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    $issuedAt = time();
    $header = $base64Url((string) json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $claims = $base64Url((string) json_encode([
        'iss' => $serviceAccount['client_email'],
        'sub' => $serviceAccount['client_email'],
        'aud' => 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
        'iat' => $issuedAt,
        'exp' => $issuedAt + 3600,
        'uid' => 'a2_phone_' . $phone,
        'claims' => ['phone' => $phone],
    ], JSON_UNESCAPED_SLASHES));
    $unsigned = $header . '.' . $claims;
    $signature = '';
    if (!openssl_sign($unsigned, $signature, $serviceAccount['private_key'], OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('Could not create the Firebase authentication token.');
    }
    return $unsigned . '.' . $base64Url($signature);
}

function matka60ApiAuthResponse(string $phone, string $name): array
{
    $firebaseCustomToken = matka60ApiFirebaseCustomToken($phone);
    $database = matka60ApiDatabase();
    return [
        'phone' => $phone,
        'name' => $name,
        'token' => matka60ApiIssueSession($database, $phone),
        'firebaseCustomToken' => $firebaseCustomToken,
        'expiresIn' => 43200,
    ];
}

function matka60ApiLogin(array $payload): array
{
    $phone = (string) ($payload['phone'] ?? '');
    $password = $payload['password'] ?? null;
    if (!preg_match('/^\d{10}$/', $phone) || !is_string($password) ||
        strlen($password) < 8 || strlen($password) > 256) {
        throw new InvalidArgumentException('Enter a valid phone number and password.');
    }

    $database = matka60ApiDatabase();
    matka60ApiRecordLoginAttempt($database, $phone);

    $profile = realtimeGet('DATA/' . $phone)['value'];
    $storedPassword = is_array($profile) ? matka60ApiProfileValue($profile['password'] ?? null) : null;
    if (!is_array($profile) || !is_string($storedPassword) || !hash_equals($storedPassword, $password)) {
        throw new InvalidArgumentException('Phone number or password is incorrect.');
    }
    $blocked = matka60ApiIsBlocked($profile['blocked'] ?? null)
        || matka60ApiIsBlocked(realtimeGet('Blocked/' . $phone)['value']);
    if ($blocked) throw new InvalidArgumentException('This account is blocked from placing games.');

    return matka60ApiAuthResponse($phone, (string) ($profile['name'] ?? 'Player'));
}

function matka60ApiSignup(array $payload): array
{
    $phone = (string) ($payload['phone'] ?? '');
    $password = $payload['password'] ?? null;
    $name = trim((string) ($payload['name'] ?? ''));
    if (!preg_match('/^\d{10}$/', $phone) || !is_string($password) ||
        strlen($password) < 8 || strlen($password) > 256 ||
        strlen($name) < 2 || strlen($name) > 60) {
        throw new InvalidArgumentException('Enter a valid name, phone number, and password.');
    }

    $database = matka60ApiDatabase();
    matka60ApiRecordLoginAttempt($database, $phone);
    $settings = realtimeGet('Admin/Admin')['value'];
    if (!is_array($settings) ||
        preg_match('/^(true|1|yes|on)$/i', (string) matka60ApiProfileValue($settings['Maintanance'] ?? '')) ||
        (isset($settings['EnableNewRegistrations']) &&
            !preg_match('/^(true|1|yes|on)$/i',
                (string) matka60ApiProfileValue($settings['EnableNewRegistrations'])))) {
        throw new InvalidArgumentException('New player registrations are currently unavailable.');
    }
    $bonusValue = matka60ApiProfileValue(
        $settings['Sign Up Bonus'] ?? $settings['bonus'] ?? $settings['Bonus'] ?? 0
    );
    if (!is_numeric($bonusValue) || !is_finite((float) $bonusValue) || (float) $bonusValue < 0 ||
        (float) $bonusValue > 1000000000) {
        throw new RuntimeException('The configured signup bonus is invalid.');
    }

    $profilePath = 'DATA/' . $phone;
    $profileResult = realtimeGet($profilePath, true);
    if ($profileResult['value'] !== null) {
        throw new InvalidArgumentException('An account with this phone number already exists.');
    }
    $now = new DateTimeImmutable('now', new DateTimeZone('Asia/Kolkata'));
    $profile = [
        'name' => $name,
        'password' => $password,
        'COINS' => (string) ((float) $bonusValue),
        'B2' => '0',
        'TD' => '0',
        'TW' => '0',
        'Last Seen' => gmdate('c'),
        'push' => '',
        'blocked' => 'no',
    ];
    $status = realtimeConditionalPut($profilePath, $profile, $profileResult['etag']);
    if ($status === 412) {
        throw new InvalidArgumentException('An account with this phone number already exists.');
    }
    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('Could not create the player account.');
    }
    $joinedDate = $now->format('d-m-Y');
    $joinedTime = $now->format('h:i:s') . ($now->format('A') === 'AM' ? ' am' : ' pm');
    $warnings = [];
    try {
        matka60ApiPut('New Users/' . $joinedDate . '/' . $phone, [$name, $phone, $joinedTime]);
    } catch (Throwable $error) {
        error_log('[A2 Matka 60] New-user index write failed: ' . safeErrorMessage($error->getMessage()));
        $warnings[] = 'Your account was created, but the admin new-user list may update later.';
    }
    return matka60ApiAuthResponse($phone, $name) + ['warnings' => $warnings];
}

function matka60ApiSession(): array
{
    $authorization = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $authorization, $matches)) {
        throw new InvalidArgumentException('Please sign in again before placing a Matka 60 bet.');
    }
    $query = matka60ApiDatabase()->prepare(
        'SELECT phone FROM matka60_sessions WHERE token_hash = :token_hash AND expires_at > UTC_TIMESTAMP()'
    );
    $query->execute(['token_hash' => hash('sha256', strtolower($matches[1]))]);
    $phone = $query->fetchColumn();
    if (!is_string($phone) || !preg_match('/^\d{10}$/', $phone)) {
        throw new InvalidArgumentException('Your secure session expired. Please sign in again.');
    }
    return ['phone' => $phone];
}

function matka60ApiLogout(): array
{
    $authorization = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $authorization, $matches)) {
        return ['ok' => true];
    }
    $delete = matka60ApiDatabase()->prepare('DELETE FROM matka60_sessions WHERE token_hash = :token_hash');
    $delete->execute(['token_hash' => hash('sha256', strtolower($matches[1]))]);
    return ['ok' => true];
}

function matka60ApiSigningKey(): string
{
    $key = config()['matka60_bet_signing_key'] ?? '';
    if (!is_string($key) || !preg_match('/^[a-f0-9]{64}$/i', $key)) {
        throw new RuntimeException('The private Matka 60 bet-signing key is not configured.');
    }
    return $key;
}

function matka60ApiSignature(string $phone, string $period, array $entry): string
{
    $fields = [
        $phone,
        $period,
        (string) ($entry['date'] ?? ''),
        (string) ($entry['bidKey'] ?? ''),
        (string) ($entry['historyKey'] ?? ''),
        (string) ($entry['requestId'] ?? ''),
    ];
    return hash_hmac('sha256', implode("\n", $fields), matka60ApiSigningKey());
}

function matka60ApiPut(string $path, array $value): void
{
    $ch = curl_init(firebaseUrl($path));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => json_encode($value, JSON_UNESCAPED_SLASHES),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . accessToken(),
            'Content-Type: application/json',
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
    if ($response === false) {
        throw new RuntimeException('Could not save the authorized Matka 60 bet: ' . substr($error, 0, 120));
    }
    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('Could not save the authorized Matka 60 bet (HTTP ' . $status . ').');
    }
}

function matka60ApiPannaNumbers(): array
{
    static $numbers = null;
    if ($numbers === null) {
        $numbers = array_fill_keys(explode(',',
            '000,100,110,111,112,113,114,115,116,117,118,119,120,122,123,124,125,126,127,128,129,130,' .
            '133,134,135,136,137,138,139,140,144,145,146,147,148,149,150,155,156,157,158,159,160,' .
            '166,167,168,169,170,177,178,179,180,188,189,190,199,200,220,222,223,224,225,226,227,228,229,230,' .
            '233,234,235,236,237,238,239,240,244,245,246,247,248,249,250,255,256,257,258,259,260,' .
            '266,267,268,269,270,277,278,279,280,288,289,290,299,300,330,333,335,336,337,338,339,340,' .
            '344,345,346,347,348,349,350,355,356,357,358,359,360,366,367,368,369,370,377,378,379,380,' .
            '388,389,390,399,400,440,444,445,446,447,448,449,450,455,456,457,458,459,460,' .
            '466,467,468,469,470,477,478,479,480,488,489,490,499,500,550,555,556,557,558,559,560,' .
            '566,567,568,569,570,577,578,579,580,588,589,590,599,600,660,666,667,668,669,670,' .
            '677,678,679,680,688,689,690,699,700,770,777,778,779,780,788,789,790,799,800,880,888,889,890,899,' .
            '900,990,999'
        ), true);
    }
    return $numbers;
}

function matka60ApiNormalizeBets(array $request, array $settings, bool $enforceLimits = true): array
{
    $gameType = (string) ($request['gameType'] ?? '');
    $selections = $request['selections'] ?? null;
    $amount = $request['amount'] ?? null;
    $digit = (string) ($request['digit'] ?? '');
    if (!in_array($gameType, ['Matka 60 Ank', 'Matka 60 Panna'], true) ||
        !is_array($selections) || !$selections || count($selections) > 30 ||
        !is_numeric($amount) || (string) (int) $amount !== (string) $amount || (int) $amount <= 0) {
        throw new InvalidArgumentException('Choose valid Matka 60 numbers and a whole-number stake.');
    }
    $amount = (int) $amount;
    if ($enforceLimits) {
        $minimum = (int) (matka60ApiProfileValue($settings['Min Entry'] ?? 0) ?: 0);
        $maximum = (int) (matka60ApiProfileValue($settings['Max Entry'] ?? 0) ?: 0);
        if (($minimum > 0 && $amount < $minimum) || ($maximum > 0 && $amount > $maximum)) {
            throw new InvalidArgumentException('The stake is outside the current per-number limits.');
        }
    }
    if ($gameType === 'Matka 60 Ank') {
        if (count($selections) !== 1 || !preg_match('/^\d$/', (string) $selections[0]) ||
            $digit !== (string) $selections[0]) {
            throw new InvalidArgumentException('Choose one valid Ank digit.');
        }
    } elseif (!preg_match('/^\d$/', $digit)) {
        throw new InvalidArgumentException('Choose a valid Panna digit.');
    }

    $normalized = [];
    foreach ($selections as $selection) {
        $selection = (string) $selection;
        if ($gameType === 'Matka 60 Panna') {
            if (!isset(matka60ApiPannaNumbers()[$selection]) ||
                (string) (array_sum(array_map('intval', str_split($selection))) % 10) !== $digit) {
                throw new InvalidArgumentException('One or more Panna selections are invalid.');
            }
        }
        if (isset($normalized[$selection])) {
            throw new InvalidArgumentException('Duplicate Matka 60 selections are not allowed.');
        }
        $normalized[$selection] = true;
    }
    return ['gameType' => $gameType, 'selections' => array_keys($normalized), 'amount' => $amount];
}

function matka60ApiPlaceBet(array $request): array
{
    $settingsConfig = config();
    if (($settingsConfig['matka60_settlement_enabled'] ?? false) !== true ||
        ($settingsConfig['matka60_server_authorized_bets_ready'] ?? false) !== true ||
        ($settingsConfig['matka60_client_wallet_writes_blocked'] ?? false) !== true) {
        throw new RuntimeException('Matka 60 server betting is disabled until the security setup is complete.');
    }
    $session = matka60ApiSession();
    $phone = $session['phone'];
    $requestId = strtolower((string) ($request['requestId'] ?? ''));
    $periodId = (string) ($request['periodId'] ?? '');
    if (!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/', $requestId) ||
        !preg_match('/^\d{12}$/', $periodId)) {
        throw new InvalidArgumentException('The Matka 60 request or period is invalid.');
    }
    $now = new DateTimeImmutable('now', new DateTimeZone('Asia/Kolkata'));
    $normalized = matka60ApiNormalizeBets($request, [], false);
    $fingerprint = hash('sha256', json_encode([
        'periodId' => $periodId,
        'bet' => $normalized,
    ], JSON_UNESCAPED_SLASHES));
    $profilePath = 'DATA/' . $phone;
    $savedProfile = realtimeGet($profilePath)['value'];
    if (!is_array($savedProfile)) throw new InvalidArgumentException('The player account was not found.');
    $savedRequests = matka60ApiProfileValue($savedProfile['matka60Requests'] ?? null);
    $savedRequests = is_array($savedRequests) ? $savedRequests : [];
    if (isset($savedRequests[$requestId])) {
        $savedRequest = $savedRequests[$requestId];
        if (!is_array($savedRequest) ||
            (string) ($savedRequest['period'] ?? '') !== $periodId ||
            !hash_equals((string) ($savedRequest['fingerprint'] ?? ''), $fingerprint)) {
            throw new InvalidArgumentException('This request ID was already used for a different bet.');
        }
        $historyKeys = $savedRequest['historyKeys'] ?? null;
        if (!is_array($historyKeys) || !$historyKeys) {
            throw new RuntimeException('The saved Matka 60 request is incomplete.');
        }
        $savedAllBets = matka60ApiProfileValue($savedProfile['matka60Bets'] ?? null);
        $savedBets = is_array($savedAllBets[$periodId] ?? null) ? $savedAllBets[$periodId] : [];
        $existing = [];
        foreach ($historyKeys as $historyKey) {
            if (isset($savedBets[$historyKey]) && is_array($savedBets[$historyKey])) {
                $existing[] = $savedBets[$historyKey];
            }
        }
        if (count($existing) !== count($historyKeys)) {
            throw new RuntimeException('The saved Matka 60 bet records are incomplete.');
        }
        matka60ApiWriteQueue($phone, $periodId, $existing);
        $savedTransactions = matka60ApiProfileValue($savedProfile['transactions'] ?? null);
        $savedTransactions = is_array($savedTransactions) ? $savedTransactions : [];
        $transactionId = 'M60-BET-' . strtoupper(str_replace('-', '', $requestId));
        return [
            'ok' => true,
            'balance' => numericValue($savedProfile['COINS'] ?? null),
            'bets' => matka60ApiDisplayBets($existing),
            'transaction' => $savedTransactions[$transactionId] ?? null,
            'replayed' => true,
        ];
    }
    if ($periodId !== $now->format('YmdHi')) {
        throw new InvalidArgumentException('This round has ended. Wait for the next round to place a bet.');
    }
    $settings = realtimeGet('Admin/Admin')['value'];
    if (!is_array($settings) ||
        preg_match('/^(true|1|yes|on)$/i', (string) matka60ApiProfileValue($settings['Maintanance'] ?? '')) ||
        (isset($settings['EnableOpenBets']) &&
            !preg_match('/^(true|1|yes|on)$/i', (string) matka60ApiProfileValue($settings['EnableOpenBets'])))) {
        throw new InvalidArgumentException('Matka 60 betting is currently unavailable.');
    }
    $normalized = matka60ApiNormalizeBets($request, $settings);
    $date = $now->format('d-m-Y');
    $clock = $now->format('h:i:s');
    $time12 = $clock . ($now->format('A') === 'AM' ? ' AM' : ' PM');
    $createdAt = $now->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
    $total = $normalized['amount'] * count($normalized['selections']);
    $transactionId = 'M60-BET-' . strtoupper(str_replace('-', '', $requestId));
    if (!is_finite((float) $total) || $total > 1000000000) {
        throw new InvalidArgumentException('The total stake is too large.');
    }

    for ($attempt = 0; $attempt < 5; $attempt++) {
        $profileResult = realtimeGet($profilePath, true);
        $profile = $profileResult['value'];
        if (!is_array($profile)) throw new InvalidArgumentException('The player account was not found.');
        if (matka60ApiIsBlocked($profile['blocked'] ?? null) ||
            matka60ApiIsBlocked(realtimeGet('Blocked/' . $phone)['value'])) {
            throw new InvalidArgumentException('This account is blocked from placing games.');
        }
        $requests = matka60ApiProfileValue($profile['matka60Requests'] ?? null);
        $requests = is_array($requests) ? $requests : [];
        if (isset($requests[$requestId])) {
            $savedRequest = $requests[$requestId];
            if (!is_array($savedRequest) ||
                (string) ($savedRequest['period'] ?? '') !== $periodId ||
                !hash_equals((string) ($savedRequest['fingerprint'] ?? ''), $fingerprint)) {
                throw new InvalidArgumentException('This request ID was already used for a different bet.');
            }
            $historyKeys = $savedRequest['historyKeys'] ?? null;
            if (!is_array($historyKeys) || !$historyKeys) {
                throw new RuntimeException('The saved Matka 60 request is incomplete.');
            }
            $existing = [];
            $bets = matka60ApiProfileValue($profile['matka60Bets'] ?? null);
            $betsByPeriod = is_array($bets[$periodId] ?? null) ? $bets[$periodId] : [];
            foreach ($historyKeys as $historyKey) {
                if (isset($betsByPeriod[$historyKey]) && is_array($betsByPeriod[$historyKey])) {
                    $existing[] = $betsByPeriod[$historyKey];
                }
            }
            if (count($existing) !== count($historyKeys)) {
                throw new RuntimeException('The saved Matka 60 bet records are incomplete.');
            }
            matka60ApiWriteQueue($phone, $periodId, $existing);
            $transactions = matka60ApiProfileValue($profile['transactions'] ?? null);
            $transactions = is_array($transactions) ? $transactions : [];
            return [
                'ok' => true,
                'balance' => numericValue($profile['COINS'] ?? null),
                'bets' => matka60ApiDisplayBets($existing),
                'transaction' => $transactions[$transactionId] ?? null,
                'replayed' => true,
            ];
        }
        $balance = numericValue($profile['COINS'] ?? null);
        if (!is_finite($balance) || $balance < $total) {
            throw new InvalidArgumentException('There are not enough points in your balance.');
        }

        $records = [];
        foreach ($normalized['selections'] as $index => $selection) {
            $historyKey = $requestId . '-' . str_pad((string) $index, 2, '0', STR_PAD_LEFT);
            $reference = random_int(100, 999);
            $bidKey = str_replace(['.', '#', '$', '[', ']', '/'], '_',
                $date . '&' . $clock . '&' . $selection . '&' . $reference . '&Matka 60');
            $payload = [
                $normalized['gameType'],
                'Open',
                $selection,
                (string) $normalized['amount'],
                $time12,
                $periodId,
            ];
            $records[] = [
                'date' => $date,
                'bidKey' => $bidKey,
                'historyKey' => $historyKey,
                'requestId' => $requestId,
                'serverAuthorized' => true,
                'payload' => $payload,
                'gameType' => $normalized['gameType'],
                'selection' => $selection,
                'amount' => $normalized['amount'],
                'period' => $periodId,
                'createdAt' => $createdAt,
            ];
        }
        matka60ApiWriteQueue($phone, $periodId, $records);

        $profile['COINS'] = round($balance - $total, 2);
        $allBets = matka60ApiProfileValue($profile['matka60Bets'] ?? null);
        $allBets = is_array($allBets) ? $allBets : [];
        $periodBets = is_array($allBets[$periodId] ?? null) ? $allBets[$periodId] : [];
        foreach ($records as $record) $periodBets[$record['historyKey']] = $record;
        $allBets[$periodId] = $periodBets;
        $profile['matka60Bets'] = $allBets;
        $requests[$requestId] = [
            'fingerprint' => $fingerprint,
            'period' => $periodId,
            'historyKeys' => array_column($records, 'historyKey'),
            'createdAt' => $createdAt,
        ];
        $profile['matka60Requests'] = $requests;
        $transactions = matka60ApiProfileValue($profile['transactions'] ?? null);
        $transactions = is_array($transactions) ? $transactions : [];
        $transactions[$transactionId] = [
            'id' => $transactionId,
            'type' => 'Bet',
            'amount' => -$total,
            'title' => 'Matka 60 bet',
            'market' => 'Matka 60',
            'period' => $periodId,
            'date' => $createdAt,
            'createdAt' => $createdAt,
            'status' => 'Submitted',
        ];
        $profile['transactions'] = $transactions;

        $status = realtimeConditionalPut($profilePath, $profile, $profileResult['etag']);
        if ($status === 412) continue;
        if ($status < 200 || $status >= 300) {
            throw new RuntimeException('Could not safely save the Matka 60 bet.');
        }
        return [
            'ok' => true,
            'balance' => $profile['COINS'],
            'bets' => matka60ApiDisplayBets($records),
            'transaction' => $transactions[$transactionId],
            'replayed' => false,
        ];
    }
    throw new RuntimeException('Your wallet changed repeatedly. Please retry the bet.');
}

function matka60ApiWriteQueue(string $phone, string $periodId, array $records): void
{
    foreach ($records as $record) {
        if (!is_array($record) || empty($record['historyKey'])) continue;
        $entry = [
            'date' => (string) $record['date'],
            'bidKey' => (string) $record['bidKey'],
            'historyKey' => (string) $record['historyKey'],
            'requestId' => (string) $record['requestId'],
            'serverAuthorized' => true,
        ];
        $entry['signature'] = matka60ApiSignature($phone, $periodId, $entry);
        matka60ApiPut(
            'Matka60/Bets/' . $periodId . '/' . $phone . '/' . $entry['historyKey'],
            $entry
        );
    }
}

function matka60ApiDisplayBets(array $records): array
{
    return array_map(static function (array $record): array {
        $date = (string) ($record['date'] ?? '');
        $historyKey = (string) ($record['historyKey'] ?? '');
        $payload = $record['payload'] ?? [];
        $selection = (string) ($record['selection'] ?? '');
        $amount = (float) ($record['amount'] ?? 0);
        return [
            'id' => $date . '/' . $historyKey,
            'date' => $date,
            'tag' => $date . ' ' . (string) ($payload[4] ?? '') . ':' . $amount . ':"' . $selection . '"',
            'payload' => $payload,
            'title' => 'Matka 60',
            'market' => 'Matka 60',
            'category' => 'Gali / Disawar',
            'gameType' => (string) ($record['gameType'] ?? ''),
            'session' => 'Open',
            'selection' => $selection,
            'amount' => $amount,
            'status' => 'Submitted',
            'createdAt' => (string) ($record['createdAt'] ?? ''),
            'bidKey' => (string) ($record['bidKey'] ?? ''),
        ];
    }, array_values(array_filter($records, 'is_array')));
}

function mainMatka60Api(): void
{
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    try {
        $allowedOrigins = matka60ApiOrigins();
    } catch (Throwable $error) {
        error_log('[A2 Matka 60] API config failed: ' . safeErrorMessage($error->getMessage()));
        matka60ApiRespond(['ok' => false, 'message' => 'Matka 60 server configuration is incomplete.'], 503);
    }
    if ($origin === '' || !in_array($origin, $allowedOrigins, true)) {
        matka60ApiRespond(['ok' => false, 'message' => 'This website is not allowed to use the Matka 60 service.'], 403);
    }
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Max-Age: 600');
    if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
        matka60ApiRespond(['ok' => false, 'message' => 'Method not allowed.'], 405);
    }
    $rawBody = file_get_contents('php://input');
    if (!is_string($rawBody) || strlen($rawBody) > 16384) {
        matka60ApiRespond(['ok' => false, 'message' => 'The Matka 60 request is too large.'], 413);
    }
    $payload = json_decode($rawBody, true);
    if (!is_array($payload)) matka60ApiRespond(['ok' => false, 'message' => 'Invalid JSON request.'], 400);
    try {
        $action = (string) ($payload['action'] ?? '');
        if ($action === 'auth') {
            $mode = (string) ($payload['mode'] ?? 'login');
            $response = $mode === 'signup'
                ? matka60ApiSignup($payload)
                : ($mode === 'login' ? matka60ApiLogin($payload) : null);
            if ($response === null) throw new InvalidArgumentException('Unsupported account access mode.');
            matka60ApiRespond(['ok' => true] + $response);
        }
        if ($action === 'logout') {
            matka60ApiRespond(matka60ApiLogout());
        }
        if ($action === 'placeBet') {
            matka60ApiRespond(matka60ApiPlaceBet($payload));
        }
        throw new InvalidArgumentException('Unsupported Matka 60 action.');
    } catch (InvalidArgumentException $error) {
        matka60ApiRespond(['ok' => false, 'message' => safeErrorMessage($error->getMessage())], 400);
    } catch (Throwable $error) {
        error_log('[A2 Matka 60] API request failed: ' . safeErrorMessage($error->getMessage()));
        matka60ApiRespond(['ok' => false, 'message' => 'The Matka 60 request could not be completed.'], 503);
    }
}

$executedFile = realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? ''));
if ($executedFile !== false && $executedFile === realpath(__FILE__)) {
    mainMatka60Api();
}
