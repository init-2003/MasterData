<?php

declare(strict_types=1);

use Sptc\MasterData\Controllers\Admin\AuthController;
use Sptc\MasterData\Controllers\Admin\ProductController;
use Sptc\MasterData\Controllers\Admin\WebsiteImageController;

// action => [HTTP method, controller, handler]. Controllers are created with (Config, Session).
return [
    'session'                   => ['GET', AuthController::class, 'sessionResponse'],
    'products'                  => ['GET', ProductController::class, 'products'],
    'product-types'             => ['GET', ProductController::class, 'types'],
    'product-units'             => ['GET', ProductController::class, 'units'],
    'product-note'              => ['GET', ProductController::class, 'productNote'],
    'product-short-note'        => ['GET', ProductController::class, 'productShortNote'],
    'product-image'             => ['GET', ProductController::class, 'productImage'],
    'product-images'            => ['GET', ProductController::class, 'productImages'],
    'login'                     => ['POST', AuthController::class, 'login'],
    'logout'                    => ['POST', AuthController::class, 'logout'],
    'update-price'              => ['POST', ProductController::class, 'updatePrice'],
    'update-product-note'       => ['POST', ProductController::class, 'updateProductNote'],
    'update-product-short-note' => ['POST', ProductController::class, 'updateProductShortNote'],
    'upload-product-image'      => ['POST', ProductController::class, 'uploadProductImage'],
    'save-product-image-url'    => ['POST', ProductController::class, 'saveProductImageUrl'],
    'delete-product-image'      => ['POST', ProductController::class, 'deleteProductImage'],
    'website-images'            => ['GET', WebsiteImageController::class, 'items'],
    'website-image'             => ['GET', WebsiteImageController::class, 'image'],
    'save-website-image'        => ['POST', WebsiteImageController::class, 'save'],
    'reorder-website-images'    => ['POST', WebsiteImageController::class, 'reorder'],
    'delete-website-image'      => ['POST', WebsiteImageController::class, 'delete'],
    'set-website-image-active'  => ['POST', WebsiteImageController::class, 'setActive'],
];
