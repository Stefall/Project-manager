<?php

declare(strict_types=1);

namespace Vlt\Controllers;

use Vlt\Domain\Ids;
use Vlt\Domain\Settings;
use Vlt\Domain\Validator;
use Vlt\Http\HttpException;
use Vlt\Http\Request;
use Vlt\Storage\Repository;

/**
 * Administration : comptes, clients, création et archivage des projets, pôles et priorités, archives.
 * Mêmes règles que frontend/src/domain/admin.js. Toutes les routes passent par Middleware::admin().
 */
final class AdminController
{
    private const ROLES = ['admin', 'member'];

    private const ARCHIVABLE = [
        'project' => ['tab' => 'PROJECTS', 'label' => 'Projet', 'name' => 'name', 'suffix' => ''],
        'task' => ['tab' => 'TASKS', 'label' => 'Tâche', 'name' => 'title', 'suffix' => 'e'],
        'deliverable' => ['tab' => 'DELIVERABLES', 'label' => 'Livrable', 'name' => 'name', 'suffix' => ''],
    ];

    public function __construct(private readonly Repository $repo)
    {
    }

    public function index(Request $request): array
    {
        $this->assertStillAdmin($request);
        $data = $this->repo->snapshot(['USERS', 'CLIENTS', 'PROJECTS', 'DELIVERABLES', 'TASKS', 'SETTINGS', 'PEOPLE']);
        $archived = fn (string $tab) => array_values(array_filter($data[$tab], fn ($x) => $x['archived']));
        return [
            'users' => array_map(self::publicUser(...), $data['USERS']),
            'clients' => $data['CLIENTS'],
            'people' => $data['PEOPLE'],
            'archived' => ['projects' => $archived('PROJECTS'), 'deliverables' => $archived('DELIVERABLES'), 'tasks' => $archived('TASKS')],
            'settingVersions' => (object) array_column($data['SETTINGS'], 'version', 'id'),
        ];
    }

    public function createUser(Request $request): array
    {
        $this->assertStillAdmin($request);
        $body = $request->body;
        $data = [
            'email' => mb_strtolower(trim((string) ($body['email'] ?? ''))),
            'name' => trim((string) ($body['name'] ?? '')),
            'role' => $body['role'] ?? 'member',
            'active' => true,
        ];
        $password = (string) ($body['password'] ?? '');
        $this->validateUser($data, null)
            ->check(mb_strlen($password) >= 12, 'password', '12 caractères minimum.')
            ->validate();
        $data['passwordHash'] = password_hash($password, PASSWORD_DEFAULT);

        $user = $this->repo->create('USERS', $data, $request->user['email'], Ids::sequential('U'), [
            'type' => 'user.created',
            'entityType' => 'user',
            'description' => sprintf('Compte autorisé : %s (%s)', $data['email'], $data['role']),
        ]);
        return ['user' => self::publicUser($user)];
    }

    public function updateUser(Request $request): array
    {
        $this->assertStillAdmin($request);
        $id = $request->params['id'];
        $changes = array_intersect_key($request->body, array_flip(['name', 'role', 'active']));
        if (isset($changes['name'])) {
            $changes['name'] = trim((string) $changes['name']);
        }
        if ($id === $request->user['id']) {
            if (array_key_exists('role', $changes) && $changes['role'] !== 'admin') {
                throw new HttpException(422, 'Vous ne pouvez pas retirer vos propres droits d\'administrateur.');
            }
            if (array_key_exists('active', $changes) && !$changes['active']) {
                throw new HttpException(422, 'Vous ne pouvez pas désactiver votre propre compte.');
            }
        }
        $this->validateUser(array_merge($this->repo->get('USERS', $id), $changes), $id)
            ->check(!array_key_exists('active', $changes) || is_bool($changes['active']), 'active', 'Valeur invalide.')
            ->validate();

        $user = $this->repo->update('USERS', $id, $changes, $request->expectedVersion(), $request->user['email'],
            function (array $before, array $after): ?array {
                $changed = ProjectsController::diff($before, $after, ['name', 'role', 'active']);
                if ($changed === []) {
                    return null;
                }
                $what = isset($changed['active']) ? ($after['active'] ? 'réactivé' : 'désactivé') : 'modifié';
                return ['type' => 'user.updated', 'entityType' => 'user', 'changes' => $changed, 'description' => "Compte $what : " . $after['email']];
            });
        return ['user' => self::publicUser($user)];
    }

