<?php

declare(strict_types=1);

namespace Sptc\MasterData\Auth;

use PDO;

final readonly class UserRepository
{
    private const DUMMY_HASH = '$2y$12$8UTdRop38fQRlG40OY7UEuM5qXb.thVqpqAKoH3dz4Pu.p/AUjjP.';

    public function __construct(private PDO $database, private bool $demo)
    {
    }

    /** @return array{username: string}|null */
    public function verify(string $username, #[\SensitiveParameter] string $password): ?array
    {
        if ($this->demo) {
            return $this->verifyDemo($username, $password);
        }

        $query = $this->database->prepare(<<<'SQL'
            SELECT TOP (1) a.[SUser]
            FROM [dbo].[System_Access] AS a
            CROSS JOIN (SELECT CONVERT(NVARCHAR(4000), ?) AS [password]) AS entered
            WHERE a.[SUser] = CONVERT(NVARCHAR(4000), ?)
              AND DATALENGTH(a.[SPass]) = DATALENGTH(entered.[password])
              AND CONVERT(VARBINARY(8000), a.[SPass]) = CONVERT(VARBINARY(8000), entered.[password])
            ORDER BY a.[SUser] COLLATE Latin1_General_100_BIN2
            SQL);
        $query->execute([$password, $username]);
        $matched = $query->fetchColumn();

        return is_string($matched) ? ['username' => trim($matched)] : null;
    }

    /** @return array{username: string}|null */
    private function verifyDemo(string $username, #[\SensitiveParameter] string $password): ?array
    {
        $query = $this->database->prepare('SELECT username, password_hash, is_active FROM users WHERE username = ? COLLATE NOCASE');
        $query->execute([$username]);
        $row = $query->fetch();

        $hash = is_array($row) && is_string($row['password_hash'] ?? null) ? $row['password_hash'] : self::DUMMY_HASH;
        $verified = strlen($password) <= 72 && password_verify($password, $hash);
        if (!$verified || !is_array($row) || !is_string($row['username'] ?? null) || (int) ($row['is_active'] ?? 0) !== 1) {
            return null;
        }

        return ['username' => $row['username']];
    }
}
