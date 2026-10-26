<?php

declare(strict_types=1);

namespace Vlt\Domain;

use Vlt\Storage\Repository;

/** Paramètres métier. Valeurs par défaut du brief, surchargées par l'onglet SETTINGS. */
final class Settings
{
    public const STATUSES = [
        ['id' => 'À faire', 'color' => 'todo'],
        ['id' => 'En cours', 'color' => 'progress'],
        ['id' => 'En attente', 'color' => 'waiting'],
        ['id' => 'Bloqué', 'color' => 'blocked'],
        ['id' => 'Terminé', 'color' => 'done'],
    ];

    public const DONE = 'Terminé';

    public const PRIORITIES = ['Basse', 'Normale', 'Haute', 'Urgente'];

    public const POLES = [
        ['id' => 'pilotage', 'label' => 'Pilotage / Gestion de projet', 'legacy' => ['Pilotage']],
        ['id' => 'ux-ui', 'label' => 'UX / UI', 'legacy' => ['UX/UI']],
        ['id' => 'da', 'label' => 'Direction artistique', 'legacy' => ['DA / Graphisme']],
        ['id' => 'graphisme', 'label' => 'Graphisme', 'legacy' => ['DA / Graphisme']],
        ['id' => 'redaction', 'label' => 'Rédaction / Contenu', 'legacy' => ['Rédaction']],
        ['id' => 'seo', 'label' => 'SEO', 'legacy' => ['SEO']],
        ['id' => 'dev', 'label' => 'Développement / Intégration', 'legacy' => ['Développement']],
        ['id' => 'social', 'label' => 'Communication / Social media', 'legacy' => []],
        ['id' => 'print', 'label' => 'Print / Édition', 'legacy' => []],
    ];

    public function __construct(private readonly array $values)
    {
    }

    public static function load(Repository $repo): self
    {
        $values = [];
        foreach ($repo->all('SETTINGS') as $row) {
            $values[$row['id']] = $row['value'] ?? null;
        }
        return new self($values);
    }

    public function statuses(): array
    {
        return $this->values['statuses'] ?? self::STATUSES;
    }

    public function priorities(): array
    {
        return $this->values['priorities'] ?? self::PRIORITIES;
    }

    public function poles(): array
    {
        return $this->values['poles'] ?? self::POLES;
    }

    public function toArray(): array
    {
        return ['statuses' => $this->statuses(), 'priorities' => $this->priorities(), 'poles' => $this->poles()];
    }
}
