<?php

declare(strict_types=1);

use Sptc\MasterData\Services\ProductImage;
use Sptc\MasterData\Core\Config;
use Sptc\MasterData\Core\Database;

require getcwd() . '/backend/vendor/autoload.php';
$config = new Config(getcwd());
if (!$config->demo()) throw new RuntimeException('Demo mode required');
$source = tempnam(sys_get_temp_dir(), 'sptc-png-');
if ($source === false) throw new RuntimeException('Unable to create image fixture');
try {
    $image = imagecreatetruecolor(2, 2);
    if ($image === false || !imagepng($image, $source)) throw new RuntimeException('Unable to create image fixture');
    $relative = (new ProductImage($config))->save('SP-0018', 1, $source, 'image-1-' . bin2hex(random_bytes(12)) . '.png');
    $query = Database::connect($config)->prepare('UPDATE products SET image1 = ? WHERE code = ?');
    $query->execute([ProductImage::oldPath($relative), 'SP-0018']);
    if ($query->rowCount() !== 1) throw new RuntimeException('Missing fixture product');
} finally {
    unlink($source);
}
