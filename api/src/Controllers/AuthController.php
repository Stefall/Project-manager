<?php

declare(strict_types=1);

namespace Vlt\Controllers;

use Vlt\Http\HttpException;
use Vlt\Http\Request;
use Vlt\Security\LoginThrottle;
use Vlt\Security\Session;
use Vlt\Storage\Repository;

final class AuthController
{
    public function __construct(private readonly Repository $repo, private readonly LoginThrottle $throttle)
    {
    }

    public function me(Request $request): array
    {
        return ['user' => Session::user(), 'csrf' => Session::csrfToken()];
    }

    public function login(Request $request): array
    {
        $email = mb_strtolower(trim((string) ($request->body['email'] ?? '')));
        $password = (string) ($request->body['password'] ?? '');
        $key = $email . '|' . ($_SERVER['REMOTE_ADDR'] ?? '');

        if ($this->throttle->tooMany($key)) {
            throw new HttpException(429, 'Trop de tentatives, réessayez dans 15 minutes.');
        }

        $user = null;
        foreach ($this->repo->all('USERS') as $candidate) {
            if (mb_strtolower($candidate['email'] ?? '') === $email && !empty($candidate['active'])) {
                $user = $candidate;
                break;
            }
        }
        // password_verify est appelé même sans compte pour ne pas révéler par le temps de réponse si l'e-mail existe.
        $hash = $user['passwordHash'] ?? '$2y$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
        if (!password_verify($password, $hash) || $user === null) {
            $this->throttle->fail($key);
            throw new HttpException(401, 'E-mail ou mot de passe incorrect.');
        }

        $this->throttle->clear($key);
        Session::login($user);
        return $this->me($request);
    }

    public function logout(Request $request): array
    {
        Session::destroy();
        return ['ok' => true];
    }
}
