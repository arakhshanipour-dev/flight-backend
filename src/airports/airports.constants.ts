export const AIRPORT_CACHE_KEYS = {
  ALL: 'airports:all',
  BY_PROVINCE: (province: string) => `airports:province:${province}`,
  BY_CITY: (city: string) => `airports:city:${city}`,
  BY_IATA: (iata: string) => `airports:iata:${iata}`,
  POPULAR: 'airports:popular',
} as const;