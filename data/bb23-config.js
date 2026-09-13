/*
 * BIG BROTHER 23 — SEASON CONFIGURATION
 * V7: official BB23 competition database + custom social setup.
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

  ratingKeys: ["general","physical","mental","social","strategic"],
  relationshipKeys: ["friendship","trust","loyalty","rivalry","respect","attraction"],

  firstFourWeeks: { teamsActive:true, teamSafety:true, wildcardActive:true },
  teamWeeks: 4,
  highRollerStartWeek: 6,
  highRollerEndWeek: 8,
  juryThresholdPlacement: 11,

  /* Official BB23 competition names and concise descriptions of the formats used on the show. */
  competitionSchedule: [
    {week:1,type:"hoh",name:"House of Cards",category:"physical",primaryCategory:"physical",description:"The four teams built a triangular house of cards on a balancing platform. Team members stabilized the platform while the captain assembled the cards; the first captain to buzz in with a standing structure won HOH."},
    {week:1,type:"wildcard",name:"Do Not Disturb",category:"social",description:"A Wildcard challenge built around choosing and protecting teammates. The winner earned the chance to accept a special immunity offer with a consequence attached."},
    {week:1,type:"pov",name:"Massive Cocktails",category:"physical",description:"Players built a ramp and rolled a cherry down it into the scoring area. The goal was to control the ramp and get the cherry to the target."},
    {week:2,type:"hoh",name:"Pool Sharks",category:"physical",description:"Players selected numbered shooting positions and tried to send a pool ball into a shark's mouth. Higher numbers were harder, and the highest successful shot won HOH."},
    {week:2,type:"wildcard",name:"BB Flying Colors",category:"mental",description:"The Wildcard players competed for a power that could change their team assignment. The winner had to decide whether the benefit was worth the strategic consequence."},
    {week:2,type:"pov",name:"Fun Tan Lotion",category:"physical",description:"Players raced through a beach-themed course, maneuvering pieces and completing the puzzle elements as quickly as possible to win the Power of Veto."},
    {week:3,type:"hoh",name:"Tom Talks BB",category:"mental",description:"A memory and trivia competition based on statements and moments from Big Brother history. Players answered questions and advanced by keeping their answers correct."},
    {week:3,type:"wildcard",name:"Unlucky 13",category:"mental",description:"Players navigated a numbered Wildcard challenge in which unlucky choices could end a run. The winner earned the season's Wildcard reward and its associated decision."},
    {week:3,type:"pov",name:"Room Key Rumble",category:"physical",description:"Players raced to collect and organize room keys in a hotel-themed setup. Speed and accuracy determined the Power of Veto winner."},
    {week:4,type:"hoh",name:"Pier Pressure",category:"physical",description:"Players balanced and maneuvered pieces on a narrow seaside-themed setup. Maintaining control while completing the objective was the key to winning HOH."},
    {week:4,type:"wildcard",name:"Olive Shook-Up",category:"physical",description:"A food-themed Wildcard challenge requiring players to manipulate and balance objects while trying to finish the course before the competition ended."},
    {week:4,type:"pov",name:"Bump, Set, Veto",category:"physical",description:"Players used a volleyball-themed setup to move and land objects into the correct scoring positions. The fastest successful performance won the Veto."},
    {week:5,type:"hoh",name:"Whale of a Time",category:"physical",description:"Players navigated a whale-themed balance and endurance setup while trying to complete the objective faster than their opponents."},
    {week:5,type:"pov",name:"Kingdom of Curl-A-Lot",category:"physical",description:"Players curled game pieces toward targets in a curling-inspired challenge. Accuracy and distance determined the Veto winner."},
    {week:6,type:"hoh",name:"Name That Croon",category:"mental",description:"A music-memory competition in which players identified songs and performers from clues and snippets. Correct answers advanced players toward the HOH win."},
    {week:6,type:"high-roller",name:"Veto Derby",category:"strategic",description:"The first High Roller's Room game let players spend BB Bucks for a chance to compete for an additional Power of Veto."},
    {week:6,type:"pov",name:"OTEV the Jacked Jellyfish",category:"mental",description:"A classic OTEV-style elimination game. Players searched for the correct answer and returned to the jellyfish before another player was eliminated each round."},
    {week:7,type:"hoh",name:"Dash to Dinner",category:"physical",description:"Players raced through a dinner-themed course, collecting and transporting items while trying to complete the objective first."},
    {week:7,type:"high-roller",name:"Chopping Block Roulette",category:"strategic",description:"Players used BB Bucks to enter a roulette-style High Roller's Room game where the winner gained a powerful advantage involving the block."},
    {week:7,type:"pov",name:"Domino Effect",category:"physical",description:"Players set up and triggered a long domino sequence, then completed the final objective before their opponents. The quickest successful run won Veto."},
    {week:8,type:"hoh",name:"BB NFT's",category:"mental",description:"A memory and matching competition built around the season's BB-themed NFT artwork. Players had to remember and identify the correct combinations under pressure."},
    {week:8,type:"high-roller",name:"Coin of Destiny",category:"strategic",description:"Players spent BB Bucks for a chance to win the Coin of Destiny, a secret power that could overthrow the sitting HOH through a coin toss."},
    {week:8,type:"high-roller-hoh",name:"Coin of Destiny (Toss)",category:"strategic",description:"The Coin of Destiny holder called a coin toss for control of the week. Winning the toss dethroned the sitting HOH and transferred HOH power."},
    {week:8,type:"pov",name:"BB High School Hijinks",category:"mental",description:"Players arranged a series of photos in the correct chronological order using clues hidden within the images. The fastest correct time won Veto."},
    {week:9,type:"hoh",name:"The Flying BB-inos",category:"physical",description:"A balance and dexterity competition in which players maneuvered BB-themed pieces through an airborne obstacle setup while trying to finish first."},
    {week:9,type:"pov",name:"Micro-Cocktails",category:"physical",description:"A miniature version of the cocktail-building style challenge requiring careful control, precision and speed to complete the setup."},
    {week:9,type:"hoh-de",name:"Crash, Boom, Pow",category:"physical",description:"A fast-paced Double Eviction HOH in which players knocked down and rebuilt targets in a timed setup. The quickest successful run became HOH."},
    {week:9,type:"pov-de",name:"Logo, Let's Go",category:"mental",description:"Players raced to identify and arrange Big Brother logos correctly. Speed and accuracy determined the Double Eviction Veto winner."},
    {week:10,type:"hoh",name:"The Cluckster",category:"physical",description:"A chicken-themed physical challenge requiring players to maneuver through the setup and complete the objective faster than their opponents."},
    {week:10,type:"pov",name:"BB Comics",category:"physical",description:"Players raced through the comic-book challenge, collecting and placing comic images in the correct arrangement. The fastest correct performance won Veto."},
    {week:10,type:"hoh-de",name:"BB Ballers",category:"physical",description:"A basketball-themed Double Eviction HOH challenge combining shooting and timed movement. The best score became the new HOH."},
    {week:10,type:"pov-de",name:"What The Bleep?",category:"mental",description:"Players watched or heard censored Big Brother moments and identified the missing words or phrases. Correct answers earned points toward the Veto win."},
    {week:11,type:"hoh",name:"BB: Crime Lab",category:"mental",description:"Players investigated a Big Brother crime scene by matching clues, evidence and suspects. The player who solved the case first won HOH."},
    {week:11,type:"pov",name:"BB Winning Days",category:"mental",description:"Players answered questions about the timing of past Big Brother events and placed them on the correct day. The best score won the final regular-season Veto."},
    {week:12,type:"final-hoh-1",name:"Bouncy Boat Bash",category:"physical",description:"The endurance opening of the Final HOH. The final three remained on a moving, bouncing boat while enduring increasingly difficult conditions; the last player standing advanced to Part 3."},
    {week:12,type:"final-hoh-2",name:"Four of a Kind",category:"mental",description:"The Final HOH Part 2 tested memory and knowledge of the season. Players answered questions and accumulated progress toward the Part 2 win."},
    {week:12,type:"final-hoh-3",name:"Houseguest Headliners",category:"mental",description:"The final two-player Final HOH round tested memory of the evicted houseguests and events of the season. The winner became the final HOH and chose the Final 2."}
  ],

  highRollerGames: [
    { week:6, type:"bonusVeto", name:"Veto Derby", cost:50, description:"Spend BB Bucks for a chance to win an additional Veto." },
    { week:7, type:"selfRemoval", name:"Chopping Block Roulette", cost:100, description:"Spend BB Bucks for a chance at a power that can protect a player from the block." },
    { week:8, type:"voteFlip", name:"Coin of Destiny", cost:250, description:"Spend BB Bucks for a chance to gain a secret power capable of challenging HOH control." }
  ],

  notes: [
    "Four-team opening format",
    "Teams are Jokers, Aces, Kings, and Queens",
    "Team twist and Wildcard Competition operate during weeks 1-4",
    "High Roller's Room operates during weeks 6-8",
    "Double Evictions occur in weeks 9 and 10",
    "Final 3 uses the three-part Final HOH format",
    "Custom relationships and alliances can be entered before simulation"
  ]
});
