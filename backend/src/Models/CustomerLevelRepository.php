<?php

declare(strict_types=1);

namespace Sptc\MasterData\Models;

use PDO;

/**
 * Customer levels read from dbo.Customer: Customer_Lavel is the stored code and Customer_Type is the name shown to staff.
 *
 * @phpstan-import-type CustomerLevel from WebsiteImageRepository
 */
final class CustomerLevelRepository
{
    /** @var list<CustomerLevel>|null */
    private ?array $levels = null;

    public function __construct(
        private readonly PDO $db,
        private readonly bool $demo,
    ) {
    }

    /** @return list<CustomerLevel> */
    public function all(): array
    {
        if ($this->levels !== null) {
            return $this->levels;
        }
        $table = $this->demo ? 'Customer' : 'dbo.Customer';
        $query = $this->db->prepare("SELECT LTRIM(RTRIM(Customer_Lavel)) AS code, MIN(LTRIM(RTRIM(Customer_Type))) AS name
            FROM {$table}
            WHERE Customer_Lavel IS NOT NULL AND LTRIM(RTRIM(Customer_Lavel)) <> ''
                AND Customer_Type IS NOT NULL AND LTRIM(RTRIM(Customer_Type)) <> ''
            GROUP BY LTRIM(RTRIM(Customer_Lavel))
            ORDER BY code");
        $query->execute();
        $levels = [];
        foreach ($query->fetchAll() as $row) {
            if (!is_array($row) || !is_scalar($row['code'] ?? null) || !is_scalar($row['name'] ?? null)) continue;
            $levels[] = ['code' => (string) $row['code'], 'name' => (string) $row['name']];
        }

        return $this->levels = $levels;
    }

    /** @return CustomerLevel|null */
    public function find(string $code): ?array
    {
        foreach ($this->all() as $level) {
            if ($level['code'] === $code) return $level;
        }

        return null;
    }
}
