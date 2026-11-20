<?php

declare(strict_types=1);

namespace Sptc\MasterData\Auth;

use Sptc\MasterData\Infrastructure\Config;

use Symfony\Component\Cache\Adapter\FilesystemAdapter;
use Symfony\Component\Lock\LockFactory;
use Symfony\Component\Lock\Store\FlockStore;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\RateLimiter\Storage\CacheStorage;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validation;

final class Login
{
    public static function valid(string $username, #[\SensitiveParameter] string $password): bool
    {
        return $username !== '' && trim($password) !== '' && mb_check_encoding([$username, $password], 'UTF-8')
            && !str_contains($username . $password, "\0")
            && count(Validation::createValidator()->validate(
                ['username' => $username, 'password' => $password],
                new Assert\Collection([
                    'username' => new Assert\Length(max: 50, countUnit: Assert\Length::COUNT_CODEPOINTS),
                    'password' => new Assert\Length(max: 50, countUnit: Assert\Length::COUNT_CODEPOINTS),
                ]),
            )) === 0;
    }

    public static function retryAfter(Config $config, string $username, string $ip): int
    {
        $runtime = $config->runtime();
        $storage = new CacheStorage(new FilesystemAdapter('login', 0, $runtime . '/cache'));
        $locks = new LockFactory(new FlockStore($runtime));
        $ipLimiter = self::limiter('ip', 25, $storage, $locks);
        $accountIpLimiter = self::limiter('account_ip', 5, $storage, $locks);
        $accountLimiter = self::limiter('account', 15, $storage, $locks);
        $ipResult = $ipLimiter->create(hash('sha256', $ip))->consume();
        if (!$ipResult->isAccepted()) {
            return max(1, $ipResult->getRetryAfter()->getTimestamp() - time());
        }

        $key = mb_strtolower($username, 'UTF-8');
        $pair = $accountIpLimiter->create(hash('sha256', $key . "\0" . $ip))->consume();
        if (!$pair->isAccepted()) {
            return max(1, $pair->getRetryAfter()->getTimestamp() - time());
        }
        $account = $accountLimiter->create(hash('sha256', $key))->consume();

        return $account->isAccepted() ? 0 : max(1, $account->getRetryAfter()->getTimestamp() - time());
    }

    private static function limiter(string $id, int $limit, CacheStorage $storage, LockFactory $locks): RateLimiterFactory
    {
        return new RateLimiterFactory(['id' => $id, 'policy' => 'sliding_window', 'limit' => $limit, 'interval' => '5 minutes'], $storage, $locks);
    }
}
