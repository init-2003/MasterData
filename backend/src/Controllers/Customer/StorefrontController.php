<?php

declare(strict_types=1);

namespace Sptc\MasterData\Controllers\Customer;

use Sptc\MasterData\Core\Api;
use Sptc\MasterData\Core\Config;
use Sptc\MasterData\Core\Database;
use Sptc\MasterData\Models\WebsiteImageRepository;
use Sptc\MasterData\Services\ProductImage;
use Sptc\MasterData\Services\WebsiteImageUrl;

final readonly class StorefrontController
{
    public function __construct(private Config $config)
    {
    }

    public function storefront(): never
    {
        $db = Database::connect($this->config);
        $images = new ProductImage($this->config, 'website-images');
        $urls = new WebsiteImageUrl($this->config, $images);

        Api::respond([
            'carousel' => $this->collectionItems($db, $urls, 'carousel'),
            'promoBanner' => $this->collectionItems($db, $urls, 'promo-banner'),
            'promoSale' => $this->collectionItems($db, $urls, 'promo-sale'),
            'demo' => $this->config->demo(),
        ]);
    }

    /**
     * @param key-of<WebsiteImageRepository::TABLES> $collection
     * @return list<array{id: string, title: string, position: int, imageUrl: string|null}>
     */
    private function collectionItems(\PDO $db, WebsiteImageUrl $urls, string $collection): array
    {
        $repo = new WebsiteImageRepository($db, $this->config->demo(), $collection);
        $result = [];
        foreach ($repo->activeItems() as $item) {
            $described = $urls->describe($collection, $item['path'], $item['linkUrl']);
            $imageUrl = $described['managedFilename'] !== null
                ? ($urls->managedPublicUrl($collection, $described['managedFilename']) ?? ('/website-images/' . $collection . '/' . rawurlencode($described['managedFilename'])))
                : $described['previewUrl'];
            if ($imageUrl === null) {
                continue;
            }
            $result[] = [
                'id' => $item['id'],
                'title' => $item['title'],
                'position' => $item['position'],
                'imageUrl' => $imageUrl,
            ];
        }

        return $result;
    }
}
