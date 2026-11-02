<?php

declare(strict_types=1);

namespace Vlt\Tests;

use PHPUnit\Framework\TestCase;
use Vlt\Controllers\AdminController;
use Vlt\Http\HttpException;
use Vlt\Http\Request;
use Vlt\Storage\LocalJsonStore;
use Vlt\Storage\Lock;
use Vlt\Storage\Repository;

final class AdminControllerTest extends TestCase
{
    private Repository $repo;
    private AdminController $controller;

    protected function setUp(): void
    {
        $dir = sys_get_temp_dir() . '/vltpm-admin-' . bin2hex(random_bytes(4));
        mkdir($dir);
        $row = fn (array $d) => [$d['id'], json_encode($d)];
        file_put_contents("$dir/sheet.json", json_encode([
            'USERS' => [['id', 'json'],
                $row(['id' => 'U-001', 'email' => 'admin@vlt.fr', 'name' => 'Admin', 'role' => 'admin', 'active' => true, 'passwordHash' => 'secret']),
                $row(['id' => 'U-002', 'email' => 'membre@vlt.fr', 'name' => 'Membre', 'role' => 'member', 'active' => true])],
            'CLIENTS' => [['id', 'json'], $row(['id' => 'C-EUR', 'name' => 'Eureden'])],
            'PROJECTS' => [['id', 'json'], $row(['id' => 'P-001', 'name' => 'Site carrière', 'clientId' => 'C-EUR'])],
            'DELIVERABLES' => [['id', 'json']],
            'TASKS' => [['id', 'json'], $row(['id' => 'T-001', 'projectId' => 'P-001', 'title' => 'Maquettes', 'priority' => 'Haute', 'poles' => ['DA / Graphisme', 'seo']])],
            'SETTINGS' => [['id', 'json']],
            'EVENTS' => [['id', 'json']],
            'META' => [['revision', 'updated_at', 'updated_by'], ['1', '', '']],
        ]));
        $this->repo = new Repository(new LocalJsonStore("$dir/sheet.json"), new Lock($dir));
        $this->controller = new AdminController($this->repo);
    }

    private function request(string $method, array $body = [], array $params = [], ?int $version = null, string $as = 'U-001'): Request
    {
        $headers = $version === null ? [] : ['if-match' => "\"$version\""];
        $request = new Request($method, '/admin', [], $body, $headers);
        $request->params = $params;
        $request->user = ['id' => $as, 'email' => $as === 'U-001' ? 'admin@vlt.fr' : 'membre@vlt.fr', 'role' => 'admin'];
        return $request;
    }

    public function testIndexNeverExposesPasswordHashes(): void
    {
        $data = $this->controller->index($this->request('GET'));
        $this->assertCount(2, $data['users']);
        $this->assertArrayNotHasKey('passwordHash', $data['users'][0]);
    }

    public function testStaleAdminSessionIsRefused(): void
    {
        $this->expectException(HttpException::class);
        $this->controller->index($this->request('GET', as: 'U-002'));
    }

    public function testCreateUserHashesPasswordAndRejectsDuplicates(): void
    {
        $user = $this->controller->createUser($this->request('POST', ['email' => 'Tanguy@VLT.fr', 'name' => 'Tanguy', 'role' => 'member', 'password' => 'un mot de passe long']))['user'];
        $this->assertSame(['U-003', 'tanguy@vlt.fr'], [$user['id'], $user['email']]);
        $stored = $this->repo->get('USERS', 'U-003');
        $this->assertTrue(password_verify('un mot de passe long', $stored['passwordHash']));
        $this->assertSame('user.created', $this->repo->all('EVENTS', true)[0]['type']);

        try {
            $this->controller->createUser($this->request('POST', ['email' => 'tanguy@vlt.fr', 'name' => 'T', 'role' => 'member', 'password' => 'un mot de passe long']));
            $this->fail('Doublon accepté');
        } catch (HttpException $e) {
            $this->assertSame('Ce compte existe déjà.', $e->details['fields']['email']);
        }
    }

    public function testAdminCannotDemoteOrDeactivateThemselves(): void
    {
        $this->expectExceptionMessage('propres droits');
        $this->controller->updateUser($this->request('PATCH', ['role' => 'member'], ['id' => 'U-001'], 1));
    }

    public function testDeactivateAnotherUser(): void
    {
        $user = $this->controller->updateUser($this->request('PATCH', ['active' => false], ['id' => 'U-002'], 1))['user'];
        $this->assertFalse($user['active']);
        $this->assertSame('Compte désactivé : membre@vlt.fr', $this->repo->all('EVENTS', true)[0]['description']);
    }

    public function testClientWithActiveProjectCannotBeArchived(): void
    {
        $this->expectExceptionMessage('Archivez d\'abord');
        $this->controller->updateClient($this->request('PATCH', ['archived' => true], ['id' => 'C-EUR'], 1));
    }

    public function testCreateAndArchiveProject(): void
    {
        $project = $this->controller->createProject($this->request('POST', ['name' => 'Rapport annuel', 'clientId' => 'C-EUR']))['project'];
        $this->assertSame(['P-002', 'Eureden', 'En cadrage', ''], [$project['id'], $project['client'], $project['status'], $project['startDate'] ?? '']);

        $archived = $this->controller->setArchived($this->request('POST', ['archived' => true], ['kind' => 'project', 'id' => 'P-002'], 1))['item'];
        $this->assertTrue($archived['archived']);
        $types = array_column($this->repo->all('EVENTS', true), 'type');
        $this->assertSame(['project.created', 'project.archived'], $types);
    }

    public function testSettingsKeepValuesUsedByTasks(): void
    {
        $poles = [['id' => 'da', 'label' => 'DA', 'legacy' => ['DA / Graphisme']], ['id' => 'seo', 'label' => 'SEO']];
        $this->assertSame(['version' => 1], $this->controller->updateSetting($this->request('POST', ['value' => $poles], ['key' => 'poles'], 0)));
        $this->assertSame(['version' => 2], $this->controller->updateSetting($this->request('POST', ['value' => [...$poles, ['id' => 'motion', 'label' => 'Motion']]], ['key' => 'poles'], 1)));

        try {
            $this->controller->updateSetting($this->request('POST', ['value' => [['id' => 'seo', 'label' => 'SEO']]], ['key' => 'poles'], 2));
            $this->fail('Pôle utilisé supprimé');
        } catch (HttpException $e) {
            $this->assertStringContainsString('DA / Graphisme', $e->getMessage());
        }
        $this->expectExceptionMessage('Haute');
        $this->controller->updateSetting($this->request('POST', ['value' => ['Basse']], ['key' => 'priorities'], 0));
    }
}
