# Rilascio su VPS con Docker

Il bot gira in un unico container. Non apre porte: si collega lui a Discord, quindi sul VPS non serve aprire nulla nel firewall. Le schede e le partite stanno in un file SQLite dentro il volume Docker `bot-data`, che sopravvive a riavvii, aggiornamenti e ricostruzioni dell'immagine.

Servono un VPS Linux (Debian, Ubuntu o simili, x86_64 o ARM64) con accesso SSH e circa 1 GB di RAM libera per la build.

## 1. Installare Docker

Su Debian o Ubuntu, da utente con `sudo`:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # poi esci e rientra in SSH
docker compose version          # deve rispondere con una versione
```

## 2. Scaricare il bot

```bash
git clone -b release https://github.com/Sdrogo/Cowboy-BeBOT.git
cd Cowboy-BeBOT
```

Se il repository è privato, usa un [token GitHub](https://github.com/settings/tokens) con permesso di lettura come password, oppure una deploy key SSH.

## 3. Configurare

```bash
cp .env.example .env
nano .env
```

Compila `DISCORD_TOKEN` e `DISCORD_CLIENT_ID`. Lascia `DISCORD_GUILD_ID` vuoto per avere i comandi su tutti i server, oppure metti l'id del tuo server per vederli subito. `DATABASE_PATH` viene ignorato: nel container il database è sempre nel volume.

Proteggi il file, contiene il token: `chmod 600 .env`.

## 4. Avviare

```bash
docker compose up -d --build
docker compose run --rm bot node dist/deploy-commands.js   # registra gli slash command
docker compose logs -f bot                                  # Ctrl+C per uscire dai log
```

Nei log deve comparire `Cowboy BeBOT in linea come ...`. La registrazione dei comandi va rifatta solo quando cambiano i comandi (nuovi comandi o opzioni); con i comandi globali Discord può metterci fino a un'ora a mostrarli.

Il container ha `restart: unless-stopped`: riparte da solo se va in crash e quando il VPS si riavvia.

## Comandi utili

| Cosa | Comando |
| --- | --- |
| Stato | `docker compose ps` |
| Log | `docker compose logs -f --tail 100 bot` |
| Fermare | `docker compose stop` |
| Riavviare | `docker compose restart bot` |
| Aggiornare | `git pull && docker compose up -d --build` |
| Pulire immagini vecchie | `docker image prune -f` |

Dopo un aggiornamento che tocca i comandi, ripeti `docker compose run --rm bot node dist/deploy-commands.js`.

## Backup del database

Copia a caldo, con il bot acceso:

```bash
docker compose exec bot node -e "new (require('better-sqlite3'))(process.env.DATABASE_PATH).backup('/app/data/backup.sqlite').then(()=>console.log('ok'))"
docker compose cp bot:/app/data/backup.sqlite ./backup-$(date +%F).sqlite
```

Per ripristinare un backup:

```bash
docker compose stop bot
docker compose cp ./backup-AAAA-MM-GG.sqlite bot:/app/data/cowboy-bebot.sqlite
docker compose start bot
```

Attenzione: `docker compose down -v` cancella il volume e quindi tutte le schede. `docker compose down` senza `-v` è sicuro.

## Se qualcosa non va

- **`Manca DISCORD_TOKEN`** nei log: il file `.env` non c'è o è vuoto, oppure non sei nella cartella del progetto.
- **`An invalid token was provided`**: il token è sbagliato o è stato rigenerato nel Developer Portal.
- **I comandi non compaiono**: rilancia la registrazione; se sono globali aspetta fino a un'ora, oppure usa `DISCORD_GUILD_ID` per il tuo server.
- **Vedo ancora il vecchio `/cowbot`**: la registrazione sostituisce tutti i comandi di quell'ambito (server o globale). Se prima li avevi registrati nell'altro ambito, svuota o imposta `DISCORD_GUILD_ID` come allora, rilancia la registrazione, poi cambia ambito e rilancia di nuovo.
- **La build si interrompe su un VPS piccolo**: su ARM `better-sqlite3` viene compilato e serve memoria. Aggiungi 1 GB di swap (`sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`) e riprova.
