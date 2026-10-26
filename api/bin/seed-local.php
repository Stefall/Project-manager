<?php

declare(strict_types=1);

/**
 * Crée un faux Sheet local (driver "local") avec des données fictives et un compte de développement.
 * Usage : php api/bin/seed-local.php [chemin du fichier]
 */

use Vlt\Storage\LocalJsonStore;

require __DIR__ . '/../vendor/autoload.php';

$file = $argv[1] ?? dirname(__DIR__, 2) . '/storage/data/local-sheet.json';
$enc = fn (array $d) => LocalJsonStore::encode($d);
$row = fn (array $d) => [$d['id'], $enc($d)];
$today = new DateTimeImmutable('today');
$d = fn (string $mod) => $today->modify($mod)->format('Y-m-d');

$projects = [
    ['id' => 'P-DEMO-SITE', 'clientId' => 'C-DEMO', 'client' => 'Client Démo', 'name' => 'Refonte du site', 'color' => '#437b70',
        'summary' => 'Refondre le site institutionnel pour clarifier l\'offre et améliorer la conversion.',
        'situation' => 'Maquettes validées ; l\'intégration démarre, les contenus restent à finaliser.'],
    ['id' => 'P-DEMO-CAMP', 'clientId' => 'C-DEMO', 'client' => 'Client Démo', 'name' => 'Campagne printemps', 'color' => '#a87963',
        'summary' => 'Concevoir la campagne de communication de printemps.', 'situation' => 'Cadrage en cours.'],
];
$deliverables = [
    ['id' => 'D-001', 'projectId' => 'P-DEMO-SITE', 'name' => 'Maquettes', 'validatedAt' => $d('-10 days')],
    ['id' => 'D-002', 'projectId' => 'P-DEMO-SITE', 'name' => 'Intégration'],
    ['id' => 'D-003', 'projectId' => 'P-DEMO-CAMP', 'name' => 'Visuels'],
];
$tasks = [
    ['id' => 'T-001', 'projectId' => 'P-DEMO-SITE', 'deliverableId' => 'D-001', 'deliverable' => 'Maquettes', 'title' => 'Maquetter la page d\'accueil', 'status' => 'Terminé', 'priority' => 'Normale', 'poles' => ['ux-ui'], 'deadline' => $d('-12 days')],
    ['id' => 'T-002', 'projectId' => 'P-DEMO-SITE', 'deliverableId' => 'D-002', 'deliverable' => 'Intégration', 'title' => 'Intégrer le gabarit de page', 'status' => 'En cours', 'priority' => 'Haute', 'poles' => ['dev'], 'startDate' => $d('-3 days'), 'deadline' => $d('+4 days')],
    ['id' => 'T-003', 'projectId' => 'P-DEMO-SITE', 'deliverableId' => 'D-002', 'deliverable' => 'Intégration', 'title' => 'Recevoir les textes définitifs', 'status' => 'En attente', 'priority' => 'Normale', 'poles' => ['redaction'], 'deadlineText' => 'Semaine prochaine'],
    ['id' => 'T-004', 'projectId' => 'P-DEMO-SITE', 'deliverableId' => 'D-002', 'deliverable' => 'Intégration', 'title' => 'Configurer l\'hébergement', 'status' => 'Bloqué', 'priority' => 'Urgente', 'poles' => ['dev'], 'deadline' => $d('-1 day')],
    ['id' => 'T-005', 'projectId' => 'P-DEMO-CAMP', 'deliverableId' => 'D-003', 'deliverable' => 'Visuels', 'title' => 'Pistes créatives', 'status' => 'À faire', 'priority' => 'Normale', 'poles' => ['da', 'graphisme']],
];
$users = [
    ['id' => 'U-001', 'email' => 'admin@vlt.local', 'name' => 'Admin démo', 'role' => 'admin', 'active' => true, 'passwordHash' => password_hash('demo-vlt', PASSWORD_DEFAULT)],
];

$sheet = [
    'CLIENTS' => [['id', 'json'], $row(['id' => 'C-DEMO', 'name' => 'Client Démo'])],
    'PROJECTS' => [['id', 'json'], ...array_map($row, $projects)],
    'DELIVERABLES' => [['id', 'json'], ...array_map($row, $deliverables)],
    'TASKS' => [['id', 'json'], ...array_map($row, $tasks)],
    'EVENTS' => [['id', 'json']],
    'NOTES' => [['id', 'json']],
    'REPORTS' => [['id', 'json']],
    'USERS' => [['id', 'json'], ...array_map($row, $users)],
    'SETTINGS' => [['id', 'json']],
    'META' => [['revision', 'updated_at', 'updated_by'], ['1', date('c'), 'seed']],
];

file_put_contents($file, json_encode($sheet, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
echo "Sheet local créé : $file\nCompte : admin@vlt.local / demo-vlt\n";
