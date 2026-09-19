# Déploiement de Reginald sur Debian 13 (LXC/Proxmox)

Guide pas à pas depuis un conteneur **Debian 13 (trixie) vierge**. Toutes les
commandes se lancent en `root` (sinon préfixe par `sudo`).

---

## 1. Mettre à jour le système et installer les outils de base

```bash
apt update && apt -y upgrade
apt -y install curl ca-certificates git gnupg
```

## 2. Installer Node.js 20 (dépôt officiel NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt -y install nodejs
node -v   # doit afficher v20.x
npm -v
```

## 3. Créer l'utilisateur de service et le dossier

```bash
useradd -r -m -d /opt/reginald -s /usr/sbin/nologin reginald
mkdir -p /opt/reginald
```

## 4. Récupérer le code

```bash
cd /opt/reginald
git clone -b claude/upbeat-knuth-5arwi3 https://github.com/HaitoDann/Reginald.git .
```

## 5. Déposer les secrets (jamais dans Git)

### 5a. Le compte de service Firebase

Copie ton fichier `serviceAccount.json` dans `/opt/reginald/serviceAccount.json`.
Deux options :

- **Depuis ton PC** (recommandé) :
  ```bash
  scp plazma-esport-firebase-adminsdk-*.json root@<IP_DU_LXC>:/opt/reginald/serviceAccount.json
  ```
- **À la main** : `nano /opt/reginald/serviceAccount.json`, colle le contenu JSON, sauvegarde (Ctrl+O, Entrée, Ctrl+X).

### 5b. Le fichier `.env`

```bash
nano /opt/reginald/.env
```
Colle ceci (remplace le token) :
```
DISCORD_TOKEN=<ton token Discord>
DISCORD_GUILD_ID=687439326035836967
DISCORD_AVAILABILITY_CHANNEL_ID=1550636671299489902
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccount.json
FIREBASE_PROJECT_ID=plazma-esport
TZ=Europe/Paris
LOG_LEVEL=info
```

### 5c. Verrouiller les droits des secrets

```bash
chmod 600 /opt/reginald/.env /opt/reginald/serviceAccount.json
```

## 6. Installer les dépendances et compiler

```bash
cd /opt/reginald
npm ci
npm run build
```

## 7. Test en avant-plan (validation)

```bash
cd /opt/reginald
node dist/index.js
```

Tu dois voir dans les logs :
```
... "msg":"Firestore initialisé" ...
... "msg":"Reginald connecté", "user":"Reginald#..." ...
... "msg":"Message hebdo publié" ...
```
→ le message de disponibilités apparaît dans le salon `#dispos`, avec les
7 emojis. Fais **Ctrl+C** pour arrêter le test.

> Le mapping `plazma/discord-links` est déjà en base : une réaction d'un des
> joueurs liés écrit directement dans `plazma-availability`.

## 8. Installer le service systemd (tourne 24/7, redémarre tout seul)

```bash
chown -R reginald:reginald /opt/reginald
cp /opt/reginald/deploy/reginald.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now reginald
```

## 9. Vérifier et suivre les logs

```bash
systemctl status reginald
journalctl -u reginald -f      # logs en direct (Ctrl+C pour quitter)
```

---

## Mise à jour du bot (après un nouveau commit)

```bash
cd /opt/reginald
git pull
npm ci
npm run build
systemctl restart reginald
```

## Gestion d'un mercato (changement de joueur sur un rôle)

Sur ta machine de dev (celle qui a `mapping.json`), édite l'entrée du rôle
concerné (nouveau `discordId` + `pseudo`), puis :
```bash
npm run link -- --dry-run   # vérifie
npm run link                # applique dans Firestore
```
Rien à toucher sur le serveur : le bot relit le mapping à chaque calcul.

## Dépannage

- **`DiscordAPIError` au démarrage** → token invalide, ou intents non activés
  dans le Developer Portal (Bot → active *Message Content Intent*).
- **`Salon introuvable`** → l'ID du salon est faux, ou le bot n'a pas accès au
  salon (vérifie les permissions du rôle du bot).
- **Erreur Firestore `PERMISSION_DENIED`** → mauvais `serviceAccount.json` ou
  mauvais projet.
- **Rien ne se passe sur une réaction** → l'utilisateur Discord n'est pas dans
  `plazma/discord-links` (lance `npm run diagnose` pour voir les liens).
