<?php

declare(strict_types=1);

namespace Sptc\MasterData\Services;

use RuntimeException;
use Sptc\MasterData\Core\Config;
use Sptc\MasterData\Middleware\HostGuard;

final class Session
{
    public function __construct(Config $config, ?string $cookiePath = null)
    {
        $directory = $config->runtime() . '/sessions';
        if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('Unable to create session directory');
        }

        $resolvedPath = $cookiePath !== null && $cookiePath !== ''
            ? $cookiePath
            : str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/api.php')));

        $policy = self::cookiePolicy($config);

        session_name('SPTCMASTER');
        session_save_path($directory);
        if (!session_start([
            'use_strict_mode' => true,
            'use_only_cookies' => true,
            'cookie_httponly' => true,
            'cookie_secure' => $policy['secure'],
            'cookie_samesite' => $policy['samesite'],
            'cookie_path' => $resolvedPath,
            'gc_maxlifetime' => 1800,
        ])) {
            throw new RuntimeException('Unable to start session');
        }

        $now = time();
        $seen = $_SESSION['seen'] ?? $now;
        if (!is_int($seen) || $now - $seen >= 1800) {
            $this->replace();
        }
        $_SESSION['seen'] = $now;
    }

    public function csrf(): string
    {
        $token = $_SESSION['csrf'] ?? null;
        if (!is_string($token)) {
            $token = bin2hex(random_bytes(32));
            $_SESSION['csrf'] = $token;
        }

        return $token;
    }

    /** @return array{username: string}|null */
    public function user(): ?array
    {
        $user = $_SESSION['user'] ?? null;
        if (!is_array($user) || !is_string($user['username'] ?? null)) {
            return null;
        }

        return ['username' => $user['username']];
    }

    /** @param array{username: string}|null $user */
    public function replace(?array $user = null): void
    {
        $_SESSION = ['seen' => time()];
        if (!session_regenerate_id(true)) {
            throw new RuntimeException('Unable to regenerate session');
        }
        if ($user !== null) {
            $_SESSION['user'] = $user;
        }
    }

    /** @return array{secure: bool, samesite: 'Lax'|'None'} */
    public static function cookiePolicy(Config $config, ?string $requestHost = null): array
    {
        $secure = $config->boolean('APP_HTTPS', $config->demo() ? 'false' : 'true');
        $host = $requestHost !== null ? HostGuard::normalizeHost($requestHost) : HostGuard::requestHost();
        if ($host !== null && str_ends_with($host, '.localhost')) {
            // Browsers treat distinct *.localhost subdomains (e.g. admin.localhost vs
            // api.localhost) as cross-site, while permitting Secure cookies on *.localhost.
            return ['secure' => true, 'samesite' => 'None'];
        }

        return ['secure' => $secure, 'samesite' => 'Lax'];
    }
}
