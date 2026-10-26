<?php

declare(strict_types=1);

namespace Vlt\Controllers;

use Vlt\Domain\Ids;
use Vlt\Domain\Validator;
use Vlt\Http\HttpException;
use Vlt\Http\Request;
use Vlt\Storage\Repository;

/**
 * Livrables. Validé, livré et publié sont trois jalons distincts, chacun enregistré par une action explicite
 * et un événement dédié : ils ne se déduisent jamais du statut des tâches.
 */
final class DeliverablesController
{
    private const MILESTONES = [
        'validate' => ['field' => 'validatedAt', 'type' => 'deliverable.validated', 'label' => 'Livrable validé'],
        'deliver' => ['field' => 'deliveredAt', 'type' => 'deliverable.delivered', 'label' => 'Livrable transmis'],
        'publish' => ['field' => 'publishedAt', 'type' => 'deliverable.published', 'label' => 'Livrable publié'],
    ];

    public function __construct(private readonly Repository $repo)
    {
    }

    public function create(Request $request): array
    {
        $data = array_intersect_key($request->body, array_flip(['projectId', 'name', 'description', 'dueDate', 'links']));
        $projects = array_column($this->repo->all('PROJECTS'), 'id');
        (new Validator($data))
            ->in('projectId', $projects, true)
            ->string('name', true, 200)
            ->string('description')
            ->date('dueDate')
            ->validate();

        $deliverable = $this->repo->create('DELIVERABLES', $data + ['links' => []], $request->user['email'], Ids::sequential('D'), [
            'type' => 'deliverable.created',
            'entityType' => 'deliverable',
            'projectId' => $data['projectId'],
            'description' => 'Livrable créé : ' . $data['name'],
        ]);
        return ['deliverable' => $deliverable];
    }

    /** POST /deliverables/{id}/validate | deliver | publish, avec une date (par défaut aujourd'hui), une note et un lien. */
    public function milestone(Request $request): array
    {
        $milestone = self::MILESTONES[$request->params['action']] ?? throw new HttpException(404, 'Action inconnue.');
        $body = $request->body + ['date' => date('Y-m-d'), 'note' => '', 'link' => ''];
        (new Validator($body))
            ->date('date')
            ->string('note', false, 2000)
            ->check($body['link'] === '' || Validator::isUrl($body['link']), 'link', 'Lien invalide.')
            ->validate();

        $deliverable = $this->repo->update('DELIVERABLES', $request->params['id'], [$milestone['field'] => $body['date']],
            $request->expectedVersion(), $request->user['email'],
            fn (array $before, array $after) => [
                'type' => $milestone['type'],
                'entityType' => 'deliverable',
                'projectId' => $after['projectId'],
                'deliverableId' => $after['id'],
                'effectiveDate' => $body['date'],
                'note' => $body['note'],
                'link' => $body['link'],
                'description' => $milestone['label'] . ' : ' . $after['name'],
            ]);
        return ['deliverable' => $deliverable];
    }
}