    private const PERSON_FIELDS = ['name', 'email', 'poles', 'external', 'digest'];

    /** Annuaire : personnes qui peuvent faire partie d'une équipe et recevoir le récap, avec ou sans compte. */
    public function createPerson(Request $request): array
    {
        $this->assertStillAdmin($request);
        $data = array_intersect_key($request->body, array_flip(self::PERSON_FIELDS)) + ['poles' => [], 'external' => false, 'digest' => true];
        $data['email'] = mb_strtolower(trim((string) ($data['email'] ?? '')));
        $data['name'] = trim((string) ($data['name'] ?? ''));
        $this->validatePerson($data, null)->validate();
        $person = $this->repo->create('PEOPLE', $data, $request->user['email'], Ids::sequential('PE'), [
            'type' => 'person.created',
            'entityType' => 'person',
            'description' => "Personne ajoutée à l'annuaire : " . $data['name'],
        ]);
        return ['person' => $person];
    }

    public function updatePerson(Request $request): array
    {
        $this->assertStillAdmin($request);
        $id = $request->params['id'];
        $changes = array_intersect_key($request->body, array_flip([...self::PERSON_FIELDS, 'archived']));
        if (isset($changes['email'])) {
            $changes['email'] = mb_strtolower(trim((string) $changes['email']));
        }
        if (isset($changes['name'])) {
            $changes['name'] = trim((string) $changes['name']);
        }
        $this->validatePerson(array_merge($this->repo->get('PEOPLE', $id), $changes), $id)->validate();
        $fields = [...self::PERSON_FIELDS, 'archived'];
        $person = $this->repo->update('PEOPLE', $id, $changes, $request->expectedVersion(), $request->user['email'],
            function (array $before, array $after) use ($fields): ?array {
                $changed = ProjectsController::diff($before, $after, $fields);
                if ($changed === []) {
                    return null;
                }
                $type = isset($changed['archived']) ? ($after['archived'] ? 'person.archived' : 'person.restored') : 'person.updated';
                return ['type' => $type, 'entityType' => 'person', 'changes' => $changed, 'description' => 'Annuaire : ' . $after['name']];
            });
        return ['person' => $person];
    }

