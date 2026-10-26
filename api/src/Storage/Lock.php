<?php

declare(strict_types=1);

namespace Vlt\Storage;

/**
 * Verrou fichier exclusif : sérialise les écritures de toutes les requêtes PHP du serveur,
 * puisque l'API Sheets n'offre pas de transaction.
 */
final class Lock
{
    public function __construct(private readonly string $dir)
    {
    }

    /** @template T @param callable(): T $fn @return T */
    public function run(string $name, callable $fn, int $timeoutSeconds = 10): mixed
    {
        $path = rtrim($this->dir, '/') . '/' . preg_replace('/[^a-z0-9_-]/i', '_', $name) . '.lock';
        $handle = fopen($path, 'c');
        if ($handle === false) {
            throw new \RuntimeException("Impossible d'ouvrir le verrou $path");
        }
        $deadline = microtime(true) + $timeoutSeconds;
        while (!flock($handle, LOCK_EX | LOCK_NB)) {
            if (microtime(true) > $deadline) {
                fclose($handle);
                throw new \RuntimeException('Le serveur est occupé, réessayez dans un instant.');
            }
            usleep(50_000);
        }
        try {
            return $fn();
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }
}
