<?php

declare(strict_types=1);

use Sptc\MasterData\Core\Config;
use Sptc\MasterData\Models\ProductRepository;
use Sptc\MasterData\Services\ProductImage;
use Sptc\MasterData\Services\ProductImageUrl;

it('builds, parses, and looks up clean product image URLs and legacy paths', function () {
    $root = sys_get_temp_dir() . '/sptc-prod-url-' . bin2hex(random_bytes(8));
    mkdir($root, 0700, true);
    $envKeys = ['APP_MODE', 'APP_HTTPS', 'APP_PUBLIC_ORIGIN', 'APP_BASE_PATH', 'WEBSITE_ALLOWED_IMAGE_HOSTS'];
    $previous = [];
    foreach ($envKeys as $key) {
        $previous[$key] = $_ENV[$key] ?? null;
    }

    try {
        $_ENV['APP_MODE'] = 'production';
        $_ENV['APP_HTTPS'] = 'true';
        $_ENV['APP_PUBLIC_ORIGIN'] = 'https://assets.example.com';
        $_ENV['APP_BASE_PATH'] = '/master-data';
        $_ENV['WEBSITE_ALLOWED_IMAGE_HOSTS'] = 'cdn.example.com';

        $config = new Config($root);
        $images = new ProductImage($config);
        $urls = new ProductImageUrl($config, $images);

        expect($urls->publicImageBase())->toBe('https://assets.example.com/master-data/product-images');

        $full = $urls->managedPublicUrl('011003%2E/tile 1.jpg');
        expect($full)->toBe('https://assets.example.com/master-data/product-images/011003%252E/tile%201.jpg')
            ->and($urls->parseManagedRelative('011003.', (string) $full))->toBe('011003%2E/tile 1.jpg')
            ->and($urls->parseManagedRelative('OTHER', (string) $full))->toBeNull()
            ->and($urls->parseManagedRelative('011003.', '011003%2E/tile 1.jpg'))->toBe('011003%2E/tile 1.jpg')
            ->and($urls->parseManagedRelative('011003.', 'storage/product-images/011003%2E/tile 1.jpg'))->toBe('011003%2E/tile 1.jpg')
            ->and($urls->lookupCandidates('011003%2E/tile 1.jpg'))->toContain(
                '011003%2E/tile 1.jpg',
                'storage/product-images/011003%2E/tile 1.jpg',
                (string) $full,
            );

        expect($urls->describe('011003.', (string) $full))->toBe([
            'sourceType' => 'upload',
            'managedRelative' => '011003%2E/tile 1.jpg',
            'previewUrl' => null,
            'imageUrl' => (string) $full,
        ])->and($urls->describe('011003.', 'https://cdn.example.com/tile.webp'))->toBe([
            'sourceType' => 'url',
            'managedRelative' => null,
            'previewUrl' => 'https://cdn.example.com/tile.webp',
            'imageUrl' => 'https://cdn.example.com/tile.webp',
        ]);

        // Enforces VARCHAR(200) ASCII byte length including percent-encoding of non-ASCII path characters
        expect($urls->validateExternalUrl('https://cdn.example.com/รูป.jpg', 200, false))
            ->toBe(['url' => 'https://cdn.example.com/%E0%B8%A3%E0%B8%B9%E0%B8%9B.jpg', 'error' => null])
            ->and($urls->validateExternalUrl('https://cdn.example.com/' . str_repeat('a', 190) . '.jpg', 200, false))
            ->toBe(['url' => null, 'error' => 'image_url_too_long'])
            ->and($urls->validateExternalUrl('https://sub.cdn.example.com/tile.jpg', 200, false))
            ->toBe(['url' => null, 'error' => 'image_host_not_allowed']);

        // When WEBSITE_ALLOWED_IMAGE_HOSTS is empty, any valid HTTP/HTTPS URL <= 200 bytes is accepted
        $_ENV['WEBSITE_ALLOWED_IMAGE_HOSTS'] = '';
        expect($urls->validateExternalUrl('http://127.0.0.1:8094/product-images/SP-0001/a.jpg', 200, false))
            ->toBe(['url' => 'http://127.0.0.1:8094/product-images/SP-0001/a.jpg', 'error' => null]);
    } finally {
        foreach ($previous as $key => $value) {
            if ($value === null) unset($_ENV[$key]);
            else $_ENV[$key] = $value;
        }
        rmdir($root);
    }
});

it('looks up products by full clean product image URLs and reports VARCHAR(200) spec in demo mode', function () {
    $db = new PDO('sqlite::memory:', options: [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $schema = file_get_contents(dirname(__DIR__, 2) . '/database/demo.sql');
    expect($schema)->not->toBeFalse();
    $db->exec((string) $schema);
    $db->exec("INSERT INTO products (code, name, price) VALUES ('SP-0001', 'สินค้า', '10.00')");

    $previousMode = $_ENV['APP_MODE'] ?? null;
    $_ENV['APP_MODE'] = 'demo';
    try {
        $repo = new ProductRepository($db, new Config(dirname(__DIR__, 2)));
        expect($repo->imageColumnSpec(1))->toBe(['maxLength' => 200, 'utf16' => false])
            ->and($repo->imageColumnSpec(2))->toBe(['maxLength' => 200, 'utf16' => false]);

        $cleanUrl = 'https://assets.example.com/master-data/product-images/SP-0001/photo.jpg';
        expect($repo->updateImage('1', 'SP-0001', 1, null, $cleanUrl))->toBeTrue()
            ->and($repo->findImagePath('SP-0001/photo.jpg', ['SP-0001/photo.jpg', $cleanUrl]))->toBe(['code' => 'SP-0001', 'slot' => 1])
            ->and($repo->findImagePath('SP-0001/other.jpg', ['SP-0001/other.jpg']))->toBeNull();
    } finally {
        if ($previousMode === null) unset($_ENV['APP_MODE']);
        else $_ENV['APP_MODE'] = $previousMode;
    }
});
