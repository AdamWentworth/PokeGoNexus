const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SOURCE = path.join(__dirname, 'data', 'shiny-ownership-2026-07-26.csv');

const NAME_ALIASES = new Map([
  ['original ash pichu', { pokemonId: 172, costume: 'ash' }],
  ['candela s kanto ponyta', { pokemonId: 77, costume: 'candela' }],
  ['pikachu libre', { pokemonId: 25, costume: 'libre' }],
  ['green flower shirt pikachu', { pokemonId: 25, costume: 'green_shirt' }],
  ['blue flower shirt pikachu', { pokemonId: 25, costume: 'blue_shirt' }],
  ['nightcap snorlax', { pokemonId: 143, costume: 'nightcap' }],
  ['okinawa balloon pikachu', { pokemonId: 25, costume: 'flying_okinawa' }],
  ['cherry blossom hat pichu', { pokemonId: 172, costume: 'cherry_blossom' }],
  ['purple flower shirt pikachu', { pokemonId: 25, costume: 'purple_shirt' }],
  ['okinawa air pikachu', { pokemonId: 25, costume: 'kariyushi' }],
  ['witch pichu', { pokemonId: 172, costume: 'witch' }],
  ['orange balloon pikachu', { pokemonId: 25, costume: 'flying_orange' }],
  ['green balloon pikachu', { pokemonId: 25, costume: 'flying_green' }],
  ['indonesia batik shirt pikachu', { pokemonId: 25, costume: 'batik_shirt' }],
  ['summer pichu', { pokemonId: 172, costume: 'summer' }],
  ['indonesia balloon pikachu', { pokemonId: 25, costume: 'flying_red' }],
  ['explorer eevee', { pokemonId: 133, costume: 'explorer' }],
  ['purple balloon pikachu', { pokemonId: 25, costume: 'flying_purple' }],
  ['cempasuchitl crown cubone', { pokemonId: 104, costume: 'Cempasúchil' }],
  ['kurta pikachu', { pokemonId: 25, costume: 'kurta' }],
  ['saree pikachu', { pokemonId: 25, costume: 'saree' }],
  ['music hat galarian zigzagoon', { pokemonId: 2042, costume: 'meloetta' }],
  ['party wobbuffet', { pokemonId: 202, costume: 'party' }],
  ['santa pichu', { pokemonId: 172, costume: 'santa_hat' }],
  ['halloween costume gengar', { pokemonId: 94, costume: 'halloween' }],
  ['music hat galarian ponyta', { pokemonId: 2030, costume: 'meloetta' }],
  ['spooky hat gengar', { pokemonId: 94, costume: 'halloween_2023' }],
  ['luca s hat piplup', { pokemonId: 393, costume: 'lucas' }],
  ['luca s hat chimchar', { pokemonId: 390, costume: 'lucas' }],
  ['luca s hat turtwig', { pokemonId: 387, costume: 'lucas' }],
  ['lucas hat piplup', { pokemonId: 393, costume: 'lucas' }],
  ['blanche s lapras', { pokemonId: 131, costume: 'blanche' }],
  ['lucas hat chimchar', { pokemonId: 390, costume: 'lucas' }],
  ['indonesia jersey pikachu', { pokemonId: 25, costume: 'indonesia_football_jersey' }],
  ['party raticate', { pokemonId: 20, costume: 'party' }],
  ['yokohama 2023 championship pikachu', { pokemonId: 25, costume: 'worlds_2023' }],
  ['halloween squirtle', { pokemonId: 7, costume: 'fall' }],
  ['halloween bulbasaur', { pokemonId: 1, costume: 'fall' }],
  ['halloween charmander', { pokemonId: 4, costume: 'fall' }],
  ['holiday glaceon', { pokemonId: 471, costume: 'holiday' }],
  ['detective pikachu', { pokemonId: 25, costume: 'detective' }],
  ['popstar pikachu', { pokemonId: 25, costume: 'pop' }],
  ['flower hat pikachu', { pokemonId: 25, costume: 'flower_crown' }],
  ['flying pikachu', { pokemonId: 25, costume: 'flying' }],
  ['pokemon day eevee', { pokemonId: 133, costume: 'party_hat' }],
  ['trading card game pikachu', { pokemonId: 25, costume: 'TCG_hat' }],
  ['cake hat pikachu', { pokemonId: 25, costume: 'cake' }],
  ['beanie johto wooper', { pokemonId: 194, costume: 'hat' }],
  ['beanie johto sneasel', { pokemonId: 215, costume: 'sunglasses' }],
  ['beanie pichu', { pokemonId: 172, costume: 'beanie' }],
  ['bowtie dragonite', { pokemonId: 149, costume: 'bow' }],
  ['pokemon day nidorino', { pokemonId: 33, costume: 'party_hat' }],
  ['shadow male nidoran', { pokemonId: 32, shadow: true }],
  ['shadow female nidoran', { pokemonId: 29, shadow: true }],
  ['pa u oricorio', { pokemonId: 2236 }],
  ['baile oricorio', { pokemonId: 741 }],
  ['pom pom oricorio', { pokemonId: 2237 }],
  ['sensu oricorio', { pokemonId: 2238 }],
  ['normal castform', { pokemonId: 351 }],
  ['rainy castform', { pokemonId: 2055 }],
  ['snowy castform', { pokemonId: 2056 }],
  ['sunny castform', { pokemonId: 2057 }],
  ['genesect no drive', { pokemonId: 649 }],
  ['genesect burn drive', { pokemonId: 2128 }],
  ['genesect chill drive', { pokemonId: 2129 }],
  ['genesect douse drive', { pokemonId: 2130 }],
  ['genesect shock drive', { pokemonId: 2131 }],
  ['kanto celebration pikachu', { pokemonId: 25, costume: 'red_hat' }],
  ['johto celebration pikachu', { pokemonId: 25, costume: 'ethan_hat' }],
  ['hoenn celebration pikachu', { pokemonId: 25, costume: 'brendan' }],
  ['sinnoh celebration pikachu', { pokemonId: 25, costume: 'lucas' }],
  ['amethyst crown pikachu', { pokemonId: 25, costume: 'amethyst' }],
  ['pokemon day pikachu', { pokemonId: 25, costume: 'red_party_hat' }],
  ['holiday pikachu', { pokemonId: 25, costume: 'holiday' }],
  ['red monocle pikachu', { pokemonId: 25, costume: 'monacle_red' }],
  ['blue monocle pikachu', { pokemonId: 25, costume: 'monacle_blue' }],
  ['yellow monocle pikachu', { pokemonId: 25, costume: 'monacle_yellow' }],
  ['rockstar pikachu', { pokemonId: 25, costume: 'rock' }],
  ['halloween pikachu', { pokemonId: 25, costume: 'halloween_hat' }],
  ['party pikachu', { pokemonId: 25, costume: 'party_hat' }],
  ['gracidea costume pikachu', { pokemonId: 25, costume: 'shaymin_flower' }],
  ['mystic cap pikachu', { pokemonId: 25, costume: 'team_mystic_hat' }],
  ['may s hat pikachu', { pokemonId: 25, costume: 'may' }],
  ['pokemon day bulbasaur', { pokemonId: 1, costume: 'party_hat' }],
  ['pokemon day squirtle', { pokemonId: 7, costume: 'party_hat' }],
  ['pokemon day charmander', { pokemonId: 4, costume: 'party_hat' }],
  ['pokemon day gengar', { pokemonId: 94, costume: 'party_hat' }],
  ['scarf lapras', { pokemonId: 131, costume: 'drip' }],
  ['holiday attire pikachu', { pokemonId: 25, costume: 'holiday_2023' }],
]);

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9?!]+/g, ' ')
    .trim();
}

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

