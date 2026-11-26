<?php

declare(strict_types=1);

namespace Sptc\MasterData\Models;

use PDO;
use Throwable;

/**
 * @phpstan-type WebsiteImageItem array{id: string, title: string, position: int, active: bool, revision: string, path: string, linkUrl: string|null, level: string|null, levelName: string|null}
 * @phpstan-type CustomerLevel array{code: string, name: string}
 *
 * Website image tables that share one row shape. PromotionLevelImageRepository adds the per-customer-level rules.
 */
class WebsiteImageRepository
{
    /** Per-table settings: table name, key column, title column, separate Link_Url column and demo URL length. */
    public const COLLECTIONS = [
        'promo-banner' => ['table' => 'Web_Promo_WelCome', 'id' => 'Promo_Id', 'title' => 'Promo_Title', 'linkUrl' => true, 'maxImageUrlLength' => 255],
        'promo-sale' => ['table' => 'Web_Promo_Sale', 'id' => 'Promo_Id', 'title' => 'Promo_Title', 'linkUrl' => true, 'maxImageUrlLength' => 255],
        'carousel' => ['table' => 'Web_Carousel', 'id' => 'Carousel_Id', 'title' => 'Slide_Title', 'linkUrl' => false, 'maxImageUrlLength' => 500],
        'promotion-level' => ['table' => 'Web_Promotion_Level', 'id' => 'Auto_ID', 'title' => 'Remark', 'linkUrl' => false, 'maxImageUrlLength' => 500],
    ];

    public const MAX_URL_CAP = 2048;

    protected readonly string $table;
    protected readonly string $idColumn;
    protected readonly string $titleColumn;
    protected readonly string $now;
    /** @var array<string, array{maxLength: int, utf16: bool}> */
    private array $columnSpecs = [];

    /** @param key-of<self::COLLECTIONS> $collection */
    final protected function __construct(
        protected readonly PDO $db,
        protected readonly bool $demo,
        private readonly string $collection,
        private readonly ?int $demoMaxImageUrlLength = null,
    ) {
        $settings = self::COLLECTIONS[$collection];
        $this->table = ($demo ? '' : 'dbo.') . $settings['table'];
        $this->idColumn = $settings['id'];
        $this->titleColumn = $settings['title'];
        $this->now = $demo ? "strftime('%Y-%m-%d %H:%M:%f', 'now')" : 'GETDATE()';
    }

    /** @param key-of<self::COLLECTIONS> $collection */
    public static function for(PDO $db, bool $demo, string $collection, ?int $demoMaxImageUrlLength = null): self
    {
        return $collection === 'promotion-level'
            ? new PromotionLevelImageRepository($db, $demo, $collection, $demoMaxImageUrlLength)
            : new self($db, $demo, $collection, $demoMaxImageUrlLength);
    }

    public function hasLinkUrl(): bool
    {
        return self::COLLECTIONS[$this->collection]['linkUrl'];
    }

    public function hasLevel(): bool
    {
        return false;
    }

    protected function orderBy(): string
    {
        return " ORDER BY Sort_Order, {$this->idColumn}";
    }

    /** @return array{maxLength: int, utf16: bool} */
    public function imageUrlColumnSpec(): array
    {
        return $this->columnSpec('Image_Url');
    }

    /** @return array{maxLength: int, utf16: bool} */
    public function linkUrlColumnSpec(): array
    {
        return $this->hasLinkUrl() ? $this->columnSpec('Link_Url') : $this->columnSpec('Image_Url');
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
                : self::COLLECTIONS[$this->collection]['maxImageUrlLength'];

            return $this->columnSpecs[$column] = ['maxLength' => $max, 'utf16' => true];
        }

        $query = $this->db->prepare(
            "SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = ? AND COLUMN_NAME = ?"
        );
        $query->execute([self::COLLECTIONS[$this->collection]['table'], $column]);
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
        $fallback->execute(['dbo.' . self::COLLECTIONS[$this->collection]['table'], $column]);
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

        return $this->columnSpecs[$column] = ['maxLength' => self::COLLECTIONS[$this->collection]['maxImageUrlLength'], 'utf16' => true];
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

