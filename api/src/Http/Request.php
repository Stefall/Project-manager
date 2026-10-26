<?php

declare(strict_types=1);

namespace Vlt\Http;

final class Request
{
    public array $params = [];
    public ?array $user = null;

    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        public readonly array $body,
        public readonly array $headers,
    ) {
    }

    public static function fromGlobals(): self
    {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $path = '/' . trim(preg_replace('#^/api#', '', $path), '/');
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr($key, 5)))] = $value;
            }
        }
        $raw = file_get_contents('php://input') ?: '';
        $body = $raw !== '' ? json_decode($raw, true) : [];
        if (!is_array($body)) {
            throw new HttpException(400, 'Corps de requête JSON invalide.');
        }
        return new self(strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'), $path, $_GET, $body, $headers);
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    /** Version attendue, envoyée dans If-Match (obligatoire pour toute modification). */
    public function expectedVersion(): int
    {
        $value = $this->header('if-match');
        if ($value === null || !ctype_digit(trim($value, '"'))) {
            throw new HttpException(428, 'En-tête If-Match manquant : rechargez la ressource avant de la modifier.');
        }
        return (int) trim($value, '"');
    }
}
