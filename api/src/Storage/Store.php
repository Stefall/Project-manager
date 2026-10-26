<?php

declare(strict_types=1);

namespace Vlt\Storage;

/**
 * Accès brut aux onglets au format « id | json » du Google Sheet.
 * Chaque ligne : colonne A = identifiant, colonne B = objet JSON.
 */
interface Store
{
    /** @return array<string, array{row: int, data: array}> lignes indexées par id */
    public function readTab(string $tab): array;

    /** @param array<int, string> $tabs @return array<string, array<string, array{row: int, data: array}>> */
    public function readTabs(array $tabs): array;

    /** Réécrit une seule ligne existante (numéro de ligne 1-based). */
    public function writeRow(string $tab, int $row, string $id, array $data): void;

    /** Ajoute une ligne en fin d'onglet. */
    public function appendRow(string $tab, string $id, array $data): void;

    /** Lit une plage brute (pour META, qui n'est pas au format id | json). */
    public function readRange(string $range): array;

    public function writeRange(string $range, array $values): void;

    /** Vide le cache de lecture après une écriture. */
    public function invalidate(): void;
}
