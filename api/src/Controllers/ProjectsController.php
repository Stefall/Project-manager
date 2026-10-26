<?php

declare(strict_types=1);

namespace Vlt\Controllers;

use Vlt\Domain\Validator;
use Vlt\Http\Request;
use Vlt\Storage\Repository;

final class ProjectsController
{
    public const FIELDS = [
        'name', 'clientId', 'client', 'summary', 'situation', 'description', 'objectives', 'scope', 'status',
        'startDate', 'endDate', 'achievements', 'watchpoints', 'nextSteps', 'links',
    ];

    public const STATUSES = ['En cadrage', 'En production', 'En pause', 'Terminé'];

    public function __construct(private readonly Repository $repo)
    {
    }

    public function update(Request $request): array
    {
        $id = $request->params['id'];
        $changes = array_intersect_key($request->body, array_flip(self::FIELDS));
        $data = array_merge($this->repo->get('PROJECTS', $id), $changes);
        $isStringList = fn ($v) => is_string($v);

        $v = (new Validator($data))
            ->string('name', true, 200)
            ->string('summary')
            ->string('situation')
            ->in('status', self::STATUSES)
            ->date('startDate')
            ->date('endDate')
            ->listOf('achievements', $isStringList, 'Liste invalide.')
            ->listOf('watchpoints', $isStringList, 'Liste invalide.')
            ->listOf('nextSteps', $isStringList, 'Liste invalide.')
            ->listOf('links', fn ($l) => is_array($l) && Validator::isUrl($l['url'] ?? null), 'Lien invalide (http ou https attendu).');
        if (!empty($data['startDate']) && !empty($data['endDate'])) {
            $v->check($data['startDate'] <= $data['endDate'], 'endDate', 'La fin doit suivre le début.');
        }
        $v->validate();

        if (isset($changes['clientId'])) {
            $changes['client'] = $this->repo->get('CLIENTS', $changes['clientId'])['name'] ?? '';
        }

        $project = $this->repo->update('PROJECTS', $id, $changes, $request->expectedVersion(), $request->user['email'],
            function (array $before, array $after) use ($id): ?array {
                $changed = self::diff($before, $after, self::FIELDS);
                if ($changed === []) {
                    return null;
                }
                return [
                    'type' => isset($changed['situation']) ? 'project.situation_updated' : 'project.updated',
                    'entityType' => 'project',
                    'projectId' => $id,
                    'changes' => $changed,
                    'description' => 'Projet modifié : ' . $after['name'],
                ];
            });
        return ['project' => $project];
    }

    public static function diff(array $before, array $after, array $fields): array
    {
        $changed = [];
        foreach ($fields as $field) {
            if (($before[$field] ?? null) !== ($after[$field] ?? null)) {
                $changed[$field] = ['before' => $before[$field] ?? null, 'after' => $after[$field] ?? null];
            }
        }
        return $changed;
    }
}
