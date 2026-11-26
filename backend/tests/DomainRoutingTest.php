<?php

declare(strict_types=1);

use Sptc\MasterData\Core\Config;
use Sptc\MasterData\Middleware\Cors;
use Sptc\MasterData\Middleware\HostGuard;
use Sptc\MasterData\Models\ProductRepository;
use Sptc\MasterData\Models\WebsiteImageRepository;
use Sptc\MasterData\Services\Session;

it('chooses SameSite=Lax for production domains and SameSite=None; Secure for *.localhost subdomains', function () {
    $root = sys_get_temp_dir() . '/sptc-cookie-' . bin2hex(random_bytes(8));
    mkdir($root, 0700, true);
    $prevHttps = $_ENV['APP_HTTPS'] ?? null;

    try {
        $_ENV['APP_HTTPS'] = 'true';
        $config = new Config($root);
        expect(Session::cookiePolicy($config, 'api.example.com'))->toBe(['secure' => true, 'samesite' => 'Lax']);

        $_ENV['APP_HTTPS'] = 'false';
        expect(Session::cookiePolicy($config, 'api.localhost:8094'))->toBe(['secure' => true, 'samesite' => 'None'])
            ->and(Session::cookiePolicy($config, 'localhost:8094'))->toBe(['secure' => false, 'samesite' => 'Lax']);
    } finally {
        if ($prevHttps === null) unset($_ENV['APP_HTTPS']); else $_ENV['APP_HTTPS'] = $prevHttps;
        rmdir($root);
    }
});

it('validates CORS origins strictly per customer and admin scope', function () {
    $root = sys_get_temp_dir() . '/sptc-cors-' . bin2hex(random_bytes(8));
    mkdir($root, 0700, true);
    $keys = ['APP_HTTPS', 'CUSTOMER_ORIGINS', 'ADMIN_ORIGINS'];
    $prev = [];
    foreach ($keys as $key) $prev[$key] = $_ENV[$key] ?? null;

    try {
        $_ENV['APP_HTTPS'] = 'true';
        $_ENV['CUSTOMER_ORIGINS'] = 'https://example.com, https://WWW.Example.com:443';
        $_ENV['ADMIN_ORIGINS'] = 'https://admin.example.com/';
        $config = new Config($root);

        expect(Cors::configuredOrigins($config, 'customer'))->toBe(['https://example.com', 'https://www.example.com'])
            ->and(Cors::configuredOrigins($config, 'admin'))->toBe(['https://admin.example.com'])
            ->and(Cors::isAllowed($config, 'customer', 'https://example.com'))->toBeTrue()
            ->and(Cors::isAllowed($config, 'customer', 'https://www.example.com'))->toBeTrue()
            ->and(Cors::isAllowed($config, 'customer', 'https://admin.example.com'))->toBeFalse()
            ->and(Cors::isAllowed($config, 'admin', 'https://admin.example.com'))->toBeTrue()
            ->and(Cors::isAllowed($config, 'admin', 'https://example.com'))->toBeFalse()
            ->and(Cors::isAllowed($config, 'admin', 'https://evil.example.com'))->toBeFalse();

        // Fail-closed in production when origins are not configured; local HTTP defaults allowed when APP_HTTPS=false
        $_ENV['CUSTOMER_ORIGINS'] = '';
        $_ENV['ADMIN_ORIGINS'] = '';
        expect(Cors::isAllowed($config, 'admin', 'http://admin.localhost:8094'))->toBeFalse();
        $_ENV['APP_HTTPS'] = 'false';
        expect(Cors::isAllowed($config, 'admin', 'http://admin.localhost:8094'))->toBeTrue()
            ->and(Cors::isAllowed($config, 'customer', 'http://shop.localhost:8094'))->toBeTrue()
            ->and(Cors::isAllowed($config, 'admin', 'http://shop.localhost:8094'))->toBeFalse();
    } finally {
        foreach ($prev as $key => $value) {
            if ($value === null) unset($_ENV[$key]); else $_ENV[$key] = $value;
        }
        rmdir($root);
    }
});

