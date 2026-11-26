<?php

declare(strict_types=1);

namespace Sptc\MasterData\Models;

use Sptc\MasterData\Core\Config;
use Sptc\MasterData\Services\ProductImage;

use PDO;
use RuntimeException;

final class ProductRepository
{
    public const PAGE_SIZE = 50;
    public const MAX_PAGE_SIZE = 500;
    public const DEFAULT_MAX_IMAGE_URL_LENGTH = 200;
    public const MAX_URL_CAP = 2048;

    /** @var array<int, array{maxLength: int, utf16: bool}> */
    private array $imageColumnSpecs = [];

    public function __construct(private readonly PDO $database, private readonly Config $config)
    {
    }

    /** @return array{items: list<array<string, string|null>>, page: int, pageSize: int, total: int, totalPages: int} */
    public function search(string $search, int $page, string $type = '', string $selectedUnit = '', int $pageSize = self::PAGE_SIZE): array
    {
        $demo = $this->config->demo();
        $table = $demo ? '[products]' : $this->configuredTable();
        $id = $this->column('ID', 'id', true);
        $code = $this->column('CODE', 'code', true);
        $name = $this->column('NAME', 'name', true);
        $barcode = $this->column('BARCODE', 'barcode');
        $category = $this->column('CATEGORY', 'category');
        $unit = $this->column('UNIT', 'unit');
        $price = $this->column('PRICE', 'price');
        $cast = $demo ? 'TEXT' : 'NVARCHAR(4000)';
        $filters = [];
        $pattern = '%' . self::escapeLike($search) . '%';
        if ($search !== '') {
            foreach (array_filter([$code, $name, $barcode]) as $column) {
                $filters[] = "CAST({$column} AS {$cast}) LIKE ? ESCAPE '!'";
            }
        }

        $clauses = $filters === [] ? [] : ['(' . implode(' OR ', $filters) . ')'];
        $parameters = array_fill(0, count($filters), $pattern);
        if ($type !== '') {
            if ($category === null) throw new RuntimeException('Product category is not configured');
            $clauses[] = "LTRIM(RTRIM({$category})) = ?";
            $parameters[] = $type;
        }
        if ($selectedUnit !== '') {
            if ($unit === null) throw new RuntimeException('Product unit is not configured');
            $clauses[] = "LTRIM(RTRIM({$unit})) = ?";
            $parameters[] = $selectedUnit;
        }
        $where = $clauses === [] ? '' : ' WHERE ' . implode(' AND ', $clauses);
        $size = min(max(1, $pageSize), self::MAX_PAGE_SIZE);
        $count = $demo ? 'COUNT(*)' : 'COUNT_BIG(*)';
        $countQuery = $this->database->prepare("SELECT {$count} FROM {$table}{$where}");
        $countQuery->execute($parameters);
        $total = (int) $countQuery->fetchColumn();
        $pages = max(1, (int) ceil($total / $size));
        $page = min(max(1, $page), $pages);
        $offset = ($page - 1) * $size;
        $pagination = $demo ? "LIMIT {$size} OFFSET {$offset}" : "OFFSET {$offset} ROWS FETCH NEXT {$size} ROWS ONLY";
        $barcode ??= 'NULL';
        $category ??= 'NULL';
        $unit ??= 'NULL';
        if ($price !== null && !$demo) {
            $price = "CAST({$price} AS DECIMAL(19, 4))";
        }
        $price = $price === null ? 'NULL' : "CAST({$price} AS {$cast})";

        $select = "SELECT {$id} AS [id], {$code} AS [code], {$name} AS [name], {$barcode} AS [barcode], {$category} AS [category], {$unit} AS [unit], {$price} AS [price]";
        $order = $id === $code ? $id : "{$code}, {$id}";
        $itemsQuery = $this->database->prepare("{$select} FROM {$table}{$where} ORDER BY {$order} {$pagination}");
        $itemsQuery->execute($parameters);
        $items = [];
        /** @var array<string, scalar|null> $row */
        foreach ($itemsQuery->fetchAll() as $row) {
            $items[] = array_map(static fn (string|int|float|bool|null $value): ?string => $value === null ? null : trim((string) $value), $row);
        }

        return ['items' => $items, 'page' => $page, 'pageSize' => $size, 'total' => $total, 'totalPages' => $pages];
    }

