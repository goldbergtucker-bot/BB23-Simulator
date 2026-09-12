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

  // Season pacing (assumes a 16-person cast; scales down gracefully).
  teamWeeks: 4,
  highRollerWeeks: 4,
  juryThresholdPlacement: 9,

  normalWeekEvents: [
    "hoh",
    "nominations",
    "pov-players",
    "pov",
    "veto-ceremony",
    "eviction-voting",
    "eviction"
  ],

  highRollerGames: [
    { type: "bonusVeto", name: "Veto Derby", cost: 50, description: "A shot at a second Power of Veto." },
    { type: "selfRemoval", name: "Block Buster", cost: 100, description: "The power to remove yourself from the block." },
    { type: "voteFlip", name: "Power Shift", cost: 150, description: "The power to flip the eviction vote." }
  ],

  notes: [
    "Four-team opening format",
    "Teams are Jokers, Aces, Kings, and Queens",
    "Team twist and Wildcard Competition operate during weeks 1-4",
    "Double or Nothing HOH twist runs during the premiere",
    "High Roller's Room (BB Bucks + powers) runs weeks 5-8",
    "Jury begins once 9 houseguests remain",
    "Final 3 uses a three-part competition and a Final HOH decision",
    "Finale ends in a jury vote for the winner"
  ]
});
