<?php

declare(strict_types=1);

namespace Vlt\Storage;

/**
 * Lecture et écriture des entités avec contrôle de version optimiste.
 * Toute écriture : verrou → relecture de la ligne → comparaison de version → écriture d'une seule ligne
 * → ajout d'un événement → incrément de META.revision.
 */
final class Repository
{
    public function __construct(private readonly Store $store, private readonly Lock $lock)
    {
    }

    /** @return array<int, array> */
    public function all(string $tab, bool $withArchived = false): array
    {
        $items = array_map(fn ($r) => self::normalize($r['data']), array_values($this->store->readTab($tab)));
        return $withArchived ? $items : array_values(array_filter($items, fn ($i) => empty($i['archived'])));
    }

    /** @param array<int, string> $tabs @return array<string, array<int, array>> */
    public function snapshot(array $tabs): array
    {
        $out = [];
        foreach ($this->store->readTabs($tabs) as $tab => $rows) {
            $out[$tab] = array_values(array_map(fn ($r) => self::normalize($r['data']), $rows));
        }
        return $out;
    }

    public function get(string $tab, string $id): array
    {
        $rows = $this->store->readTab($tab);
        if (!isset($rows[$id])) {
            throw new NotFoundException("$tab/$id introuvable");
        }
        return self::normalize($rows[$id]['data']);
    }

    /**
     * Crée une entité. $idFactory reçoit les ids existants et renvoie le nouvel id.
     * @param callable(array<int,string>): string $idFactory
     */
    public function create(string $tab, array $data, string $user, callable $idFactory, ?array $event = null): array
    {
        return $this->lock->run('write', function () use ($tab, $data, $user, $idFactory, $event) {
            $this->store->invalidate();
            $rows = $this->store->readTab($tab);
            $now = self::now();
            $data['id'] = $idFactory(array_keys($rows));
            $data['version'] = 1;
            $data['createdAt'] = $data['createdAt'] ?? $now;
            $data['updatedAt'] = $now;
            $data['updatedBy'] = $user;
            $data['archived'] = false;
            $this->store->appendRow($tab, $data['id'], $data);
            if ($event !== null) {
                $this->appendEvent($event + ['entity' => $data['id']], $user);
            }
            $this->bumpRevision($user);
            $this->store->invalidate();
            return $data;
        });
    }

    /**
     * Met à jour une entité si sa version n'a pas changé depuis la lecture du client.
     * @param callable(array, array): ?array $buildEvent reçoit (avant, après) et renvoie l'événement à journaliser
     */
    public function update(string $tab, string $id, array $changes, int $expectedVersion, string $user, ?callable $buildEvent = null): array
    {
        return $this->lock->run('write', function () use ($tab, $id, $changes, $expectedVersion, $user, $buildEvent) {
            $this->store->invalidate();
            $rows = $this->store->readTab($tab);
            if (!isset($rows[$id])) {
                throw new NotFoundException("$tab/$id introuvable");
            }
            $current = self::normalize($rows[$id]['data']);
            if ($current['version'] !== $expectedVersion) {
                throw new ConflictException($current, $expectedVersion);
            }
            unset($changes['id'], $changes['version'], $changes['createdAt']);
            $next = array_merge($current, $changes, [
                'version' => $current['version'] + 1,
                'updatedAt' => self::now(),
                'updatedBy' => $user,
            ]);
            $this->store->writeRow($tab, $rows[$id]['row'], $id, $next);
            $event = $buildEvent ? $buildEvent($current, $next) : null;
            if ($event !== null) {
                $this->appendEvent($event + ['entity' => $id], $user);
            }
            $this->bumpRevision($user);
            $this->store->invalidate();
            return $next;
        });
    }

    /** EVENTS est en ajout seul : aucune méthode ne permet de modifier ou supprimer un événement. */
    public function appendEvent(array $event, string $user): array
    {
        $date = self::now();
        $event = array_merge([
            'id' => 'EV-' . (int) (microtime(true) * 1000) . bin2hex(random_bytes(2)),
            'date' => $date,
            'author' => $user,
        ], $event);
        $this->store->appendRow('EVENTS', $event['id'], $event);
        return $event;
    }

    public function revision(): int
    {
        $rows = $this->store->readRange('META!A1:C2');
        return (int) ($rows[1][0] ?? 0);
    }

    private function bumpRevision(string $user): void
    {
        $this->store->writeRange('META!A1:C2', [
            ['revision', 'updated_at', 'updated_by'],
            [(string) ($this->revision() + 1), self::now(), $user],
        ]);
    }

    /** Les lignes écrites par l'Apps Script n'ont ni version ni archived : on leur donne des valeurs par défaut. */
    private static function normalize(array $data): array
    {
        $data['version'] = (int) ($data['version'] ?? 1);
        $data['archived'] = (bool) ($data['archived'] ?? false);
        return $data;
    }

    public static function now(): string
    {
        return (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
    }
}
