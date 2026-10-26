<?php

declare(strict_types=1);

/**
 * Crée un compte VLT dans l'onglet USERS. Le mot de passe est saisi sans écho et stocké haché.
 * Usage : php api/bin/create-user.php prenom.nom@vlt.fr "Prénom Nom" [admin|member]
 */

use Vlt\Domain\Ids;

require __DIR__ . '/../src/bootstrap.php';

[, $email, $name, $role] = $argv + [null, null, null, 'member'];
if (!$email || !$name || !in_array($role, ['admin', 'member'], true)) {
    fwrite(STDERR, "Usage : php api/bin/create-user.php email \"Nom\" [admin|member]\n");
    exit(1);
}

echo 'Mot de passe (12 caractères minimum) : ';
system('stty -echo');
$password = trim((string) fgets(STDIN));
system('stty echo');
echo "\n";
if (mb_strlen($password) < 12) {
    fwrite(STDERR, "Mot de passe trop court.\n");
    exit(1);
}

$user = vlt_repository()->create('USERS', [
    'email' => mb_strtolower($email),
    'name' => $name,
    'role' => $role,
    'active' => true,
    'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
], 'cli', Ids::sequential('U'));

echo "Compte {$user['id']} créé pour {$user['email']} ({$role}).\n";
