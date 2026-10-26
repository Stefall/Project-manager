# Démo sur GitHub Pages (sans serveur)

Pour la démo, l'interface est publiée sur GitHub Pages et lit/écrit directement le Google Sheet avec le compte Google de la personne connectée. L'API PHP reste dans le dépôt pour la version de production.

**Sheet de démo** : « VLT Project Manager — Démo », une copie du Sheet de production. L'Apps Script continue d'utiliser l'original, qui n'est jamais modifié par la démo.

## Ce qui protège les données

- Le Sheet n'est **pas** public : seules les personnes avec qui il est partagé (en Éditeur) peuvent le lire ou l'écrire, même avec l'URL de la démo.
- En plus, le compte doit figurer dans l'onglet `USERS` (actif) pour entrer dans l'application.
- Aucune clé secrète n'est publiée : l'identifiant client OAuth est public par nature.

Limites par rapport à la version serveur : pas de verrou serveur (deux enregistrements dans la même seconde peuvent encore se croiser), journal écrit par le navigateur, PDF généré dans le navigateur.

## Mise en place (une fois, environ 15 minutes)

### 1. Identifiant OAuth Google

1. Ouvrir <https://console.cloud.google.com/>, créer un projet « VLT Project Manager ».
2. **APIs et services → Bibliothèque** : activer **Google Sheets API**.
3. **APIs et services → Écran de consentement OAuth** : type **Externe**, nom « VLT Project Manager », e-mail d'assistance. Champ d'application : `.../auth/spreadsheets`. Laisser en mode **Test** et ajouter comme **utilisateurs test** chaque compte Google de l'équipe (100 maximum).
4. **APIs et services → Identifiants → Créer → ID client OAuth** : type **Application Web**.
   - Origines JavaScript autorisées : `https://stefall.github.io`
   - (pour tester en local : `http://localhost:5173`)
5. Copier l'**ID client** (`xxxx.apps.googleusercontent.com`).

En mode Test, Google affiche un avertissement « application non validée » à la première connexion : cliquer sur « Continuer ». C'est normal pour une démo interne.

### 2. Variables du dépôt GitHub

Dépôt → **Settings → Secrets and variables → Actions → onglet Variables** :

| Variable | Valeur |
| --- | --- |
| `GOOGLE_CLIENT_ID` | l'ID client de l'étape 1 |
| `SPREADSHEET_ID` | identifiant du Sheet de démo (dans son URL, entre `/d/` et `/edit`) |

### 3. Activer Pages

Dépôt → **Settings → Pages → Source : GitHub Actions**. Chaque fusion dans `main` publie la démo sur `https://stefall.github.io/Project-manager/` (relance manuelle possible dans l'onglet Actions → « Démo GitHub Pages » → Run workflow).

### 4. Donner accès à un membre de l'équipe

1. Partager le Sheet de démo avec son compte Google, en **Éditeur**.
2. L'ajouter comme utilisateur test dans l'écran de consentement OAuth.
3. Ajouter une ligne dans l'onglet `USERS` : colonne A `U-002`, colonne B
   `{"id":"U-002","email":"prenom@exemple.com","name":"Prénom","role":"member","active":true}`

## Tester en local

```bash
cd frontend
cp .env.example .env.local   # renseigner VITE_GOOGLE_CLIENT_ID et VITE_SPREADSHEET_ID
npm install && npm run dev   # http://localhost:5173/app/
```
