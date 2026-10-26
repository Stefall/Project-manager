<?php

declare(strict_types=1);

namespace Vlt\Storage;

use Google\Client;
use Google\Service\Sheets;
use Google\Service\Sheets\ValueRange;

/**
 * Accès au Google Sheet via un compte de service. Les identifiants ne quittent jamais le serveur.
 * Les lectures sont regroupées en un seul batchGet et mises en cache quelques secondes.
 */
final class GoogleSheetsStore implements Store
{
    private Sheets $sheets;

    public function __construct(
        private readonly string $spreadsheetId,
        string $serviceAccountFile,
        private readonly string $cacheDir,
        private readonly int $cacheTtl = 5,
    ) {
        $client = new Client();
        $client->setAuthConfig($serviceAccountFile);
        $client->setScopes([Sheets::SPREADSHEETS]);
        $this->sheets = new Sheets($client);
    }

    public function readTab(string $tab): array
    {
        return $this->readTabs([$tab])[$tab];
    }

    public function readTabs(array $tabs): array
    {
        $cacheFile = $this->cacheDir . '/sheets-' . md5(implode(',', $tabs)) . '.json';
        if (is_file($cacheFile) && filemtime($cacheFile) > time() - $this->cacheTtl) {
            return json_decode((string) file_get_contents($cacheFile), true);
        }

        $ranges = array_map(fn (string $t) => "$t!A:B", $tabs);
        $response = $this->sheets->spreadsheets_values->batchGet($this->spreadsheetId, ['ranges' => $ranges]);

        $out = [];
        foreach ($response->getValueRanges() as $i => $valueRange) {
            $tab = $tabs[$i];
            $out[$tab] = [];
            foreach ($valueRange->getValues() ?? [] as $r => $row) {
                if ($r === 0 || ($row[0] ?? '') === '') {
                    continue;
                }
                $out[$tab][(string) $row[0]] = ['row' => $r + 1, 'data' => json_decode($row[1] ?? '{}', true) ?: []];
            }
        }
        file_put_contents($cacheFile, json_encode($out, JSON_UNESCAPED_UNICODE));
        return $out;
    }

    public function writeRow(string $tab, int $row, string $id, array $data): void
    {
        $body = new ValueRange(['values' => [[$id, LocalJsonStore::encode($data)]]]);
        $this->sheets->spreadsheets_values->update(
            $this->spreadsheetId,
            "$tab!A$row:B$row",
            $body,
            ['valueInputOption' => 'RAW'],
        );
    }

    public function appendRow(string $tab, string $id, array $data): void
    {
        $body = new ValueRange(['values' => [[$id, LocalJsonStore::encode($data)]]]);
        $this->sheets->spreadsheets_values->append(
            $this->spreadsheetId,
            "$tab!A:B",
            $body,
            ['valueInputOption' => 'RAW', 'insertDataOption' => 'INSERT_ROWS'],
        );
    }

    public function readRange(string $range): array
    {
        return $this->sheets->spreadsheets_values->get($this->spreadsheetId, $range)->getValues() ?? [];
    }

    public function writeRange(string $range, array $values): void
    {
        $this->sheets->spreadsheets_values->update(
            $this->spreadsheetId,
            $range,
            new ValueRange(['values' => $values]),
            ['valueInputOption' => 'RAW'],
        );
    }

    public function invalidate(): void
    {
        foreach (glob($this->cacheDir . '/sheets-*.json') ?: [] as $file) {
            @unlink($file);
        }
    }
}
