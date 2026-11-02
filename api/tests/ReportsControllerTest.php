<?php

declare(strict_types=1);

namespace Vlt\Tests;

use PHPUnit\Framework\TestCase;
use Vlt\Controllers\ReportsController;
use Vlt\Http\HttpException;
use Vlt\Http\Request;
use Vlt\Storage\LocalJsonStore;
use Vlt\Storage\Lock;
use Vlt\Storage\Repository;

final class ReportsControllerTest extends TestCase
{
    private Repository $repo;
    private ReportsController $controller;

    protected function setUp(): void
    {
        $dir = sys_get_temp_dir() . '/vltpm-reports-' . bin2hex(random_bytes(4));
        mkdir($dir);
        file_put_contents("$dir/sheet.json", json_encode([
            'PROJECTS' => [['id', 'json'], ['P-1', json_encode(['id' => 'P-1', 'name' => 'Site carrière'])]],
            'REPORTS' => [['id', 'json']],
            'EVENTS' => [['id', 'json']],
            'META' => [['revision', 'updated_at', 'updated_by'], ['1', '', '']],
        ]));
        $this->repo = new Repository(new LocalJsonStore("$dir/sheet.json"), new Lock($dir));
        $this->controller = new ReportsController($this->repo);
    }

    private function post(array $body): array
    {
        $request = new Request('POST', '/reports', [], $body, []);
        $request->user = ['email' => 'a@vlt.fr'];
        return $this->controller->create($request)['report'];
    }

    public function testEachFreezeAddsAVersionAndAnEvent(): void
    {
        $first = $this->post(['month' => '2026-10', 'projectId' => 'P-1', 'content' => ['month' => '2026-10']]);
        $second = $this->post(['month' => '2026-10', 'projectId' => 'P-1', 'content' => ['month' => '2026-10']]);
        $other = $this->post(['month' => '2026-10', 'content' => ['month' => '2026-10']]);

        $this->assertSame(['R-0001', 1], [$first['id'], $first['number']]);
        $this->assertSame(['R-0002', 2], [$second['id'], $second['number']]);
        $this->assertSame(1, $other['number']);
        $this->assertSame('a@vlt.fr', $second['createdBy']);
        $events = $this->repo->all('EVENTS', true);
        $this->assertCount(3, $events);
        $this->assertSame('report.frozen', $events[0]['type']);
    }

    public function testRejectsUnknownProjectAndBadMonth(): void
    {
        $this->expectException(HttpException::class);
        $this->post(['month' => '2026-13', 'projectId' => 'P-9', 'content' => []]);
    }
}
