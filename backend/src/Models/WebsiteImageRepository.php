<?php

declare(strict_types=1);

namespace Sptc\MasterData\Models;

use PDO;
use Throwable;

final class WebsiteImageRepository
{
    public const TABLES = [
        'promo-banner' => 'Web_Promo_Banner',
        'promo-sale' => 'Web_Promo_Sale',
        'carousel' => 'Web_Carousel',
    ];

    public const DEFAULT_MAX_IMAGE_URL_LENGTHS = [
        'promo-banner' => 255,
        'promo-sale' => 255,
        'carousel' => 500,
    ];
    public const MAX_URL_CAP = 2048;

    private readonly string $table;
    private readonly string $idColumn;
    private readonly string $titleColumn;
    private readonly bool $hasLinkUrl;
    private readonly string $now;
    /** @var array<string, array{maxLength: int, utf16: bool}> */
    private array $columnSpecs = [];

    /** @param key-of<self::TABLES> $collection */
    public function __construct(
        private readonly PDO $db,
        private readonly bool $demo,
        private readonly string $collection,
        private readonly ?int $demoMaxImageUrlLength = null,
    ) {
        $this->table = ($demo ? '' : 'dbo.') . self::TABLES[$collection];
        $this->idColumn = $collection === 'carousel' ? 'Carousel_Id' : 'Promo_Id';
        $this->titleColumn = $collection === 'carousel' ? 'Slide_Title' : 'Promo_Title';
        $this->hasLinkUrl = $collection !== 'carousel';
        $this->now = $demo ? "strftime('%Y-%m-%d %H:%M:%f', 'now')" : 'GETDATE()';
    }

    public function hasLinkUrl(): bool
    {
        return $this->hasLinkUrl;
    }

    /** @return array{maxLength: int, utf16: bool} */
    public function imageUrlColumnSpec(): array
    {
        return $this->columnSpec('Image_Url');
    }

    /** @return array{maxLength: int, utf16: bool} */
    public function linkUrlColumnSpec(): array
    {
        return $this->hasLinkUrl ? $this->columnSpec('Link_Url') : $this->columnSpec('Image_Url');
    }

    /**
     * @param 'Image_Url'|'Link_Url' $column
     * @return array{maxLength: int, utf16: bool}
     */
    private function columnSpec(string $column): array
    {
        if (isset($this->columnSpecs[$column])) {
            return $this->columnSpecs[$column];
        }
        if ($this->demo) {
            $max = $this->demoMaxImageUrlLength !== null && $this->demoMaxImageUrlLength > 0
                ? min($this->demoMaxImageUrlLength, self::MAX_URL_CAP)
                : self::DEFAULT_MAX_IMAGE_URL_LENGTHS[$this->collection];

            return $this->columnSpecs[$column] = ['maxLength' => $max, 'utf16' => true];
        }

        $query = $this->db->prepare(
            "SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = ? AND COLUMN_NAME = ?"
        );
        $query->execute([self::TABLES[$this->collection], $column]);
        $row = $query->fetch();
        if (is_array($row)) {
            $dataType = strtolower((string) ($row['DATA_TYPE'] ?? 'nvarchar'));
            $utf16 = in_array($dataType, ['nvarchar', 'nchar'], true);
            $rawLength = isset($row['CHARACTER_MAXIMUM_LENGTH']) ? (int) $row['CHARACTER_MAXIMUM_LENGTH'] : 0;
            if ($rawLength === -1) {
                return $this->columnSpecs[$column] = ['maxLength' => self::MAX_URL_CAP, 'utf16' => $utf16];
            }
            if ($rawLength > 0) {
                return $this->columnSpecs[$column] = ['maxLength' => min($rawLength, self::MAX_URL_CAP), 'utf16' => $utf16];
            }
        }

        $fallback = $this->db->prepare('SELECT COL_LENGTH(?, ?)');
        $fallback->execute(['dbo.' . self::TABLES[$this->collection], $column]);
        $bytes = $fallback->fetchColumn();
        if (is_numeric($bytes)) {
            $byteLength = (int) $bytes;
            if ($byteLength === -1) {
                return $this->columnSpecs[$column] = ['maxLength' => self::MAX_URL_CAP, 'utf16' => true];
            }
            if ($byteLength > 0) {
                return $this->columnSpecs[$column] = ['maxLength' => min(max(1, intdiv($byteLength, 2)), self::MAX_URL_CAP), 'utf16' => true];
            }
        }

        return $this->columnSpecs[$column] = ['maxLength' => self::DEFAULT_MAX_IMAGE_URL_LENGTHS[$this->collection], 'utf16' => true];
    }

