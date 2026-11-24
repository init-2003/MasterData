<?php

declare(strict_types=1);

namespace Sptc\MasterData\Services;

use InvalidArgumentException;
use Sptc\MasterData\Core\Config;

final readonly class ProductImageUrl
{
    private WebsiteImageUrl $shared;

    public function __construct(
        Config $config,
        private ProductImage $images,
    ) {
        $this->shared = new WebsiteImageUrl($config, new ProductImage($config, 'website-images'));
    }

    public function publicImageBase(): ?string
    {
        $origin = $this->shared->publicOrigin();
        $basePath = $this->shared->basePath();
        if ($origin === null || $basePath === null) {
            return null;
        }

        return $origin . $basePath . '/product-images';
    }

    /** @return list<string> */
    public function allowedHosts(): array
    {
        return $this->shared->allowedHosts();
    }

    public function managedPublicUrl(string $relative): ?string
    {
        $short = ProductImage::shortPath($relative);
        $parts = explode('/', $short, 2);
        if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '' || str_contains($parts[1], '/')) {
            return null;
        }
        [$folder, $filename] = $parts;
        if ($this->images->filenameMediaType($filename) === null) {
            return null;
        }
        $base = $this->publicImageBase();
        if ($base === null) {
            return null;
        }

        return $base . '/' . rawurlencode($folder) . '/' . rawurlencode($filename);
    }

    /** @return list<string> */
    public function lookupCandidates(string $relative): array
    {
        $short = ProductImage::shortPath($relative);
        $candidates = [$short, ProductImage::oldPath($short)];
        $canonical = $this->managedPublicUrl($short);
        if ($canonical !== null) {
            $candidates[] = $canonical;
        }

        return array_values(array_unique($candidates));
    }

    public function parseManagedRelative(string $code, string $stored): ?string
    {
        try {
            $expectedFolder = ProductImage::folder($code);
        } catch (InvalidArgumentException) {
            return null;
        }

        $short = ProductImage::shortPath($stored);
        $prefix = $expectedFolder . '/';
        if (str_starts_with($short, $prefix)) {
            $filename = substr($short, strlen($prefix));
            if ($filename !== '' && !str_contains($filename, '/') && $this->images->filenameMediaType($filename) !== null) {
                return $short;
            }
            return null;
        }

        $base = $this->publicImageBase();
        if ($base === null || !str_starts_with($stored, $base . '/')) {
            return null;
        }
        $tail = substr($stored, strlen($base) + 1);
        if ($tail === '' || str_contains($tail, '?') || str_contains($tail, '#')) {
            return null;
        }
        $parts = explode('/', $tail, 2);
        if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '' || str_contains($parts[1], '/')) {
            return null;
        }
        $folder = rawurldecode($parts[0]);
        $filename = rawurldecode($parts[1]);
        if ($folder !== $expectedFolder || str_contains($filename, '/') || $this->images->filenameMediaType($filename) === null) {
            return null;
        }
        $relative = $folder . '/' . $filename;

        return $this->managedPublicUrl($relative) === $stored ? $relative : null;
    }

    /**
     * @return array{url: string, error: null}|array{url: null, error: 'invalid_image_url'|'image_host_not_allowed'|'image_url_too_long'}
     */
    public function validateExternalUrl(string $raw, int $maxLength, bool $utf16Units = false): array
    {
        $trimmed = trim($raw);
        if ($trimmed === '' || !mb_check_encoding($trimmed, 'UTF-8') || preg_match('/[\x00-\x20\x7F]/', $trimmed)) {
            return ['url' => null, 'error' => 'invalid_image_url'];
        }
        $prepared = $utf16Units ? $trimmed : self::encodeNonAscii($trimmed);

        return $this->shared->validateExternalUrl($prepared, $maxLength, $utf16Units);
    }

    /**
     * @return array{
     *     sourceType: 'upload'|'url'|'legacy'|null,
     *     managedRelative: string|null,
     *     previewUrl: string|null,
     *     imageUrl: string|null,
     * }
     */
    public function describe(string $code, ?string $stored): array
    {
        if ($stored === null || trim($stored) === '') {
            return [
                'sourceType' => null,
                'managedRelative' => null,
                'previewUrl' => null,
                'imageUrl' => null,
            ];
        }

        $managedRelative = $this->parseManagedRelative($code, $stored);
        if ($managedRelative !== null) {
            $isFullUrl = $this->shared->isHttpUrl($stored);
            return [
                'sourceType' => 'upload',
                'managedRelative' => $managedRelative,
                'previewUrl' => null,
                'imageUrl' => $isFullUrl ? $stored : null,
            ];
        }

        if ($this->shared->isHttpUrl($stored)) {
            $validated = $this->validateExternalUrl($stored, PHP_INT_MAX, true);
            return [
                'sourceType' => 'url',
                'managedRelative' => null,
                'previewUrl' => $validated['url'],
                'imageUrl' => $stored,
            ];
        }

        return [
            'sourceType' => 'legacy',
            'managedRelative' => null,
            'previewUrl' => null,
            'imageUrl' => null,
        ];
    }

    private static function encodeNonAscii(string $url): string
    {
        $encoded = preg_replace_callback(
            '/[^\x21-\x7E]/u',
            static fn (array $match): string => rawurlencode($match[0]),
            $url,
        );

        return is_string($encoded) ? $encoded : $url;
    }
}
