<?php

declare(strict_types=1);

namespace Sptc\MasterData\Core;

use Sptc\MasterData\Controllers\Admin\AuthController;
use Sptc\MasterData\Controllers\Admin\ProductController;
use Sptc\MasterData\Controllers\Admin\WebsiteImageController;
use Sptc\MasterData\Controllers\Customer\PublicCatalogController;
use Sptc\MasterData\Controllers\Customer\StorefrontController;
use Sptc\MasterData\Middleware\Cors;
use Sptc\MasterData\Middleware\Csrf;
use Sptc\MasterData\Middleware\HostGuard;
use Sptc\MasterData\Services\ProductImage;
use Sptc\MasterData\Services\Session;
use Sptc\MasterData\Services\WebsiteImageUrl;

final readonly class Api
{
    public function __construct(
        private Config $config,
    ) {
    }

    public function dispatch(): never
    {
        HostGuard::verify($this->config, 'api');
        $method = $_SERVER['REQUEST_METHOD'] ?? '';
        $basePath = (new WebsiteImageUrl($this->config, new ProductImage($this->config, 'website-images')))->basePath() ?? '';
        $routePath = $this->normalizedRequestPath($basePath);

        // 1. Public clean image URLs & legacy query-based public image URLs (no session, no cookies)
        if ($method === 'GET') {
            if (preg_match('~\A/website-images/([a-z0-9-]+)/([^/]+)\z~', $routePath, $match) === 1) {
                $_GET['website-image'] = $match[1] . '/' . rawurldecode($match[2]);
                WebsiteImageController::publicImage($this->config);
            }
            if (preg_match('~\A/product-images/([^/]+)/([^/]+)\z~', $routePath, $match) === 1) {
                $_GET['path'] = rawurldecode($match[1]) . '/' . rawurldecode($match[2]);
                ProductController::imageByPath($this->config);
            }
            if (in_array($routePath, ['/', '/index.php', '/api.php'], true)) {
                if (isset($_GET['path'])) {
                    ProductController::imageByPath($this->config);
                }
                if (isset($_GET['website-image'])) {
                    WebsiteImageController::publicImage($this->config);
                }
            }
        }

        // 2. Customer public API (/customer/<action>)
        if (str_starts_with($routePath, '/customer/')) {
            Cors::handle($this->config, 'customer', $method);
            $action = trim(substr($routePath, strlen('/customer/')), '/');
            $action = match ($action) {
                'catalog/filters' => 'catalog-filters',
                'catalog/item' => 'catalog-item',
                default => $action,
            };
            $routes = require dirname(__DIR__, 2) . '/routes/customer.php';
            $requiredMethod = $routes[$action] ?? null;
            if (!is_string($requiredMethod)) {
                self::fail(404, 'not_found');
            }
            if ($method !== $requiredMethod) {
                header('Allow: ' . $requiredMethod . ', OPTIONS');
                self::fail(405, 'method_not_allowed');
            }
            match ($action) {
                'storefront' => (new StorefrontController($this->config))->storefront(),
                'catalog' => (new PublicCatalogController($this->config))->catalog(),
                'catalog-filters' => (new PublicCatalogController($this->config))->filters(),
                'catalog-item' => (new PublicCatalogController($this->config))->item(),
                default => self::fail(404, 'not_found'),
            };
        }

        // 3. Admin API (/admin/<action>)
        if (str_starts_with($routePath, '/admin/')) {
            header('X-Robots-Tag: noindex, nofollow');
            Cors::handle($this->config, 'admin', $method);
            $action = trim(substr($routePath, strlen('/admin/')), '/');
            $routes = require dirname(__DIR__, 2) . '/routes/admin.php';
            $requiredMethod = $routes[$action] ?? null;
            if (!is_string($requiredMethod)) {
                self::fail(404, 'not_found');
            }
            if ($method !== $requiredMethod) {
                header('Allow: ' . $requiredMethod . ', OPTIONS');
                self::fail(405, 'method_not_allowed');
            }
            $session = new Session($this->config, ($basePath === '' ? '' : $basePath) . '/admin');
            if ($requiredMethod === 'POST') {
                Csrf::verify($session);
            }

            match ($action) {
                'session' => (new AuthController($this->config, $session))->sessionResponse(),
                'login' => (new AuthController($this->config, $session))->login(),
                'logout' => (new AuthController($this->config, $session))->logout(),
                'products' => (new ProductController($this->config, $session))->products(),
                'product-types' => (new ProductController($this->config, $session))->types(),
                'product-units' => (new ProductController($this->config, $session))->units(),
                'update-price' => (new ProductController($this->config, $session))->updatePrice(),
                'product-note' => (new ProductController($this->config, $session))->productNote(),
                'update-product-note' => (new ProductController($this->config, $session))->updateProductNote(),
                'product-short-note' => (new ProductController($this->config, $session))->productShortNote(),
                'update-product-short-note' => (new ProductController($this->config, $session))->updateProductShortNote(),
                'product-image' => (new ProductController($this->config, $session))->productImage(),
                'product-images' => (new ProductController($this->config, $session))->productImages(),
                'upload-product-image' => (new ProductController($this->config, $session))->uploadProductImage(),
                'save-product-image-url' => (new ProductController($this->config, $session))->saveProductImageUrl(),
                'delete-product-image' => (new ProductController($this->config, $session))->deleteProductImage(),
                'website-images' => (new WebsiteImageController($this->config, $session))->items(),
                'website-image' => (new WebsiteImageController($this->config, $session))->image(),
                'save-website-image' => (new WebsiteImageController($this->config, $session))->save(),
                'reorder-website-images' => (new WebsiteImageController($this->config, $session))->reorder(),
                'delete-website-image' => (new WebsiteImageController($this->config, $session))->delete(),
                'set-website-image-active' => (new WebsiteImageController($this->config, $session))->setActive(),
                default => self::fail(404, 'not_found'),
            };
        }

        self::fail(404, 'not_found');
    }

    private function normalizedRequestPath(string $basePath): string
    {
        $raw = explode('?', (string) ($_SERVER['REQUEST_URI'] ?? '/'), 2)[0];
        if ($basePath !== '' && str_starts_with($raw, $basePath . '/')) {
            $raw = substr($raw, strlen($basePath));
        }
        return $raw === '' ? '/' : $raw;
    }

    public static function fail(int $status, string $code): never
    {
        self::respond(['error' => $code], $status);
    }

    /** @param array<string, mixed> $data */
    public static function respond(array $data, int $status = 200): never
    {
        http_response_code($status);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);
        exit;
    }
}
