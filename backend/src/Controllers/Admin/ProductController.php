<?php

declare(strict_types=1);

namespace Sptc\MasterData\Controllers\Admin;

use Sptc\MasterData\Services\Session;
use Sptc\MasterData\Core\Config;
use Sptc\MasterData\Core\Database;
use Sptc\MasterData\Core\Api;
use Sptc\MasterData\Models\ProductRepository;
use Sptc\MasterData\Services\ProductImage;
use Sptc\MasterData\Services\ProductImageUrl;
use Sptc\MasterData\Services\WebsiteImageUrl;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validation;

final readonly class ProductController
{
    public function __construct(private Config $config, private Session $session) {}

    public function products(): never
    {
        if ($this->session->user() === null) {
            Api::fail(401, 'login_required');
        }
        session_write_close();
        $search = $_GET['q'] ?? '';
        $type = $_GET['type'] ?? '';
        $unit = $_GET['unit'] ?? '';
        $rawPage = $_GET['page'] ?? '1';
        $rawPageSize = $_GET['pageSize'] ?? (string) ProductRepository::PAGE_SIZE;
        if (!is_string($search) || !mb_check_encoding($search, 'UTF-8') || !is_string($type) || !mb_check_encoding($type, 'UTF-8') || !is_string($unit) || !mb_check_encoding($unit, 'UTF-8') || !is_string($rawPage) || !is_string($rawPageSize)) {
            Api::fail(422, 'invalid_input');
        }
        $search = trim($search);
        $page = filter_var($rawPage, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 1000000]]);
        $pageSize = filter_var($rawPageSize, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => ProductRepository::MAX_PAGE_SIZE]]);
        $type = trim($type);
        $unit = trim($unit);
        if ($page === false || $pageSize === false || mb_strlen($type) > 255 || mb_strlen($unit) > 255 || count(Validation::createValidator()->validate($search, new Assert\Length(max: 100))) > 0) {
            Api::fail(422, 'invalid_input');
        }

        $repository = new ProductRepository(Database::connect($this->config), $this->config);
        Api::respond($repository->search($search, $page, $type, $unit, $pageSize));
    }

    public function types(): never
    {
        if ($this->session->user() === null) Api::fail(401, 'login_required');
        session_write_close();
        $repository = new ProductRepository(Database::connect($this->config), $this->config);
        Api::respond(['items' => $repository->types()]);
    }

    public function units(): never
    {
        if ($this->session->user() === null) Api::fail(401, 'login_required');
        session_write_close();
        $repository = new ProductRepository(Database::connect($this->config), $this->config);
        Api::respond(['items' => $repository->units()]);
    }

    public function productShortNote(): never { $this->productNote(true); }

    public function productNote(bool $short = false): never
    {
        if ($this->session->user() === null) Api::fail(401, 'login_required');
        $id = $_GET['id'] ?? null;
        if (!is_string($id) || $id === '' || !mb_check_encoding($id, 'UTF-8') || mb_strlen($id) > 128) Api::fail(422, 'invalid_input');
        session_write_close();
        $note = (new ProductRepository(Database::connect($this->config), $this->config))->note($id, $short);
        if ($note === null) Api::fail(404, 'product_not_found');
        Api::respond($note);
    }

    public function updateProductShortNote(): never { $this->updateProductNote(true); }

    public function updateProductNote(bool $short = false): never
    {
        if ($this->session->user() === null) Api::fail(401, 'login_required');
        if (strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0])) !== 'application/json') Api::fail(415, 'invalid_content_type');
        $raw = file_get_contents('php://input', length: 65537);
        if ($raw === false || strlen($raw) > 65536) Api::fail(413, 'invalid_input');
        $body = json_decode($raw, true, 8);
        if (!is_array($body) || array_diff(array_keys($body), ['id', 'expectedNote', 'note']) !== [] || !array_key_exists('expectedNote', $body)) Api::fail(422, 'invalid_input');
        $id = $body['id'] ?? null;
        $expected = $body['expectedNote'];
        $note = $body['note'] ?? null;
        if (!is_string($id) || $id === '' || !mb_check_encoding($id, 'UTF-8') || mb_strlen($id) > 128 || !is_string($note) || !mb_check_encoding($note, 'UTF-8') || mb_strlen($note) > ($short ? 255 : 4000) || str_contains($note, "\0") || ($expected !== null && (!is_string($expected) || !mb_check_encoding($expected, 'UTF-8')))) Api::fail(422, 'invalid_input');
        session_write_close();
        try {
            $updated = (new ProductRepository(Database::connect($this->config), $this->config))->updateNote($id, $expected, $note, $short);
        } catch (\PDOException $error) {
            if ($short && in_array($error->getCode(), ['22001', '22003'], true)) Api::fail(422, 'invalid_input');
            throw $error;
        }
        if (!$updated) Api::fail(409, 'note_changed');
        Api::respond(['ok' => true]);
    }

    public function updatePrice(): never
    {
        if ($this->session->user() === null) Api::fail(401, 'login_required');
        if (strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0])) !== 'application/json') Api::fail(415, 'invalid_content_type');
        $raw = file_get_contents('php://input', length: 4097);
        if ($raw === false || strlen($raw) > 4096) Api::fail(413, 'invalid_input');
        $body = json_decode($raw, true, 8);
        if (!is_array($body) || array_diff(array_keys($body), ['id', 'expectedPrice', 'price']) !== [] || !array_key_exists('expectedPrice', $body)) Api::fail(422, 'invalid_input');
        $id = $body['id'] ?? null;
        $expected = $body['expectedPrice'];
        $price = $body['price'] ?? null;
        if (!is_string($id) || $id === '' || mb_strlen($id) > 128 || !is_string($price) || !preg_match('/\A\d{1,13}(?:\.\d{1,2})?\z/D', $price) || ($expected !== null && (!is_string($expected) || !preg_match('/\A\d{1,15}(?:\.\d{1,4})?\z/D', $expected)))) Api::fail(422, 'invalid_input');
        session_write_close();
        if (!(new ProductRepository(Database::connect($this->config), $this->config))->updatePrice($id, $expected, $price)) Api::fail(409, 'price_changed');
        Api::respond(['ok' => true]);
    }

    public function productImage(): never
    {
        if ($this->session->user() === null) Api::fail(401, 'login_required');
        $id = $_GET['id'] ?? null;
        $slot = $_GET['slot'] ?? '1';
        if (!is_string($id) || $id === '' || !mb_check_encoding($id, 'UTF-8') || mb_strlen($id) > 128 || !in_array($slot, ['1', '2'], true)) Api::fail(422, 'invalid_input');
        session_write_close();
        $repo = new ProductRepository(Database::connect($this->config), $this->config);
        $state = $repo->imageState($id);
        if ($state === null) Api::fail(404, 'product_not_found');
        $storage = new ProductImage($this->config);
        $urls = new ProductImageUrl($this->config, $storage);
        $stored = $state['image' . $slot];
        $described = $urls->describe($state['code'], $stored);
        if ($described['sourceType'] === 'url') {
            if ($described['previewUrl'] === null) Api::fail(404, 'image_not_found');
            header('Referrer-Policy: no-referrer');
            header('Location: ' . $described['previewUrl'], true, 302);
            exit;
        }
        try {
            $path = $described['managedRelative'] !== null
                ? $storage->path($state['code'], (int) $slot, $described['managedRelative'])
                : ($stored === null && $slot === '1' ? $storage->legacyPath($id) : '');
        } catch (\InvalidArgumentException) { Api::fail(404, 'image_not_found'); }
        if ($path === '' || is_link($path) || !is_file($path)) Api::fail(404, 'image_not_found');
        $mime = $storage->filenameMediaType(basename($path)) ?? 'image/png';
        header('Content-Type: ' . $mime);
        header('Content-Disposition: inline');
        readfile($path);
        exit;
    }

    public static function imageByPath(Config $config): never
    {
        $relative = $_GET['path'] ?? null;
        if (!is_string($relative) || $relative === '' || strlen($relative) > 200 || !mb_check_encoding($relative, 'UTF-8')) Api::fail(422, 'invalid_input');
        $storage = new ProductImage($config);
        $urls = new ProductImageUrl($config, $storage);
        $repo = new ProductRepository(Database::connect($config), $config);
        $reference = $repo->findImagePath($relative, $urls->lookupCandidates($relative));
        if ($reference === null) Api::fail(404, 'image_not_found');
        try {
            $file = $storage->path($reference['code'], $reference['slot'], $relative);
        } catch (\InvalidArgumentException) { Api::fail(404, 'image_not_found'); }
        if (is_link($file) || !is_file($file)) Api::fail(404, 'image_not_found');
        $mime = $storage->filenameMediaType(basename($file)) ?? 'image/png';
        header('Content-Type: ' . $mime);
        header('Content-Disposition: inline');
        readfile($file);
        exit;
    }

    public function productImages(): never
    {
        if ($this->session->user() === null) Api::fail(401, 'login_required');
        $id = $_GET['id'] ?? null;
        if (!is_string($id) || $id === '' || !mb_check_encoding($id, 'UTF-8') || mb_strlen($id) > 128) Api::fail(422, 'invalid_input');
        session_write_close();
        $repo = new ProductRepository(Database::connect($this->config), $this->config);
        $state = $repo->imageState($id);
        if ($state === null) Api::fail(404, 'product_not_found');
        $storage = new ProductImage($this->config);
        $urls = new ProductImageUrl($this->config, $storage);
        $legacy = $storage->legacyPath($id);
        $hasLegacySlot1 = !is_link($legacy) && is_file($legacy);
        $slot1Spec = $repo->imageColumnSpec(1);
        $slot2Spec = $repo->imageColumnSpec(2);
        $images = [];
        foreach ([1, 2] as $slot) {
            $stored = $state['image' . $slot];
            $described = $urls->describe($state['code'], $stored);
            $exists = $stored !== null || ($slot === 1 && $hasLegacySlot1);
            $sourceType = $described['sourceType'] ?? ($slot === 1 && $hasLegacySlot1 ? 'legacy' : null);
            $images[] = [
                'slot' => $slot,
                'path' => $stored,
                'exists' => $exists,
                'sourceType' => $sourceType,
                'imageUrl' => $described['imageUrl'],
                'preview' => $described['sourceType'] === 'url' ? $described['previewUrl'] : null,
            ];
        }
        Api::respond([
            'images' => $images,
            'config' => [
                'uploadEnabled' => $urls->publicImageBase() !== null,
                'allowedImageHosts' => $urls->allowedHosts(),
                'maxImageUrlLength' => min($slot1Spec['maxLength'], $slot2Spec['maxLength']),
                'slotMaxLengths' => ['1' => $slot1Spec['maxLength'], '2' => $slot2Spec['maxLength']],
            ],
        ]);
    }

    public function deleteProductImage(): never
    {
        if ($this->session->user() === null) Api::fail(401, 'login_required');
        if (strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0])) !== 'application/json') Api::fail(415, 'invalid_content_type');
        $raw = file_get_contents('php://input', length: 4097);
        if ($raw === false || strlen($raw) > 4096) Api::fail(413, 'invalid_input');
        $body = json_decode($raw, true, 8);
        if (!is_array($body) || array_diff(array_keys($body), ['id', 'slot', 'expected']) !== [] || !array_key_exists('expected', $body)) Api::fail(422, 'invalid_input');
        $id = $body['id'] ?? null;
        $slot = $body['slot'] ?? null;
        $expected = $body['expected'];
        if (!is_string($id) || $id === '' || !mb_check_encoding($id, 'UTF-8') || mb_strlen($id) > 128 || !in_array($slot, [1, 2], true) || ($expected !== null && (!is_string($expected) || $expected === '' || strlen($expected) > ProductRepository::MAX_URL_CAP))) Api::fail(422, 'invalid_input');
        session_write_close();
        $db = Database::connect($this->config);
        $repo = new ProductRepository($db, $this->config);
        $state = $repo->imageState($id);
        if ($state === null) Api::fail(404, 'product_not_found');
        $storage = new ProductImage($this->config);
        $urls = new ProductImageUrl($this->config, $storage);
        $db->beginTransaction();
        try {
            if (!$repo->updateImage($id, $state['code'], $slot, $expected, null)) {
                $db->rollBack();
                Api::fail(409, 'image_changed');
            }
            $db->commit();
        } catch (\Throwable $error) {
            if ($db->inTransaction()) $db->rollBack();
            throw $error;
        }
        if ($expected !== null) {
            $oldRelative = $urls->parseManagedRelative($state['code'], $expected);
            if ($oldRelative !== null && $repo->findImagePath($oldRelative, $urls->lookupCandidates($oldRelative)) === null) {
                try {
                    $path = $storage->path($state['code'], $slot, $oldRelative);
                    if (!is_link($path) && is_file($path)) @unlink($path);
                } catch (\InvalidArgumentException) { /* Keep files outside this product's image directory. */ }
            }
        }
        if ($slot === 1) {
            $legacy = $storage->legacyPath($id);
            if (!is_link($legacy) && is_file($legacy)) @unlink($legacy);
        }
        Api::respond(['ok' => true]);
    }

    public function saveProductImageUrl(): never
    {
        if ($this->session->user() === null) Api::fail(401, 'login_required');
        if (strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0])) !== 'application/json') Api::fail(415, 'invalid_content_type');
        $raw = file_get_contents('php://input', length: 8193);
        if ($raw === false || strlen($raw) > 8192) Api::fail(413, 'invalid_input');
        $body = json_decode($raw, true, 8);
        if (!is_array($body) || array_diff(array_keys($body), ['id', 'slot', 'expected', 'imageUrl']) !== [] || !array_key_exists('expected', $body)) Api::fail(422, 'invalid_input');
        $id = $body['id'] ?? null;
        $slot = $body['slot'] ?? null;
        $expected = $body['expected'];
        $imageUrl = $body['imageUrl'] ?? null;
        if (!is_string($id) || $id === '' || !mb_check_encoding($id, 'UTF-8') || mb_strlen($id) > 128
            || !in_array($slot, [1, 2], true)
            || !is_string($imageUrl)
            || ($expected !== null && (!is_string($expected) || $expected === '' || strlen($expected) > ProductRepository::MAX_URL_CAP))) {
            Api::fail(422, 'invalid_input');
        }
        session_write_close();
        $db = Database::connect($this->config);
        $repo = new ProductRepository($db, $this->config);
        $state = $repo->imageState($id);
        if ($state === null) Api::fail(404, 'product_not_found');
        $storage = new ProductImage($this->config);
        $urls = new ProductImageUrl($this->config, $storage);
        $columnSpec = $repo->imageColumnSpec($slot);
        $validation = $urls->validateExternalUrl($imageUrl, $columnSpec['maxLength'], $columnSpec['utf16']);
        if ($validation['error'] !== null) Api::fail(422, $validation['error']);
        $validatedUrl = $validation['url'];
        $db->beginTransaction();
        try {
            if (!$repo->updateImage($id, $state['code'], $slot, $expected, $validatedUrl)) {
                $db->rollBack();
                Api::fail(409, 'image_changed');
            }
            $stored = $repo->imageState($id);
            if ($stored === null || $stored['code'] !== $state['code'] || $stored['image' . $slot] !== $validatedUrl) {
                throw new \RuntimeException('Image URL could not be stored exactly');
            }
            $db->commit();
        } catch (\Throwable $error) {
            if ($db->inTransaction()) $db->rollBack();
            throw $error;
        }
        if ($expected !== null) {
            $oldRelative = $urls->parseManagedRelative($state['code'], $expected);
            $otherSlot = $slot === 1 ? 'image2' : 'image1';
            $otherRelative = $stored[$otherSlot] === null ? null : $urls->parseManagedRelative($state['code'], $stored[$otherSlot]);
            if ($oldRelative !== null && $oldRelative !== $otherRelative) {
                try {
                    $oldPath = $storage->path($state['code'], $slot, $oldRelative);
                    if (!is_link($oldPath) && is_file($oldPath)) @unlink($oldPath);
                } catch (\InvalidArgumentException) { /* Never delete files outside this product's image directory. */ }
            }
        }
        Api::respond(['ok' => true, 'path' => $validatedUrl, 'imageUrl' => $validatedUrl, 'sourceType' => 'url']);
    }

    public function uploadProductImage(): never
    {
        if ($this->session->user() === null) Api::fail(401, 'login_required');
        $id = $_POST['id'] ?? null;
        $slot = $_POST['slot'] ?? '1';
        $expected = $_POST['expected'] ?? '';
        $file = $_FILES['image'] ?? null;
        if (!is_string($id) || $id === '' || !mb_check_encoding($id, 'UTF-8') || mb_strlen($id) > 128 || !in_array($slot, ['1', '2'], true) || !is_string($expected) || strlen($expected) > ProductRepository::MAX_URL_CAP || !is_array($file)) Api::fail(422, 'invalid_input');
        $error = $file['error'] ?? UPLOAD_ERR_NO_FILE;
        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) Api::fail(413, 'image_too_large');
        $tmp = $file['tmp_name'] ?? null;
        $name = $file['name'] ?? null;
        if ($error !== UPLOAD_ERR_OK || !is_string($tmp) || !is_string($name) || !is_uploaded_file($tmp)) Api::fail(422, 'invalid_image');
        session_write_close();
        $db = Database::connect($this->config);
        $repo = new ProductRepository($db, $this->config);
        $state = $repo->imageState($id);
        if ($state === null) Api::fail(404, 'product_not_found');
        $storage = new ProductImage($this->config);
        $urls = new ProductImageUrl($this->config, $storage);
        if ($urls->publicImageBase() === null) Api::fail(400, 'public_url_not_configured');
        try {
            $relative = $storage->save($state['code'], (int) $slot, $tmp, $name);
        } catch (\InvalidArgumentException $saveError) {
            Api::fail(422, $saveError->getMessage() === 'Image path is too long' ? 'image_url_too_long' : 'invalid_image');
        }
        $newPath = $storage->path($state['code'], (int) $slot, $relative);
        $fullUrl = $urls->managedPublicUrl($relative);
        $columnSpec = $repo->imageColumnSpec((int) $slot);
        if ($fullUrl === null || !WebsiteImageUrl::fitsLength($fullUrl, $columnSpec['maxLength'], $columnSpec['utf16'])) {
            @unlink($newPath);
            Api::fail(422, 'image_url_too_long');
        }
        $commitAttempted = false;
        try {
            $db->beginTransaction();
            if (!$repo->updateImage($id, $state['code'], (int) $slot, $expected === '' ? null : $expected, $fullUrl)) {
                $db->rollBack();
                @unlink($newPath);
                Api::fail(409, 'image_changed');
            }
            $stored = $repo->imageState($id);
            if ($stored === null || $stored['code'] !== $state['code'] || $stored['image' . $slot] !== $fullUrl) throw new \RuntimeException('Image URL could not be stored exactly');
            $commitAttempted = true;
            $db->commit();
        } catch (\Throwable $error) {
            if ($db->inTransaction()) $db->rollBack();
            if (!$commitAttempted) @unlink($newPath);
            throw $error;
        }
        $otherSlot = $slot === '1' ? 'image2' : 'image1';
        $otherRelative = $stored[$otherSlot] === null ? null : $urls->parseManagedRelative($state['code'], $stored[$otherSlot]);
        $oldRelative = $expected === '' ? null : $urls->parseManagedRelative($state['code'], $expected);
        if ($oldRelative !== null && $oldRelative !== $relative && $oldRelative !== $otherRelative) {
            try {
                $oldPath = $storage->path($state['code'], (int) $slot, $oldRelative);
                if (!is_link($oldPath) && is_file($oldPath)) @unlink($oldPath);
            } catch (\InvalidArgumentException) { /* Never delete files outside this product's image directory. */ }
        }
        Api::respond(['ok' => true, 'path' => $fullUrl, 'imageUrl' => $fullUrl, 'sourceType' => 'upload']);
    }

}
