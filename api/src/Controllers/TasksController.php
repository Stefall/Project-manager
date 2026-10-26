<?php

declare(strict_types=1);

namespace Vlt\Controllers;

use Vlt\Domain\Ids;
use Vlt\Domain\Settings;
use Vlt\Domain\Validator;
use Vlt\Http\HttpException;
use Vlt\Http\Request;
use Vlt\Storage\Repository;

final class TasksController
{
    /** Champs modifiables par le client ; tout le reste est calculé côté serveur. */
    private const FIELDS = [
        'projectId', 'deliverableId', 'title', 'description', 'status', 'priority', 'poles',
        'startDate', 'deadline', 'deadlineText', 'note', 'checklist', 'links',
    ];

    public function __construct(private readonly Repository $repo)
    {
    }

    public function create(Request $request): array
    {
        $data = array_intersect_key($request->body, array_flip(self::FIELDS)) + [
            'status' => 'À faire',
            'priority' => 'Normale',
            'poles' => [],
            'checklist' => [],
            'links' => [],
        ];
        $this->validate($data, true);
        $data = $this->withDeliverableName($data);

        $task = $this->repo->create('TASKS', $data, $request->user['email'], Ids::sequential('T'), [
            'type' => 'task.created',
            'entityType' => 'task',
            'projectId' => $data['projectId'],
            'deliverableId' => $data['deliverableId'] ?? '',
            'description' => 'Tâche créée : ' . $data['title'],
        ]);
        return ['task' => $task];
    }

    public function update(Request $request): array
    {
        $id = $request->params['id'];
        $changes = array_intersect_key($request->body, array_flip(self::FIELDS));
        $current = $this->repo->get('TASKS', $id);
        $this->validate(array_merge($current, $changes), false);
        $changes = $this->withDeliverableName($changes);

        // Les dates de clôture suivent le statut ; elles ne sont jamais envoyées par le client.
        if (isset($changes['status']) && $changes['status'] !== $current['status']) {
            $done = $changes['status'] === Settings::DONE;
            $changes['completedAt'] = $done ? Repository::now() : '';
            $changes['closedAt'] = $changes['completedAt'];
        }

        $task = $this->repo->update('TASKS', $id, $changes, $request->expectedVersion(), $request->user['email'], self::eventFor(...));
        return ['task' => $task];
    }

    public function archive(Request $request): array
    {
        $id = $request->params['id'];
        $task = $this->repo->update('TASKS', $id, ['archived' => true], $request->expectedVersion(), $request->user['email'],
            fn (array $before) => [
                'type' => 'task.archived',
                'entityType' => 'task',
                'projectId' => $before['projectId'] ?? '',
                'description' => 'Tâche archivée : ' . ($before['title'] ?? ''),
            ]);
        return ['task' => $task];
    }

    /** Choisit l'événement à journaliser : une tâche n'est « réalisée » que via task.completed. */
    public static function eventFor(array $before, array $after): ?array
    {
        $changed = [];
        foreach (self::FIELDS as $field) {
            if (($before[$field] ?? null) !== ($after[$field] ?? null)) {
                $changed[$field] = ['before' => $before[$field] ?? null, 'after' => $after[$field] ?? null];
            }
        }
        if ($changed === []) {
            return null;
        }
        $base = [
            'entityType' => 'task',
            'projectId' => $after['projectId'] ?? '',
            'deliverableId' => $after['deliverableId'] ?? '',
            'changes' => $changed,
        ];
        if (isset($changed['status'])) {
            if ($after['status'] === Settings::DONE) {
                return $base + ['type' => 'task.completed', 'description' => 'Tâche terminée : ' . $after['title']];
            }
            return $base + ['type' => 'task.status_changed', 'description' => "{$after['title']} : {$before['status']} → {$after['status']}"];
        }
        return $base + ['type' => 'task.updated', 'description' => 'Tâche modifiée : ' . $after['title']];
    }

    private function validate(array $data, bool $creating): void
    {
        $settings = Settings::load($this->repo);
        $projects = array_column($this->repo->all('PROJECTS'), null, 'id');
        $deliverables = array_column($this->repo->all('DELIVERABLES'), null, 'id');

        $v = (new Validator($data))
            ->string('title', true, 200)
            ->string('description')
            ->string('note')
            ->string('deadlineText', false, 100)
            ->in('projectId', array_keys($projects), true)
            ->in('status', array_column($settings->statuses(), 'id'), true)
            ->in('priority', $settings->priorities(), true)
            ->subset('poles', array_column($settings->poles(), 'id'))
            ->date('startDate')
            ->date('deadline')
            ->listOf('checklist', fn ($i) => is_array($i) && is_string($i['label'] ?? null) && is_bool($i['done'] ?? null), 'Checklist invalide.')
            ->listOf('links', fn ($i) => is_array($i) && Validator::isUrl($i['url'] ?? null), 'Lien invalide (http ou https attendu).');

        if (!empty($data['deliverableId'])) {
            $deliverable = $deliverables[$data['deliverableId']] ?? null;
            $v->check($deliverable !== null && $deliverable['projectId'] === $data['projectId'], 'deliverableId', 'Ce livrable n\'appartient pas au projet.');
        }
        if (!empty($data['startDate']) && !empty($data['deadline'])) {
            $v->check($data['startDate'] <= $data['deadline'], 'startDate', 'La date de début doit précéder la deadline.');
        }
        $v->validate();
    }

    /** Recopie le nom du livrable dans `deliverable` : l'Apps Script actuel lit ce champ texte. */
    private function withDeliverableName(array $data): array
    {
        if (array_key_exists('deliverableId', $data)) {
            $name = '';
            if ($data['deliverableId']) {
                try {
                    $name = $this->repo->get('DELIVERABLES', $data['deliverableId'])['name'] ?? '';
                } catch (\Throwable) {
                    throw new HttpException(422, 'Livrable introuvable.', ['fields' => ['deliverableId' => 'Livrable introuvable.']]);
                }
            }
            $data['deliverable'] = $name;
        }
        return $data;
    }
}
