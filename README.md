# BB23 Custom Big Brother Simulator

This version uses a single simulation engine and a structured event-history model designed for a BrantSteele-style experience.

## Current architecture
- `engine/game-state.js` owns the state shape.
- `engine/season-engine.js` simulates the season once and records immutable event snapshots plus structured event data.
- `engine/relationships.js` controls strategic/relationship decisions.
- `engine/competitions.js` controls competition results.
- `app.js` is presentation/navigation only: it reveals the recorded events and never re-simulates them.
- `index.html` and `style.css` provide the UI.

## Structured event data
Every history event can carry participant IDs, player IDs, nominee IDs, voter IDs, winner IDs, vote records, and other relevant IDs. This is the foundation for reliable portraits, voting displays, statistics, alliances, twists, and finale presentation.

## Current BrantSteele-style features
- One-time season simulation with progressive event reveal
- Previous / Reveal Next / Reveal Week / Reveal Rest controls
- Immutable event snapshots
- Centered event portraits
- Structured live eviction voting with voter and target portraits
- Dynamic houseguest status
- Season statistics
- Resimulation using the same cast
- Saved/imported custom cast data

## Next development layers
1. Complete structured event metadata for every competition/twist.
2. Expand the event UI into dedicated HOH, nominations, POV, veto ceremony, voting, eviction, and finale screens.
3. Add full alliance and relationship history displays.
4. Add competition/voting/placement analytics and season history.
5. Implement exact BB23 competition and twist schedules.
