<?php

declare(strict_types=1);

use Vlt\Controllers\AuthController;
use Vlt\Controllers\BootstrapController;
use Vlt\Controllers\DeliverablesController;
use Vlt\Controllers\ProjectsController;
use Vlt\Controllers\TasksController;
use Vlt\Http\HttpException;
use Vlt\Http\Request;
use Vlt\Http\Response;
use Vlt\Http\Router;
use Vlt\Security\LoginThrottle;
use Vlt\Security\Middleware;
use Vlt\Security\Session;
use Vlt\Storage\ConflictException;
use Vlt\Storage\NotFoundException;

require __DIR__ . '/../api/src/bootstrap.php';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

try {
    Session::start(
        env('SESSION_NAME', 'vltpm'),
        vlt_path('storage/sessions'),
        (int) env('SESSION_IDLE_MINUTES', '480'),
        env('APP_ENV', 'production') === 'production',
    );

    $repo = vlt_repository();
    $auth = new AuthController($repo, new LoginThrottle(vlt_path('storage/locks')));
    $bootstrap = new BootstrapController($repo);
    $tasks = new TasksController($repo);
    $deliverables = new DeliverablesController($repo);
    $projects = new ProjectsController($repo);

    $member = [Middleware::auth(), Middleware::csrf()];
    $router = new Router();
    $router->add('GET', '/auth/me', $auth->me(...));
    $router->add('POST', '/auth/login', $auth->login(...), [Middleware::csrf()]);
    $router->add('POST', '/auth/logout', $auth->logout(...), $member);

    $router->add('GET', '/bootstrap', $bootstrap->show(...), $member);

    $router->add('POST', '/tasks', $tasks->create(...), $member);
    $router->add('PATCH', '/tasks/{id}', $tasks->update(...), $member);
    $router->add('POST', '/tasks/{id}/archive', $tasks->archive(...), $member);

    $router->add('PATCH', '/projects/{id}', $projects->update(...), $member);

    $router->add('POST', '/deliverables', $deliverables->create(...), $member);
    $router->add('PATCH', '/deliverables/{id}', $deliverables->update(...), $member);
    $router->add('POST', '/deliverables/{id}/{action}', $deliverables->milestone(...), $member);

    Response::json($router->dispatch(Request::fromGlobals()));
} catch (ConflictException $e) {
    Response::json(['error' => $e->getMessage(), 'code' => 'conflict', 'current' => $e->current], 409);
} catch (NotFoundException $e) {
    Response::json(['error' => 'Élément introuvable.', 'code' => 'not_found'], 404);
} catch (HttpException $e) {
    Response::json(['error' => $e->getMessage()] + $e->details, $e->status);
} catch (Throwable $e) {
    error_log('[vltpm] ' . $e::class . ': ' . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n", 3, vlt_path('storage/logs/api.log'));
    $debug = env('APP_ENV') === 'development';
    Response::json(['error' => 'Erreur serveur.' . ($debug ? ' ' . $e->getMessage() : '')], 500);
}
