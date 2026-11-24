<?php

declare(strict_types=1);

namespace Sptc\MasterData\Services;

use Sptc\MasterData\Core\Config;

final readonly class WebsiteImageUrl
{
    public const PUBLIC_QUERY_PARAM = 'website-image';

    public function __construct(
        private Config $config,
        private ProductImage $images,
    ) {
    }

    public function publicOrigin(): ?string
    {
        $raw = trim($this->config->value('APP_PUBLIC_ORIGIN'));
        if ($raw === '' || !mb_check_encoding($raw, 'UTF-8') || preg_match('/[\x00-\x20\x7F]/', $raw)) {
            return null;
        }
        $parts = parse_url($raw);
        if (!is_array($parts)) {
            return null;
        }
        $scheme = isset($parts['scheme']) ? strtolower($parts['scheme']) : '';
        $requireHttps = $this->config->boolean('APP_HTTPS', $this->config->demo() ? 'false' : 'true');
        if ($requireHttps ? $scheme !== 'https' : !in_array($scheme, ['https', 'http'], true)) {
            return null;
        }
        if (isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) {
            return null;
        }
        $path = $parts['path'] ?? '';
        if ($path !== '' && $path !== '/') {
            return null;
        }
        $host = isset($parts['host']) ? rtrim(strtolower($parts['host']), '.') : '';
        if ($host === '' || (!self::isValidHostname($host) && filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) === false)) {
            return null;
        }
        $port = $parts['port'] ?? null;
        if ($port !== null && (($scheme === 'https' && $port === 443) || ($scheme === 'http' && $port === 80))) {
            $port = null;
        }

        return $scheme . '://' . $host . ($port !== null ? ':' . $port : '');
    }

    public function basePath(): ?string
    {
        $raw = trim($this->config->value('APP_BASE_PATH'));
        if ($raw === '' || $raw === '/') {
            return '';
        }
        if (!mb_check_encoding($raw, 'UTF-8') || preg_match('/[\x00-\x20\x7F?#\\\\]/', $raw)) {
            return null;
        }
        $trimmed = trim($raw, '/');
        if ($trimmed === '') {
            return '';
        }
        $segments = explode('/', $trimmed);
        foreach ($segments as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..' || !preg_match('/\A[A-Za-z0-9._~%-]+\z/', $segment)) {
                return null;
            }
        }

        return '/' . implode('/', $segments);
    }

    public function publicEndpointBase(): ?string
    {
        $origin = $this->publicOrigin();
        $basePath = $this->basePath();
        if ($origin === null || $basePath === null) {
            return null;
        }

        return $origin . $basePath . '/api.php';
    }

    public function publicImageBase(): ?string
    {
        $origin = $this->publicOrigin();
        $basePath = $this->basePath();
        if ($origin === null || $basePath === null) {
            return null;
        }

        return $origin . $basePath . '/website-images';
    }

    /** @return list<string> */
    public function allowedHosts(): array
    {
        $raw = $this->config->value('WEBSITE_ALLOWED_IMAGE_HOSTS');
        if (trim($raw) === '') {
            return [];
        }
        $hosts = [];
        foreach (explode(',', $raw) as $entry) {
            $host = rtrim(strtolower(trim($entry)), '.');
            if ($host === '' || filter_var($host, FILTER_VALIDATE_IP) !== false || !self::isValidHostname($host)) {
                continue;
            }
            $hosts[] = $host;
        }

        return array_values(array_unique($hosts));
    }

    public function managedPublicUrl(string $collection, string $filename): ?string
    {
        if ($this->images->filenameMediaType($filename) === null) {
            return null;
        }
        $base = $this->publicImageBase();
        if ($base === null) {
            return null;
        }

        return $base . '/' . $collection . '/' . rawurlencode($filename);
    }

    public function legacyQueryPublicUrl(string $collection, string $filename): ?string
    {
        if ($this->images->filenameMediaType($filename) === null) {
            return null;
        }
        $endpoint = $this->publicEndpointBase();
        if ($endpoint === null) {
            return null;
        }

        return $endpoint . '?' . self::PUBLIC_QUERY_PARAM . '=' . $collection . '/' . rawurlencode($filename);
    }

    /** @return list<string> */
    public function managedLookupCandidates(string $collection, string $filename): array
    {
        if ($this->images->filenameMediaType($filename) === null) {
            return [];
        }
        $candidates = ['website-images/' . $collection . '/' . $filename];
        $canonical = $this->managedPublicUrl($collection, $filename);
        if ($canonical !== null) {
            $candidates[] = $canonical;
        }
        $legacyQuery = $this->legacyQueryPublicUrl($collection, $filename);
        if ($legacyQuery !== null) {
            $candidates[] = $legacyQuery;
        }

        return $candidates;
    }

    public function parseManagedFilename(string $collection, string $imageUrl): ?string
    {
        $legacyPrefix = 'website-images/' . $collection . '/';
        if (str_starts_with($imageUrl, $legacyPrefix)) {
            $filename = substr($imageUrl, strlen($legacyPrefix));
            return $this->images->filenameMediaType($filename) !== null ? $filename : null;
        }

        $cleanBase = $this->publicImageBase();
        $cleanPrefix = $cleanBase === null ? null : $cleanBase . '/' . $collection . '/';
        if ($cleanPrefix !== null && str_starts_with($imageUrl, $cleanPrefix)) {
            $encoded = substr($imageUrl, strlen($cleanPrefix));
            if ($encoded !== '' && !str_contains($encoded, '/') && !str_contains($encoded, '?') && !str_contains($encoded, '#')) {
                $filename = rawurldecode($encoded);
                if (!str_contains($filename, '/') && $this->images->filenameMediaType($filename) !== null
                    && $this->managedPublicUrl($collection, $filename) === $imageUrl) {
                    return $filename;
                }
            }
            return null;
        }

        $endpoint = $this->publicEndpointBase();
        if ($endpoint === null || !str_starts_with($imageUrl, $endpoint . '?')) {
            return null;
        }
        $query = substr($imageUrl, strlen($endpoint) + 1);
        parse_str($query, $params);
        if (array_keys($params) !== [self::PUBLIC_QUERY_PARAM]) {
            return null;
        }
        $target = $params[self::PUBLIC_QUERY_PARAM];
        if (!is_string($target) || !str_starts_with($target, $collection . '/')) {
            return null;
        }
        $filename = substr($target, strlen($collection) + 1);
        if ($filename === '' || str_contains($filename, '/') || $this->images->filenameMediaType($filename) === null) {
            return null;
        }

        return $this->legacyQueryPublicUrl($collection, $filename) === $imageUrl ? $filename : null;
    }

    /**
     * @return array{url: string, error: null}|array{url: null, error: 'invalid_image_url'|'image_host_not_allowed'|'image_url_too_long'}
     */
    public function validateExternalUrl(string $raw, int $maxLength, bool $utf16Units = true): array
    {
        $url = trim($raw);
        if ($url === '' || !mb_check_encoding($url, 'UTF-8') || preg_match('/[\x00-\x20\x7F]/', $url)) {
            return ['url' => null, 'error' => 'invalid_image_url'];
        }
        $parts = parse_url($url);
        if (!is_array($parts)) {
            return ['url' => null, 'error' => 'invalid_image_url'];
        }
        $scheme = isset($parts['scheme']) ? strtolower($parts['scheme']) : '';
        if (!in_array($scheme, ['https', 'http'], true) || isset($parts['user']) || isset($parts['pass']) || isset($parts['fragment'])) {
            return ['url' => null, 'error' => 'invalid_image_url'];
        }
        $port = $parts['port'] ?? null;
        if ($port !== null && (($scheme === 'https' && $port === 443) || ($scheme === 'http' && $port === 80))) {
            $port = null;
        }
        $host = isset($parts['host']) ? rtrim(strtolower($parts['host']), '.') : '';
        if ($host === '' || (!self::isValidHostname($host) && filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) === false)) {
            return ['url' => null, 'error' => 'invalid_image_url'];
        }
        $path = $parts['path'] ?? '';
        if ($path === '' || $path === '/' || !str_starts_with($path, '/') || str_contains($path, '\\')) {
            return ['url' => null, 'error' => 'invalid_image_url'];
        }
        $allowedHosts = $this->allowedHosts();
        if ($allowedHosts !== [] && !in_array($host, $allowedHosts, true)) {
            return ['url' => null, 'error' => 'image_host_not_allowed'];
        }

        $normalized = $scheme . '://' . $host . ($port !== null ? ':' . $port : '') . $path . (isset($parts['query']) ? '?' . $parts['query'] : '');
        if (!self::fitsLength($normalized, $maxLength, $utf16Units)) {
            return ['url' => null, 'error' => 'image_url_too_long'];
        }

        return ['url' => $normalized, 'error' => null];
    }

    public function isHttpUrl(string $value): bool
    {
        return preg_match('~\Ahttps?://~i', trim($value)) === 1;
    }

    /**
     * @return array{
     *     sourceType: 'upload'|'url'|'legacy',
     *     managedFilename: string|null,
     *     previewUrl: string|null,
     *     imageUrl: string|null,
     * }
     */
    public function describe(string $collection, string $stored, ?string $linkUrl = null): array
    {
        if (trim($stored) === '' && $linkUrl !== null && trim($linkUrl) !== '') {
            $trimmedLink = trim($linkUrl);
            $validated = $this->validateExternalUrl($trimmedLink, PHP_INT_MAX, false);
            return [
                'sourceType' => 'url',
                'managedFilename' => null,
                'previewUrl' => $validated['url'],
                'imageUrl' => $trimmedLink,
            ];
        }

        $managedFilename = $this->parseManagedFilename($collection, $stored);
        if ($managedFilename !== null) {
            $isLegacyManaged = str_starts_with($stored, 'website-images/' . $collection . '/');
            return [
                'sourceType' => 'upload',
                'managedFilename' => $managedFilename,
                'previewUrl' => null,
                'imageUrl' => $isLegacyManaged ? null : $stored,
            ];
        }

        if ($this->isHttpUrl($stored)) {
            $validated = $this->validateExternalUrl($stored, PHP_INT_MAX, false);
            return [
                'sourceType' => 'url',
                'managedFilename' => null,
                'previewUrl' => $validated['url'],
                'imageUrl' => $stored,
            ];
        }

        return [
            'sourceType' => 'legacy',
            'managedFilename' => null,
            'previewUrl' => $this->legacyPreviewUrl($stored),
            'imageUrl' => null,
        ];
    }

    public function legacyPreviewUrl(string $stored): ?string
    {
        $base = trim($this->config->value('WEBSITE_LEGACY_IMAGE_BASE_URL'));
        if (!preg_match('~\Ahttps?://[^/?#@]+(?:/[^?#]*)?\z~i', $base)
            || !preg_match('~\A[^/\\\\?#:\x00-\x1f]+\.(?:jpe?g|png|webp|gif|avif)\z~i', $stored)) {
            return null;
        }

        return rtrim($base, '/') . '/' . rawurlencode($stored);
    }

    public static function fitsLength(string $value, int $maxLength, bool $utf16Units = true): bool
    {
        if ($maxLength < 1 || !mb_check_encoding($value, 'UTF-8')) {
            return false;
        }
        if ($utf16Units) {
            return strlen(mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')) <= $maxLength * 2;
        }

        return strlen($value) <= $maxLength;
    }

    private static function isValidHostname(string $host): bool
    {
        return preg_match('/\A(?=.{1,253}\z)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\z/', $host) === 1;
    }
}
