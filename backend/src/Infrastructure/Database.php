<?php

declare(strict_types=1);

namespace Sptc\MasterData\Infrastructure;

use PDO;
use RuntimeException;

final class Database
{
    public static function connect(Config $config): PDO
    {
        if ($config->demo()) {
            return new PDO('sqlite:' . $config->runtime() . '/catalog.sqlite', options: [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        }

        if (!in_array('sqlsrv', PDO::getAvailableDrivers(), true)) {
            throw new RuntimeException('PHP PDO_SQLSRV is required');
        }

        $server = $config->required('DB_SERVER');
        $database = $config->required('DB_DATABASE');
        foreach ([$server, $database] as $part) {
            if (preg_match('/[;{}\x00-\x1F]/', $part)) {
                throw new RuntimeException('Invalid SQL Server connection setting');
            }
        }

        $trust = $config->boolean('DB_TRUST_CERTIFICATE') ? 'yes' : 'no';
        $dsn = "sqlsrv:Server={$server};Database={$database};Encrypt=yes;TrustServerCertificate={$trust};LoginTimeout=5";

        return new PDO($dsn, $config->required('DB_USER'), $config->required('DB_PASSWORD'), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
}
