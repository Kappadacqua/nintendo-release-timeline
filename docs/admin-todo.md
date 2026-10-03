# Admin to-do

> **Superato** (2026-10-03): la lista aggiornata dei dati da inserire a mano è `data/manual-todo.md` (`npm run data:validate -- --todo`).

Data to fill in by hand, generated on 2026-09-27 from `public/data/games.json` (84 entries, 17 of them free updates, which have no scores and are left out) and `npm run data:validate`. "Released" means a first release date on or before 2026-09-27. Newest first.

To regenerate: rerun `npm run data:validate` after `npm run data:build`; the lists below match its "Released games missing Metacritic or Backloggd" section.

Where to enter the data:
- **Admin panel**: `npm run dev` → `/admin.html`.
- **By hand**: `data/overrides.json`, under `games.<id>` — `metacritic: { critic, criticCount, user, userCount }` and `backloggd: { rating, count }`. Then `npm run data:build`.

Rankings drops a score without its review count when "Min. reviews" is above 0: fill in the counts too.

## Metacritic missing (47)

Critic and user score. Admin panel, or `games.<id>.metacritic` in `data/overrides.json`.

| Title | Type | Release | Missing | Search |
|---|---|---|---|---|
| Derby Stallion 2 | Game | 2026-09-24 | critic, user | [Metacritic](https://www.metacritic.com/search/Derby%20Stallion%202/) |
| Fire Emblem: Fortune's Weave | Game | 2026-09-17 | critic, user | [Metacritic](https://www.metacritic.com/search/Fire%20Emblem%3A%20Fortune's%20Weave/) |
| Orbitals | Game | 2026-09-03 | critic, user | [Metacritic](https://www.metacritic.com/search/Orbitals/) |
| Pokémon Pokopia: Bubbly Basin | DLC | 2026-08-05 | critic, user | [Metacritic](https://www.metacritic.com/search/Pok%C3%A9mon%20Pokopia%3A%20Bubbly%20Basin/) |
| Xenoblade Chronicles 2: Nintendo Switch 2 Edition | Switch 2 Edition | 2026-07-30 | critic, user | [Metacritic](https://www.metacritic.com/search/Xenoblade%20Chronicles%202%3A%20Nintendo%20Switch%202%20Edition/) |
| Splatoon Raiders | Game | 2026-07-23 | critic, user | [Metacritic](https://www.metacritic.com/search/Splatoon%20Raiders/) |
| Fitness Boxing 3: Your Personal Trainer - Nintendo Switch 2 Edition | Switch 2 Edition | 2026-07-16 | critic, user | [Metacritic](https://www.metacritic.com/search/Fitness%20Boxing%203%3A%20Your%20Personal%20Trainer%20-%20Nintendo%20Switch%202%20Edition/) |
| Rhythm Heaven Groove | Game | 2026-07-02 | critic, user | [Metacritic](https://www.metacritic.com/search/Rhythm%20Heaven%20Groove/) |
| Star Fox | Game | 2026-06-25 | critic, user | [Metacritic](https://www.metacritic.com/search/Star%20Fox/) |
| DK Challenge | Game | 2026-06-09 | critic, user | [Metacritic](https://www.metacritic.com/search/DK%20Challenge/) |
| Xenoblade Chronicles: Definitive Edition - Nintendo Switch 2 Edition | Switch 2 Edition | 2026-06-09 | critic, user | [Metacritic](https://www.metacritic.com/search/Xenoblade%20Chronicles%3A%20Definitive%20Edition%20-%20Nintendo%20Switch%202%20Edition/) |
| A-Train 9 Evolution | Game | 2026-06-04 | critic, user | [Metacritic](https://www.metacritic.com/search/A-Train%209%20Evolution/) |
| eFootball Kick-Off! | Game | 2026-06-03 | critic, user | [Metacritic](https://www.metacritic.com/search/eFootball%20Kick-Off!/) |
| Yoshi and the Mysterious Book | Game | 2026-05-21 | critic, user | [Metacritic](https://www.metacritic.com/search/Yoshi%20and%20the%20Mysterious%20Book/) |
| Card&Casino | Game | 2026-04-23 | critic, user | [Metacritic](https://www.metacritic.com/search/Card%26Casino/) |
| Tomodachi Life: Living the Dream | Game | 2026-04-16 | critic, user | [Metacritic](https://www.metacritic.com/search/Tomodachi%20Life%3A%20Living%20the%20Dream/) |
| Pokémon Champions | Game | 2026-04-08 | critic, user | [Metacritic](https://www.metacritic.com/search/Pok%C3%A9mon%20Champions/) |
| Super Mario Bros. Wonder: Nintendo Switch 2 Edition + Meetup in Bellabel Park | Switch 2 Edition | 2026-03-26 | critic, user | [Metacritic](https://www.metacritic.com/search/Super%20Mario%20Bros.%20Wonder%3A%20Nintendo%20Switch%202%20Edition%20%2B%20Meetup%20in%20Bellabel%20Park/) |
| Pokémon Pokopia | Game | 2026-03-05 | critic, user | [Metacritic](https://www.metacritic.com/search/Pok%C3%A9mon%20Pokopia/) |
| Mario Tennis Fever | Game | 2026-02-12 | critic, user | [Metacritic](https://www.metacritic.com/search/Mario%20Tennis%20Fever/) |
| Tokyo Scramble | Game | 2026-02-11 | critic, user | [Metacritic](https://www.metacritic.com/search/Tokyo%20Scramble/) |
| Pool Room Billiard | Game | 2026-01-22 | critic, user | [Metacritic](https://www.metacritic.com/search/Pool%20Room%20Billiard/) |
| Animal Crossing: New Horizons - Nintendo Switch 2 Edition | Switch 2 Edition | 2026-01-15 | critic, user | [Metacritic](https://www.metacritic.com/search/Animal%20Crossing%3A%20New%20Horizons%20-%20Nintendo%20Switch%202%20Edition/) |
| Riichi Mahjong | Game | 2025-12-25 | critic, user | [Metacritic](https://www.metacritic.com/search/Riichi%20Mahjong/) |
| Pokémon Legends: Z-A - Mega Dimension | DLC | 2025-12-10 | critic, user | [Metacritic](https://www.metacritic.com/search/Pok%C3%A9mon%20Legends%3A%20Z-A%20-%20Mega%20Dimension/) |
| Metroid Prime 4: Beyond | Game | 2025-12-04 | critic, user | [Metacritic](https://www.metacritic.com/search/Metroid%20Prime%204%3A%20Beyond/) |
| Kirby Air Riders | Game | 2025-11-20 | critic, user | [Metacritic](https://www.metacritic.com/search/Kirby%20Air%20Riders/) |
| Hyrule Warriors: Age of Imprisonment | Game | 2025-11-06 | critic, user | [Metacritic](https://www.metacritic.com/search/Hyrule%20Warriors%3A%20Age%20of%20Imprisonment/) |
| Pokémon Legends: Z-A | Game | 2025-10-16 | critic, user | [Metacritic](https://www.metacritic.com/search/Pok%C3%A9mon%20Legends%3A%20Z-A/) |
| Super Mario Galaxy | Game | 2025-10-02 | critic, user | [Metacritic](https://www.metacritic.com/search/Super%20Mario%20Galaxy/) |
| Super Mario Galaxy 2 | Game | 2025-10-02 | critic, user | [Metacritic](https://www.metacritic.com/search/Super%20Mario%20Galaxy%202/) |
| The Touryst: Deluxe | Game | 2025-09-25 | critic, user | [Metacritic](https://www.metacritic.com/search/The%20Touryst%3A%20Deluxe/) |
| Donkey Kong Bananza: DK Island & Emerald Rush | DLC | 2025-09-12 | critic, user | [Metacritic](https://www.metacritic.com/search/Donkey%20Kong%20Bananza%3A%20DK%20Island%20%26%20Emerald%20Rush/) |
| Kirby and the Forgotten Land: Nintendo Switch 2 Edition + Star-Crossed World | Switch 2 Edition | 2025-08-28 | critic, user | [Metacritic](https://www.metacritic.com/search/Kirby%20and%20the%20Forgotten%20Land%3A%20Nintendo%20Switch%202%20Edition%20%2B%20Star-Crossed%20World/) |
| Drag x Drive | Game | 2025-08-14 | critic, user | [Metacritic](https://www.metacritic.com/search/Drag%20x%20Drive/) |
| Chillin' by the Fire | Game | 2025-07-31 | critic, user | [Metacritic](https://www.metacritic.com/search/Chillin'%20by%20the%20Fire/) |
| Super Mario Party Jamboree: Nintendo Switch 2 Edition + Jamboree TV | Switch 2 Edition | 2025-07-24 | critic, user | [Metacritic](https://www.metacritic.com/search/Super%20Mario%20Party%20Jamboree%3A%20Nintendo%20Switch%202%20Edition%20%2B%20Jamboree%20TV/) |
| Pokémon Friends | Game | 2025-07-22 | critic, user | [Metacritic](https://www.metacritic.com/search/Pok%C3%A9mon%20Friends/) |
| Donkey Kong Bananza | Game | 2025-07-17 | critic, user | [Metacritic](https://www.metacritic.com/search/Donkey%20Kong%20Bananza/) |
| Fast Fusion | Game | 2025-06-05 | critic, user | [Metacritic](https://www.metacritic.com/search/Fast%20Fusion/) |
| Mario Kart World | Game | 2025-06-05 | critic, user | [Metacritic](https://www.metacritic.com/search/Mario%20Kart%20World/) |
| Nintendo Switch 2 Welcome Tour | Game | 2025-06-05 | critic, user | [Metacritic](https://www.metacritic.com/search/Nintendo%20Switch%202%20Welcome%20Tour/) |
| Puyo Puyo Tetris 2S | Game | 2025-06-05 | critic, user | [Metacritic](https://www.metacritic.com/search/Puyo%20Puyo%20Tetris%202S/) |
| Shine Post: Be Your Idol! | Game | 2025-06-05 | critic, user | [Metacritic](https://www.metacritic.com/search/Shine%20Post%3A%20Be%20Your%20Idol!/) |
| Survival Kids | Game | 2025-06-05 | critic, user | [Metacritic](https://www.metacritic.com/search/Survival%20Kids/) |
| The Legend of Zelda: Breath of the Wild - Nintendo Switch 2 Edition | Switch 2 Edition | 2025-06-05 | critic, user | [Metacritic](https://www.metacritic.com/search/The%20Legend%20of%20Zelda%3A%20Breath%20of%20the%20Wild%20-%20Nintendo%20Switch%202%20Edition/) |
| The Legend of Zelda: Tears of the Kingdom - Nintendo Switch 2 Edition | Switch 2 Edition | 2025-06-05 | critic, user | [Metacritic](https://www.metacritic.com/search/The%20Legend%20of%20Zelda%3A%20Tears%20of%20the%20Kingdom%20-%20Nintendo%20Switch%202%20Edition/) |

## Backloggd missing (47)

User score. Admin panel, or `games.<id>.backloggd` in `data/overrides.json`.

| Title | Type | Release | Search |
|---|---|---|---|
| Derby Stallion 2 | Game | 2026-09-24 | [Backloggd](https://backloggd.com/search/games/Derby%20Stallion%202/) |
| Fire Emblem: Fortune's Weave | Game | 2026-09-17 | [Backloggd](https://backloggd.com/search/games/Fire%20Emblem%3A%20Fortune's%20Weave/) |
| Orbitals | Game | 2026-09-03 | [Backloggd](https://backloggd.com/search/games/Orbitals/) |
| Pokémon Pokopia: Bubbly Basin | DLC | 2026-08-05 | [Backloggd](https://backloggd.com/search/games/Pok%C3%A9mon%20Pokopia%3A%20Bubbly%20Basin/) |
| Xenoblade Chronicles 2: Nintendo Switch 2 Edition | Switch 2 Edition | 2026-07-30 | [Backloggd](https://backloggd.com/search/games/Xenoblade%20Chronicles%202%3A%20Nintendo%20Switch%202%20Edition/) |
| Splatoon Raiders | Game | 2026-07-23 | [Backloggd](https://backloggd.com/search/games/Splatoon%20Raiders/) |
| Fitness Boxing 3: Your Personal Trainer - Nintendo Switch 2 Edition | Switch 2 Edition | 2026-07-16 | [Backloggd](https://backloggd.com/search/games/Fitness%20Boxing%203%3A%20Your%20Personal%20Trainer%20-%20Nintendo%20Switch%202%20Edition/) |
| Rhythm Heaven Groove | Game | 2026-07-02 | [Backloggd](https://backloggd.com/search/games/Rhythm%20Heaven%20Groove/) |
| Star Fox | Game | 2026-06-25 | [Backloggd](https://backloggd.com/search/games/Star%20Fox/) |
| DK Challenge | Game | 2026-06-09 | [Backloggd](https://backloggd.com/search/games/DK%20Challenge/) |
| Xenoblade Chronicles: Definitive Edition - Nintendo Switch 2 Edition | Switch 2 Edition | 2026-06-09 | [Backloggd](https://backloggd.com/search/games/Xenoblade%20Chronicles%3A%20Definitive%20Edition%20-%20Nintendo%20Switch%202%20Edition/) |
| A-Train 9 Evolution | Game | 2026-06-04 | [Backloggd](https://backloggd.com/search/games/A-Train%209%20Evolution/) |
| eFootball Kick-Off! | Game | 2026-06-03 | [Backloggd](https://backloggd.com/search/games/eFootball%20Kick-Off!/) |
| Yoshi and the Mysterious Book | Game | 2026-05-21 | [Backloggd](https://backloggd.com/search/games/Yoshi%20and%20the%20Mysterious%20Book/) |
| Card&Casino | Game | 2026-04-23 | [Backloggd](https://backloggd.com/search/games/Card%26Casino/) |
| Tomodachi Life: Living the Dream | Game | 2026-04-16 | [Backloggd](https://backloggd.com/search/games/Tomodachi%20Life%3A%20Living%20the%20Dream/) |
| Pokémon Champions | Game | 2026-04-08 | [Backloggd](https://backloggd.com/search/games/Pok%C3%A9mon%20Champions/) |
| Super Mario Bros. Wonder: Nintendo Switch 2 Edition + Meetup in Bellabel Park | Switch 2 Edition | 2026-03-26 | [Backloggd](https://backloggd.com/search/games/Super%20Mario%20Bros.%20Wonder%3A%20Nintendo%20Switch%202%20Edition%20%2B%20Meetup%20in%20Bellabel%20Park/) |
| Pokémon Pokopia | Game | 2026-03-05 | [Backloggd](https://backloggd.com/search/games/Pok%C3%A9mon%20Pokopia/) |
| Mario Tennis Fever | Game | 2026-02-12 | [Backloggd](https://backloggd.com/search/games/Mario%20Tennis%20Fever/) |
| Tokyo Scramble | Game | 2026-02-11 | [Backloggd](https://backloggd.com/search/games/Tokyo%20Scramble/) |
| Pool Room Billiard | Game | 2026-01-22 | [Backloggd](https://backloggd.com/search/games/Pool%20Room%20Billiard/) |
| Animal Crossing: New Horizons - Nintendo Switch 2 Edition | Switch 2 Edition | 2026-01-15 | [Backloggd](https://backloggd.com/search/games/Animal%20Crossing%3A%20New%20Horizons%20-%20Nintendo%20Switch%202%20Edition/) |
| Riichi Mahjong | Game | 2025-12-25 | [Backloggd](https://backloggd.com/search/games/Riichi%20Mahjong/) |
| Pokémon Legends: Z-A - Mega Dimension | DLC | 2025-12-10 | [Backloggd](https://backloggd.com/search/games/Pok%C3%A9mon%20Legends%3A%20Z-A%20-%20Mega%20Dimension/) |
| Metroid Prime 4: Beyond | Game | 2025-12-04 | [Backloggd](https://backloggd.com/search/games/Metroid%20Prime%204%3A%20Beyond/) |
| Kirby Air Riders | Game | 2025-11-20 | [Backloggd](https://backloggd.com/search/games/Kirby%20Air%20Riders/) |
| Hyrule Warriors: Age of Imprisonment | Game | 2025-11-06 | [Backloggd](https://backloggd.com/search/games/Hyrule%20Warriors%3A%20Age%20of%20Imprisonment/) |
| Pokémon Legends: Z-A | Game | 2025-10-16 | [Backloggd](https://backloggd.com/search/games/Pok%C3%A9mon%20Legends%3A%20Z-A/) |
| Super Mario Galaxy | Game | 2025-10-02 | [Backloggd](https://backloggd.com/search/games/Super%20Mario%20Galaxy/) |
| Super Mario Galaxy 2 | Game | 2025-10-02 | [Backloggd](https://backloggd.com/search/games/Super%20Mario%20Galaxy%202/) |
| The Touryst: Deluxe | Game | 2025-09-25 | [Backloggd](https://backloggd.com/search/games/The%20Touryst%3A%20Deluxe/) |
| Donkey Kong Bananza: DK Island & Emerald Rush | DLC | 2025-09-12 | [Backloggd](https://backloggd.com/search/games/Donkey%20Kong%20Bananza%3A%20DK%20Island%20%26%20Emerald%20Rush/) |
| Kirby and the Forgotten Land: Nintendo Switch 2 Edition + Star-Crossed World | Switch 2 Edition | 2025-08-28 | [Backloggd](https://backloggd.com/search/games/Kirby%20and%20the%20Forgotten%20Land%3A%20Nintendo%20Switch%202%20Edition%20%2B%20Star-Crossed%20World/) |
| Drag x Drive | Game | 2025-08-14 | [Backloggd](https://backloggd.com/search/games/Drag%20x%20Drive/) |
| Chillin' by the Fire | Game | 2025-07-31 | [Backloggd](https://backloggd.com/search/games/Chillin'%20by%20the%20Fire/) |
| Super Mario Party Jamboree: Nintendo Switch 2 Edition + Jamboree TV | Switch 2 Edition | 2025-07-24 | [Backloggd](https://backloggd.com/search/games/Super%20Mario%20Party%20Jamboree%3A%20Nintendo%20Switch%202%20Edition%20%2B%20Jamboree%20TV/) |
| Pokémon Friends | Game | 2025-07-22 | [Backloggd](https://backloggd.com/search/games/Pok%C3%A9mon%20Friends/) |
| Donkey Kong Bananza | Game | 2025-07-17 | [Backloggd](https://backloggd.com/search/games/Donkey%20Kong%20Bananza/) |
| Fast Fusion | Game | 2025-06-05 | [Backloggd](https://backloggd.com/search/games/Fast%20Fusion/) |
| Mario Kart World | Game | 2025-06-05 | [Backloggd](https://backloggd.com/search/games/Mario%20Kart%20World/) |
| Nintendo Switch 2 Welcome Tour | Game | 2025-06-05 | [Backloggd](https://backloggd.com/search/games/Nintendo%20Switch%202%20Welcome%20Tour/) |
| Puyo Puyo Tetris 2S | Game | 2025-06-05 | [Backloggd](https://backloggd.com/search/games/Puyo%20Puyo%20Tetris%202S/) |
| Shine Post: Be Your Idol! | Game | 2025-06-05 | [Backloggd](https://backloggd.com/search/games/Shine%20Post%3A%20Be%20Your%20Idol!/) |
| Survival Kids | Game | 2025-06-05 | [Backloggd](https://backloggd.com/search/games/Survival%20Kids/) |
| The Legend of Zelda: Breath of the Wild - Nintendo Switch 2 Edition | Switch 2 Edition | 2025-06-05 | [Backloggd](https://backloggd.com/search/games/The%20Legend%20of%20Zelda%3A%20Breath%20of%20the%20Wild%20-%20Nintendo%20Switch%202%20Edition/) |
| The Legend of Zelda: Tears of the Kingdom - Nintendo Switch 2 Edition | Switch 2 Edition | 2025-06-05 | [Backloggd](https://backloggd.com/search/games/The%20Legend%20of%20Zelda%3A%20Tears%20of%20the%20Kingdom%20-%20Nintendo%20Switch%202%20Edition/) |

## Developer missing or "Nintendo" (14)

For first-party games the developer decides the studio on the Studios page ("Nintendo" is a hidden studio, so its games go to no studio). Upcoming and TBA games are included. Fix it from the admin panel ("Developer" field): see the note below the table.

| Title | Type | Release | First party | Developer now | Id |
|---|---|---|---|---|---|
| Beyond the Dark Nightwatch | Game | TBA | no | — | `igdb:403828` |
| Putty World | Game | TBA | no | — | `manual:putty-world` |
| Hyrule Warriors: Age of Calamity - Definitive Edition | Game | 2027-02-25 | yes | — | `igdb:417167` |
| Pikmin 4: Nintendo Switch 2 Edition + Dandori Academy | Switch 2 Edition | 2026-11-12 | yes | — | `igdb:417169` |
| The Legend of Zelda: Ocarina of Time | Game | 2026-11-05 | yes | Nintendo | `igdb:405460` |
| Nintendo Switch Sports Resort | Game | 2026-10-22 | yes | — | `igdb:405451` |
| Derby Stallion 2 | Game | 2026-09-24 | no | — | `igdb:405468` |
| DK Challenge | Game | 2026-06-09 | yes | Nintendo | `igdb:405439` |
| Card&Casino | Game | 2026-04-23 | no | — | `igdb:399617` |
| Pool Room Billiard | Game | 2026-01-22 | no | — | `igdb:386785` |
| Riichi Mahjong | Game | 2025-12-25 | no | — | `igdb:403729` |
| The Touryst: Deluxe | Game | 2025-09-25 | no | — | `igdb:368773` |
| Chillin' by the Fire | Game | 2025-07-31 | no | — | `igdb:358531` |
| Survival Kids | Game | 2025-06-05 | no | — | `igdb:338087` |

**Note — how to fix it.** Open the game in the admin panel and fill "Developer" (saved as `developer` in `games.<id>` of `data/overrides.json`, it replaces the IGDB one). For the 5 first-party games above (DK Challenge, Nintendo Switch Sports Resort, The Legend of Zelda: Ocarina of Time, Pikmin 4: Nintendo Switch 2 Edition + Dandori Academy, Hyrule Warriors: Age of Calamity - Definitive Edition) use the studio name as on the Studios page, so they join that studio; until then they stay out of it. The third-party ones only affect the developer line on the card.
