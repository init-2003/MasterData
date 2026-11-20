<?php

declare(strict_types=1);

use Sptc\MasterData\Infrastructure\Config;
use Sptc\MasterData\Infrastructure\Database;
use Sptc\MasterData\Auth\Login;

require dirname(__DIR__) . '/vendor/autoload.php';

$config = new Config(dirname(__DIR__, 2));
if (!$config->demo()) {
    fwrite(STDERR, "Set APP_MODE=demo to create a sample account.\n");
    exit(1);
}

$username = strtolower(trim($argv[1] ?? ''));
$line = fgets(STDIN);
$password = $line === false ? '' : rtrim($line, "\r\n");
if (!Login::valid($username, $password) || strlen($password) < 12 || strlen($password) > 72) {
    fwrite(STDERR, "Usage: create-demo-user.php <username> with a 12–72 byte password on stdin (up to 50 characters).\n");
    exit(1);
}

try {
    $db = Database::connect($config);
    $query = $db->prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    $query->execute([$username, password_hash($password, PASSWORD_DEFAULT)]);
    fwrite(STDOUT, "Demo user created: {$username}\n");
} catch (Throwable $error) {
    fwrite(STDERR, 'Unable to create demo user. Seed demo data and use a unique username. Error code: ' . $error->getCode() . PHP_EOL);
    exit(1);
}