function parsePercent(value) {
  const normalized = String(value || '').replaceAll(',', '.').replaceAll('%', '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDexNumber(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function parseDexNumbers(value) {
  const numbers = [];
  for (const part of String(value || '').split(',')) {
    const range = part.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      for (let number = start; number <= end; number += 1) numbers.push(number);
      continue;
    }
    const number = parseDexNumber(part);
    if (number != null) numbers.push(number);
  }
  return [...new Set(numbers)];
}

function readRaritySource(sourcePath = DEFAULT_SOURCE) {
  const [header, ...lines] = fs.readFileSync(sourcePath, 'utf8').trim().split(/\r?\n/);
  if (!header.startsWith('Pokedex Number,Pokemon Name,')) {
    throw new Error(`Unexpected rarity source header in ${sourcePath}`);
  }
  return lines.map((line, index) => {
    const [dex, name, players, percent] = parseCsvLine(line);
    return {
      sourceRow: index + 2,
      dex: parseDexNumber(dex),
      dexNumbers: parseDexNumbers(dex),
      dexRange: dex,
      name,
      normalizedName: normalizeName(name),
      players: Number(players || 0),
      percent: parsePercent(percent),
      zeroIsUnknown: parsePercent(percent) === 0,
    };
  });
}

function sourceHint(entry) {
  const alias = NAME_ALIASES.get(entry.normalizedName);
  if (alias) return alias;

  const unown = entry.normalizedName.match(/^unown ([a-z?!])$/);
  if (unown) {
    return { pokedexNumber: 201, form: unown[1].toUpperCase() };
  }

  const shadow = entry.normalizedName.match(/^shadow (.+)$/);
  if (shadow) {
    return {
      pokedexNumber: entry.dex,
      pokedexNumbers: entry.dexNumbers,
      shadow: true,
      speciesName: shadow[1],
    };
  }

  return { pokedexNumber: entry.dex, pokedexNumbers: entry.dexNumbers, speciesName: entry.normalizedName };
}

module.exports = {
  DEFAULT_SOURCE,
  NAME_ALIASES,
  normalizeName,
  parseCsvLine,
  parseDexNumbers,
  readRaritySource,
  sourceHint,
};
