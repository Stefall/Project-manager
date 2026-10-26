<?php

declare(strict_types=1);

namespace Vlt\Security;

/** Limite les tentatives de connexion : 5 échecs par e-mail et par IP en 15 minutes. */
final class LoginThrottle
{
    private const MAX_ATTEMPTS = 5;
    private const WINDOW = 900;

    public function __construct(private readonly string $dir)
    {
    }

    public function tooMany(string $key): bool
    {
        return count($this->attempts($key)) >= self::MAX_ATTEMPTS;
    }

    public function fail(string $key): void
    {
        $attempts = $this->attempts($key);
        $attempts[] = time();
        file_put_contents($this->file($key), json_encode($attempts));
    }

    public function clear(string $key): void
    {
        @unlink($this->file($key));
    }

    private function attempts(string $key): array
    {
        $file = $this->file($key);
        $list = is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
        return array_values(array_filter($list, fn (int $t) => $t > time() - self::WINDOW));
    }

    private function file(string $key): string
    {
        return rtrim($this->dir, '/') . '/login-' . hash('sha256', $key) . '.json';
    }
}
