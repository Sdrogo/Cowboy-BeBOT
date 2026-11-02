---
title: Privacy Policy – Cowboy BeBOT
---

# Cowboy BeBOT Privacy Policy

*Effective 2 November 2026* · [Versione italiana](privacy.html)

This policy explains what data **Cowboy BeBOT** (the "Bot") processes, why, and what your rights are under Regulation (EU) 2016/679 ("GDPR") and Italian Legislative Decree 196/2003. If the two language versions differ, the Italian one prevails.

## 1. Data controller

The controller is the **Army of Me** team, reachable through the [team's Discord channel](https://discord.gg/Xe86XD6K96).

## 2. What we collect

The Bot only receives from Discord your interactions with its commands (`/cowbot prova`, `/cowbot scheda`, `/cowbot partita`, `/cowbot orologio`, `/cowbot rischio`) and its buttons. **It does not read chat messages**, and it does not access member lists, direct messages, your email, IP address or other Discord account data.

The Bot **stores** in its database:

| Data | Example | Linked to |
|---|---|---|
| Discord user ID | `123456789012345678` | your sheets |
| Character sheets: name, concept, Groove, Memory, traits and wounds, Cartridges, Rhythm, Burdens, active character, creation date | "Spike, bounty hunter" | your user ID |
| Game state: Session type and title, Big Shot user ID, turn, Difficulty, Genre, minimum shock, Risk, active effects, last update | Classic Session, turn 2, Difficulty 5 | the Discord channel ID |
| Session participants: user ID, character used, Rhythm roll and value | Rhythm 4 | the Discord channel ID |
| Clocks: name, segments, Approach, type, marked segments | "Casino escape", 2 of 4 | the Discord channel ID |

The Bot also keeps the data of a roll you just made **in temporary memory** (not on disk) so you can use the buttons on the roll card. This data is deleted after three hours or when the Bot restarts.

You write the sheet text yourself: please don't put personal data about you or anyone else in it.

The server hosting the Bot may keep technical operation logs (startup, errors), which normally don't contain sheet content.

## 3. Why we process it and on what legal basis

- **Running the Bot** (saving and showing sheets, computing rolls, keeping channel game state): performance of the service you request by using the commands, Art. 6(1)(b) GDPR.
- **Security and troubleshooting** (technical logs): the controller's legitimate interest in keeping the service working and secure, Art. 6(1)(f) GDPR.

The data is **not** used for advertising, profiling or automated decision-making, and is **not** sold or shared with third parties.

## 4. Where it is stored and who can access it

The data is stored in a database on a private server run by the controller, hosted by **OVHcloud** in **the United Kingdom (London)**. The provider acts only as infrastructure. The UK is outside the European Union, but the European Commission recognises it as providing an adequate level of data protection (Art. 45 GDPR), so the transfer needs no further safeguards. Only the controller has access to the database.

Interactions also pass through Discord, which processes them under its own [Privacy Policy](https://discord.com/privacy). Discord Inc. is based in the United States.

## 5. How long we keep it

- Sheets are kept until you delete them with `/cowbot scheda elimina` or ask the controller to delete them.
- A channel's game state is kept while the Bot is used in that server. You can ask the controller to delete it.
- A channel's participants and clocks are deleted when a new Session starts in that channel.
- Temporary roll data lasts at most three hours.
- Technical logs are kept only as long as necessary and then deleted.

If the Bot is shut down, the database is deleted.

## 6. Your rights

You have the right to access, rectify and erase your data, to restrict processing, to data portability, and to object to processing based on legitimate interest (Arts. 15–22 GDPR). You can do much of this yourself with `/cowbot scheda`. For anything else, write in the [team's Discord channel](https://discord.gg/Xe86XD6K96) with your Discord user ID: we will reply within one month.

If you believe the processing breaches the GDPR, you can lodge a complaint with the Italian [Garante per la protezione dei dati personali](https://www.garanteprivacy.it) or with the authority in your country.

## 7. Children

The Bot is meant for people allowed to use Discord under its terms. It does not knowingly collect any data beyond what is described above, at any age.

## 8. Changes

If this policy changes, the updated version is published at this address with a new effective date.
