<?php

declare(strict_types=1);

use Sptc\MasterData\Services\ProductImage;
use Sptc\MasterData\Models\ProductRepository;
use Sptc\MasterData\Core\Config;
use Sptc\MasterData\Core\Database;

require dirname(__DIR__) . '/vendor/autoload.php';

$apply = array_key_exists('apply', getopt('', ['apply']) ?: []);
$config = new Config(dirname(__DIR__, 2));
if (!$config->demo() && ($config->value('DB_PRODUCT_SCHEMA', 'dbo') !== 'dbo' || $config->value('DB_PRODUCT_TABLE', 'Trade') !== 'Trade' || $config->value('DB_PRODUCT_ID', 'Trade_Id') !== 'Trade_Id' || $config->value('DB_PRODUCT_CODE', 'Trade_Id') !== 'Trade_Id')) {
    throw new RuntimeException('Migration requires the default dbo.Trade product mapping.');
}
$db = Database::connect($config);
$repo = new ProductRepository($db, $config);
$storage = new ProductImage($config);
$sql = $config->demo()
    ? 'SELECT id, code, image1, image2 FROM products WHERE image1 LIKE ? OR image2 LIKE ?'
    : 'SELECT Trade_Id AS id, Trade_Id AS code, Trade_Image1 AS image1, Trade_Image2 AS image2 FROM dbo.Trade WHERE Trade_Image1 LIKE ? OR Trade_Image2 LIKE ?';
$query = $db->prepare($sql);
$query->execute(['storage/product-images/%', 'storage/product-images/%']);
$changes = [];
foreach ($query->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $id = trim((string) $row['id']);
    $code = trim((string) $row['code']);
    for ($slot = 1; $slot <= 2; $slot++) {
        $old = $row['image' . $slot];
        if (!is_string($old) || !str_starts_with($old, 'storage/product-images/')) continue;
        $short = ProductImage::shortPath($old);
        $file = $storage->path($code, $slot, $old);
        if ($file !== $storage->path($code, $slot, $short) || is_link($file) || !is_file($file)) throw new RuntimeException('A referenced image is missing or invalid; no database paths were changed.');
        $changes[] = ['id' => $id, 'code' => $code, 'slot' => $slot, 'old' => $old, 'new' => $short];
    }
}
fwrite(STDOUT, 'Validated image paths: ' . count($changes) . PHP_EOL);
if (!$apply || $changes === []) exit(0);

$directory = $config->root . '/storage/image-path-backups';
if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('Unable to create backup directory.');
$backup = $directory . '/paths-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(6)) . '.json';
$stream = fopen($backup, 'x');
if ($stream === false) throw new RuntimeException('Unable to create backup file.');
try {
    $json = json_encode(['database' => $config->demo() ? 'demo' : $config->required('DB_DATABASE'), 'changes' => $changes], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    if (fwrite($stream, $json) !== strlen($json) || !fflush($stream)) throw new RuntimeException('Unable to write backup file.');
} finally {
    fclose($stream);
}
@chmod($backup, 0600);
fwrite(STDOUT, 'Backup: ' . $backup . PHP_EOL);
$db->beginTransaction();
try {
    foreach ($changes as $change) {
        if (!$repo->updateImage($change['id'], $change['code'], $change['slot'], $change['old'], $change['new'])) throw new RuntimeException('Image path changed concurrently; migration rolled back.');
        $current = $repo->imageState($change['id']);
        if ($current === null || $current['image' . $change['slot']] !== $change['new']) throw new RuntimeException('Image path could not be saved exactly; migration rolled back.');
    }
    $db->commit();
} catch (Throwable $error) {
    if ($db->inTransaction()) $db->rollBack();
    throw $error;
}
fwrite(STDOUT, 'Image paths updated: ' . count($changes) . PHP_EOL);
