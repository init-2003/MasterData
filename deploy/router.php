<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
$path = explode('?', $uri, 2)[0];

$readSetting = static function (string $key) use ($root): string {
    $value = $_SERVER[$key] ?? getenv($key);
    if (is_string($value) && trim($value) !== '') {
        return trim($value);
    }
    $envFile = $root . '/.env';
    if (is_file($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $trimmedLine = trim($line);
            if ($trimmedLine === '' || str_starts_with($trimmedLine, '#')) continue;
            if (preg_match('/\A' . preg_quote($key, '/') . '\s*=\s*(.*)\z/', $trimmedLine, $match) === 1) {
                return trim($match[1], " \t\"'");
            }
        }
    }
    return '';
};

$rawHostHeader = (string) ($_SERVER['HTTP_HOST'] ?? '');
$hostParts = explode(':', trim($rawHostHeader), 2);
$requestHost = rtrim(strtolower($hostParts[0]), '.');
$portSuffix = isset($hostParts[1]) && ctype_digit($hostParts[1]) ? ':' . $hostParts[1] : '';

$parseHostList = static function (string $raw): array {
    $hosts = [];
    foreach (explode(',', $raw) as $entry) {
        $h = rtrim(strtolower(explode(':', trim($entry), 2)[0]), '.');
        if ($h !== '') $hosts[] = $h;
    }
    return array_values(array_unique($hosts));
};

$rawApiHosts = $readSetting('API_HOSTS');
$rawAdminHosts = $readSetting('ADMIN_HOSTS');
$rawCustomerHosts = $readSetting('CUSTOMER_HOSTS');

$apiHosts = $parseHostList($rawApiHosts !== '' ? $rawApiHosts : 'api.localhost');
$adminHosts = $parseHostList($rawAdminHosts !== '' ? $rawAdminHosts : 'admin.localhost');
$customerHosts = $parseHostList($rawCustomerHosts !== '' ? $rawCustomerHosts : 'shop.localhost,www.shop.localhost,localhost,127.0.0.1');

// 1. Backend API domain (api.example.com / api.localhost)
if (in_array($requestHost, $apiHosts, true)) {
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    $_SERVER['PHP_SELF'] = '/index.php';
    require $root . '/public/api/index.php';
    return true;
}

// 2. Canonical 301 redirect: www.<domain> -> <domain> on customer site
if (str_starts_with($requestHost, 'www.') && in_array($requestHost, $customerHosts, true)) {
    $targetHost = substr($requestHost, 4);
    if (in_array($targetHost, $customerHosts, true)) {
        header('Location: http://' . $targetHost . $portSuffix . $uri, true, 301);
        return true;
    }
}

// 3. Static frontend domains (customer vs admin)
$scope = null;
if (in_array($requestHost, $adminHosts, true)) {
    $scope = 'admin';
} elseif (in_array($requestHost, $customerHosts, true)) {
    $scope = 'customer';
} elseif ($rawApiHosts === '' && $rawAdminHosts === '' && $rawCustomerHosts === '') {
    $scope = 'customer';
}

if ($scope === null) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Not Found';
    return true;
}

$public = $root . '/public/' . $scope;
$rawBasePath = $readSetting('APP_BASE_PATH');
$basePath = '';
if ($rawBasePath !== '') {
    $trimmedBase = trim($rawBasePath, '/');
    if ($trimmedBase !== '' && preg_match('/\A[A-Za-z0-9._~%-]+(?:\/[A-Za-z0-9._~%-]+)*\z/', $trimmedBase) === 1) {
        $segments = explode('/', $trimmedBase);
        if (!in_array('.', $segments, true) && !in_array('..', $segments, true)) {
            $basePath = '/' . $trimmedBase;
        }
    }
}

if ($basePath !== '' && $path === $basePath) {
    header('Location: ' . $basePath . '/', true, 302);
    return true;
}

$subPath = null;
if ($basePath === '') {
    $subPath = $path;
} elseif (str_starts_with($path, $basePath . '/')) {
    $subPath = substr($path, strlen($basePath));
}

if ($subPath !== null) {
    if ($subPath === '/' || $subPath === '/index.html') {
        $index = $public . '/index.html';
        if (is_file($index)) {
            header('Content-Type: text/html; charset=utf-8');
            header('X-Content-Type-Options: nosniff');
            header('Referrer-Policy: same-origin');
            if ($scope === 'admin') {
                header('X-Frame-Options: DENY');
                header('X-Robots-Tag: noindex, nofollow');
            } else {
                header('X-Frame-Options: SAMEORIGIN');
            }
            readfile($index);
            return true;
        }
    }
    // theme-init.js sits beside index.html: the admin page loads it before the app to apply the saved theme.
    $isThemeScript = $scope === 'admin' && $subPath === '/theme-init.js';
    if (($isThemeScript || preg_match('~\A/assets/[A-Za-z0-9._-]+\z~', $subPath)) && is_file($public . $subPath)) {
        $file = $public . $subPath;
        $mime = match (strtolower(pathinfo($file, PATHINFO_EXTENSION))) {
            'js', 'mjs' => 'application/javascript; charset=utf-8',
            'css' => 'text/css; charset=utf-8',
            'woff2' => 'font/woff2',
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            'svg' => 'image/svg+xml',
            default => 'application/octet-stream',
        };
        header('Content-Type: ' . $mime);
        readfile($file);
        return true;
    }
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo 'Not Found';
return true;