    /** @return list<WebsiteImageItem> */
    public function activeItems(): array
    {
        $query = $this->db->prepare($this->select() . ' WHERE Is_Active = 1' . $this->orderBy());
        $query->execute();
        $items = [];
        foreach ($query->fetchAll() as $row) {
            $items[] = $this->item($row);
        }
        return $items;
    }

    /**
     * Lists the collection; for level collections a level code limits the list to that customer level.
     *
     * @return list<WebsiteImageItem>
     */
    public function items(bool $lockCollection = false, ?string $level = null): array
    {
        $hint = $lockCollection && !$this->demo ? ' WITH (UPDLOCK, HOLDLOCK)' : '';
        [$where, $values] = $this->levelFilter($level);
        $query = $this->db->prepare($this->select($hint) . $where . $this->orderBy());
        $query->execute($values);
        $items = [];
        foreach ($query->fetchAll() as $row) {
            $items[] = $this->item($row);
        }
        return $items;
    }

    /** @return array{string, list<string>} WHERE clause and its values. */
    protected function levelFilter(?string $level): array
    {
        return ['', []];
    }

    /** @return WebsiteImageItem|null */
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

    /** @param CustomerLevel|null $level Required for level collections. */
    public function add(string $title, int $active, string $image, ?string $linkUrl = null, ?array $level = null): void
    {
        $hint = $this->demo ? '' : ' WITH (UPDLOCK, HOLDLOCK)';
        if ($this->hasLinkUrl()) {
            $query = $this->db->prepare("INSERT INTO {$this->table} ({$this->titleColumn}, Sort_Order, Is_Active, Image_Url, Link_Url)
                SELECT ?, COALESCE(MAX(Sort_Order), 0) + 1, ?, ?, ? FROM {$this->table}{$hint}");
            $query->execute([$title, $active, $image, $linkUrl]);
            return;
        }
        $query = $this->db->prepare("INSERT INTO {$this->table} ({$this->titleColumn}, Sort_Order, Is_Active, Image_Url)
            SELECT ?, COALESCE(MAX(Sort_Order), 0) + 1, ?, ? FROM {$this->table}{$hint}");
        $query->execute([$title, $active, $image]);
    }

    /** @param CustomerLevel|null $level Required for level collections. */
    public function update(int $id, string $expected, string $title, int $active, ?string $image, ?string $linkUrl = null, bool $updateLinkUrl = false, ?array $level = null): bool
    {
        return $this->change($id, $expected, function (array $item) use ($id, $title, $active, $image, $linkUrl, $updateLinkUrl): void {
            if ($this->hasLinkUrl() && $updateLinkUrl) {
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

    /** @return WebsiteImageItem|null */
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

    /** @param callable(WebsiteImageItem): void $write */
    protected function change(int $id, string $expected, callable $write): bool
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

    /**
     * @param array<int, string> $expected Revisions keyed by ID in the requested order.
     * @param string|null $level For level collections, the level whose rows are reordered; it must list every row of that level.
     */
    public function reorder(array $expected, ?string $level = null): bool
    {
        if ($this->hasLevel() && $level === null) return false;
        $this->db->beginTransaction();
        try {
            $items = $this->items(lockCollection: true, level: $level);
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

    /** Extra SELECT columns, each starting with a comma. */
    protected function extraColumns(): string
    {
        return $this->hasLinkUrl() ? ', Link_Url AS linkUrl' : '';
    }

    private function select(string $hint = ''): string
    {
        return "SELECT {$this->idColumn} AS id, {$this->titleColumn} AS title,
            Sort_Order AS position, Is_Active AS active, Image_Url AS path{$this->extraColumns()}, Updated_At AS updated
            FROM {$this->table}{$hint}";
    }

    /** @return WebsiteImageItem|null */
    protected function find(int $id, bool $lock = false): ?array
    {
        $hint = $lock && !$this->demo ? ' WITH (UPDLOCK)' : '';
        $query = $this->db->prepare($this->select($hint) . " WHERE {$this->idColumn} = ?");
        $query->execute([$id]);
        $row = $query->fetch();
        return is_array($row) ? $this->item($row) : null;
    }

    /**
     * @param array<string, mixed> $row
     * @return WebsiteImageItem
     */
    protected function item(array $row): array
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
            'level' => null,
            'levelName' => null,
        ];
    }
}
