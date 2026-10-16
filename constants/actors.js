// BetaSeries can return several hundred cast entries for a single show, most of them one-line
// or uncredited background roles - this caps how many we persist per show in shows_actors,
// keeping only the top-billed cast (the API already returns characters ordered by importance).
export const MAX_CAST_SIZE = 30;
