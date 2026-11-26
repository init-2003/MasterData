<?php

declare(strict_types=1);

namespace Sptc\MasterData\Controllers\Admin;

use InvalidArgumentException;
use Sptc\MasterData\Core\Api;
use Sptc\MasterData\Core\Config;
use Sptc\MasterData\Core\Database;
use Sptc\MasterData\Models\CustomerLevelRepository;
use Sptc\MasterData\Models\WebsiteImageRepository;
use Sptc\MasterData\Services\ProductImage;
use Sptc\MasterData\Services\Session;
use Sptc\MasterData\Services\WebsiteImageUrl;
use Throwable;

/**
 * @phpstan-import-type WebsiteImageItem from WebsiteImageRepository
 * @phpstan-import-type CustomerLevel from WebsiteImageRepository
 */
final readonly class WebsiteImageController
{
    /** @var key-of<WebsiteImageRepository::COLLECTIONS> */
    private string $collection;
    private WebsiteImageRepository $repository;
    private ?CustomerLevelRepository $levels;
    private ProductImage $images;
    private WebsiteImageUrl $urls;

    public function __construct(Config $config, Session $session)
    {
        if ($session->user() === null) Api::fail(401, 'unauthorized');
        $collection = $_GET['collection'] ?? null;
        if (!is_string($collection) || !isset(WebsiteImageRepository::COLLECTIONS[$collection])) {
            Api::fail(400, 'invalid_input');
        }
        $this->collection = $collection;
        $db = Database::connect($config);
        $this->repository = WebsiteImageRepository::for($db, $config->demo(), $collection);
        $this->levels = $this->repository->hasLevel() ? new CustomerLevelRepository($db, $config->demo()) : null;
        $this->images = new ProductImage($config, 'website-images');
        $this->urls = new WebsiteImageUrl($config, $this->images);
    }

    public static function publicImage(Config $config): never
    {
        if (isset($_GET[WebsiteImageUrl::PUBLIC_QUERY_PARAM])) {
            $raw = $_GET[WebsiteImageUrl::PUBLIC_QUERY_PARAM];
            if (!is_string($raw) || !mb_check_encoding($raw, 'UTF-8')) {
                Api::fail(404, 'not_found');
            }
            $parts = explode('/', $raw, 2);
            if (count($parts) !== 2 || str_contains($parts[1], '/')) {
                Api::fail(404, 'not_found');
            }
            [$collection, $filename] = $parts;
        } elseif (isset($_GET['collection'], $_GET['file'])) {
            $rawCollection = $_GET['collection'];
            $rawFile = $_GET['file'];
            if (!is_string($rawCollection) || !is_string($rawFile) || !mb_check_encoding($rawFile, 'UTF-8') || str_contains($rawFile, '/')) {
                Api::fail(404, 'not_found');
            }
            $collection = $rawCollection;
            $filename = $rawFile;
        } else {
            Api::fail(404, 'not_found');
        }

        if (!isset(WebsiteImageRepository::COLLECTIONS[$collection])) {
            Api::fail(404, 'not_found');
        }

        $images = new ProductImage($config, 'website-images');
        $type = $images->filenameMediaType($filename);
        if ($type === null) {
            Api::fail(404, 'not_found');
        }

        $urls = new WebsiteImageUrl($config, $images);
        $candidates = $urls->managedLookupCandidates($collection, $filename);
        $repository = WebsiteImageRepository::for(Database::connect($config), $config->demo(), $collection);
        if (!$repository->hasActiveManagedImage($candidates)) {
            Api::fail(404, 'not_found');
        }

        try {
            $path = $images->path($collection, 1, $collection . '/' . $filename);
        } catch (InvalidArgumentException) {
            Api::fail(404, 'not_found');
        }

        self::streamFile($path, $type);
    }

    public function items(): never
    {
        $imageColumnSpec = $this->repository->imageUrlColumnSpec();
        $linkColumnSpec = $this->repository->linkUrlColumnSpec();
        $hasLevel = $this->levels !== null;
        $config = [
            // Level collections store only the file name, so uploads do not need a public origin.
            'uploadEnabled' => $hasLevel || $this->urls->publicImageBase() !== null,
            'allowedImageHosts' => $this->urls->allowedHosts(),
            'maxImageUrlLength' => $imageColumnSpec['maxLength'],
            'maxLinkUrlLength' => $linkColumnSpec['maxLength'],
            'titleRequired' => !$hasLevel,
        ];
        if ($this->levels !== null) {
            $config['levels'] = $this->levels->all();
        }
        Api::respond([
            'items' => array_map($this->publicItem(...), $this->repository->items()),
            'config' => $config,
        ]);
    }

    public function image(): never
    {
        $id = self::id($_GET['id'] ?? null);
        $stored = isset($_GET['version'])
            ? $this->repository->imageVersion($id, self::revision($_GET['version']))
            : $this->repository->image($id, self::revision($_GET['revision'] ?? null));
        if ($stored === null) Api::fail(404, 'not_found');
        $filename = $this->urls->parseManagedFilename($this->collection, $stored);
        if ($filename === null) Api::fail(404, 'not_found');
        $type = $this->images->filenameMediaType($filename);
        if ($type === null) Api::fail(404, 'not_found');
        try {
            $path = $this->images->path($this->collection, 1, $this->collection . '/' . $filename);
        } catch (InvalidArgumentException) {
            Api::fail(404, 'not_found');
        }

        self::streamFile($path, $type);
    }

    public function save(): never
    {
        $id = isset($_POST['id']) ? self::id($_POST['id']) : null;
        $expected = $id === null ? '' : self::revision($_POST['expected'] ?? null);
        $title = is_string($_POST['title'] ?? null) ? trim($_POST['title']) : '';
        $titleLimit = $this->collection === 'carousel' ? 255 : 200;
        $active = $_POST['active'] ?? null;
        // Level collections keep the description in the optional Remark column.
        if (($title === '' && $this->levels === null) || !mb_check_encoding($title, 'UTF-8') || strlen(mb_convert_encoding($title, 'UTF-16LE', 'UTF-8')) > $titleLimit * 2
            || !in_array($active, ['0', '1'], true)) {
            Api::fail(400, 'invalid_input');
        }
        $level = null;
        if ($this->levels !== null) {
            $rawLevel = $_POST['level'] ?? null;
            $level = is_string($rawLevel) ? $this->levels->find(trim($rawLevel)) : null;
            if ($level === null) Api::fail(400, 'invalid_level');
        }

        $upload = $_FILES['image'] ?? null;
        if (is_array($upload) && ($upload['error'] ?? null) === UPLOAD_ERR_NO_FILE) {
            $upload = null;
        }
        $rawImageUrl = $_POST['imageUrl'] ?? null;
        if ($rawImageUrl !== null && !is_string($rawImageUrl)) {
            Api::fail(400, 'invalid_input');
        }
        $rawSource = $_POST['source'] ?? null;
        if ($rawSource !== null && (!is_string($rawSource) || !in_array($rawSource, ['upload', 'url'], true))) {
            Api::fail(400, 'invalid_input');
        }
        $source = $rawSource ?? (is_string($rawImageUrl) && trim($rawImageUrl) !== '' ? 'url' : 'upload');
        if ($source === 'url' && $upload !== null) {
            Api::fail(400, 'invalid_input');
        }
        if ($source === 'upload' && is_string($rawImageUrl) && trim($rawImageUrl) !== '') {
            Api::fail(400, 'invalid_input');
        }

        $existing = null;
        if ($id !== null) {
            $existing = $this->repository->findByRevision($id, $expected);
            if ($existing === null) {
                Api::fail(409, 'image_conflict');
            }
        }

        if ($source === 'url') {
            $linkColumnSpec = $this->repository->linkUrlColumnSpec();
            $validation = $this->urls->validateExternalUrl($rawImageUrl ?? '', $linkColumnSpec['maxLength'], $linkColumnSpec['utf16']);
            if ($validation['error'] !== null) {
                Api::fail(400, $validation['error']);
            }
            $newUrl = $validation['url'];
            $useLinkColumn = $this->repository->hasLinkUrl();
            $imageValue = $useLinkColumn ? '' : $newUrl;
            $linkValue = $useLinkColumn ? $newUrl : null;
            if ($id === null) {
                $this->repository->add($title, (int) $active, $imageValue, $linkValue, $level);
            } elseif (!$this->repository->update($id, $expected, $title, (int) $active, $imageValue, $linkValue, $useLinkColumn, $level)) {
                Api::fail(409, 'image_conflict');
            }

            Api::respond(['saved' => true]);
        }

        $columnSpec = $this->repository->imageUrlColumnSpec();
        $newRelative = null;
        $newImageUrl = null;
        if ($upload !== null) {
            $storesFilename = WebsiteImageUrl::storesFilename($this->collection);
            if (!$storesFilename && $this->urls->publicImageBase() === null) {
                Api::fail(400, 'public_url_not_configured');
            }
            $newRelative = $this->upload($upload);
            $filename = substr($newRelative, strlen($this->collection . '/'));
            // Web_Promotion_Level keeps only the file name, matching its existing rows.
            $storedValue = $storesFilename ? $filename : $this->urls->managedPublicUrl($this->collection, $filename);
            if ($storedValue === null || !WebsiteImageUrl::fitsLength($storedValue, $columnSpec['maxLength'], $columnSpec['utf16'])) {
                $this->remove($newRelative);
                Api::fail(400, 'image_url_too_long');
            }
            $newImageUrl = $storedValue;
        } elseif ($id === null) {
            Api::fail(400, 'invalid_image');
        } elseif ($this->urls->describe($this->collection, $existing['path'], $existing['linkUrl'])['sourceType'] === 'url') {
            Api::fail(400, 'invalid_image');
        }

        $clearLinkUrl = $this->repository->hasLinkUrl() && $newImageUrl !== null;
        try {
            if ($id === null) {
                $this->repository->add($title, (int) $active, (string) $newImageUrl, null, $level);
            } elseif (!$this->repository->update($id, $expected, $title, (int) $active, $newImageUrl, null, $clearLinkUrl, $level)) {
                if ($newRelative !== null) $this->remove($newRelative);
                Api::fail(409, 'image_conflict');
            }
        } catch (Throwable $error) {
            if ($newRelative !== null) $this->remove($newRelative);
            throw $error;
        }

        Api::respond(['saved' => true]);
    }

    private static function id(mixed $value): int
    {
        if (!is_int($value) && !is_string($value)) Api::fail(400, 'invalid_input');
        $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 2147483647]]);
        if ($id === false) Api::fail(400, 'invalid_input');
        return $id;
    }

    public function reorder(): never
    {
        $raw = file_get_contents('php://input', length: 1048577);
        $body = is_string($raw) && strlen($raw) <= 1048576 ? json_decode($raw, true) : null;
        $order = is_array($body) ? ($body['items'] ?? null) : null;
        if (!is_array($order) || !array_is_list($order) || count($order) < 2) {
            Api::fail(400, 'invalid_input');
        }
        $expected = [];
        foreach ($order as $entry) {
            if (!is_array($entry)) Api::fail(400, 'invalid_input');
            $id = self::id($entry['id'] ?? null);
            if (isset($expected[$id])) Api::fail(400, 'invalid_input');
            $expected[$id] = self::revision($entry['revision'] ?? null);
        }
        $level = null;
        if ($this->repository->hasLevel()) {
            // Rows are ordered within one customer level at a time.
            $rawLevel = $body['level'] ?? null;
            if (!is_string($rawLevel) || trim($rawLevel) === '' || strlen($rawLevel) > 10) Api::fail(400, 'invalid_input');
            $level = trim($rawLevel);
        }
        if (!$this->repository->reorder($expected, $level)) Api::fail(409, 'image_conflict');
        Api::respond(['saved' => true]);
    }

    public function delete(): never
    {
        $id = self::id($_POST['id'] ?? null);
        $expected = self::revision($_POST['expected'] ?? null);
        if (!$this->repository->delete($id, $expected)) Api::fail(409, 'image_conflict');
        Api::respond(['deleted' => true]);
    }

    public function setActive(): never
    {
        $id = self::id($_POST['id'] ?? null);
        $expected = self::revision($_POST['expected'] ?? null);
        $active = $_POST['active'] ?? null;
        if (!in_array($active, ['0', '1'], true)) Api::fail(400, 'invalid_input');
        $updated = $this->repository->setActive($id, $expected, (int) $active);
        if ($updated === null) Api::fail(409, 'image_conflict');
        Api::respond(['saved' => true, 'item' => $this->publicItem($updated)]);
    }

    private static function revision(mixed $value): string
    {
        if (!is_string($value) || !preg_match('/\A[a-f0-9]{64}\z/', $value)) Api::fail(400, 'invalid_input');
        return $value;
    }

    private static function streamFile(string $path, string $type): never
    {
        $file = is_link($path) ? false : @fopen($path, 'rb');
        if ($file === false) Api::fail(404, 'not_found');
        header('Content-Type: ' . $type);
        header('Content-Disposition: inline');
        fpassthru($file);
        fclose($file);
        exit;
    }

    /**
     * @param WebsiteImageItem $item
     * @return array{id: string, title: string, position: int, active: bool, revision: string, level?: string|null, levelName?: string|null, preview: string|null, sourceType: 'upload'|'url'|'legacy', imageUrl: string|null}
     */
    private function publicItem(array $item): array
    {
        $stored = $item['path'];
        $linkUrl = $item['linkUrl'];
        unset($item['path'], $item['linkUrl']);
        if ($this->levels === null) {
            unset($item['level'], $item['levelName']);
        }
        $described = $this->urls->describe($this->collection, $stored, $linkUrl);
        $preview = $described['managedFilename'] !== null
            ? '/admin/website-image?' . http_build_query([
                'collection' => $this->collection, 'id' => $item['id'], 'version' => hash('sha256', $stored),
            ])
            : $described['previewUrl'];
        // File names saved by the earlier promotion system may not be in storage yet; preview them from
        // WEBSITE_LEGACY_IMAGE_BASE_URL until the files are copied into storage/website-images/<collection>/.
        if ($described['managedFilename'] !== null && WebsiteImageUrl::storesFilename($this->collection)
            && !$this->managedFileExists($described['managedFilename'])) {
            $preview = $this->urls->legacyPreviewUrl($stored);
        }

        return $item + [
            'preview' => $preview,
            'sourceType' => $described['sourceType'],
            'imageUrl' => $described['imageUrl'],
        ];
    }

    private function managedFileExists(string $filename): bool
    {
        try {
            $path = $this->images->path($this->collection, 1, $this->collection . '/' . $filename);
        } catch (InvalidArgumentException) {
            return false;
        }

        return is_file($path) && !is_link($path);
    }

    private function upload(mixed $upload): string
    {
        if (!is_array($upload) || ($upload['error'] ?? null) !== UPLOAD_ERR_OK
            || !is_string($upload['name'] ?? null) || !is_string($upload['tmp_name'] ?? null)
            || !is_uploaded_file($upload['tmp_name'])) {
            Api::fail(400, 'invalid_image');
        }
        try {
            return $this->images->save($this->collection, 1, $upload['tmp_name'], $upload['name']);
        } catch (InvalidArgumentException $error) {
            Api::fail(400, $error->getMessage() === 'Image path is too long' ? 'image_url_too_long' : 'invalid_image');
        }
    }

    private function remove(string $relative): void
    {
        $path = $this->images->path($this->collection, 1, $relative);
        if (is_file($path)) @unlink($path);
    }
}