    private function validatePerson(array $data, ?string $id): Validator
    {
        $taken = false;
        foreach ($this->repo->all('PEOPLE') as $p) {
            if ($p['id'] !== $id && mb_strtolower($p['email'] ?? '') === mb_strtolower($data['email'] ?? '')) {
                $taken = true;
            }
        }
        $poles = array_column(Settings::load($this->repo)->poles(), 'id');
        return (new Validator($data))
            ->string('name', true, 120)
            ->check(filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL) !== false, 'email', 'Adresse e-mail invalide.')
            ->check(!$taken, 'email', 'Cette personne existe déjà.')
            ->subset('poles', $poles)
            ->check(is_bool($data['external'] ?? false) && is_bool($data['digest'] ?? true), 'digest', 'Valeur invalide.');
    }

    public function createClient(Request $request): array
    {
        $this->assertStillAdmin($request);
        $name = trim((string) ($request->body['name'] ?? ''));
        $this->validateClient($name, null)->validate();
        $client = $this->repo->create('CLIENTS', ['name' => $name], $request->user['email'], Ids::sequential('C'), [
            'type' => 'client.created',
            'entityType' => 'client',
            'description' => 'Client créé : ' . $name,
        ]);
        return ['client' => $client];
    }

    public function updateClient(Request $request): array
    {
        $this->assertStillAdmin($request);
        $id = $request->params['id'];
        $changes = array_intersect_key($request->body, array_flip(['name', 'archived']));
        $current = $this->repo->get('CLIENTS', $id);
        if (isset($changes['name'])) {
            $changes['name'] = trim((string) $changes['name']);
        }
        $this->validateClient($changes['name'] ?? $current['name'] ?? '', $id)->validate();
        if (!empty($changes['archived'])) {
            foreach ($this->repo->all('PROJECTS') as $project) {
                if (($project['clientId'] ?? '') === $id) {
                    throw new HttpException(422, 'Archivez d\'abord les projets de ce client.');
                }
            }
        }
        if (array_key_exists('archived', $changes)) {
            $changes['archived'] = (bool) $changes['archived'];
        }
        $client = $this->repo->update('CLIENTS', $id, $changes, $request->expectedVersion(), $request->user['email'],
            function (array $before, array $after): ?array {
                $changed = ProjectsController::diff($before, $after, ['name', 'archived']);
                if ($changed === []) {
                    return null;
                }
                $type = isset($changed['archived']) ? ($after['archived'] ? 'client.archived' : 'client.restored') : 'client.updated';
                $what = isset($changed['archived']) ? ($after['archived'] ? 'archivé' : 'restauré') : 'modifié';
                return ['type' => $type, 'entityType' => 'client', 'changes' => $changed, 'description' => "Client $what : " . $after['name']];
            });
        return ['client' => $client];
    }

    public function createProject(Request $request): array
    {
        $this->assertStillAdmin($request);
        $data = array_intersect_key($request->body, array_flip(ProjectsController::FIELDS)) + [
            'status' => 'En cadrage', 'achievements' => [], 'watchpoints' => [], 'nextSteps' => [], 'links' => [],
        ];
        $clients = array_column($this->repo->all('CLIENTS'), 'name', 'id');
        $v = (new Validator($data))
            ->string('name', true, 200)
            ->in('clientId', array_keys($clients), true)
            ->in('status', ProjectsController::STATUSES)
            ->date('startDate')
            ->date('endDate');
        if (!empty($data['startDate']) && !empty($data['endDate'])) {
            $v->check($data['startDate'] <= $data['endDate'], 'endDate', 'La fin doit suivre le début.');
        }
        if (array_key_exists('team', $data)) {
            $refused = ProjectsController::teamError($data['team'], $this->repo);
            $v->check($refused === null, 'team', (string) $refused);
        }
        $v->validate();
        if (isset($data['team'])) {
            $data['team'] = ProjectsController::compactTeam($data['team']);
        }
        $data['name'] = trim($data['name']);
        $data['client'] = $clients[$data['clientId']];

        $project = $this->repo->create('PROJECTS', $data, $request->user['email'], Ids::sequential('P'), [
            'type' => 'project.created',
            'entityType' => 'project',
            'description' => 'Projet créé : ' . $data['name'],
        ]);
        return ['project' => $project];
    }

    /** POST /admin/archive/{kind}/{id} { archived } : archive ou restaure un projet, une tâche ou un livrable. */
    public function setArchived(Request $request): array
    {
        $this->assertStillAdmin($request);
        $kind = $request->params['kind'];
        $meta = self::ARCHIVABLE[$kind] ?? throw new HttpException(404, 'Type inconnu.');
        $archived = (bool) ($request->body['archived'] ?? true);
        $id = $request->params['id'];
        $item = $this->repo->update($meta['tab'], $id, ['archived' => $archived], $request->expectedVersion(), $request->user['email'],
            fn (array $before) => [
                'type' => $kind . ($archived ? '.archived' : '.restored'),
                'entityType' => $kind,
                'projectId' => $kind === 'project' ? $id : ($before['projectId'] ?? ''),
                'description' => sprintf('%s %s%s : %s', $meta['label'], $archived ? 'archivé' : 'restauré', $meta['suffix'], $before[$meta['name']] ?? ''),
            ] + ($kind === 'deliverable' ? ['deliverableId' => $id] : []));
        return ['item' => $item];
    }

    /** POST /admin/settings/{key} { value } : remplace la liste des pôles ou des priorités. */
    public function updateSetting(Request $request): array
    {
        $this->assertStillAdmin($request);
        $key = $request->params['key'];
        $value = $request->body['value'] ?? null;
        $refused = self::settingError($key, $value, $this->repo->all('TASKS', true), Settings::load($this->repo));
        if ($refused !== null) {
            throw new HttpException(422, $refused);
        }
        $event = [
            'type' => 'settings.updated',
            'entityType' => 'settings',
            'description' => 'Paramètres modifiés : ' . ($key === 'poles' ? 'pôles' : 'priorités'),
        ];
        $exists = in_array($key, array_column($this->repo->all('SETTINGS', true), 'id'), true);
        if (!$exists) {
            if ($request->expectedVersion() !== 0) {
                throw new HttpException(409, 'Modifié entre-temps par quelqu\'un d\'autre.', ['code' => 'conflict']);
            }
            $row = $this->repo->create('SETTINGS', ['value' => $value], $request->user['email'], fn () => $key, $event);
        } else {
            $row = $this->repo->update('SETTINGS', $key, ['value' => $value], $request->expectedVersion(), $request->user['email'], fn () => $event);
        }
        return ['version' => $row['version']];
    }

    /** Une valeur encore utilisée par une tâche (même archivée) ne peut pas disparaître de la liste. */
    public static function settingError(string $key, mixed $value, array $tasks, Settings $settings): ?string
    {
        if (!in_array($key, ['poles', 'priorities'], true)) {
            return 'Paramètre non modifiable.';
        }
        if (!is_array($value) || $value === [] || !array_is_list($value)) {
            return $key === 'poles' ? 'Au moins un pôle est nécessaire.' : 'Au moins une priorité est nécessaire.';
        }
        if ($key === 'priorities') {
            foreach ($value as $p) {
                if (!is_string($p) || trim($p) === '') {
                    return 'Chaque priorité doit avoir un libellé.';
                }
            }
            if (count(array_unique(array_map('mb_strtolower', $value))) !== count($value)) {
                return 'Deux priorités portent le même nom.';
            }
            foreach ($tasks as $t) {
                if (!empty($t['priority']) && !in_array($t['priority'], $value, true)) {
                    return sprintf('La priorité « %s » est utilisée par des tâches et ne peut pas être supprimée.', $t['priority']);
                }
            }
            return null;
        }

        $ids = [];
        foreach ($value as $p) {
            if (!is_array($p) || !preg_match('/^[a-z0-9-]+$/', (string) ($p['id'] ?? '')) || trim((string) ($p['label'] ?? '')) === '') {
                return 'Chaque pôle doit avoir un libellé.';
            }
            if (isset($ids[$p['id']])) {
                return sprintf('Le pôle « %s » existe déjà.', $p['label']);
            }
            $ids[$p['id']] = true;
        }
        // Les tâches de l'ancien outil portent encore des libellés (« DA / Graphisme ») : on les ramène aux identifiants actuels.
        $known = [];
        foreach ($settings->poles() as $p) {
            $known[$p['label']] = [$p['id']];
            foreach ($p['legacy'] ?? [] as $legacy) {
                $known[$legacy][] = $p['id'];
            }
        }
        foreach ($tasks as $t) {
            foreach ($t['poles'] ?? [] as $pole) {
                if (!isset($ids[$pole]) && array_intersect($known[$pole] ?? [], array_keys($ids)) === []) {
                    return sprintf('Le pôle « %s » est utilisé par des tâches : masquez-le plutôt que de le supprimer.', $pole);
                }
            }
        }
        return null;
    }

    public static function publicUser(array $user): array
    {
        unset($user['passwordHash']);
        return $user;
    }

    /** Le rôle de la session peut dater : on relit le compte avant toute action d'administration. */
    private function assertStillAdmin(Request $request): void
    {
        foreach ($this->repo->all('USERS') as $user) {
            if ($user['id'] === $request->user['id']) {
                if (($user['role'] ?? '') === 'admin' && !empty($user['active'])) {
                    return;
                }
                break;
            }
        }
        throw new HttpException(403, 'Réservé aux administrateurs.');
    }

    private function validateUser(array $data, ?string $id): Validator
    {
        $taken = false;
        foreach ($this->repo->all('USERS', true) as $u) {
            if ($u['id'] !== $id && mb_strtolower($u['email'] ?? '') === mb_strtolower($data['email'] ?? '')) {
                $taken = true;
            }
        }
        return (new Validator($data))
            ->check(filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL) !== false, 'email', 'Adresse e-mail invalide.')
            ->check(!$taken, 'email', 'Ce compte existe déjà.')
            ->string('name', true, 120)
            ->in('role', self::ROLES, true);
    }

    private function validateClient(string $name, ?string $id): Validator
    {
        $taken = false;
        foreach ($this->repo->all('CLIENTS', true) as $c) {
            if ($c['id'] !== $id && mb_strtolower(trim($c['name'] ?? '')) === mb_strtolower($name)) {
                $taken = true;
            }
        }
        return (new Validator(['name' => $name]))->string('name', true, 120)->check(!$taken, 'name', 'Ce client existe déjà.');
    }
}
