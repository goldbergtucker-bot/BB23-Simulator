/*
 * BIG BROTHER 23 — SEASON CONFIGURATION
 * Stage 1: data only. No simulation logic belongs here.
 */

window.BB23_CONFIG = Object.freeze({
  seasonId: "bb23-custom",
  seasonNumber: 23,
  originalYear: 2021,
  defaultCastSize: 16,

  teams: [
    { id: "jokers", name: "Jokers", colorClass: "jokers" },
    { id: "aces", name: "Aces", colorClass: "aces" },
    { id: "kings", name: "Kings", colorClass: "kings" },
    { id: "queens", name: "Queens", colorClass: "queens" }
  ],

  ratingKeys: [
    "general",
    "physical",
    "mental",
    "social",
    "strategic"
  ],

  relationshipKeys: [
    "friendship",
    "trust",
    "loyalty",
    "rivalry",
    "respect",
    "attraction"
  ],

  firstFourWeeks: {
    teamsActive: true,
    teamSafety: true,
    wildcardActive: true
  },

  normalWeekEvents: [
    "hoh",
    "nominations",
    "pov-players",
    "pov",
    "veto-ceremony",
    "eviction-voting",
    "eviction"
  ],

  notes: [
    "Four-team opening format",
    "Teams are Jokers, Aces, Kings, and Queens",
    "Team twist operates during the first four weeks",
    "Wildcard competition operates during the first four weeks",
    "High Roller's Room is a later-stage feature",
    "Finale and jury logic are later-stage features"
  ]
});
