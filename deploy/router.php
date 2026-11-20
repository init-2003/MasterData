<?php

declare(strict_types=1);

$path = explode('?', (string) ($_SERVER['REQUEST_URI'] ?? '/'), 2)[0];
if (in_array($path, ['/', '/index.html', '/api.php'], true)) {
    return false;
}
if (preg_match('~\A/assets/[A-Za-z0-9._-]+\z~', $path) && is_file(dirname(__DIR__) . '/public' . $path)) {
    return false;
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo 'Not Found';
