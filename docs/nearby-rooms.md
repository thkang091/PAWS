# Rooms: online and nearby (2026-11-07)

Tournament opens on one screen: an Online / Nearby switch, then Make a room or Join game. Swipe right for that mode's
games (nearby: the four room games, a tap makes a room for that game; online: Number Trail with friends, Number Trail
practice, the weekly tournaments, coming soon). The last mode used is remembered on the phone.

- Online room: `create_room(..., p_mode => 'online')`. The game is Number Trail, joined by code (remote invite on).
  The room screen is the same as nearby, with the game fixed, the code instead of a QR, and Distance (1, 1.5, 2.5 km)
  plus Ranked stored on the room (`set_room_options`). Start makes the online race (`number_create_online_match`, the
  room's starter rule, the room's settings), and every player moves to the Number Trail room, where each checks
  their own streets and the host picks a number they all can walk.
- Join: online is six code slots that join as soon as the sixth character is typed; nearby opens the camera with an
  "Enter a code" switch. A wrong code shakes the slots and names the problem.
- Room taps (who starts, remote invite, distance, ranked, ready, game) show at once and are undone if the server
  refuses. The room state call reads everything in one parallel round.

- Make a room: one safety promise, then a room with no game (`create_room` with a null game). It opens on the room
  screen: Host and Leave, Room info (the host's live QR, the code for everyone else, this phone's Sound effects and
  Vibration, Who starts: Host, 1st place or Last place) and Players (avatar, name, ready, wins in this room). Swipe right
  (or tap the Game row) for the games; the host picks one there.
- Join game: QR always works. A typed code works only while the host has Enable remote invite on. Rooms made for a
  game up front (Number Trail online, legacy create) keep code joins on.
- Who starts: `room_starter` picks from wins recorded in the room (`room_scores`: battle wins, Find the Mafia round
  wins, Number Trail wins). Ties go to the host. `start_battle`, `number_start` and the Mafia start all call
  `room_assert_can_start` (`not_your_turn_to_start`).
- Changing game: `set_room_game` (host, open room, nothing running). Changing drops an unprepared Number Trail race and
  asks everyone to be ready again. Null puts the room back to picking; Number Trail's lobby uses it for the host's back
  button.
- Game detail pages are gone: `/game/battle/[game]` and the nearby catalog entries open the Nearby tab.
- No background music track ships yet, so the room has no music switch. Add an audio asset to enable one.

Server: migration `20270128120000_nearby_rooms.sql` (deployed to ytitmpodghiehzlmrhte on 2026-11-07 with the rest of
the game chain, one file at a time; see the Supabase note in memory: the remote history has diverged, never
`db push --include-all`), edge function `rooms` (deployed) (state adds `startPermission`,
`remoteInvite`, `starterId`, `me.canStart`, member `score`). Tests: `supabase/tests/nearby_rooms.sql`.

Known gap: the Number Trail screens still show the start button to the host only; if the room rule says 1st or last
place, the host's tap is refused with "Someone else starts this game."
