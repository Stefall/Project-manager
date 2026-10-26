<?php

declare(strict_types=1);

namespace Vlt\Storage;

/**
 * Imite le Google Sheet dans un fichier JSON local, pour développer et tester sans accès Google.
 * Format du fichier : { "TASKS": [["id","json"], ["T-001","{...}"], ...], "META": [[...]] }
 */
final class LocalJsonStore implements Store
{
    public function __construct(private readonly string $file)
    {
    }

    public function readTab(string $tab): array
    {
        $rows = $this->load()[$tab] ?? [];
        $out = [];
        foreach ($rows as $i => $row) {
            if ($i === 0 || ($row[0] ?? '') === '') {
                continue;
            }
            $out[(string) $row[0]] = ['row' => $i + 1, 'data' => json_decode($row[1] ?? '{}', true) ?: []];
        }
        return $out;
    }

    public function readTabs(array $tabs): array
    {
        $out = [];
        foreach ($tabs as $tab) {
            $out[$tab] = $this->readTab($tab);
        }
        return $out;
    }

    public function writeRow(string $tab, int $row, string $id, array $data): void
    {
        $all = $this->load();
        $all[$tab][$row - 1] = [$id, self::encode($data)];
        $this->save($all);
    }

    public function appendRow(string $tab, string $id, array $data): void
    {
        $all = $this->load();
        $all[$tab] ??= [['id', 'json']];
        $all[$tab][] = [$id, self::encode($data)];
        $this->save($all);
    }

    public function readRange(string $range): array
    {
        [$tab] = explode('!', $range);
        return $this->load()[$tab] ?? [];
    }

    public function writeRange(string $range, array $values): void
    {
        [$tab] = explode('!', $range);
        $all = $this->load();
        $all[$tab] = $values;
        $this->save($all);
    }

    public function invalidate(): void
    {
    }

    public static function encode(array $data): string
    {
        return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    private function load(): array
    {
        if (!is_file($this->file)) {
            return [];
        }
        return json_decode((string) file_get_contents($this->file), true) ?: [];
    }

    private function save(array $all): void
    {
        $tmp = $this->file . '.tmp';
        file_put_contents($tmp, json_encode($all, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        rename($tmp, $this->file);
    }
}
