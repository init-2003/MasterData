<?php

declare(strict_types=1);

namespace Sptc\MasterData\Middleware;

use Sptc\MasterData\Core\Api;
use Sptc\MasterData\Core\Config;

final class Cors
{
    /**
     * @param 'admin'|'customer' $scope
     * @return list<string>
     */
    public static function configuredOrigins(Config $config, string $scope): array
    {
        $key = $scope === 'admin' ? 'ADMIN_ORIGINS' : 'CUSTOMER_ORIGINS';
        return self::parseOrigins($config->value($key));
    }

    /** @return list<string> */
    public static function parseOrigins(string $raw): array
    {
        if (trim($raw) === '') {
            return [];
        }
        $origins = [];
        foreach (explode(',', $raw) as $entry) {
            $normalized = self::normalizeOrigin($entry);
            if ($normalized !== null) {
                $origins[] = $normalized;
            }
        }

        return array_values(array_unique($origins));
    }

    public static function normalizeOrigin(string $raw): ?string
    {
        $value = trim($raw);
        if ($value === '' || !mb_check_encoding($value, 'UTF-8') || preg_match('/[\x00-\x20\x7F]/', $value)) {
            return null;
        }
        $parts = parse_url($value);
        if (!is_array($parts)) {
            return null;
        }
        $scheme = isset($parts['scheme']) ? strtolower($parts['scheme']) : '';
        if (!in_array($scheme, ['https', 'http'], true)) {
            return null;
        }
        if (isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) {
            return null;
        }
        $path = $parts['path'] ?? '';
        if ($path !== '' && $path !== '/') {
            return null;
        }
        $host = isset($parts['host']) ? HostGuard::normalizeHost($parts['host']) : null;
        if ($host === null) {
            return null;
        }
        $port = $parts['port'] ?? null;
        if ($port !== null && (($scheme === 'https' && $port === 443) || ($scheme === 'http' && $port === 80))) {
            $port = null;
        }

        return $scheme . '://' . $host . ($port !== null ? ':' . $port : '');
    }

    /** @param 'admin'|'customer' $scope */
    public static function isAllowed(Config $config, string $scope, string $origin): bool
    {
        $normalized = self::normalizeOrigin($origin);
        if ($normalized === null) {
            return false;
        }
        $configured = self::configuredOrigins($config, $scope);
        if ($configured !== []) {
            return in_array($normalized, $configured, true);
        }

        $requireHttps = $config->boolean('APP_HTTPS', $config->demo() ? 'false' : 'true');
        if ($requireHttps) {
            return false;
        }

        $parts = parse_url($normalized);
        $host = is_array($parts) && isset($parts['host']) ? strtolower($parts['host']) : '';
        $localHosts = $scope === 'admin'
            ? ['admin.localhost']
            : ['shop.localhost', 'www.shop.localhost', 'localhost', '127.0.0.1'];

        return str_starts_with($normalized, 'http://') && in_array($host, $localHosts, true);
    }

    /** @param 'admin'|'customer' $scope */
    public static function handle(Config $config, string $scope, string $method): void
    {
        header('Vary: Origin');
        $rawOrigin = $_SERVER['HTTP_ORIGIN'] ?? null;
        $hasOrigin = is_string($rawOrigin) && trim($rawOrigin) !== '';
        $origin = $hasOrigin ? self::normalizeOrigin($rawOrigin) : null;
        $allowed = $origin !== null && self::isAllowed($config, $scope, $origin);

        if ($allowed) {
            header('Access-Control-Allow-Origin: ' . $origin);
            if ($scope === 'admin') {
                header('Access-Control-Allow-Credentials: true');
                header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
                header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
            } else {
                header('Access-Control-Allow-Headers: Accept');
                header('Access-Control-Allow-Methods: GET, OPTIONS');
            }
            header('Access-Control-Max-Age: 600');
        }

        if ($method === 'OPTIONS') {
            if ($allowed) {
                http_response_code(204);
                exit;
            }
            Api::fail(403, 'origin_not_allowed');
        }

        if ($hasOrigin && !$allowed) {
            Api::fail(403, 'origin_not_allowed');
        }

        if ($scope === 'admin' && $method === 'POST' && !$hasOrigin && self::configuredOrigins($config, 'admin') !== []) {
            Api::fail(403, 'origin_not_allowed');
        }
    }
}
