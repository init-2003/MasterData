<?php

declare(strict_types=1);

use Sptc\MasterData\Controllers\Customer\PublicCatalogController;
use Sptc\MasterData\Controllers\Customer\StorefrontController;

// action => [HTTP method, controller, handler]. Controllers are created with (Config).
return [
    'storefront'      => ['GET', StorefrontController::class, 'storefront'],
    'catalog'         => ['GET', PublicCatalogController::class, 'catalog'],
    'catalog-filters' => ['GET', PublicCatalogController::class, 'filters'],
    'catalog-item'    => ['GET', PublicCatalogController::class, 'item'],
];
