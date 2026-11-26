<?php

declare(strict_types=1);

namespace Sptc\MasterData\Core;

use Sptc\MasterData\Controllers\Admin\ProductController;
use Sptc\MasterData\Controllers\Admin\WebsiteImageController;
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
            [, $controller, $handler] = $this->route('customer', $action, $method);
            (new $controller($this->config))->$handler();
        }

        // 3. Admin API (/admin/<action>)
        if (str_starts_with($routePath, '/admin/')) {
            header('X-Robots-Tag: noindex, nofollow');
            Cors::handle($this->config, 'admin', $method);
            $action = trim(substr($routePath, strlen('/admin/')), '/');
            [$requiredMethod, $controller, $handler] = $this->route('admin', $action, $method);
            $session = new Session($this->config, ($basePath === '' ? '' : $basePath) . '/admin');
            if ($requiredMethod === 'POST') {
                Csrf::verify($session);
            }

            (new $controller($this->config, $session))->$handler();
        }

        self::fail(404, 'not_found');
    }

    /**
     * Looks up an action and rejects unknown actions (404) and wrong HTTP methods (405).
     *
     * @param 'admin'|'customer' $scope
     * @return array{string, class-string, string}
     */
    private function route(string $scope, string $action, string $method): array
    {
        /** @var array<string, array{string, class-string, string}> $routes */
        $routes = require dirname(__DIR__, 2) . '/routes/' . $scope . '.php';
        $route = $routes[$action] ?? null;
        if ($route === null) {
            self::fail(404, 'not_found');
        }
        if ($method !== $route[0]) {
            header('Allow: ' . $route[0] . ', OPTIONS');
            self::fail(405, 'method_not_allowed');
        }
        return $route;
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