    /**
     * @return array{
     *     items: list<array{id: string|null, code: string|null, name: string|null, category: string|null, unit: string|null, price: string|null, image1: string|null, image2: string|null}>,
     *     page: int,
     *     pageSize: int,
     *     total: int,
     *     totalPages: int,
     * }
     */
    public function publicSearch(string $search, int $page, string $type = '', string $selectedUnit = '', int $pageSize = 24): array
    {
        $demo = $this->config->demo();
        $table = $demo ? '[products]' : $this->configuredTable();
        $id = $this->column('ID', 'id', true);
        $code = $this->column('CODE', 'code', true);
        $name = $this->column('NAME', 'name', true);
        $barcode = $this->column('BARCODE', 'barcode');
        $category = $this->column('CATEGORY', 'category');
        $unit = $this->column('UNIT', 'unit');
        $price = $this->column('PRICE', 'price');
        $image1 = $demo ? '[image1]' : '[Trade_Image1]';
        $image2 = $demo ? '[image2]' : '[Trade_Image2]';
        $cast = $demo ? 'TEXT' : 'NVARCHAR(4000)';
        $filters = [];
        $pattern = '%' . self::escapeLike($search) . '%';
        if ($search !== '') {
            foreach (array_filter([$code, $name, $barcode]) as $column) {
                $filters[] = "CAST({$column} AS {$cast}) LIKE ? ESCAPE '!'";
            }
        }

        $clauses = $filters === [] ? [] : ['(' . implode(' OR ', $filters) . ')'];
        $parameters = array_fill(0, count($filters), $pattern);
        if ($type !== '') {
            if ($category === null) throw new RuntimeException('Product category is not configured');
            $clauses[] = "LTRIM(RTRIM({$category})) = ?";
            $parameters[] = $type;
        }
        if ($selectedUnit !== '') {
            if ($unit === null) throw new RuntimeException('Product unit is not configured');
            $clauses[] = "LTRIM(RTRIM({$unit})) = ?";
            $parameters[] = $selectedUnit;
        }
        $where = $clauses === [] ? '' : ' WHERE ' . implode(' AND ', $clauses);
        $size = min(max(1, $pageSize), 60);
        $count = $demo ? 'COUNT(*)' : 'COUNT_BIG(*)';
        $countQuery = $this->database->prepare("SELECT {$count} FROM {$table}{$where}");
        $countQuery->execute($parameters);
        $total = (int) $countQuery->fetchColumn();
        $pages = max(1, (int) ceil($total / $size));
        $page = min(max(1, $page), $pages);
        $offset = ($page - 1) * $size;
        $pagination = $demo ? "LIMIT {$size} OFFSET {$offset}" : "OFFSET {$offset} ROWS FETCH NEXT {$size} ROWS ONLY";
        $category ??= 'NULL';
        $unit ??= 'NULL';
        if ($price !== null && !$demo) {
            $price = "CAST({$price} AS DECIMAL(19, 4))";
        }
        $price = $price === null ? 'NULL' : "CAST({$price} AS {$cast})";

        $select = "SELECT {$id} AS [id], {$code} AS [code], {$name} AS [name], {$category} AS [category], {$unit} AS [unit], {$price} AS [price], {$image1} AS [image1], {$image2} AS [image2]";
        $order = $id === $code ? $id : "{$code}, {$id}";
        $itemsQuery = $this->database->prepare("{$select} FROM {$table}{$where} ORDER BY {$order} {$pagination}");
        $itemsQuery->execute($parameters);
        $items = [];
        /** @var array<string, scalar|null> $row */
        foreach ($itemsQuery->fetchAll() as $row) {
            $norm = static fn (string|int|float|bool|null $value): ?string => $value === null || trim((string) $value) === '' ? null : trim((string) $value);
            $items[] = [
                'id' => $norm($row['id'] ?? null),
                'code' => $norm($row['code'] ?? null),
                'name' => $norm($row['name'] ?? null),
                'category' => $norm($row['category'] ?? null),
                'unit' => $norm($row['unit'] ?? null),
                'price' => $norm($row['price'] ?? null),
                'image1' => $norm($row['image1'] ?? null),
                'image2' => $norm($row['image2'] ?? null),
            ];
        }

        return ['items' => $items, 'page' => $page, 'pageSize' => $size, 'total' => $total, 'totalPages' => $pages];
    }

