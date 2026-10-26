# Installation et déploiement

## Prérequis du serveur

- PHP 8.2 ou plus, extensions `json`, `mbstring`, `openssl`, `curl`, `dom`, `gd` (PDF).
- Apache avec `mod_rewrite` (ou Nginx, voir plus bas), HTTPS actif.
- Aucun Node.js : le front est compilé avant l'envoi.

## 1. Compte de service Google

1. Dans Google Cloud Console, créer un projet, activer **Google Sheets API**.
2. Créer un compte de service, générer une clé JSON.
3. Partager le Google Sheet avec l'adresse e-mail du compte de service, en **Éditeur**. Ne jamais le partager publiquement.
4. Déposer la clé dans `config/service-account.json` (hors racine web, droits 600).

## 2. Configuration

Copier `config/.env.example` en `config/.env` et renseigner :

| Variable | Rôle |
| --- | --- |
| `APP_ENV` | `production` (cookies Secure) ou `development` |
| `APP_URL` | URL publique, ex. `https://pm.vlt.fr` |
| `STORAGE_DRIVER` | `google` en production, `local` pour développer |
| `GOOGLE_SPREADSHEET_ID` | identifiant du Sheet (dans son URL, entre `/d/` et `/edit`) |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | chemin absolu de la clé JSON |
| `SHEETS_CACHE_TTL` | durée du cache de lecture en secondes (5 par défaut) |
| `SESSION_IDLE_MINUTES` | déconnexion après inactivité (480 par défaut) |
| `BACKUP_DIR`, `BACKUP_KEEP_DAYS` | sauvegardes JSON quotidiennes |

## 3. Build et envoi

```bash
cd api && composer install --no-dev --optimize-autoloader && cd ..
cd frontend && npm ci && npm run build && cd ..     # produit public/app/
```

Envoyer sur le serveur : `api/` (avec `vendor/`), `public/`, `config/.env`, `config/service-account.json`, et créer `storage/` avec ses sous-dossiers `cache locks sessions backups logs`, inscriptibles par PHP.

La racine web du domaine doit pointer sur `public/`. Si l'hébergeur impose une racine fixe, y placer le contenu de `public/` et ajuster le chemin de `require` dans `index.php`.

Nginx : `location /api { try_files $uri /index.php?$query_string; }` et `location / { try_files $uri /app/index.html; }`.

## 4. Premier compte

```bash
php api/bin/create-user.php prenom@vlt.fr "Prénom Nom" admin
```

## 5. Sauvegarde et restauration

À compléter en phase 9 (`api/bin/backup.php` en cron quotidien, `api/bin/restore.php`).
