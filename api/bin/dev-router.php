<?php

// Routeur du serveur PHP intégré, qui ignore .htaccess. Développement uniquement :
// php -S localhost:8000 -t public api/bin/dev-router.php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (str_starts_with($path, '/api')) {
    require __DIR__ . '/../../public/index.php';
    return true;
}
if ($path !== '/' && is_file(__DIR__ . '/../../public' . $path)) {
    return false;
}
readfile(__DIR__ . '/../../public/app/index.html');
return true;
