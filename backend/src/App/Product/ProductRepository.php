<?php

declare(strict_types=1);

namespace Sptc\MasterData\App\Product;

use Sptc\MasterData\Infrastructure\Config;

use PDO;
use RuntimeException;

final readonly class ProductRepository
{
    public const PAGE_SIZE = 15;

    public function __construct(private PDO $database, private Config $config)
    {
    }

    /** @return array{items: list<array<string, string|null>>, page: int, pageSize: int, total: int, totalPages: int} */
    public function search(string $search, int $page, string $type = '', string $selectedUnit = ''): array
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
        $size = self::PAGE_SIZE;
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

    /** @return array{code:string,slot:int}|null */
    public function findImagePath(string $path): ?array
    {
        $table = $this->config->demo() ? '[products]' : $this->configuredTable();
        $codeColumn = $this->column('CODE', 'code', true);
        $first = $this->config->demo() ? '[image1]' : '[Trade_Image1]';
        $second = $this->config->demo() ? '[image2]' : '[Trade_Image2]';
        $short = ProductImage::shortPath($path);
        $old = ProductImage::oldPath($path);
        $query = $this->database->prepare("SELECT {$codeColumn} AS [code], {$first} AS [image1], {$second} AS [image2] FROM {$table} WHERE {$first} IN (?, ?) OR {$second} IN (?, ?)");
        $query->execute([$short, $old, $short, $old]);
        foreach ($query->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if (!is_array($row) || !is_string($row['code'] ?? null)) continue;
            if (in_array($row['image1'] ?? null, [$short, $old], true)) return ['code' => trim($row['code']), 'slot' => 1];
            if (in_array($row['image2'] ?? null, [$short, $old], true)) return ['code' => trim($row['code']), 'slot' => 2];
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
