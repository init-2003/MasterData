<?php

declare(strict_types=1);

use Sptc\MasterData\Core\Config;
use Sptc\MasterData\Models\CustomerLevelRepository;
use Sptc\MasterData\Models\WebsiteImageRepository;
use Sptc\MasterData\Services\ProductImage;
use Sptc\MasterData\Services\WebsiteImageUrl;

it('builds and parses full public URLs for uploaded website images including subpaths and legacy paths', function () {
    $root = sys_get_temp_dir() . '/sptc-web-url-' . bin2hex(random_bytes(8));
    mkdir($root, 0700, true);
    $envKeys = ['APP_MODE', 'APP_HTTPS', 'APP_PUBLIC_ORIGIN', 'APP_BASE_PATH', 'WEBSITE_ALLOWED_IMAGE_HOSTS', 'WEBSITE_LEGACY_IMAGE_BASE_URL'];
    $previous = [];
    foreach ($envKeys as $key) {
        $previous[$key] = $_ENV[$key] ?? null;
    }

    try {
        $_ENV['APP_MODE'] = 'production';
        $_ENV['APP_HTTPS'] = 'true';
        $_ENV['APP_PUBLIC_ORIGIN'] = 'https://Assets.Example.com/';
        $_ENV['APP_BASE_PATH'] = '/master-data/';
        $_ENV['WEBSITE_ALLOWED_IMAGE_HOSTS'] = 'CDN.Example.com, images.example.com.';
        $_ENV['WEBSITE_LEGACY_IMAGE_BASE_URL'] = 'https://legacy.example.com/images';

        $config = new Config($root);
        $images = new ProductImage($config, 'website-images');
        $urls = new WebsiteImageUrl($config, $images);

        expect($urls->publicOrigin())->toBe('https://assets.example.com')
            ->and($urls->basePath())->toBe('/master-data')
            ->and($urls->publicImageBase())->toBe('https://assets.example.com/master-data/website-images')
            ->and($urls->allowedHosts())->toBe(['cdn.example.com', 'images.example.com']);

        $full = $urls->managedPublicUrl('promo-banner', 'โปรโมชัน 50%25+1.jpg');
        expect($full)->toBe('https://assets.example.com/master-data/website-images/promo-banner/%E0%B9%82%E0%B8%9B%E0%B8%A3%E0%B9%82%E0%B8%A1%E0%B8%8A%E0%B8%B1%E0%B8%99%2050%2525%2B1.jpg')
            ->and($urls->parseManagedFilename('promo-banner', (string) $full))->toBe('โปรโมชัน 50%25+1.jpg')
            ->and($urls->parseManagedFilename('promo-sale', (string) $full))->toBeNull()
            ->and($urls->parseManagedFilename('promo-banner', 'https://assets.example.com/master-data/api.php?website-image=promo-banner/old-query.jpg'))->toBe('old-query.jpg')
            ->and($urls->parseManagedFilename('promo-banner', 'website-images/promo-banner/old-banner.png'))->toBe('old-banner.png')
            ->and($urls->parseManagedFilename('promo-banner', 'website-images/promo-banner/../secret.png'))->toBeNull();

        expect($urls->describe('promo-banner', (string) $full))->toBe([
            'sourceType' => 'upload',
            'managedFilename' => 'โปรโมชัน 50%25+1.jpg',
            'previewUrl' => null,
            'imageUrl' => (string) $full,
        ])->and($urls->describe('promo-banner', 'website-images/promo-banner/old-banner.png'))->toBe([
            'sourceType' => 'upload',
            'managedFilename' => 'old-banner.png',
            'previewUrl' => null,
            'imageUrl' => null,
        ])->and($urls->describe('promo-banner', 'legacy banner.jpg'))->toBe([
            'sourceType' => 'legacy',
            'managedFilename' => null,
            'previewUrl' => 'https://legacy.example.com/images/legacy%20banner.jpg',
            'imageUrl' => null,
        ]);

        // Reject HTTP origin when APP_HTTPS=true, allow when APP_HTTPS=false
        $_ENV['APP_PUBLIC_ORIGIN'] = 'http://127.0.0.1:8094';
        expect($urls->publicOrigin())->toBeNull();
        $_ENV['APP_HTTPS'] = 'false';
        expect($urls->publicOrigin())->toBe('http://127.0.0.1:8094');

        // Reject invalid base paths
        $_ENV['APP_BASE_PATH'] = '/master-data/../other';
        expect($urls->basePath())->toBeNull()
            ->and($urls->publicEndpointBase())->toBeNull();
    } finally {
        foreach ($previous as $key => $value) {
            if ($value === null) unset($_ENV[$key]);
            else $_ENV[$key] = $value;
        }
        rmdir($root);
    }
});

