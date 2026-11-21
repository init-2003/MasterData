<?php

declare(strict_types=1);

namespace Sptc\MasterData\Services;

use InvalidArgumentException;
use RuntimeException;
use Sptc\MasterData\Core\Config;

final readonly class ProductImage
{
    public const MAX_SIZE = 5 * 1024 * 1024;
    private const PREFIX = 'storage/product-images/';

    public function __construct(private Config $config) {}

    public static function folder(string $code): string
    {
        if ($code === '' || !mb_check_encoding($code, 'UTF-8')) throw new InvalidArgumentException('Invalid product code');
        $folder = preg_replace_callback('/[%<>:"\/\\\\|?*\x00-\x1F]/u', static fn (array $m): string => rawurlencode($m[0]), $code);
        if ($folder === null) throw new InvalidArgumentException('Invalid product code');
        $folder = preg_replace_callback('/[. ]+$/u', static fn (array $m): string => implode('', array_map(static fn (string $c): string => sprintf('%%%02X', ord($c)), str_split($m[0]))), $folder);
        if ($folder === null) throw new InvalidArgumentException('Invalid product code');
        if (preg_match('/\A(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?\z/i', $folder)) $folder = sprintf('%%%02X', ord($folder[0])) . substr($folder, 1);
        return $folder;
    }

    public function legacyPath(string $id): string
    {
        return $this->config->root . '/storage/product-images/' . ($this->config->demo() ? 'demo' : 'production') . '/' . hash('sha256', $id) . '.png';
    }

    public function path(string $code, int $slot, string $relative): string
    {
        $relative = self::shortPath($relative);
        $prefix = self::folder($code) . '/';
        $filename = substr($relative, strlen($prefix));
        if (!in_array($slot, [1, 2], true) || !str_starts_with($relative, $prefix) || !mb_check_encoding($filename, 'UTF-8') || !preg_match('/\.png\z/iD', $filename) || preg_match('/[<>:"\/\\\\|?*\x00-\x1F]/u', $filename) || preg_match('/\A(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?\z/i', $filename)) throw new InvalidArgumentException('Invalid image path');
        $base = $this->config->demo() ? $this->config->root . '/var/demo/product-images/' : $this->config->root . '/' . self::PREFIX;
        $directory = $base . self::folder($code);
        if (is_link($directory)) throw new RuntimeException('Image directory is a symbolic link');
        return $directory . '/' . $filename;
    }

    public function save(string $code, int $slot, string $uploadedPath, string $originalName): string
    {
        $size = filesize($uploadedPath);
        $info = @getimagesize($uploadedPath);
        if ($size === false || $size === 0 || $size > self::MAX_SIZE || $info === false || !in_array($info['mime'], ['image/jpeg', 'image/png', 'image/webp'], true) || $info[0] < 1 || $info[1] < 1 || $info[0] > 4096 || $info[1] > 4096 || $info[0] * $info[1] > 16000000) throw new InvalidArgumentException('Invalid image');
        if (!mb_check_encoding($originalName, 'UTF-8')) throw new InvalidArgumentException('Invalid image filename');
        $filename = basename(str_replace('\\', '/', $originalName));
        $stem = pathinfo($filename, PATHINFO_FILENAME);
        if ($stem === '') throw new InvalidArgumentException('Invalid image filename');
        $stem = self::folder($stem);
        $relative = self::folder($code) . '/' . $stem . '.png';
        if (strlen($relative) > 200) throw new InvalidArgumentException('Image path is too long');
        $path = $this->path($code, $slot, $relative);
        $bytes = file_get_contents($uploadedPath);
        $image = $bytes === false ? false : @imagecreatefromstring($bytes);
        if ($image === false) throw new InvalidArgumentException('Invalid image');
        $dir = dirname($path);
        if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) throw new RuntimeException('Unable to create image directory');
        if (is_link($dir)) throw new RuntimeException('Image directory is a symbolic link');
        $temporary = tempnam($dir, 'upload-');
        if ($temporary === false) throw new RuntimeException('Unable to create image file');
        $lock = null;
        try {
            imagesavealpha($image, true);
            if (!imagepng($image, $temporary)) throw new RuntimeException('Unable to encode image');
            $lock = fopen($dir . '/.upload.lock', 'c');
            if ($lock === false || !flock($lock, LOCK_EX)) throw new RuntimeException('Unable to lock image directory');
            $entries = scandir($dir);
            if ($entries === false) throw new RuntimeException('Unable to read image directory');
            $used = array_fill_keys(array_map(static fn (string $entry): string => mb_strtolower($entry, 'UTF-8'), $entries), true);
            for ($number = 0; $number <= 10000; $number++) {
                $name = $stem . ($number === 0 ? '' : '-' . $number) . '.png';
                $relative = self::folder($code) . '/' . $name;
                if (strlen($relative) > 200) throw new InvalidArgumentException('Image path is too long');
                if (isset($used[mb_strtolower($name, 'UTF-8')])) continue;
                $path = $this->path($code, $slot, $relative);
                $output = @fopen($path, 'xb');
                if ($output === false) {
                    if (file_exists($path) || is_link($path)) continue;
                    throw new RuntimeException('Unable to create image file');
                }
                $input = fopen($temporary, 'rb');
                $saved = false;
                try {
                    if ($input === false) throw new RuntimeException('Unable to read image file');
                    $written = stream_copy_to_stream($input, $output);
                    $saved = $written !== false && $written === filesize($temporary) && fflush($output);
                } finally {
                    if (is_resource($input)) fclose($input);
                    fclose($output);
                    if (!$saved) @unlink($path);
                }
                if (!$saved) throw new RuntimeException('Unable to save image');
                return $relative;
            }
            throw new RuntimeException('Too many files with the same name');
        } finally {
            if (is_resource($lock)) { flock($lock, LOCK_UN); fclose($lock); }
            if (is_file($temporary)) unlink($temporary);
        }
    }

    public static function shortPath(string $path): string
    {
        return str_starts_with($path, self::PREFIX) ? substr($path, strlen(self::PREFIX)) : $path;
    }

    public static function oldPath(string $path): string
    {
        return self::PREFIX . self::shortPath($path);
    }
}
