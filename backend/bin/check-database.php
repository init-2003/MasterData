<?php

declare(strict_types=1);

use Sptc\MasterData\Core\Config;
use Sptc\MasterData\Core\Database;
use Sptc\MasterData\Models\ProductRepository;
use Sptc\MasterData\Models\UserRepository;
use Sptc\MasterData\Models\WebsiteImageRepository;

require dirname(__DIR__) . '/vendor/autoload.php';

if (array_key_exists('password-stdin', getopt('', ['password-stdin']) ?: [])) {
    $line = fgets(STDIN);
    if ($line !== false) {
        $_ENV['DB_PASSWORD'] = rtrim($line, "\r\n");
    }
}

try {
    $config = new Config(dirname(__DIR__, 2));
    if ($config->demo()) {
        fwrite(STDERR, "Set APP_MODE=production to test the database connection.\n");
        exit(1);
    }
    $db = Database::connect($config);
    $repository = new ProductRepository($db, $config);
    $catalog = $repository->search('', 1);
    fwrite(STDOUT, "Database connection verified. Products: {$catalog['total']}. First page: " . count($catalog['items']) . PHP_EOL);
    $sampleId = $catalog['items'][0]['id'] ?? '';
    if ($sampleId !== '') {
        if ($repository->imageState($sampleId) === null) throw new RuntimeException('Image columns could not be read.');
        foreach ([1, 2] as $slot) {
            $spec = $repository->imageColumnSpec($slot);
            $unit = $spec['utf16'] ? 'UTF-16 chars' : 'bytes';
            fwrite(STDOUT, "Product column Trade_Image{$slot} max length: {$spec['maxLength']} ({$unit}).\n");
        }
        fwrite(STDOUT, "Product image columns verified.\n");
    }
    $search = $catalog['items'][0]['code'] ?? '';
    if ($search !== '') {
        $match = $repository->search($search, 1);
        if ($match['total'] < 1) {
            throw new RuntimeException('Search did not return the sampled product.');
        }
        fwrite(STDOUT, "Product code search verified. Matching rows: {$match['total']}.\n");
    }
    $missing = bin2hex(random_bytes(16));
    if ((new UserRepository($db, false))->verify($missing, $missing) !== null) {
        throw new RuntimeException('Unknown account was accepted.');
    }
    fwrite(STDOUT, "System_Access rejected an unknown account.\n");
    foreach (WebsiteImageRepository::COLLECTIONS as $collection => ['table' => $tableName]) {
        try {
            $websiteRepo = WebsiteImageRepository::for($db, false, $collection);
            $spec = $websiteRepo->imageUrlColumnSpec();
            $unit = $spec['utf16'] ? 'UTF-16 chars' : 'bytes';
            fwrite(STDOUT, "Website table dbo.{$tableName}.Image_Url max length: {$spec['maxLength']} ({$unit}).\n");
            if ($websiteRepo->hasLinkUrl()) {
                $linkSpec = $websiteRepo->linkUrlColumnSpec();
                $linkUnit = $linkSpec['utf16'] ? 'UTF-16 chars' : 'bytes';
                fwrite(STDOUT, "Website table dbo.{$tableName}.Link_Url max length: {$linkSpec['maxLength']} ({$linkUnit}).\n");
            }
        } catch (Throwable $websiteError) {
            fwrite(STDOUT, "Website table dbo.{$tableName} check skipped ({$websiteError->getCode()}).\n");
        }
    }
} catch (Throwable $error) {
    fwrite(STDERR, 'Database check failed. ' . $error::class . ' code: ' . $error->getCode() . PHP_EOL);
    exit(1);
}
