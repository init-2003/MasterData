<?php

declare(strict_types=1);

use Sptc\MasterData\Core\Config;
use Sptc\MasterData\Services\Login;
use Sptc\MasterData\Models\ProductRepository;
use Sptc\MasterData\Services\ProductImage;
use Sptc\MasterData\Models\UserRepository;

it('reads certificate trust settings safely', function () {
    $config = new Config(dirname(__DIR__, 2));
    foreach (['true' => true, 'TRUE' => true, '1' => true, 'false' => false, '0' => false, 'invalid' => false] as $value => $expected) {
        $_ENV['SPTC_TEST_BOOLEAN'] = (string) $value;
        expect($config->boolean('SPTC_TEST_BOOLEAN'))->toBe($expected);
    }
    unset($_ENV['SPTC_TEST_BOOLEAN']);
});

it('validates credentials consistently for setup and login', function () {
    expect(Login::valid('admin.local', 'correct password'))->toBeTrue()
        ->and(Login::valid('ผู้ใช้งาน', 'กขค'))->toBeTrue()
        ->and(Login::valid('', 'correct password'))->toBeFalse()
        ->and(Login::valid('admin.local', ''))->toBeFalse()
        ->and(Login::valid('admin.local', str_repeat('ก', 51)))->toBeFalse()
        ->and(Login::valid('admin.local', "password\0value"))->toBeFalse();
});

it('verifies only active users and persists a password hash', function () {
    $db = testDatabase();
    $users = new UserRepository($db, true);
    $db->prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')->execute(['store.operator', password_hash('correct password', PASSWORD_DEFAULT)]);
    expect($db->query('SELECT password_hash FROM users')->fetchColumn())->not->toBe('correct password')
        ->and($users->verify('STORE.OPERATOR', 'correct password'))->toBe(['username' => 'store.operator'])
        ->and($users->verify('store.operator', 'wrong password'))->toBeNull()
        ->and($users->verify('unknown.user', 'correct password'))->toBeNull();
    $db->exec('UPDATE users SET is_active = 0');
    expect($users->verify('store.operator', 'correct password'))->toBeNull();
});

it('finds Thai names and literal wildcards, and paginates deterministically', function () {
    $db = testDatabase();
    $previousMode = $_ENV['APP_MODE'] ?? null;
    $_ENV['APP_MODE'] = 'demo';
    try {
        $products = new ProductRepository($db, new Config(dirname(__DIR__, 2)));
        $insert = $db->prepare('INSERT INTO products (code, name, barcode, category, unit, price) VALUES (?, ?, ?, ?, ?, ?)');
        for ($index = 1; $index <= 16; $index++) {
            $insert->execute([sprintf('P-%02d', $index), 'สินค้าตัวอย่าง', '885' . $index, 'ประเภท', 'ชิ้น', '15.50']);
        }
        $insert->execute(['A_%[!', 'พิเศษ', '9999', null, null, null]);
        $db->exec("INSERT INTO types (name) VALUES ('ประเภท'), ('ไม่มีสินค้า')");
        $db->exec("INSERT INTO units (name) VALUES ('ชิ้น'), ('ไม่มีสินค้า')");

        expect($products->search('สินค้าตัวอย่าง', 1)['total'])->toBe(16)
            ->and($products->search('', 1)['pageSize'])->toBe(50)
            ->and($products->search('_%[!', 1)['total'])->toBe(1)
            ->and($products->search('9999', 1)['items'][0]['code'])->toBe('A_%[!')
            ->and($products->search('', 1, '', '', 15)['items'])->toHaveCount(15)
            ->and($products->search('', 9, '', '', 15)['page'])->toBe(2)
            ->and($products->search('', 2, '', '', 15)['items'])->toHaveCount(2)
            ->and($products->search('ไม่พบ', 1)['total'])->toBe(0)
            ->and($products->types())->toContain('ประเภท', 'ไม่มีสินค้า')
            ->and($products->units())->toContain('ชิ้น', 'ไม่มีสินค้า')
            ->and($products->search('สินค้าตัวอย่าง', 2, 'ประเภท', '', 15)['items'])->toHaveCount(1)
            ->and($products->search('พิเศษ', 1, 'ประเภท')['total'])->toBe(0)
            ->and($products->search('', 1, 'ไม่มีสินค้า')['total'])->toBe(0)
            ->and($products->search('สินค้าตัวอย่าง', 2, 'ประเภท', 'ชิ้น', 15)['items'])->toHaveCount(1)
            ->and($products->search('', 1, '', 'ไม่มีสินค้า')['total'])->toBe(0);
    } finally {
        if ($previousMode === null) {
            unset($_ENV['APP_MODE']);
        } else {
            $_ENV['APP_MODE'] = $previousMode;
        }
    }
});

