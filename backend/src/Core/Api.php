<?php

declare(strict_types=1);

namespace Sptc\MasterData\Core;

use Sptc\MasterData\Services\Session;
use Sptc\MasterData\Controllers\AuthController;
use Sptc\MasterData\Controllers\ProductController;
use Sptc\MasterData\Middleware\Csrf;

final readonly class Api
{
    public function __construct(private Config $config)
    {
    }

    public function dispatch(): never
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? '';
        $action = $_GET['action'] ?? (isset($_GET['path']) ? 'product-image-by-path' : 'session');
        $routes = require dirname(__DIR__, 2) . '/routes/api.php';
        $requiredMethod = is_string($action) ? ($routes[$action] ?? null) : null;
        if ($requiredMethod === null) {
            self::fail(404, 'not_found');
        }
        if ($method !== $requiredMethod) {
            header('Allow: ' . $requiredMethod);
            self::fail(405, 'method_not_allowed');
        }
        if ($action === 'product-image-by-path') ProductController::imageByPath($this->config);
        $session = new Session($this->config);
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
            'delete-product-image' => (new ProductController($this->config, $session))->deleteProductImage(),
            default => self::fail(404, 'not_found'),
        };
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
