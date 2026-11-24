<?php

declare(strict_types=1);

use Sptc\MasterData\Core\Config;
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

    $bannerRepo = new WebsiteImageRepository($db, true, 'promo-banner');
    $saleRepo = new WebsiteImageRepository($db, true, 'promo-sale');
    $carouselRepo = new WebsiteImageRepository($db, true, 'carousel');

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
