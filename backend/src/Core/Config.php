<?php

declare(strict_types=1);

namespace Sptc\MasterData\Core;

use Dotenv\Dotenv;
use RuntimeException;

final readonly class Config
{
    public function __construct(public string $root)
    {
        if (is_file($root . '/.env')) {
            Dotenv::createImmutable($root)->load();
        }
    }

    public function value(string $key, string $default = ''): string
    {
        $value = getenv($key, true);
        if ($value !== false) {
            return $value;
        }
        $value = $_ENV[$key] ?? $_SERVER[$key] ?? null;

        return is_string($value) ? $value : $default;
    }

    public function required(string $key): string
    {
        $value = $this->value($key);
        if ($value === '') {
            throw new RuntimeException('Missing configuration: ' . $key);
        }

        return $value;
    }

    public function demo(): bool
    {
        return $this->value('APP_MODE', 'production') === 'demo';
    }

    public function boolean(string $key, string $default = ''): bool
    {
        return in_array(strtolower(trim($this->value($key, $default))), ['1', 'true'], true);
    }

    public function runtime(): string
    {
        $path = $this->root . '/var/' . ($this->demo() ? 'demo' : 'production');
        if (!is_dir($path) && !@mkdir($path, 0700, true) && !is_dir($path)) {
            throw new RuntimeException('Unable to create runtime directory');
        }

        return $path;
    }
}