it('parses and normalizes allowed domain hosts for customer and admin scopes', function () {
    $root = sys_get_temp_dir() . '/sptc-hosts-' . bin2hex(random_bytes(8));
    mkdir($root, 0700, true);
    $prevCustomer = $_ENV['CUSTOMER_HOSTS'] ?? null;
    $prevAdmin = $_ENV['ADMIN_HOSTS'] ?? null;
    $prevHttpHost = $_SERVER['HTTP_HOST'] ?? null;

    try {
        $_ENV['CUSTOMER_HOSTS'] = 'WWW.Example.com, example.com:443, bad host, 127.0.0.1:8094';
        $_ENV['ADMIN_HOSTS'] = 'Admin.Example.com.';
        $config = new Config($root);

        expect(HostGuard::allowedHosts($config, 'customer'))->toBe(['www.example.com', 'example.com', '127.0.0.1'])
            ->and(HostGuard::allowedHosts($config, 'admin'))->toBe(['admin.example.com']);

        $_SERVER['HTTP_HOST'] = 'ADMIN.example.com:443';
        expect(HostGuard::requestHost())->toBe('admin.example.com');
        HostGuard::verify($config, 'admin');

        $_SERVER['HTTP_HOST'] = 'www.example.com';
        HostGuard::verify($config, 'customer');
    } finally {
        if ($prevCustomer === null) unset($_ENV['CUSTOMER_HOSTS']); else $_ENV['CUSTOMER_HOSTS'] = $prevCustomer;
        if ($prevAdmin === null) unset($_ENV['ADMIN_HOSTS']); else $_ENV['ADMIN_HOSTS'] = $prevAdmin;
        if ($prevHttpHost === null) unset($_SERVER['HTTP_HOST']); else $_SERVER['HTTP_HOST'] = $prevHttpHost;
        rmdir($root);
    }
});

it('returns only active storefront website images and public product catalog items', function () {
    $db = new PDO('sqlite::memory:', options: [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $schema = file_get_contents(dirname(__DIR__, 2) . '/database/demo.sql');
    expect($schema)->not->toBeFalse();
    $db->exec((string) $schema);

    $bannerRepo = WebsiteImageRepository::for($db, true, 'promo-banner');
    $bannerRepo->add('แบนเนอร์ปิด', 0, 'https://shop.localhost/website-images/promo-banner/hidden.jpg');
    $bannerRepo->add('แบนเนอร์เปิด', 1, 'https://shop.localhost/website-images/promo-banner/visible.jpg');

    $active = $bannerRepo->activeItems();
    expect($active)->toHaveCount(1)
        ->and($active[0]['title'])->toBe('แบนเนอร์เปิด');

    $prevMode = $_ENV['APP_MODE'] ?? null;
    $_ENV['APP_MODE'] = 'demo';
    try {
        $db->exec("INSERT INTO products (code, name, category, unit, price, note, short_note, image1, image2)
            VALUES ('SP-0001', 'กระเบื้อง', 'กระเบื้อง', 'กล่อง', '329.00', 'คำอธิบายเต็ม', 'คำอธิบายย่อ', 'SP-0001/tile.jpg', 'https://cdn.example.com/tile2.webp')");
        $products = new ProductRepository($db, new Config(dirname(__DIR__, 2)));
        $search = $products->publicSearch('กระเบื้อง', 1);
        expect($search['total'])->toBe(1)
            ->and($search['items'][0])->toMatchArray([
                'code' => 'SP-0001',
                'name' => 'กระเบื้อง',
                'price' => '329.00',
                'image1' => 'SP-0001/tile.jpg',
                'image2' => 'https://cdn.example.com/tile2.webp',
            ]);

        $detail = $products->publicItem((string) $search['items'][0]['id']);
        expect($detail)->not->toBeNull()
            ->and($detail['shortNote'])->toBe('คำอธิบายย่อ')
            ->and($detail['note'])->toBe('คำอธิบายเต็ม');
    } finally {
        if ($prevMode === null) unset($_ENV['APP_MODE']); else $_ENV['APP_MODE'] = $prevMode;
    }
});
