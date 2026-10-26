<?php

declare(strict_types=1);

namespace Vlt\Security;

use Vlt\Http\HttpException;
use Vlt\Http\Request;

final class Middleware
{
    public static function auth(): callable
    {
        return function (Request $request): void {
            $request->user = Session::user();
            if ($request->user === null) {
                throw new HttpException(401, 'Session expirée, reconnectez-vous.');
            }
        };
    }

    public static function admin(): callable
    {
        return function (Request $request): void {
            if (($request->user['role'] ?? null) !== 'admin') {
                throw new HttpException(403, 'Réservé aux administrateurs.');
            }
        };
    }

    /** Les requêtes d'écriture doivent renvoyer le jeton CSRF de la session dans X-CSRF-Token. */
    public static function csrf(): callable
    {
        return function (Request $request): void {
            if (in_array($request->method, ['GET', 'HEAD', 'OPTIONS'], true)) {
                return;
            }
            $token = $request->header('x-csrf-token') ?? '';
            if (!hash_equals(Session::csrfToken(), $token)) {
                throw new HttpException(419, 'Jeton de sécurité invalide, rechargez la page.');
            }
        };
    }
}
