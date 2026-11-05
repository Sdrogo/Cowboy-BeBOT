# Cowboy BeBOT

Bot Discord per giocare a **Cowboy Bebop – Il Gioco di Ruolo**. Tira le Prove con le regole del manuale e mostra il risultato come una card grafica, tiene le schede dei personaggi e lo stato della partita in ogni canale.

## Cosa fa

- **`/cowbot-prova`** tira una Prova con il personaggio attivo. La riserva si calcola da sola: dadi della svolta, tratti scelti (con autocompletamento), Genere, Cartucce di *farsi coinvolgere*, Vantaggio e Svantaggio. Il risultato arriva come immagine, con i pulsanti per spingersi al limite e assorbire shock (ferendo un tratto o segnando una Cartuccia). Solo chi ha tirato può usarli. Dopo la conferma si passa alla spesa: il CT spende i successi (orologi o −1 Difficoltà), il Big Shot spende gli shock (orologi, +1 Difficoltà o messi da parte come Rischio) e può spendere Rischio per aggiungere shock.
Gli slash command sono pochi: `/cowbot-prova`, `/cowbot-scheda`, `/cowbot-partita`, `/cowbot-orologio` e `/cowbot-rischio`. Nelle ultime quattro si sceglie l'`azione` e il bot apre un form con i soli campi che servono (o esegue subito, se non servono).

- **`/cowbot-scheda`** gestisce i personaggi. Ogni utente Discord può averne più di uno e passare dall'uno all'altro con `/cowbot-scheda azione:usa`. Contiene Groove, concept, Ricordo, tratti per Approccio (3 esagoni ciascuno, più 3 per il MONO), ferite, Cartucce, Ritmo e Fardelli.
- **`/cowbot-partita`** tiene svolta, Difficoltà, Genere e shock minimo del canale. `/cowbot-partita azione:sessione` avvia una Session (Classica, Personale, Filler, Climax): chi la lancia fa da Big Shot, i CT si uniscono con un pulsante e il bot calcola Ritmo e Rischio iniziali. `/cowbot-partita azione:fine` la chiude (solo il Big Shot, con conferma): azzera Ritmo, Rischio e orologi, guarisce le ferite gravi, libera le Cartucce dopo Personale e Climax e mostra la card di chiusura. `/cowbot-partita azione:the-end` tira The End per il finale di stagione.
- **`/cowbot-orologio`** crea, segna ed elimina gli orologi del canale (obiettivo, minaccia, inseguimento), mostrati come card. Chiudere una minaccia applica il suo effetto alla svolta successiva.
- **`/cowbot-rischio`** spende il Rischio del Big Shot fuori dalle Prove: Difficoltà a inizio svolta, inseguimento, Svantaggio sulla prossima Prova.

Le regole implementate e le scelte sui punti ambigui del manuale sono nella specifica condivisa nel progetto.

## Avvio

Serve Node.js 20 o superiore.

```bash
npm install
cp .env.example .env   # inserisci token, application id e (per i test) l'id del server
npm run deploy-commands
npm run dev
```

Per creare il bot: Discord Developer Portal → New Application → Bot → copia il token. Per invitarlo: OAuth2 → URL Generator, scope `bot` e `applications.commands`, permessi *Send Messages* e *Attach Files*.

In produzione si usa Docker: la guida passo passo per il VPS è in [docs/deploy-vps.md](docs/deploy-vps.md). Senza Docker: `npm run build` e poi `npm start`. I dati stanno in un file SQLite (`DATABASE_PATH`, di default `data/cowboy-bebot.sqlite`).

## Sviluppo

```bash
npm test              # test del motore delle Prove e delle schede
npm run typecheck
npm run preview-card  # genera card di esempio in ./preview senza collegarsi a Discord
```

Struttura:

- `src/engine` regole e motore delle Prove, funzioni pure e testate
- `src/store` schede e partite su SQLite
- `src/render` card generate con Satori (layout tipo flexbox) e convertite in PNG con resvg
- `src/commands` slash command e pulsanti

## Non ancora fatto

Riff che spendono Ritmo (Assolo, Aiutare, Improvvisare, Jam), Scommettere, Groove con scelte dopo il tiro (Piani a Lungo Termine, Fuori dagli Schemi, Aggiustatutto), Tratti Session, spesa del Ritmo al posto delle Cartucce nelle Session Personale e Climax, e scheda in versione grafica.

## Termini e privacy

I Termini di Servizio e l'Informativa sulla privacy (in italiano e in inglese) sono in `docs/legal`. Con GitHub Pages attivo sulla cartella `/docs` del ramo di rilascio, sono pubblicati a questi indirizzi, da inserire nel Developer Portal (General Information → Terms of Service URL e Privacy Policy URL):

- https://sdrogo.github.io/Cowboy-BeBOT/legal/termini-di-servizio.html
- https://sdrogo.github.io/Cowboy-BeBOT/legal/privacy.html
- https://sdrogo.github.io/Cowboy-BeBOT/legal/terms-of-service.html
- https://sdrogo.github.io/Cowboy-BeBOT/legal/privacy-policy.html

Se aggiungi dati salvati nel database, aggiorna anche l'informativa.
