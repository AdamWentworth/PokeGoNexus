// constants.ts

export { cpMultipliers } from '@pokemongonexus/shared-domain/combat-power';

export const generations = ["Kanto", "Johto", "Hoenn", "Sinnoh", "Unova", "Kalos", "Alola", "Galar", "Hisui", "Paldea"];

export const pokemonTypes = [
            "fire", "water", "grass", "electric", "psychic", "ice", "dragon", "dark", 
            "fairy", "normal", "fighting", "flying", "poison", "ground", "rock", 
            "bug", "ghost", "steel"
        ];

export const generationMap = {
            "kanto": 1,
            "johto": 2,
            "hoenn": 3,
            "sinnoh": 4,
            "unova": 5,
            "kalos": 6,
            "alola": 7,
            "galar": 8,
            "hisui": 9,
            "paldea": 10
        };

export const multiFormPokedexNumbers = [201, 649, 664, 665, 666, 669, 670, 671, 676, 710, 711, 741];

export const oneWaySharedFormPokemonIDs: { [key: number]: number[] } = {
    //Alolan
    2011: [19, 2011],
    2012: [20, 2012],
    2013: [26, 2013],
    2014: [27, 2014],
    2015: [28, 2015],
    2016: [37, 2016],
    2017: [38, 2017],
    2018: [50, 2018],
    2019: [51, 2019],
    2020: [52, 2020],
    2029: [52, 2029],
    2021: [53, 2021],
    2022: [74, 2022],
    2023: [75, 2023],
    2024: [76, 2024],
    2025: [88, 2025],
    2026: [89, 2026],
    2027: [103, 2027],
    2028: [105, 2028],
    //Galarian
    2030: [77, 2030],
    2031: [78, 2031],
    2032: [79, 2032],
    2033: [80, 2033],
    2034: [83, 2034],
    2035: [110, 2035],
    2036: [122, 2036],
    2037: [144, 2037],
    2038: [145, 2038],
    2039: [146, 2039],
    2040: [199, 2040],
    2041: [222, 2041],
    2042: [263, 2042],
    2043: [264, 2043],
    2044: [554, 2044],
    2103: [555, 2103],
    2104: [2102, 2104],
    2046: [562, 2046],
    2047: [618, 2047],
    //Hisuian
    2048: [58, 2048],
    2049: [59, 2049],
    2050: [100, 2050],
    2051: [101, 2051],
    2334: [157, 2334],
    2053: [211, 2053],
    2054: [215, 2054],
    2332: [503, 2332],
    2115: [628, 2115],
    2227: [713, 2227],
    2335: [724, 2335],
    2336: [483, 2336],
    2337: [484, 2337],
    //Paldean
    2303: [194, 2303],
    //Genesect
    2128: [649, 2128],
    2129: [649, 2129],
    2130: [649, 2130],
    2131: [649, 2131],
  };
  

export const sharedFormPokemonIDs = [
    [351, 2055, 2056, 2057],
]