    /**
     * @return array{id: string, code: string, name: string|null, category: string|null, unit: string|null, price: string|null, note: string|null, shortNote: string|null, image1: string|null, image2: string|null}|null
     */
    public function publicItem(string $idValue): ?array
    {
        $demo = $this->config->demo();
        $table = $demo ? '[products]' : $this->configuredTable();
        $id = $this->column('ID', 'id', true);
        $code = $this->column('CODE', 'code', true);
        $name = $this->column('NAME', 'name', true);
        $category = $this->column('CATEGORY', 'category') ?? 'NULL';
        $unit = $this->column('UNIT', 'unit') ?? 'NULL';
        $price = $this->column('PRICE', 'price');
        $cast = $demo ? 'TEXT' : 'NVARCHAR(4000)';
        if ($price !== null && !$demo) {
            $price = "CAST({$price} AS DECIMAL(19, 4))";
        }
        $price = $price === null ? 'NULL' : "CAST({$price} AS {$cast})";
        $note = $demo ? '[note]' : 'CAST([Trade_Note] AS NVARCHAR(MAX))';
        $shortNote = $demo ? '[short_note]' : 'CAST([Trade_Note_Sort] AS NVARCHAR(MAX))';
        $image1 = $demo ? '[image1]' : '[Trade_Image1]';
        $image2 = $demo ? '[image2]' : '[Trade_Image2]';
        $query = $this->database->prepare(
            "SELECT {$id} AS [id], {$code} AS [code], {$name} AS [name], {$category} AS [category], {$unit} AS [unit], {$price} AS [price], {$note} AS [note], {$shortNote} AS [shortNote], {$image1} AS [image1], {$image2} AS [image2]
            FROM {$table} WHERE {$id} = ?"
        );
        $query->execute([$idValue]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) return null;
        $norm = static fn (mixed $value): ?string => !is_scalar($value) || trim((string) $value) === '' ? null : trim((string) $value);

        return [
            'id' => trim((string) $row['id']),
            'code' => trim((string) $row['code']),
            'name' => $norm($row['name'] ?? null),
            'category' => $norm($row['category'] ?? null),
            'unit' => $norm($row['unit'] ?? null),
            'price' => $norm($row['price'] ?? null),
            'note' => isset($row['note']) && is_string($row['note']) && $row['note'] !== '' ? $row['note'] : null,
            'shortNote' => isset($row['shortNote']) && is_string($row['shortNote']) && $row['shortNote'] !== '' ? $row['shortNote'] : null,
            'image1' => $norm($row['image1'] ?? null),
            'image2' => $norm($row['image2'] ?? null),
        ];
    }

    public static function escapeLike(string $value): string
    {
        return strtr($value, ['!' => '!!', '%' => '!%', '_' => '!_', '[' => '![']);
    }

    /** @return list<string> */
    public function types(): array
    {
        return $this->referenceNames('[types]', '[dbo].[Type]', '[Type_Name]');
    }

    /** @return list<string> */
    public function units(): array
    {
        return $this->referenceNames('[units]', '[dbo].[Unit]', '[Unit_Name]');
    }

    /** @return list<string> */
    private function referenceNames(string $demoTable, string $productionTable, string $productionColumn): array
    {
        $table = $this->config->demo() ? $demoTable : $productionTable;
        $column = $this->config->demo() ? '[name]' : $productionColumn;
        $query = $this->database->query("SELECT DISTINCT LTRIM(RTRIM({$column})) AS [name] FROM {$table} WHERE {$column} IS NOT NULL AND LTRIM(RTRIM({$column})) <> '' ORDER BY [name]");
        if ($query === false) throw new RuntimeException('Unable to load product filters');
        $names = [];
        foreach ($query->fetchAll(PDO::FETCH_COLUMN) as $name) {
            if (is_string($name)) $names[] = $name;
        }
        return $names;
    }

    public function exists(string $id): bool
    {
        $table = $this->config->demo() ? '[products]' : $this->configuredTable();
        $column = $this->column('ID', 'id', true);
        $query = $this->database->prepare("SELECT 1 FROM {$table} WHERE {$column} = ?");
        $query->execute([$id]);
        return $query->fetchColumn() !== false;
    }

    /** @return array{code:string,image1:string|null,image2:string|null}|null */
    public function imageState(string $id): ?array
    {
        $table = $this->config->demo() ? '[products]' : $this->configuredTable();
        $idColumn = $this->column('ID', 'id', true);
        $codeColumn = $this->column('CODE', 'code', true);
        $first = $this->config->demo() ? '[image1]' : '[Trade_Image1]';
        $second = $this->config->demo() ? '[image2]' : '[Trade_Image2]';
        $query = $this->database->prepare("SELECT {$codeColumn} AS [code], {$first} AS [image1], {$second} AS [image2] FROM {$table} WHERE {$idColumn} = ?");
        $query->execute([$id]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) return null;
        $code = trim((string) $row['code']);
        $unique = $this->database->prepare("SELECT COUNT(*) FROM {$table} WHERE {$codeColumn} = ?");
        $unique->execute([$code]);
        if ((int) $unique->fetchColumn() !== 1) throw new RuntimeException('Product code is not unique');
        return ['code' => $code, 'image1' => $row['image1'] === null || $row['image1'] === '' ? null : (string) $row['image1'], 'image2' => $row['image2'] === null || $row['image2'] === '' ? null : (string) $row['image2']];
    }

