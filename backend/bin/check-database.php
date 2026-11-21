<?php

declare(strict_types=1);

use Sptc\MasterData\Core\Config;
use Sptc\MasterData\Core\Database;
use Sptc\MasterData\Models\ProductRepository;
use Sptc\MasterData\Models\UserRepository;

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
} catch (Throwable $error) {
    fwrite(STDERR, 'Database check failed. ' . $error::class . ' code: ' . $error->getCode() . PHP_EOL);
    exit(1);
}
