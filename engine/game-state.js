/*
 * BIG BROTHER SIMULATOR — INITIAL GAME STATE
 * Stage 1 only.
 *
 * This file owns the shape of the game state. Later engines will mutate
 * this object instead of creating competing sources of truth.
 */

(function () {
  function emptyRatings() {
    return {
      general: 50,
      physical: 50,
      mental: 50,
      social: 50,
      strategic: 50
    };
  }

  function emptyRelationships() {
    return {
      friendship: 50,
      trust: 50,
      loyalty: 50,
      rivalry: 0,
      respect: 50,
      attraction: 0
    };
  }

  function createHouseguest(index) {
    return {
      id: `hg-${index + 1}`,
      slot: index + 1,
      firstName: "",
      lastName: "",
      portraitUrl: "",
      teamId: null,
      ratings: emptyRatings(),
      relationships: emptyRelationships(),
      allianceIds: [],
      active: true,
      safe: false,
      nominated: false,
      juryMember: false,
      evicted: false,
      placement: null,
      stats: {
        daysPlayed: 0, hohWins: 0, povWins: 0, wildcardWins: 0,
        nominations: 0, votesAgainst: 0, evictionVotesCast: 0,
        competitionWins: 0, juryVotesReceived: 0
      }
    };
  }

  function createInitialState(config) {
    const houseguests = Array.from(
      { length: config.defaultCastSize },
      (_, index) => createHouseguest(index)
    );

    const relationships = {};
    houseguests.forEach(hg => {
      relationships[hg.id] = {};
      houseguests.forEach(other => {
        if (hg.id !== other.id) {
          relationships[hg.id][other.id] = {
            friendship: 50,
            trust: 50,
            loyalty: 50,
            rivalry: 0,
            respect: 50,
            attraction: 0
          };
        }
      });
    });

    return {
      version: 2,
      season: {
        id: config.seasonId,
        number: config.seasonNumber,
        originalYear: config.originalYear,
        name: "Big Brother 23 — Custom Cast",
        themeUrl: "",
        logoUrl: ""
      },

      phase: "setup",
      week: 0,
      day: 0,

      houseguests,
      teams: config.teams.map(team => ({
        id: team.id,
        name: team.name,
        memberIds: []
      })),

      alliances: [],
      relationships,

      currentHOH: null,
      originalHOH: null,
      secretHOH: null,
      dethronedHOH: null,
      nominees: [],
      povPlayers: [],
      vetoWinners: [],
      evictionVotes: [],
      evicted: [],
      jury: [],

      bbBucks: {},
      powers: [],

      history: [],
      currentEventIndex: -1,
      finale: null,
      statistics: {}
    };
  }

  window.GameState = {
    emptyRatings,
    emptyRelationships,
    createInitialState
  };
})();