    /** @return array{maxLength: int, utf16: bool} */
    public function imageColumnSpec(int $slot): array
    {
        if (!in_array($slot, [1, 2], true)) throw new RuntimeException('Invalid image slot');
        if (isset($this->imageColumnSpecs[$slot])) {
            return $this->imageColumnSpecs[$slot];
        }
        if ($this->config->demo()) {
            return $this->imageColumnSpecs[$slot] = ['maxLength' => self::DEFAULT_MAX_IMAGE_URL_LENGTH, 'utf16' => false];
        }

        $schema = $this->config->value('DB_PRODUCT_SCHEMA', 'dbo');
        $table = $this->config->value('DB_PRODUCT_TABLE', 'Trade');
        $column = 'Trade_Image' . $slot;
        $query = $this->database->prepare(
            'SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?'
        );
        $query->execute([$schema, $table, $column]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (is_array($row)) {
            $dataType = strtolower((string) ($row['DATA_TYPE'] ?? 'varchar'));
            $utf16 = in_array($dataType, ['nvarchar', 'nchar'], true);
            $rawLength = isset($row['CHARACTER_MAXIMUM_LENGTH']) ? (int) $row['CHARACTER_MAXIMUM_LENGTH'] : 0;
            if ($rawLength === -1) {
                return $this->imageColumnSpecs[$slot] = ['maxLength' => self::MAX_URL_CAP, 'utf16' => $utf16];
            }
            if ($rawLength > 0) {
                return $this->imageColumnSpecs[$slot] = ['maxLength' => min($rawLength, self::MAX_URL_CAP), 'utf16' => $utf16];
            }
        }

        $fallback = $this->database->prepare('SELECT COL_LENGTH(?, ?)');
        $fallback->execute([$schema . '.' . $table, $column]);
        $bytes = $fallback->fetchColumn();
        if (is_numeric($bytes)) {
            $byteLength = (int) $bytes;
            if ($byteLength === -1) {
                return $this->imageColumnSpecs[$slot] = ['maxLength' => self::MAX_URL_CAP, 'utf16' => false];
            }
            if ($byteLength > 0) {
                return $this->imageColumnSpecs[$slot] = ['maxLength' => min($byteLength, self::MAX_URL_CAP), 'utf16' => false];
            }
        }

        return $this->imageColumnSpecs[$slot] = ['maxLength' => self::DEFAULT_MAX_IMAGE_URL_LENGTH, 'utf16' => false];
    }

    /**
     * @param list<string>|null $candidates
     * @return array{code:string,slot:int}|null
     */
    public function findImagePath(string $path, ?array $candidates = null): ?array
    {
        $table = $this->config->demo() ? '[products]' : $this->configuredTable();
        $codeColumn = $this->column('CODE', 'code', true);
        $first = $this->config->demo() ? '[image1]' : '[Trade_Image1]';
        $second = $this->config->demo() ? '[image2]' : '[Trade_Image2]';
        $values = $candidates ?? [ProductImage::shortPath($path), ProductImage::oldPath($path)];
        $values = array_values(array_unique(array_filter($values, static fn (string $v): bool => $v !== '')));
        if ($values === []) return null;
        $placeholders = implode(', ', array_fill(0, count($values), '?'));
        $query = $this->database->prepare("SELECT {$codeColumn} AS [code], {$first} AS [image1], {$second} AS [image2] FROM {$table} WHERE {$first} IN ({$placeholders}) OR {$second} IN ({$placeholders})");
        $query->execute([...$values, ...$values]);
        foreach ($query->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if (!is_array($row) || !is_string($row['code'] ?? null)) continue;
            if (in_array($row['image1'] ?? null, $values, true)) return ['code' => trim($row['code']), 'slot' => 1];
            if (in_array($row['image2'] ?? null, $values, true)) return ['code' => trim($row['code']), 'slot' => 2];
        }
        return null;
    }

    public function updateImage(string $id, string $code, int $slot, ?string $expected, ?string $path): bool
    {
        $table = $this->config->demo() ? '[products]' : $this->configuredTable();
        $idColumn = $this->column('ID', 'id', true);
        $codeColumn = $this->column('CODE', 'code', true);
        if (!in_array($slot, [1, 2], true)) throw new RuntimeException('Invalid image slot');
        $column = $this->config->demo() ? '[image' . $slot . ']' : '[Trade_Image' . $slot . ']';
        $condition = $expected === null ? "({$column} IS NULL OR {$column} = '')" : "{$column} = ?";
        $query = $this->database->prepare("UPDATE {$table} SET {$column} = ? WHERE {$idColumn} = ? AND {$codeColumn} = ? AND {$condition}");
        $params = [$path, $id, $code];
        if ($expected !== null) $params[] = $expected;
        $query->execute($params);
        return $query->rowCount() === 1;
    }

    /** @return array{note: string|null}|null */
    public function note(string $id, bool $short = false): ?array
    {
        $table = $this->config->demo() ? '[products]' : $this->configuredTable();
        $idColumn = $this->column('ID', 'id', true);
        $column = $this->config->demo() ? ($short ? '[short_note]' : '[note]') : ($short ? 'CAST([Trade_Note_Sort] AS NVARCHAR(MAX))' : 'CAST([Trade_Note] AS NVARCHAR(MAX))');
        $query = $this->database->prepare("SELECT {$column} AS [note] FROM {$table} WHERE {$idColumn} = ?");
        $query->execute([$id]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? ['note' => $row['note'] === null ? null : (string) $row['note']] : null;
    }

    public function updateNote(string $id, ?string $expected, string $note, bool $short = false): bool
    {
        $demo = $this->config->demo();
        $table = $demo ? '[products]' : $this->configuredTable();
        $idColumn = $this->column('ID', 'id', true);
        $column = $demo ? ($short ? '[short_note]' : '[note]') : ($short ? '[Trade_Note_Sort]' : '[Trade_Note]');
        $condition = $expected === null ? "{$column} IS NULL" : ($demo ? "{$column} = ?" : "CAST({$column} AS NVARCHAR(MAX)) COLLATE Latin1_General_100_BIN2 = CAST(? AS NVARCHAR(MAX)) COLLATE Latin1_General_100_BIN2 AND DATALENGTH(CAST({$column} AS NVARCHAR(MAX))) = DATALENGTH(CAST(? AS NVARCHAR(MAX)))");
        $parameters = [$note, $id];
        if ($expected !== null) { $parameters[] = $expected; if (!$demo) $parameters[] = $expected; }
        $query = $this->database->prepare("UPDATE {$table} SET {$column} = ? WHERE {$idColumn} = ? AND {$condition}");
        $query->execute($parameters);
        return $query->rowCount() === 1;
    }

    public function updatePrice(string $id, ?string $expected, string $price): bool
    {
        $demo = $this->config->demo();
        $table = $demo ? '[products]' : $this->configuredTable();
        $idColumn = $this->column('ID', 'id', true);
        $priceColumn = $this->column('PRICE', 'price', true);
        $condition = $expected === null ? "{$priceColumn} IS NULL" : ($demo ? "{$priceColumn} = ?" : "CAST({$priceColumn} AS DECIMAL(19, 4)) = CAST(? AS DECIMAL(19, 4))");
        $query = $this->database->prepare("UPDATE {$table} SET {$priceColumn} = ? WHERE {$idColumn} = ? AND {$condition}");
        $parameters = [$price, $id];
        if ($expected !== null) $parameters[] = $expected;
        $query->execute($parameters);
        return $query->rowCount() === 1;
    }

    private function column(string $setting, string $demoColumn, bool $required = false): ?string
    {
        $key = 'DB_PRODUCT_' . $setting;
        $defaults = ['ID' => 'Trade_Id', 'CODE' => 'Trade_Id', 'NAME' => 'Trade_Name', 'BARCODE' => '', 'CATEGORY' => 'Type_Name', 'UNIT' => 'Unit_Name', 'PRICE' => 'Sale_Price1'];
        $name = $this->config->demo() ? $demoColumn : $this->config->value($key, $defaults[$setting] ?? '');
        if ($required && $name === '') throw new RuntimeException('Missing configuration: ' . $key);

        return $name === '' ? null : self::identifier($name);
    }

    private function configuredTable(): string
    {
        $schema = $this->config->value('DB_PRODUCT_SCHEMA', 'dbo');
        $table = $this->config->value('DB_PRODUCT_TABLE', 'Trade');
        if ($schema === '' || $table === '') throw new RuntimeException('Missing product table configuration');
        return self::identifier($schema) . '.' . self::identifier($table);
    }

    private static function identifier(string $name): string
    {
        if (mb_strlen($name) > 128 || preg_match('/[\x00-\x1F]/', $name)) {
            throw new RuntimeException('Invalid SQL identifier');
        }

        return '[' . str_replace(']', ']]', $name) . ']';
    }
}
