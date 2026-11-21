<?php

declare(strict_types=1);

namespace Sptc\MasterData\Middleware;

use Sptc\MasterData\Core\Api;
use Sptc\MasterData\Services\Session;

final class Csrf
{
    public static function verify(Session $session): void
    {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($token) || !hash_equals($session->csrf(), $token)) {
            Api::fail(403, 'csrf_invalid');
        }
    }
}
