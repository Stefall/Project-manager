<?php

declare(strict_types=1);

namespace Vlt\Controllers;

use Vlt\Domain\Ids;
use Vlt\Domain\Validator;
use Vlt\Http\HttpException;
use Vlt\Http\Request;
use Vlt\Storage\Repository;

/**
 * Historique et bilans mensuels. Un bilan est calculé à partir de l'historique puis figé :
 * chaque génération ajoute une version (« number »), aucune n'est jamais modifiée.
 */
final class ReportsController
{
    // Une cellule Google Sheets contient au plus 50 000 caractères.
    private const MAX_JSON = 48000;

    public function __construct(private readonly Repository $repo)
    {
    }

    public function events(Request $request): array
    {
        return ['events' => $this->repo->all('EVENTS', true)];
    }

    public function index(Request $request): array
    {
        return ['reports' => $this->repo->all('REPORTS')];
    }

    public function create(Request $request): array
    {
        $body = $request->body;
        $projectId = (string) ($body['projectId'] ?? '');
        $projects = array_column($this->repo->all('PROJECTS'), 'name', 'id');
        (new Validator($body))
            ->check(is_string($body['month'] ?? null) && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $body['month']) === 1, 'month', 'Mois invalide.')
            ->check($projectId === '' || isset($projects[$projectId]), 'projectId', 'Projet inconnu.')
            ->check(is_array($body['content'] ?? null), 'content', 'Contenu du bilan manquant.')
            ->string('comment', false, 2000)
            ->validate();

        $number = 1 + array_reduce($this->repo->all('REPORTS'), fn (int $max, array $r) =>
            ($r['month'] ?? '') === $body['month'] && ($r['projectId'] ?? '') === $projectId ? max($max, (int) ($r['number'] ?? 0)) : $max, 0);
        $report = [
            'month' => $body['month'],
            'projectId' => $projectId,
            'number' => $number,
            'comment' => (string) ($body['comment'] ?? ''),
            'content' => $body['content'],
            'createdBy' => $request->user['email'],
        ];
        if (strlen(json_encode($report, JSON_UNESCAPED_UNICODE)) > self::MAX_JSON) {
            throw new HttpException(413, 'Bilan trop volumineux pour être figé : limitez-le à un projet.');
        }

        $scope = $projectId === '' ? 'tous les projets' : $projects[$projectId];
        $saved = $this->repo->create('REPORTS', $report, $request->user['email'], Ids::sequential('R', 4), [
            'type' => 'report.frozen',
            'entityType' => 'report',
            'projectId' => $projectId,
            'description' => sprintf('Bilan %s figé (version %d, %s)', $body['month'], $number, $scope),
        ]);
        return ['report' => $saved];
    }
}