    /** @param list<string> $imageUrls */
    public function hasActiveManagedImage(array $imageUrls): bool
    {
        $candidates = array_values(array_unique(array_filter($imageUrls, static fn (string $url): bool => $url !== '')));
        if ($candidates === []) {
            return false;
        }
        $placeholders = implode(', ', array_fill(0, count($candidates), '?'));
        $sql = $this->demo
            ? "SELECT 1 FROM {$this->table} WHERE Is_Active = 1 AND Image_Url IN ({$placeholders}) LIMIT 1"
            : "SELECT TOP 1 1 FROM {$this->table} WHERE Is_Active = 1 AND Image_Url IN ({$placeholders})";
        $query = $this->db->prepare($sql);
        $query->execute($candidates);

        return $query->fetchColumn() !== false;
    }

    /** @return list<array{id: string, title: string, position: int, active: bool, revision: string, path: string, linkUrl: string|null}> */
    public function items(bool $lockCollection = false): array
    {
        $hint = $lockCollection && !$this->demo ? ' WITH (UPDLOCK, HOLDLOCK)' : '';
        $query = $this->db->prepare($this->select($hint) . " ORDER BY Sort_Order, {$this->idColumn}");
        $query->execute();
        $items = [];
        foreach ($query->fetchAll() as $row) {
            $items[] = $this->item($row);
        }
        return $items;
    }

    /** @return array{id: string, title: string, position: int, active: bool, revision: string, path: string, linkUrl: string|null}|null */
    public function findByRevision(int $id, string $revision): ?array
    {
        $item = $this->find($id);
        return $item !== null && $item['revision'] === $revision ? $item : null;
    }

    public function image(int $id, string $revision): ?string
    {
        $item = $this->findByRevision($id, $revision);
        return $item !== null ? $item['path'] : null;
    }

    public function imageVersion(int $id, string $version): ?string
    {
        $item = $this->find($id);
        return $item !== null && hash('sha256', $item['path']) === $version ? $item['path'] : null;
    }

