export const AIRLINE_CACHE_KEYS = {
  ALL: 'airlines:all',
  BY_IATA: (iata: string) => `airlines:iata:${iata}`,
  BY_ICAO: (icao: string) => `airlines:icao:${icao}`,
  POPULAR: 'airlines:popular',
} as const;