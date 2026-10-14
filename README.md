# Reginald

Bot Discord officiel de **PlaZma Esport**. Reginald est une **interface Discord
d'ARCHI** (l'outil interne). Il ne crée aucune logique métier parallèle : la
source de vérité reste **Firestore**, alimentée par ARCHI.

```
Discord ⇄ Reginald ⇄ Firestore ⇆ ARCHI
```

## Ce que fait Reginald

Chaque semaine, Reginald publie un message de disponibilités :

```
🟥 Lundi   🟧 Mardi   🟨 Mercredi   🟩 Jeudi
🟦 Vendredi   🟪 Samedi   ⬜ Dimanche
```

Le message est publié automatiquement **chaque samedi à 08:00 (Europe/Paris)**
pour la **semaine suivante**, afin de laisser le week-end aux joueurs pour
répondre. (Bascule gérée par `activeWeekValue` + un tick idempotent ; aucun
cron externe requis, robuste aux redémarrages.)

Les joueurs réagissent avec l’emoji des jours où ils sont dispos. Reginald :

- détecte les réactions ajoutées/retirées ;
- résout le **Discord User ID → joueur ARCHI** (doc `plazma/discord-links`) ;
- écrit la dispo dans **`plazma-availability`** au schéma ARCHI
  (`{ week, uid, playerId, days: { Jour: 'yes' } }`) ;
- recalcule les créneaux **5/5** et **édite** le message Discord en direct.

> **5/5 = créneau possible, pas un scrim.** Un scrim n’est annoncé que s’il
> existe réellement dans le Planning d’ARCHI.

Les remplaçants comptent dans le 5/5 ; si le créneau n’atteint 5 que grâce à un
sub, le message le signale (`⚠️ avec un sub`).

## Intégration ARCHI (schémas réutilisés)

| Donnée | Emplacement Firestore | Remarque |
|---|---|---|
| Roster | `plazma/roster` | 5 titulaires + coach + `_extras` (subs) |
| Disponibilités | `plazma-availability/{week}__{uid}` | 1 doc / joueur / semaine |
| Planning | `plazma/schedule-{week}` | grille des sessions |
| Scrims | `plazma-scrims/{id}` | CR de match |
| Mapping Discord | `plazma/discord-links` | **nouveau**, propre à Reginald |
| État du bot | `plazma/reginald` | id du message hebdo à éditer |

- La clé de semaine `YYYY-Www` et son libellé sont **portés à l’identique**
  depuis `plazma-schedule.html` (`src/week.ts`, `src/weeklabel.ts`).
- `uid` écrit = uid Firebase Auth du compte ARCHI lié (option A), pour que la
  grille ARCHI reste cohérente avec ce que publie le bot.
- Reginald utilise le **Firebase Admin SDK**, qui contourne `firestore.rules` :
  il respecte donc le schéma manuellement.

### Doc `plazma/discord-links`

```json
{
  "links": {
    "<discordUserId>": { "playerId": "boulou", "uid": "<firebaseAuthUid>" }
  }
}
```

C’est la seule donnée nouvelle. À terme, l’édition de ce mapping peut être
ajoutée à l’UI ARCHI (section Team) ; en attendant il se remplit à la main.

## Configuration

Copier `.env.example` en `.env` (jamais committé) :

- `DISCORD_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_AVAILABILITY_CHANNEL_ID`
- `FIREBASE_SERVICE_ACCOUNT_PATH` (fichier JSON hors Git) ou
  `GOOGLE_APPLICATION_CREDENTIALS`
- `TZ=Europe/Paris`

Aucun secret n’est stocké dans Git (voir `.gitignore`).

## Développement

```bash
npm install
npm run typecheck
npm test          # tests unitaires (week, résumé 5/5)
npm run dev       # exécution locale (tsx --watch)
npm run build && npm start
```

## Déploiement (LXC Debian / Proxmox)

1. `npm ci && npm run build` sur la cible, dans `/opt/reginald`.
2. Placer `.env` et le service account JSON dans `/opt/reginald` (droits 600).
3. Installer l’unité systemd : `deploy/reginald.service` → `/etc/systemd/system/`.
4. `systemctl enable --now reginald`.

`Restart=always` + partials discord.js assurent la survie aux redémarrages et
aux coupures réseau : le message hebdo est retrouvé via `plazma/reginald`.

## Statut

Squelette fonctionnel : lecture roster/dispos, écriture des dispos au schéma
ARCHI, message hebdo édité en direct. Le mapping `plazma/discord-links` doit
être renseigné avant la première utilisation réelle.