    public function add(string $title, int $active, string $image, ?string $linkUrl = null): void
    {
        $hint = $this->demo ? '' : ' WITH (UPDLOCK, HOLDLOCK)';
        if ($this->hasLinkUrl) {
            $query = $this->db->prepare("INSERT INTO {$this->table} ({$this->titleColumn}, Sort_Order, Is_Active, Image_Url, Link_Url)
                SELECT ?, COALESCE(MAX(Sort_Order), 0) + 1, ?, ?, ? FROM {$this->table}{$hint}");
            $query->execute([$title, $active, $image, $linkUrl]);
            return;
        }
        $query = $this->db->prepare("INSERT INTO {$this->table} ({$this->titleColumn}, Sort_Order, Is_Active, Image_Url)
            SELECT ?, COALESCE(MAX(Sort_Order), 0) + 1, ?, ? FROM {$this->table}{$hint}");
        $query->execute([$title, $active, $image]);
    }

    public function update(int $id, string $expected, string $title, int $active, ?string $image, ?string $linkUrl = null, bool $updateLinkUrl = false): bool
    {
        return $this->change($id, $expected, function (array $item) use ($id, $title, $active, $image, $linkUrl, $updateLinkUrl): void {
            if ($this->hasLinkUrl && $updateLinkUrl) {
                $query = $this->db->prepare("UPDATE {$this->table}
                    SET {$this->titleColumn} = ?, Is_Active = ?, Image_Url = ?, Link_Url = ?, Updated_At = {$this->now}
                    WHERE {$this->idColumn} = ?");
                $query->execute([$title, $active, $image ?? $item['path'], $linkUrl, $id]);
                return;
            }
            $query = $this->db->prepare("UPDATE {$this->table}
                SET {$this->titleColumn} = ?, Is_Active = ?, Image_Url = ?, Updated_At = {$this->now}
                WHERE {$this->idColumn} = ?");
            $query->execute([$title, $active, $image ?? $item['path'], $id]);
        });
    }

    public function delete(int $id, string $expected): bool
    {
        return $this->change($id, $expected, function () use ($id): void {
            $query = $this->db->prepare("DELETE FROM {$this->table} WHERE {$this->idColumn} = ?");
            $query->execute([$id]);
        });
    }

    /** @return array{id: string, title: string, position: int, active: bool, revision: string, path: string, linkUrl: string|null}|null */
    public function setActive(int $id, string $expected, int $active): ?array
    {
        $updated = null;
        $this->change($id, $expected, function () use ($id, $active, &$updated): void {
            $query = $this->db->prepare("UPDATE {$this->table} SET Is_Active = ?, Updated_At = {$this->now}
                WHERE {$this->idColumn} = ?");
            $query->execute([$active, $id]);
            $updated = $this->find($id);
        });
        return $updated;
    }

    /** @param callable(array{id: string, title: string, position: int, active: bool, revision: string, path: string, linkUrl: string|null}): void $write */
    private function change(int $id, string $expected, callable $write): bool
    {
        $this->db->beginTransaction();
        try {
            $item = $this->find($id, lock: true);
            if ($item === null || $item['revision'] !== $expected) {
                $this->db->rollBack();
                return false;
            }
            $write($item);
            $this->db->commit();
            return true;
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    /** @param array<int, string> $expected Revisions keyed by ID in the requested order. */
    public function reorder(array $expected): bool
    {
        $this->db->beginTransaction();
        try {
            $items = $this->items(lockCollection: true);
            $actual = array_column($items, 'revision', 'id');
            if (count($actual) !== count($expected) || array_diff_assoc($expected, $actual) !== []) {
                $this->db->rollBack();
                return false;
            }
            $query = $this->db->prepare("UPDATE {$this->table} SET Sort_Order = ?, Updated_At = {$this->now}
                WHERE {$this->idColumn} = ? AND (Sort_Order IS NULL OR Sort_Order <> ?)");
            $position = 0;
            foreach (array_keys($expected) as $id) {
                $position++;
                $query->execute([$position, $id, $position]);
            }
            $this->db->commit();
            return true;
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    private function select(string $hint = ''): string
    {
        $linkColumn = $this->hasLinkUrl ? ', Link_Url AS linkUrl' : '';
        return "SELECT {$this->idColumn} AS id, {$this->titleColumn} AS title,
            Sort_Order AS position, Is_Active AS active, Image_Url AS path{$linkColumn}, Updated_At AS updated
            FROM {$this->table}{$hint}";
    }

    /** @return array{id: string, title: string, position: int, active: bool, revision: string, path: string, linkUrl: string|null}|null */
    private function find(int $id, bool $lock = false): ?array
    {
        $hint = $lock && !$this->demo ? ' WITH (UPDLOCK)' : '';
        $query = $this->db->prepare($this->select($hint) . " WHERE {$this->idColumn} = ?");
        $query->execute([$id]);
        $row = $query->fetch();
        return is_array($row) ? $this->item($row) : null;
    }

    /**
     * @param array<string, mixed> $row
     * @return array{id: string, title: string, position: int, active: bool, revision: string, path: string, linkUrl: string|null}
     */
    private function item(array $row): array
    {
        $linkUrl = isset($row['linkUrl']) && is_string($row['linkUrl']) && trim($row['linkUrl']) !== ''
            ? trim($row['linkUrl'])
            : null;
        return [
            'id' => (string) $row['id'],
            'title' => (string) $row['title'],
            'position' => (int) $row['position'],
            'active' => (bool) $row['active'],
            'revision' => hash('sha256', serialize($row)),
            'path' => (string) $row['path'],
            'linkUrl' => $linkUrl,
        ];
    }
}
