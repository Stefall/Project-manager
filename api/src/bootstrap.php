<?php

declare(strict_types=1);

use Vlt\Storage\GoogleSheetsStore;
use Vlt\Storage\LocalJsonStore;
use Vlt\Storage\Lock;
use Vlt\Storage\Repository;
use Vlt\Storage\Store;

require __DIR__ . '/../vendor/autoload.php';

define('VLT_ROOT', dirname(__DIR__, 2));

Dotenv\Dotenv::createImmutable(VLT_ROOT . '/config')->safeLoad();

function env(string $key, ?string $default = null): ?string
{
    return $_ENV[$key] ?? $default;
}

function vlt_path(string $relative): string
{
    return str_starts_with($relative, '/') ? $relative : VLT_ROOT . '/' . $relative;
}

date_default_timezone_set(env('APP_TIMEZONE', 'Europe/Paris'));

function vlt_store(): Store
{
    return match (env('STORAGE_DRIVER', 'google')) {
        'local' => new LocalJsonStore(vlt_path(env('LOCAL_STORE_FILE', 'storage/data/local-sheet.json'))),
        'google' => new GoogleSheetsStore(
            env('GOOGLE_SPREADSHEET_ID') ?: throw new RuntimeException('GOOGLE_SPREADSHEET_ID manquant'),
            vlt_path(env('GOOGLE_SERVICE_ACCOUNT_FILE', 'config/service-account.json')),
            vlt_path('storage/cache'),
            (int) env('SHEETS_CACHE_TTL', '5'),
        ),
    };
}

function vlt_repository(): Repository
{
    return new Repository(vlt_store(), new Lock(vlt_path('storage/locks')));
}
