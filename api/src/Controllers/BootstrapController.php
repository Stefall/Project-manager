<?php

declare(strict_types=1);

namespace Vlt\Controllers;

use Vlt\Domain\Settings;
use Vlt\Http\Request;
use Vlt\Storage\Repository;

/**
 * Renvoie en un appel tout ce dont l'interface a besoin (un seul batchGet côté Sheets).
 * Le front compare `revision` pour savoir s'il doit rafraîchir.
 */
final class BootstrapController
{
    private const TABS = ['CLIENTS', 'PROJECTS', 'DELIVERABLES', 'TASKS', 'SETTINGS'];

    public function __construct(private readonly Repository $repo)
    {
    }

    public function show(Request $request): array
    {
        $since = isset($request->query['since']) ? (int) $request->query['since'] : null;
        $revision = $this->repo->revision();
        if ($since !== null && $since === $revision) {
            return ['revision' => $revision, 'unchanged' => true];
        }

        $data = $this->repo->snapshot(self::TABS);
        $settings = [];
        foreach ($data['SETTINGS'] as $row) {
            $settings[$row['id']] = $row['value'] ?? null;
        }

        return [
            'revision' => $revision,
            'clients' => $data['CLIENTS'],
            'projects' => $data['PROJECTS'],
            'deliverables' => $data['DELIVERABLES'],
            'tasks' => array_values(array_filter($data['TASKS'], fn ($t) => !$t['archived'])),
            'settings' => (new Settings($settings))->toArray(),
        ];
    }
}