it('validates external HTTPS image URLs against allowed hosts and column length', function () {
    $root = sys_get_temp_dir() . '/sptc-ext-url-' . bin2hex(random_bytes(8));
    mkdir($root, 0700, true);
    $previousHosts = $_ENV['WEBSITE_ALLOWED_IMAGE_HOSTS'] ?? null;

    try {
        $_ENV['WEBSITE_ALLOWED_IMAGE_HOSTS'] = 'cdn.example.com, 127.0.0.1, *.wildcard.com, images.example.com';
        $config = new Config($root);
        $urls = new WebsiteImageUrl($config, new ProductImage($config, 'website-images'));

        expect($urls->allowedHosts())->toBe(['cdn.example.com', 'images.example.com'])
            ->and($urls->validateExternalUrl('https://CDN.Example.com/banners/sale.webp?w=1200', 255))
            ->toBe(['url' => 'https://cdn.example.com/banners/sale.webp?w=1200', 'error' => null])
            ->and($urls->validateExternalUrl('http://CDN.Example.com/banners/sale.webp', 255))
            ->toBe(['url' => 'http://cdn.example.com/banners/sale.webp', 'error' => null])
            ->and($urls->validateExternalUrl('ftp://cdn.example.com/banners/sale.webp', 255))
            ->toBe(['url' => null, 'error' => 'invalid_image_url'])
            ->and($urls->validateExternalUrl('data:image/png;base64,AAAA', 255))
            ->toBe(['url' => null, 'error' => 'invalid_image_url'])
            ->and($urls->validateExternalUrl('https://user:pass@cdn.example.com/banners/sale.webp', 255))
            ->toBe(['url' => null, 'error' => 'invalid_image_url'])
            ->and($urls->validateExternalUrl('https://cdn.example.com/banners/sale.webp#hash', 255))
            ->toBe(['url' => null, 'error' => 'invalid_image_url'])
            ->and($urls->validateExternalUrl('https://cdn.example.com:8443/banners/sale.webp', 255))
            ->toBe(['url' => 'https://cdn.example.com:8443/banners/sale.webp', 'error' => null])
            ->and($urls->validateExternalUrl('https://cdn.example.com/', 255))
            ->toBe(['url' => null, 'error' => 'invalid_image_url'])
            ->and($urls->validateExternalUrl('https://evil.example.com/banners/sale.webp', 255))
            ->toBe(['url' => null, 'error' => 'image_host_not_allowed'])
            ->and($urls->validateExternalUrl('https://sub.cdn.example.com/banners/sale.webp', 255))
            ->toBe(['url' => null, 'error' => 'image_host_not_allowed'])
            ->and($urls->validateExternalUrl('https://cdn.example.com/' . str_repeat('a', 40) . '.jpg', 50))
            ->toBe(['url' => null, 'error' => 'image_url_too_long']);

        // When WEBSITE_ALLOWED_IMAGE_HOSTS is empty, any valid HTTP/HTTPS URL (including local/LAN IP & custom ports) is allowed
        $_ENV['WEBSITE_ALLOWED_IMAGE_HOSTS'] = '';
        expect($urls->validateExternalUrl('https://any-cdn.example.org/banners/sale.webp?v=2', 255))
            ->toBe(['url' => 'https://any-cdn.example.org/banners/sale.webp?v=2', 'error' => null])
            ->and($urls->validateExternalUrl('http://127.0.0.1:8094/api.php?website-image=promo-banner/banner.png', 255))
            ->toBe(['url' => 'http://127.0.0.1:8094/api.php?website-image=promo-banner/banner.png', 'error' => null])
            ->and($urls->validateExternalUrl('http://localhost:8080/images/sale.jpg', 255))
            ->toBe(['url' => 'http://localhost:8080/images/sale.jpg', 'error' => null]);

        // Describe returns null preview when host is later removed from a configured allowlist, while preserving stored URL for editing
        $_ENV['WEBSITE_ALLOWED_IMAGE_HOSTS'] = 'images.example.com';
        expect($urls->describe('carousel', 'https://cdn.example.com/banners/sale.webp'))->toBe([
            'sourceType' => 'url',
            'managedFilename' => null,
            'previewUrl' => null,
            'imageUrl' => 'https://cdn.example.com/banners/sale.webp',
        ]);
    } finally {
        if ($previousHosts === null) unset($_ENV['WEBSITE_ALLOWED_IMAGE_HOSTS']);
        else $_ENV['WEBSITE_ALLOWED_IMAGE_HOSTS'] = $previousHosts;
        rmdir($root);
    }
});