it('updates only the price and rejects stale values', function () {
    $db = testDatabase();
    $db->exec("INSERT INTO products (code, name, price) VALUES ('P1', 'สินค้า', '15.50')");
    $previousMode = $_ENV['APP_MODE'] ?? null;
    $_ENV['APP_MODE'] = 'demo';
    try {
        $products = new ProductRepository($db, new Config(dirname(__DIR__, 2)));
        expect($products->updatePrice('1', '15.50', '19.25'))->toBeTrue()
            ->and($products->updatePrice('1', '15.50', '20.00'))->toBeFalse()
            ->and($db->query('SELECT price FROM products')->fetchColumn())->toBe('19.25')
            ->and($db->query('SELECT name FROM products')->fetchColumn())->toBe('สินค้า')
            ->and($products->updateImage('1', 'P1', 1, null, 'first.png'))->toBeTrue()
            ->and($products->updateImage('1', 'P1', 2, null, 'second.png'))->toBeTrue()
            ->and($products->updateImage('1', 'P1', 1, null, 'stale.png'))->toBeFalse()
            ->and($products->updateImage('1', 'wrong', 1, 'first.png', 'stale.png'))->toBeFalse()
            ->and($products->findImagePath('first.png'))->toBe(['code' => 'P1', 'slot' => 1])
            ->and($products->findImagePath('storage/product-images/first.png'))->toBe(['code' => 'P1', 'slot' => 1])
            ->and($products->findImagePath('second.png'))->toBe(['code' => 'P1', 'slot' => 2])
            ->and($products->findImagePath('unknown.png'))->toBeNull()
            ->and($products->imageState('1'))->toBe(['code' => 'P1', 'image1' => 'first.png', 'image2' => 'second.png']);
    } finally {
        if ($previousMode === null) unset($_ENV['APP_MODE']);
        else $_ENV['APP_MODE'] = $previousMode;
    }
});

it('reads and updates short notes without overwriting concurrent changes or the full note', function () {
    $db = testDatabase();
    $db->exec("INSERT INTO products (code, name, note) VALUES ('P1', 'สินค้า', 'คำอธิบายเต็ม')");
    $previousMode = $_ENV['APP_MODE'] ?? null;
    $_ENV['APP_MODE'] = 'demo';
    try {
        $products = new ProductRepository($db, new Config(dirname(__DIR__, 2)));
        expect($products->note('1', true))->toBe(['note' => null])
            ->and($products->updateNote('1', null, 'ข้อความสั้น', true))->toBeTrue()
            ->and($products->updateNote('1', null, 'ข้อมูลเก่า', true))->toBeFalse()
            ->and($products->note('1', true))->toBe(['note' => 'ข้อความสั้น'])
            ->and($products->note('1'))->toBe(['note' => 'คำอธิบายเต็ม']);
    } finally {
        if ($previousMode === null) unset($_ENV['APP_MODE']);
        else $_ENV['APP_MODE'] = $previousMode;
    }
});

it('validates images and preserves the previous image when replacement is invalid', function () {
    $root = sys_get_temp_dir() . '/sptc-image-' . bin2hex(random_bytes(8));
    mkdir($root, 0700, true);
    $source = $root . '/source.png';
    $bad = $root . '/bad.png';
    $image = imagecreatetruecolor(2, 2);
    imagepng($image, $source);
    file_put_contents($bad, 'not an image');
    $previous = $_ENV['APP_MODE'] ?? null;
    $_ENV['APP_MODE'] = 'demo';
    try {
        $storage = new ProductImage(new Config($root));
        expect(ProductImage::folder('011003.'))->toBe('011003%2E')
            ->and(ProductImage::folder('011003%2E'))->toBe('011003%252E')
            ->and(ProductImage::folder('../product'))->toBe('..%2Fproduct');
        $relative = $storage->save('011003.', 1, $source, 'tile.jpg');
        $path = $storage->path('011003.', 1, $relative);
        expect($relative)->toBe('011003%2E/tile.png')
            ->and($storage->path('011003.', 1, 'storage/product-images/' . $relative))->toBe($path);
        $second = $storage->save('011003.', 2, $source, 'tile.png');
        $secondPath = $storage->path('011003.', 2, $second);
        expect($second)->toBe('011003%2E/tile-1.png');
        $third = $storage->save('011003.', 2, $source, 'TILE.webp');
        $thirdPath = $storage->path('011003.', 2, $third);
        expect($third)->toBe('011003%2E/TILE-2.png');
        $original = file_get_contents($path);
        expect($original)->not->toBeFalse();
        expect(fn () => $storage->save('011003.', 1, $bad, 'bad.png'))->toThrow(InvalidArgumentException::class);
        expect(fn () => $storage->path('011003.', 2, '011003%2E/../.env'))->toThrow(InvalidArgumentException::class);
        expect(file_get_contents($path))->toBe($original);
    } finally {
        if ($previous === null) unset($_ENV['APP_MODE']); else $_ENV['APP_MODE'] = $previous;
        if (isset($path) && is_file($path)) unlink($path);
        if (isset($secondPath) && is_file($secondPath)) unlink($secondPath);
        if (isset($thirdPath) && is_file($thirdPath)) unlink($thirdPath);
        if (is_file($root . '/var/demo/product-images/011003%2E/.upload.lock')) unlink($root . '/var/demo/product-images/011003%2E/.upload.lock');
        if (is_dir($root . '/var/demo/product-images/011003%2E')) rmdir($root . '/var/demo/product-images/011003%2E');
        if (is_dir($root . '/var/demo/product-images')) rmdir($root . '/var/demo/product-images');
        if (is_dir($root . '/var/demo')) rmdir($root . '/var/demo');
        if (is_dir($root . '/var')) rmdir($root . '/var');
        unlink($source);
        unlink($bad);
        rmdir($root);
    }
});

function testDatabase(): PDO
{
    $db = new PDO('sqlite::memory:', options: [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $db->exec(file_get_contents(dirname(__DIR__, 2) . '/database/demo.sql'));

    return $db;
}
