<?php

declare(strict_types=1);

namespace Sptc\MasterData\Controllers\Customer;

use Sptc\MasterData\Core\Api;
use Sptc\MasterData\Core\Config;
use Sptc\MasterData\Core\Database;
use Sptc\MasterData\Models\ProductRepository;
use Sptc\MasterData\Services\ProductImage;
use Sptc\MasterData\Services\ProductImageUrl;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validation;

final readonly class PublicCatalogController
{
    public function __construct(private Config $config)
    {
    }

    public function catalog(): never
    {
        $search = $_GET['q'] ?? '';
        $type = $_GET['type'] ?? '';
        $unit = $_GET['unit'] ?? '';
        $rawPage = $_GET['page'] ?? '1';
        $rawPageSize = $_GET['pageSize'] ?? '24';
        if (!is_string($search) || !mb_check_encoding($search, 'UTF-8') || !is_string($type) || !mb_check_encoding($type, 'UTF-8')
            || !is_string($unit) || !mb_check_encoding($unit, 'UTF-8') || !is_string($rawPage) || !is_string($rawPageSize)) {
            Api::fail(422, 'invalid_input');
        }
        $search = trim($search);
        $type = trim($type);
        $unit = trim($unit);
        $page = filter_var($rawPage, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 1000000]]);
        $pageSize = filter_var($rawPageSize, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 60]]);
        if ($page === false || $pageSize === false || mb_strlen($type) > 255 || mb_strlen($unit) > 255
            || count(Validation::createValidator()->validate($search, new Assert\Length(max: 100))) > 0) {
            Api::fail(422, 'invalid_input');
        }

        $repo = new ProductRepository(Database::connect($this->config), $this->config);
        $storage = new ProductImage($this->config);
        $urls = new ProductImageUrl($this->config, $storage);
        $result = $repo->publicSearch($search, $page, $type, $unit, $pageSize);

        $items = [];
        foreach ($result['items'] as $row) {
            $code = $row['code'] ?? '';
            $images = array_values(array_filter([
                $this->resolvePublicImage($urls, $code, $row['image1']),
                $this->resolvePublicImage($urls, $code, $row['image2']),
            ]));
            $items[] = [
                'id' => $row['id'],
                'code' => $row['code'],
                'name' => $row['name'],
                'category' => $row['category'],
                'unit' => $row['unit'],
                'price' => $row['price'],
                'images' => $images,
            ];
        }

        Api::respond([
            'items' => $items,
            'page' => $result['page'],
            'pageSize' => $result['pageSize'],
            'total' => $result['total'],
            'totalPages' => $result['totalPages'],
        ]);
    }

    public function filters(): never
    {
        $repo = new ProductRepository(Database::connect($this->config), $this->config);
        Api::respond([
            'types' => $repo->types(),
            'units' => $repo->units(),
        ]);
    }

    public function item(): never
    {
        $id = $_GET['id'] ?? null;
        if (!is_string($id) || $id === '' || !mb_check_encoding($id, 'UTF-8') || mb_strlen($id) > 128) {
            Api::fail(422, 'invalid_input');
        }
        $repo = new ProductRepository(Database::connect($this->config), $this->config);
        $item = $repo->publicItem($id);
        if ($item === null) {
            Api::fail(404, 'product_not_found');
        }
        $storage = new ProductImage($this->config);
        $urls = new ProductImageUrl($this->config, $storage);
        $images = array_values(array_filter([
            $this->resolvePublicImage($urls, $item['code'], $item['image1']),
            $this->resolvePublicImage($urls, $item['code'], $item['image2']),
        ]));

        Api::respond([
            'id' => $item['id'],
            'code' => $item['code'],
            'name' => $item['name'],
            'category' => $item['category'],
            'unit' => $item['unit'],
            'price' => $item['price'],
            'note' => $item['note'],
            'shortNote' => $item['shortNote'],
            'images' => $images,
        ]);
    }

    private function resolvePublicImage(ProductImageUrl $urls, string $code, ?string $stored): ?string
    {
        if ($code === '' || $stored === null) {
            return null;
        }
        $described = $urls->describe($code, $stored);
        if ($described['managedRelative'] !== null) {
            $full = $urls->managedPublicUrl($described['managedRelative']);
            if ($full !== null) {
                return $full;
            }
            $parts = explode('/', $described['managedRelative'], 2);
            if (count($parts) === 2) {
                return '/product-images/' . rawurlencode($parts[0]) . '/' . rawurlencode($parts[1]);
            }
            return null;
        }
        if ($described['sourceType'] === 'url') {
            return $described['previewUrl'];
        }

        return null;
    }
}
