<?php

declare(strict_types=1);

namespace Sptc\MasterData\Http;

use Sptc\MasterData\Auth\Session;
use Sptc\MasterData\Infrastructure\Config;
use Sptc\MasterData\App\Product\ProductController;

final readonly class Api
{
    public function __construct(private Config $config)
    {
    }

    public function dispatch(): never
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? '';
        $action = $_GET['action'] ?? (isset($_GET['path']) ? 'product-image-by-path' : 'session');
        $requiredMethod = match ($action) {
            'session', 'products', 'product-types', 'product-units', 'product-note', 'product-short-note', 'product-image', 'product-images', 'product-image-by-path' => 'GET',
            'login', 'logout', 'update-price', 'update-product-note', 'update-product-short-note', 'upload-product-image', 'delete-product-image' => 'POST',
            default => null,
        };
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
            $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
            if (!is_string($token) || !hash_equals($session->csrf(), $token)) {
                self::fail(403, 'csrf_invalid');
            }
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
