<?php

declare(strict_types=1);

namespace Vlt\Tests;

use PHPUnit\Framework\TestCase;
use Vlt\Controllers\TasksController;
use Vlt\Domain\Ids;
use Vlt\Storage\ConflictException;
use Vlt\Storage\LocalJsonStore;
use Vlt\Storage\Lock;
use Vlt\Storage\Repository;

final class RepositoryTest extends TestCase
{
    private string $dir;
    private Repository $repo;
    private LocalJsonStore $store;

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . '/vltpm-test-' . bin2hex(random_bytes(4));
        mkdir($this->dir);
        file_put_contents("$this->dir/sheet.json", json_encode([
            'TASKS' => [['id', 'json'], ['T-007', json_encode(['id' => 'T-007', 'title' => 'Ligne Apps Script', 'status' => 'À faire', 'projectId' => 'P-1'])]],
            'EVENTS' => [['id', 'json']],
            'META' => [['revision', 'updated_at', 'updated_by'], ['12', '', '']],
        ]));
        $this->store = new LocalJsonStore("$this->dir/sheet.json");
        $this->repo = new Repository($this->store, new Lock($this->dir));
    }

    public function testLegacyRowsGetVersionOne(): void
    {
        $task = $this->repo->get('TASKS', 'T-007');
        $this->assertSame(1, $task['version']);
        $this->assertFalse($task['archived']);
    }

    public function testCreateContinuesExistingSequence(): void
    {
        $task = $this->repo->create('TASKS', ['title' => 'Nouvelle', 'projectId' => 'P-1'], 'a@vlt.fr', Ids::sequential('T'));
        $this->assertSame('T-008', $task['id']);
        $this->assertSame(13, $this->repo->revision());
    }

    public function testUpdateWithStaleVersionIsRejectedAndNothingIsWritten(): void
    {
        $this->repo->update('TASKS', 'T-007', ['title' => 'Version de Léa'], 1, 'lea@vlt.fr');

        try {
            $this->repo->update('TASKS', 'T-007', ['title' => 'Version de Marc'], 1, 'marc@vlt.fr');
            $this->fail('Un conflit était attendu');
        } catch (ConflictException $e) {
            $this->assertSame('Version de Léa', $e->current['title']);
            $this->assertSame(2, $e->current['version']);
        }
        $this->assertSame('Version de Léa', $this->repo->get('TASKS', 'T-007')['title']);
    }

    public function testUpdateWritesOnlyItsRowAndKeepsUnknownFields(): void
    {
        $this->repo->update('TASKS', 'T-007', ['status' => 'En cours'], 1, 'a@vlt.fr');
        $task = $this->repo->get('TASKS', 'T-007');
        $this->assertSame('Ligne Apps Script', $task['title']);
        $this->assertSame('En cours', $task['status']);
        $this->assertSame('a@vlt.fr', $task['updatedBy']);
    }

    public function testEventsCarryAuthor(): void
    {
        $this->repo->update('TASKS', 'T-007', ['status' => 'Terminé', 'title' => 'Ligne Apps Script'], 1, 'a@vlt.fr', TasksController::eventFor(...));
        $events = $this->repo->all('EVENTS');
        $this->assertCount(1, $events);
        $this->assertSame('task.completed', $events[0]['type']);
        $this->assertSame('a@vlt.fr', $events[0]['author']);
        $this->assertSame('T-007', $events[0]['entity']);
    }

    public function testStatusChangeOtherThanDoneIsNotACompletion(): void
    {
        $event = TasksController::eventFor(['status' => 'À faire', 'title' => 'x'], ['status' => 'Bloqué', 'title' => 'x']);
        $this->assertSame('task.status_changed', $event['type']);
    }

    public function testCreationIsNeverACompletion(): void
    {
        $this->assertNull(TasksController::eventFor(['title' => 'x'], ['title' => 'x']));
    }
}
