<?php

declare(strict_types=1);

namespace Vlt\Domain;

final class Ids
{
    /** Prochain id séquentiel : T-001, T-002… en reprenant après le plus grand existant. */
    public static function sequential(string $prefix, int $pad = 3): callable
    {
        return function (array $existing) use ($prefix, $pad): string {
            $max = 0;
            foreach ($existing as $id) {
                if (preg_match('/^' . preg_quote($prefix, '/') . '-(\d+)$/', (string) $id, $m)) {
                    $max = max($max, (int) $m[1]);
                }
            }
            return sprintf('%s-%0' . $pad . 'd', $prefix, $max + 1);
        };
    }
}
