<?php

declare(strict_types=1);

namespace Sptc\MasterData\Models;

use InvalidArgumentException;

/**
 * dbo.Web_Promotion_Level: every row belongs to one customer level (Customer_Lavel = code, Level_Name = name)
 * and is ordered within that level. The optional description is stored in Remark.
 *
 * @phpstan-import-type WebsiteImageItem from WebsiteImageRepository
 * @phpstan-import-type CustomerLevel from WebsiteImageRepository
 */
final class PromotionLevelImageRepository extends WebsiteImageRepository
{
    public function hasLevel(): bool
    {
        return true;
    }

    protected function orderBy(): string
    {
        return " ORDER BY Customer_Lavel, Sort_Order, {$this->idColumn}";
    }

    protected function levelFilter(?string $level): array
    {
        return $level === null ? ['', []] : [' WHERE Customer_Lavel = ?', [$level]];
    }

    protected function extraColumns(): string
    {
        return ', Customer_Lavel AS level, Level_Name AS levelName';
    }

    public function add(string $title, int $active, string $image, ?string $linkUrl = null, ?array $level = null): void
    {
        $level = self::requireLevel($level);
        $hint = $this->demo ? '' : ' WITH (UPDLOCK, HOLDLOCK)';
        // New rows go to the end of their own level; Status keeps its database default.
        $query = $this->db->prepare("INSERT INTO {$this->table} ({$this->titleColumn}, Sort_Order, Is_Active, Image_Url, Customer_Lavel, Level_Name, Updated_At)
            SELECT ?, COALESCE(MAX(Sort_Order), 0) + 1, ?, ?, ?, ?, {$this->now} FROM {$this->table}{$hint} WHERE Customer_Lavel = ?");
        $query->execute([$title === '' ? null : $title, $active, $image, $level['code'], $level['name'], $level['code']]);
    }

    public function update(int $id, string $expected, string $title, int $active, ?string $image, ?string $linkUrl = null, bool $updateLinkUrl = false, ?array $level = null): bool
    {
        $level = self::requireLevel($level);
        return $this->change($id, $expected, function (array $item) use ($id, $title, $active, $image, $level): void {
            // Moving to another level appends the row to the end of that level.
            $query = $this->db->prepare("UPDATE {$this->table}
                SET {$this->titleColumn} = ?, Is_Active = ?, Image_Url = ?, Customer_Lavel = ?, Level_Name = ?,
                    Sort_Order = CASE WHEN Customer_Lavel = ? THEN Sort_Order
                        ELSE (SELECT COALESCE(MAX(Sort_Order), 0) + 1 FROM {$this->table} WHERE Customer_Lavel = ?) END,
                    Updated_At = {$this->now}
                WHERE {$this->idColumn} = ?");
            $query->execute([
                $title === '' ? null : $title, $active, $image ?? $item['path'],
                $level['code'], $level['name'], $level['code'], $level['code'], $id,
            ]);
        });
    }

    protected function item(array $row): array
    {
        $text = static fn (mixed $value): ?string => is_scalar($value) && trim((string) $value) !== '' ? trim((string) $value) : null;
        return array_merge(parent::item($row), [
            'level' => $text($row['level'] ?? null),
            'levelName' => $text($row['levelName'] ?? null),
        ]);
    }

    /**
     * @param CustomerLevel|null $level
     * @return CustomerLevel
     */
    private static function requireLevel(?array $level): array
    {
        return $level ?? throw new InvalidArgumentException('Customer level is required');
    }
}
