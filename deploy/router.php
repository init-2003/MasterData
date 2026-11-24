<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$public = $root . '/public';
$path = explode('?', (string) ($_SERVER['REQUEST_URI'] ?? '/'), 2)[0];

$rawBasePath = $_SERVER['APP_BASE_PATH'] ?? getenv('APP_BASE_PATH');
if (!is_string($rawBasePath) || trim($rawBasePath) === '') {
    $envFile = $root . '/.env';
    if (is_file($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $trimmedLine = trim($line);
            if ($trimmedLine === '' || str_starts_with($trimmedLine, '#')) continue;
            if (preg_match('/\AAPP_BASE_PATH\s*=\s*(.*)\z/', $trimmedLine, $match) === 1) {
                $rawBasePath = trim($match[1], " \t\"'");
                break;
            }
        }
    }
}

$basePath = '';
if (is_string($rawBasePath)) {
    $trimmedBase = trim(trim($rawBasePath), '/');
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
    if (preg_match('~\A/website-images/([a-z0-9-]+)/([^/]+)\z~', $subPath, $match) === 1) {
        $_GET['website-image'] = $match[1] . '/' . rawurldecode($match[2]);
        $_SERVER['SCRIPT_NAME'] = ($basePath === '' ? '' : $basePath) . '/api.php';
        $_SERVER['PHP_SELF'] = $_SERVER['SCRIPT_NAME'];
        require $public . '/api.php';
        return true;
    }
    if (preg_match('~\A/product-images/([^/]+)/([^/]+)\z~', $subPath, $match) === 1) {
        $_GET['path'] = rawurldecode($match[1]) . '/' . rawurldecode($match[2]);
        $_SERVER['SCRIPT_NAME'] = ($basePath === '' ? '' : $basePath) . '/api.php';
        $_SERVER['PHP_SELF'] = $_SERVER['SCRIPT_NAME'];
        require $public . '/api.php';
        return true;
    }

    if ($basePath === '') {
        if (in_array($subPath, ['/', '/index.html', '/api.php'], true)) {
            return false;
        }
        if (preg_match('~\A/assets/[A-Za-z0-9._-]+\z~', $subPath) && is_file($public . $subPath)) {
            return false;
        }
    } else {
        if ($subPath === '/' || $subPath === '/index.html') {
            $index = $public . '/index.html';
            if (is_file($index)) {
                header('Content-Type: text/html; charset=utf-8');
                readfile($index);
                return true;
            }
        }
        if ($subPath === '/api.php') {
            $_SERVER['SCRIPT_NAME'] = $basePath . '/api.php';
            $_SERVER['PHP_SELF'] = $basePath . '/api.php';
            require $public . '/api.php';
            return true;
        }
        if (preg_match('~\A/assets/[A-Za-z0-9._-]+\z~', $subPath) && is_file($public . $subPath)) {
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
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo 'Not Found';
return true;
