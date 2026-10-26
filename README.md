# VLT Project Manager

Application interne de pilotage de projets de l'agence VLT. Front Vue 3 compilé en fichiers statiques, API REST PHP 8.2+, Google Sheets comme base de données unique.

## État d'avancement

| Phase | Contenu | État |
| --- | --- | --- |
| 1 | Audit du Google Sheet existant | fait (voir le document d'audit) |
| 2 | Design system et structure Vue 3 | fait : jetons, composants de base, gabarit |
| 3 | Dashboard et navigation | première version |
| 4 | Projets, livrables, tâches | vue tableau et Kanban de base ; fiches projet à faire |
| 5 | Mode réunion | fait : panneau « Nouvelle tâche », raccourci `N`, « Enregistrer et créer une autre » |
| 6 | Gantt et calendrier | à faire |
| 7 | API, authentification, synchronisation Sheets | socle fait : sessions, CSRF, versions, verrou ; admin à faire |
| 8 | Historique et bilans PDF | journal des événements fait ; bilans à faire |
| 9 | Tests, sécurisation, déploiement | tests du dépôt de données faits |

## Arborescence

```
frontend/     Vue 3 + Vite + Pinia + Vue Router (développement uniquement)
api/          API PHP : src/ (Http, Controllers, Domain, Storage, Security), bin/ (scripts), tests/
public/       seule racine web : index.php (API) + app/ (front compilé) + .htaccess
config/       .env et clé du compte de service Google, hors racine web
storage/      sessions, cache, verrous, sauvegardes, journaux (non versionné)
docs/         installation, configuration, sauvegarde
```

## Développer en local, sans Google

```bash
cd api && composer install && cd ..
cp config/.env.example config/.env   # puis STORAGE_DRIVER=local et APP_ENV=development
php api/bin/seed-local.php           # crée un faux Sheet et le compte admin@vlt.local / demo-vlt
php -S 127.0.0.1:8000 -t public api/bin/dev-router.php
cd frontend && npm install && npm run dev   # http://localhost:5173/app/ (proxy /api vers :8000)
```

Tests : `cd api && vendor/bin/phpunit`.

## Principes

- **Google Sheets reste la source de vérité.** Format conservé : colonne A = id, colonne B = objet JSON. Les lignes écrites par l'ancien Apps Script restent lisibles.
- **Aucune modification n'est écrasée en silence.** Chaque entité porte une `version` ; le front l'envoie dans `If-Match`, l'API répond 409 si elle a changé.
- **EVENTS est en ajout seul** et porte date, auteur, type, entité, note et lien. Une tâche n'est « réalisée » qu'avec un événement `task.completed` ; un livrable n'est validé, livré ou publié qu'avec l'événement correspondant.
- **Aucun identifiant Google dans le navigateur.** Le front ne parle qu'à l'API PHP.

Voir `docs/installation.md` pour le déploiement.
