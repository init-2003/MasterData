<?php

declare(strict_types=1);

use Sptc\MasterData\Core\Config;
use Sptc\MasterData\Core\Database;

require dirname(__DIR__) . '/vendor/autoload.php';

$config = new Config(dirname(__DIR__, 2));
if (!$config->demo()) {
    fwrite(STDERR, "Set APP_MODE=demo before seeding sample data.\n");
    exit(1);
}

$schema = file_get_contents($config->root . '/database/demo.sql');
if ($schema === false) {
    throw new RuntimeException('Demo schema was not found.');
}
$db = Database::connect($config);
$db->exec($schema);
$columnQuery = $db->query('PRAGMA table_info(products)');
if ($columnQuery === false) throw new RuntimeException('Unable to inspect demo products');
$columns = $columnQuery->fetchAll(PDO::FETCH_COLUMN, 1);
foreach (['image1', 'image2', 'note', 'short_note'] as $column) {
    if (!in_array($column, $columns, true)) $db->exec("ALTER TABLE products ADD COLUMN {$column} TEXT");
}
$products = [
    ['กระเบื้องพอร์ซเลน ลายหิน 60 × 60 ซม.', 'กระเบื้อง', 'กล่อง', '329.00'],
    ['กาวซีเมนต์ปูกระเบื้อง 20 กก.', 'วัสดุก่อสร้าง', 'ถุง', '245.00'],
    ['แปรงทาสีด้ามไม้ 2 นิ้ว', 'อุปกรณ์งานสี', 'ด้าม', '49.00'],
    ['สีอะคริลิกภายนอก สีขาว 1 แกลลอน', 'อุปกรณ์งานสี', 'แกลลอน', '695.00'],
    ['ท่อพีวีซีสีฟ้า 1/2 นิ้ว', 'งานประปา', 'เส้น', '65.00'],
    ['ข้องอพีวีซี 90° 1/2 นิ้ว', 'งานประปา', 'ชิ้น', '12.00'],
    ['สว่านไฟฟ้า 650 วัตต์', 'เครื่องมือช่าง', 'เครื่อง', '1790.00'],
    ['คีมปากจิ้งจก 8 นิ้ว', 'เครื่องมือช่าง', 'ชิ้น', '159.00'],
    ['ตลับเมตร 5 เมตร', 'เครื่องมือช่าง', 'ชิ้น', '119.00'],
    ['ไขควงปากแฉก #2', 'เครื่องมือช่าง', 'ด้าม', '55.00'],
    ['ถุงมือช่างเคลือบยาง', 'อุปกรณ์ป้องกัน', 'คู่', '39.00'],
    ['แว่นตานิรภัยเลนส์ใส', 'อุปกรณ์ป้องกัน', 'ชิ้น', '79.00'],
    ['ปลั๊กพ่วง 3 ช่อง 3 เมตร', 'งานไฟฟ้า', 'ชุด', '289.00'],
    ['หลอดไฟ LED 9 วัตต์', 'งานไฟฟ้า', 'หลอด', '69.00'],
    ['สายไฟ VAF 2 × 1.5 ตร.มม.', 'งานไฟฟ้า', 'ม้วน', '1390.00'],
    ['แผ่นยิปซัม 9 มม.', 'วัสดุก่อสร้าง', 'แผ่น', '175.00'],
    ['สกรูเกลียวปล่อย 25 มม.', 'วัสดุก่อสร้าง', 'กล่อง', '85.00'],
    ['เทปพันเกลียว 12 มม.', 'งานประปา', 'ม้วน', '15.00'],
];

$query = $db->prepare('INSERT OR IGNORE INTO products (code, name, barcode, category, unit, price) VALUES (?, ?, ?, ?, ?, ?)');
$typeQuery = $db->prepare('INSERT OR IGNORE INTO types (name) VALUES (?)');
$unitQuery = $db->prepare('INSERT OR IGNORE INTO units (name) VALUES (?)');
$db->beginTransaction();
foreach ($products as $index => [$name, $category, $unit, $price]) {
    $query->execute([sprintf('SP-%04d', $index + 1), $name, sprintf('885000000%04d', $index + 1), $category, $unit, $price]);
    $typeQuery->execute([$category]);
    $unitQuery->execute([$unit]);
}
$typeQuery->execute(['ประเภทตัวอย่างที่ยังไม่มีสินค้า']);
$unitQuery->execute(['หน่วยตัวอย่างที่ยังไม่มีสินค้า']);
$db->commit();
fwrite(STDOUT, "Sample catalog prepared. Create a demo user with backend/bin/create-demo-user.php.\n");