it('checks active managed images and enforces per-table URL lengths in WebsiteImageRepository', function () {
    $db = new PDO('sqlite::memory:', options: [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $schema = file_get_contents(dirname(__DIR__, 2) . '/database/demo.sql');
    expect($schema)->not->toBeFalse();
    $db->exec((string) $schema);

    $bannerRepo = WebsiteImageRepository::for($db, true, 'promo-banner');
    $saleRepo = WebsiteImageRepository::for($db, true, 'promo-sale');
    $carouselRepo = WebsiteImageRepository::for($db, true, 'carousel');

    expect($bannerRepo->imageUrlColumnSpec())->toBe(['maxLength' => 255, 'utf16' => true])
        ->and($saleRepo->imageUrlColumnSpec())->toBe(['maxLength' => 255, 'utf16' => true])
        ->and($carouselRepo->imageUrlColumnSpec())->toBe(['maxLength' => 500, 'utf16' => true]);

    $fullUrl = 'https://assets.example.com/master-data/website-images/promo-banner/hero.jpg';
    $legacyPath = 'website-images/promo-banner/legacy.png';
    $bannerRepo->add('แบนเนอร์ใหม่', 0, $fullUrl);
    $bannerRepo->add('แบนเนอร์เก่า', 1, $legacyPath);

    expect($bannerRepo->hasActiveManagedImage([$fullUrl, 'website-images/promo-banner/hero.jpg']))->toBeFalse()
        ->and($bannerRepo->hasActiveManagedImage([$legacyPath]))->toBeTrue();

    $items = $bannerRepo->items();
    expect($items)->toHaveCount(2);
    $activated = $bannerRepo->setActive((int) $items[0]['id'], $items[0]['revision'], 1);
    expect($activated)->not->toBeNull()
        ->and($bannerRepo->hasActiveManagedImage([$fullUrl]))->toBeTrue();

    $deactivated = $bannerRepo->setActive((int) $activated['id'], $activated['revision'], 0);
    expect($deactivated)->not->toBeNull()
        ->and($bannerRepo->hasActiveManagedImage([$fullUrl]))->toBeFalse();

    // Link_Url storage on promo tables (Image_Url = '', Link_Url = external URL; switching to upload clears Link_Url to NULL)
    $bannerRepo->add('แบนเนอร์ลิงก์', 1, '', 'https://cdn.example.com/promo-link.jpg');
    $allBanners = $bannerRepo->items();
    $linkBanner = $allBanners[2];
    expect($linkBanner['path'])->toBe('')
        ->and($linkBanner['linkUrl'])->toBe('https://cdn.example.com/promo-link.jpg');

    $switched = $bannerRepo->update((int) $linkBanner['id'], $linkBanner['revision'], 'เปลี่ยนเป็นอัปโหลด', 1, $fullUrl, null, true);
    expect($switched)->toBeTrue();
    $reloaded = $bannerRepo->items()[2];
    expect($reloaded['path'])->toBe($fullUrl)
        ->and($reloaded['linkUrl'])->toBeNull();
});

it('stores promotion-level images per customer level and keeps ordering within each level', function () {
    $db = new PDO('sqlite::memory:', options: [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $schema = file_get_contents(dirname(__DIR__, 2) . '/database/demo.sql');
    expect($schema)->not->toBeFalse();
    $db->exec((string) $schema);
    $db->exec("INSERT INTO Customer (Customer_Id, Customer_Type, Customer_Lavel) VALUES
        ('C1', 'ขายปลีก', '1'), ('C2', 'ขายส่ง 1', '2'), ('C3', ' ขายส่ง 2 ', '3'), ('C4', 'ขายส่ง 1', '2'),
        ('C5', NULL, '4'), ('C6', 'ไม่มีรหัส', NULL), ('C7', 'ว่าง', '')");
    // Rows written by the earlier promotion system: file name only, NULL remark, several rows sharing one Sort_Order.
    $db->exec("INSERT INTO Web_Promotion_Level (Auto_ID, Customer_Lavel, Level_Name, Image_Url, Sort_Order, Remark, Is_Active) VALUES
        (9, '2', 'ขายส่ง1', 'Promotionlevel_1773857819_5529.jpg', 4, NULL, 0),
        (10, '2', 'ขายส่ง1', 'Promotionlevel_1773883743_9045.png', 2, NULL, 0),
        (19, '3', 'ขายส่ง2', 'Promotionlevel_1786084184_4529.png', 1, NULL, 1)");

    $levels = new CustomerLevelRepository($db, true);
    expect($levels->all())->toBe([
        ['code' => '1', 'name' => 'ขายปลีก'],
        ['code' => '2', 'name' => 'ขายส่ง 1'],
        ['code' => '3', 'name' => 'ขายส่ง 2'],
    ])->and($levels->find('2'))->toBe(['code' => '2', 'name' => 'ขายส่ง 1'])
        ->and($levels->find('4'))->toBeNull()
        ->and($levels->find(''))->toBeNull();

    $repo = WebsiteImageRepository::for($db, true, 'promotion-level');
    expect($repo->hasLevel())->toBeTrue()
        ->and($repo->hasLinkUrl())->toBeFalse()
        ->and($repo->imageUrlColumnSpec())->toBe(['maxLength' => 500, 'utf16' => true])
        ->and((WebsiteImageRepository::for($db, true, 'promo-sale'))->hasLevel())->toBeFalse();

    $legacy = $repo->items();
    expect(array_column($legacy, 'id'))->toBe(['10', '9', '19'])
        ->and($legacy[0])->toMatchArray(['title' => '', 'level' => '2', 'levelName' => 'ขายส่ง1', 'path' => 'Promotionlevel_1773883743_9045.png'])
        ->and(array_column($repo->items(level: '3'), 'id'))->toBe(['19']);

    $wholesale1 = ['code' => '2', 'name' => 'ขายส่ง 1'];
    $wholesale2 = ['code' => '3', 'name' => 'ขายส่ง 2'];
    $repo->add('', 1, 'new-level2.jpg', null, $wholesale1);
    $repo->add('โปรขายส่ง 2', 0, 'new-level3.png', null, $wholesale2);
    $level2 = $repo->items(level: '2');
    $added = $level2[2];
    expect(array_column($level2, 'id'))->toBe(['10', '9', $added['id']])
        ->and($added)->toMatchArray(['title' => '', 'position' => 5, 'active' => true, 'level' => '2', 'levelName' => 'ขายส่ง 1', 'path' => 'new-level2.jpg'])
        ->and($db->query("SELECT Remark, Status FROM Web_Promotion_Level WHERE Auto_ID = {$added['id']}")->fetch())
        ->toBe(['Remark' => null, 'Status' => 'Y'])
        ->and($repo->items(level: '3')[1])->toMatchArray(['title' => 'โปรขายส่ง 2', 'position' => 2, 'level' => '3']);

    expect(fn () => $repo->add('x', 1, 'x.jpg'))->toThrow(InvalidArgumentException::class);

    // Moving a row to another level appends it there; staying in the same level keeps its position.
    expect($repo->update((int) $added['id'], $added['revision'], 'ย้ายระดับ', 1, null, null, false, $wholesale2))->toBeTrue();
    $moved = $repo->items(level: '3')[2];
    expect($moved)->toMatchArray(['id' => $added['id'], 'title' => 'ย้ายระดับ', 'position' => 3, 'level' => '3', 'levelName' => 'ขายส่ง 2', 'path' => 'new-level2.jpg'])
        ->and($repo->update((int) $moved['id'], $added['revision'], 'เก่า', 1, null, null, false, $wholesale2))->toBeFalse();
    expect($repo->update((int) $moved['id'], $moved['revision'], 'คงระดับ', 0, 'replaced.webp', null, false, $wholesale2))->toBeTrue()
        ->and($repo->items(level: '3')[2])->toMatchArray(['title' => 'คงระดับ', 'position' => 3, 'active' => false, 'path' => 'replaced.webp']);

    // Reordering covers exactly one level and leaves the other levels untouched.
    $level3 = $repo->items(level: '3');
    $reversed = [];
    foreach (array_reverse($level3) as $row) $reversed[(int) $row['id']] = $row['revision'];
    expect($repo->reorder($reversed))->toBeFalse()
        ->and($repo->reorder($reversed, '2'))->toBeFalse()
        ->and($repo->reorder($reversed, '3'))->toBeTrue()
        ->and(array_column($repo->items(level: '3'), 'position'))->toBe([1, 2, 3])
        ->and(array_column($repo->items(level: '3'), 'id'))->toBe(array_map('strval', array_keys($reversed)))
        ->and(array_column($repo->items(level: '2'), 'position'))->toBe([2, 4]);

    // Only active rows are public, matched by their stored file name.
    expect($repo->hasActiveManagedImage(['Promotionlevel_1786084184_4529.png']))->toBeTrue()
        ->and($repo->hasActiveManagedImage(['Promotionlevel_1773857819_5529.jpg']))->toBeFalse();
});

it('treats promotion-level Image_Url values as file names in the website image store', function () {
    $root = sys_get_temp_dir() . '/sptc-level-url-' . bin2hex(random_bytes(8));
    mkdir($root, 0700, true);
    $envKeys = ['APP_MODE', 'APP_HTTPS', 'APP_PUBLIC_ORIGIN', 'APP_BASE_PATH', 'WEBSITE_LEGACY_IMAGE_BASE_URL'];
    $previous = [];
    foreach ($envKeys as $key) $previous[$key] = $_ENV[$key] ?? null;

    try {
        $_ENV['APP_MODE'] = 'production';
        $_ENV['APP_HTTPS'] = 'true';
        $_ENV['APP_PUBLIC_ORIGIN'] = 'https://assets.example.com';
        $_ENV['APP_BASE_PATH'] = '';
        $_ENV['WEBSITE_LEGACY_IMAGE_BASE_URL'] = 'https://legacy.example.com/promotion';
        $config = new Config($root);
        $urls = new WebsiteImageUrl($config, new ProductImage($config, 'website-images'));

        expect(WebsiteImageUrl::storesFilename('promotion-level'))->toBeTrue()
            ->and(WebsiteImageUrl::storesFilename('promo-sale'))->toBeFalse()
            ->and($urls->parseManagedFilename('promotion-level', 'Promotionlevel_1773857819_5529.jpg'))->toBe('Promotionlevel_1773857819_5529.jpg')
            ->and($urls->parseManagedFilename('promotion-level', 'nested/file.jpg'))->toBeNull()
            ->and($urls->parseManagedFilename('promotion-level', 'file.gif'))->toBeNull()
            ->and($urls->parseManagedFilename('promo-sale', 'Promotionlevel_1773857819_5529.jpg'))->toBeNull()
            ->and($urls->managedLookupCandidates('promotion-level', 'a.png'))->toContain('a.png')
            ->and($urls->managedLookupCandidates('promo-sale', 'a.png'))->not->toContain('a.png');

        expect($urls->describe('promotion-level', 'โปร ขายส่ง.png'))->toBe([
            'sourceType' => 'upload',
            'managedFilename' => 'โปร ขายส่ง.png',
            'previewUrl' => null,
            'imageUrl' => 'https://assets.example.com/website-images/promotion-level/%E0%B9%82%E0%B8%9B%E0%B8%A3%20%E0%B8%82%E0%B8%B2%E0%B8%A2%E0%B8%AA%E0%B9%88%E0%B8%87.png',
        ])->and($urls->describe('promotion-level', 'https://cdn.example.com/level.jpg')['sourceType'])->toBe('url')
            ->and($urls->legacyPreviewUrl('Promotionlevel_1773857819_5529.jpg'))->toBe('https://legacy.example.com/promotion/Promotionlevel_1773857819_5529.jpg');
    } finally {
        foreach ($previous as $key => $value) {
            if ($value === null) unset($_ENV[$key]);
            else $_ENV[$key] = $value;
        }
        rmdir($root);
    }
});
