<?php

declare(strict_types=1);

namespace Sptc\MasterData\Middleware;

use Sptc\MasterData\Core\Api;
use Sptc\MasterData\Core\Config;

final class HostGuard
{
    /**
     * @param 'admin'|'customer'|'api' $scope
     * @return list<string>
     */
    public static function allowedHosts(Config $config, string $scope): array
    {
        $key = match ($scope) {
            'admin' => 'ADMIN_HOSTS',
            'customer' => 'CUSTOMER_HOSTS',
            'api' => 'API_HOSTS',
        };
        return self::parseHosts($config->value($key));
    }

    /** @return list<string> */
    public static function parseHosts(string $raw): array
    {
        if (trim($raw) === '') {
            return [];
        }
        $hosts = [];
        foreach (explode(',', $raw) as $entry) {
            $host = self::normalizeHost($entry);
            if ($host !== null) {
                $hosts[] = $host;
            }
        }

        return array_values(array_unique($hosts));
    }

    public static function normalizeHost(string $raw): ?string
    {
        $value = trim($raw);
        if ($value === '' || !mb_check_encoding($value, 'UTF-8') || preg_match('/[\x00-\x20\x7F\/\\\\?#]/', $value)) {
            return null;
        }
        if (str_contains($value, ':')) {
            $parts = explode(':', $value, 2);
            if (!ctype_digit($parts[1])) {
                return null;
            }
            $value = $parts[0];
        }
        $host = rtrim(strtolower($value), '.');
        if ($host === '') {
            return null;
        }
        if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
            return $host;
        }
        if (preg_match('/\A(?=.{1,253}\z)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\z/', $host) === 1) {
            return $host;
        }

        return null;
    }

    public static function requestHost(): ?string
    {
        $raw = $_SERVER['HTTP_HOST'] ?? '';
        return is_string($raw) ? self::normalizeHost($raw) : null;
    }

    /** @param 'admin'|'customer'|'api' $scope */
    public static function verify(Config $config, string $scope): void
    {
        $allowed = self::allowedHosts($config, $scope);
        if ($allowed === []) {
            return;
        }
        $host = self::requestHost();
        if ($host === null || !in_array($host, $allowed, true)) {
            Api::fail(404, 'not_found');
        }
    }
}
