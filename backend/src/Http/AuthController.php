<?php

declare(strict_types=1);

namespace Sptc\MasterData\Http;

use Sptc\MasterData\Auth\Login;
use Sptc\MasterData\Auth\Session;
use Sptc\MasterData\Auth\UserRepository;
use Sptc\MasterData\Infrastructure\Config;
use Sptc\MasterData\Infrastructure\Database;

final readonly class AuthController
{
    public function __construct(private Config $config, private Session $session) {}

    public function sessionResponse(): never
    {
        Api::respond(['user' => $this->session->user(), 'csrf' => $this->session->csrf(), 'demo' => $this->config->demo()]);
    }

    public function login(): never
    {
        $contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
        if ($contentType !== 'application/json') {
            Api::fail(415, 'invalid_content_type');
        }
        $raw = file_get_contents('php://input', length: 4097);
        if ($raw === false || strlen($raw) > 4096) {
            Api::fail(413, 'invalid_input');
        }
        $body = json_decode($raw, true, 8);
        $username = is_array($body) && is_string($body['username'] ?? null) ? trim($body['username']) : '';
        $password = is_array($body) && is_string($body['password'] ?? null) ? $body['password'] : '';
        if (!Login::valid($username, $password)) {
            Api::fail(422, 'invalid_input');
        }
        $retry = Login::retryAfter($this->config, $username, (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
        if ($retry > 0) {
            header('Retry-After: ' . $retry);
            Api::fail(429, 'rate_limited');
        }

        $repository = new UserRepository(Database::connect($this->config), $this->config->demo());
        $user = $repository->verify($username, $password);
        if ($user === null) {
            Api::fail(401, 'invalid_credentials');
        }

        $this->session->replace($user);
        $this->sessionResponse();
    }

    public function logout(): never
    {
        $this->session->replace();
        $this->sessionResponse();
    }

}