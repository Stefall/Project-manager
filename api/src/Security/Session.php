<?php

declare(strict_types=1);

namespace Vlt\Security;

/** Session PHP durcie : cookie HttpOnly + Secure + SameSite, expiration sur inactivité, jeton CSRF. */
final class Session
{
    public static function start(string $name, string $savePath, int $idleMinutes, bool $secure): void
    {
        session_name($name);
        session_save_path($savePath);
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        ini_set('session.use_strict_mode', '1');
        ini_set('session.gc_maxlifetime', (string) ($idleMinutes * 60));
        session_start();

        $last = $_SESSION['last_activity'] ?? null;
        if ($last !== null && time() - $last > $idleMinutes * 60) {
            self::destroy();
            session_start();
        }
        $_SESSION['last_activity'] = time();
        $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    }

    public static function login(array $user): void
    {
        session_regenerate_id(true);
        $_SESSION['user'] = ['id' => $user['id'], 'email' => $user['email'], 'name' => $user['name'] ?? '', 'role' => $user['role']];
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }

    public static function user(): ?array
    {
        return $_SESSION['user'] ?? null;
    }

    public static function csrfToken(): string
    {
        return $_SESSION['csrf'];
    }

    public static function destroy(): void
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
    }
}
