<?php

declare(strict_types=1);

use Monolog\Handler\StreamHandler;
use Monolog\Logger;
use Sptc\MasterData\Core\Api;
use Sptc\MasterData\Core\Config;
use Symfony\Component\Lock\Exception\InvalidArgumentException as LockInvalidArgumentException;

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$root = dirname(__DIR__, 2);
$autoload = $root . '/backend/vendor/autoload.php';
if (!is_file($autoload)) {
    http_response_code(503);
    echo '{"error":"service_unavailable"}';
    exit;
}
require $autoload;

$logger = null;
try {
    $config = new Config($root);
    $logger = new Logger('master-data-api', [new StreamHandler($config->runtime() . '/app.log', filePermission: 0600, useLocking: true)]);
    (new Api($config))->dispatch();
} catch (Throwable $error) {
    $context = ['type' => $error::class, 'code' => $error->getCode()];
    if ($error instanceof LockInvalidArgumentException) {
        $context['lock_error'] = $error->getMessage();
    }
    try {
        $logger?->error('API request failed', $context);
    } catch (Throwable) {
        error_log('Master Data API logging failed');
    }
    Api::fail(503, 'service_unavailable');
}
