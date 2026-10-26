<?php

declare(strict_types=1);

namespace Vlt\Http;

/** Routeur minimal : méthode + motif « /tasks/{id} » → handler, avec middlewares par route. */
final class Router
{
    /** @var array<int, array{string, string, callable, array<int, callable>}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler, array $middlewares = []): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '$#';
        $this->routes[] = [$method, $regex, $handler, $middlewares];
    }

    public function dispatch(Request $request): mixed
    {
        $allowed = false;
        foreach ($this->routes as [$method, $regex, $handler, $middlewares]) {
            if (!preg_match($regex, $request->path, $m)) {
                continue;
            }
            $allowed = true;
            if ($method !== $request->method) {
                continue;
            }
            $request->params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);
            foreach ($middlewares as $middleware) {
                $middleware($request);
            }
            return $handler($request);
        }
        throw new HttpException($allowed ? 405 : 404, $allowed ? 'Méthode non autorisée.' : 'Route inconnue.');
    }
}
