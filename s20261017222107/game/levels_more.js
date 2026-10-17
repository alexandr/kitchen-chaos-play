// More kitchens: Intro Apocalypse, 1-4, 1-6, Worlds 2-6 and The Peckening.
// Reconstructed from reference/frames/*.jpg (Loopy Longplays OC1 longplay), reference/LEVELS.md,
// reference/SPEC_core.md §3 and reference/RECIPES.md. Positions are ±1 tile; moving parts are
// approximations (no periods are documented, see LEVELS.md "Open questions").
//
// Legend (one char per tile, row 0 = back wall, camera looks from the bottom):
//   .  floor   ,  ice floor   ~  hazard (water/lava/road/void)   ' ' nothing (solid, outside)
//   #  counter   H  solid wall/pillar   C  chopping board   S  stove+pot   F  stove+pan   G  empty burner
//   D  deep fryer   V  oven   P  pass   R  plate return   W  sink   K  drying rack   X  bin
//   E  counter+extinguisher   L  counter+clean plate
//   crates: O onion T tomato M mushroom e beef u bun l lettuce f fish p potato d dough c cheese
//           s pepperoni r rice w tortilla k chicken
//   > < ^ v  conveyor belts   Q/q, Y/y portal pairs   1-4 chef spawns (floor)
// stars: {players: [1★, 2★, 3★]} from TrueAchievements (2P column verified against the video cards).
// movers:  { cells, path:[[dc,dr]...] (cyclic, starts at path[0]), hold, move, under }
// toggles: { cells, a, b, period, duty, phase }  (b for `duty` fraction of each period)

const ALL_SOUPS = ['onion_soup', 'tomato_soup', 'mushroom_soup'];
const ALL_BURGERS = ['burger', 'lettuce_burger', 'blt_burger'];
const FISH_CHIPS = ['fish', 'chips', 'fish_chips'];
const PIZZAS = ['pizza', 'pepperoni_pizza', 'mushroom_pizza'];
const BURRITOS = ['beef_burrito', 'chicken_burrito'];

const rect = (c0, r0, c1, r1) => {
  const out = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push([c, r]);
  return out;
};

// 5-4: single-tile rocks (burners/counters) riding one figure-8 loop round both lava platforms.
// Waypoints are absolute map cells; each rock gets the same loop, rotated to its start point.
function figure8Rocks(starts, hold, move) {
  const W = [[10, 1], [18, 1], [18, 7], [10, 7], [8, 2], [0, 2], [0, 8], [8, 8]];
  const loop = [];
  for (let i = 0; i < W.length; i++) {
    const a = W[i], b = W[(i + 1) % W.length];
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    for (let s = 0; s < n; s++) {
      loop.push([Math.round(a[0] + (b[0] - a[0]) * s / n), Math.round(a[1] + (b[1] - a[1]) * s / n)]);
    }
  }
  return starts.map(([c, r]) => {
    const k = loop.findIndex(([x, y]) => x === c && y === r);
    const path = loop.map((_, j) => {
      const p = loop[(k + j) % loop.length];
      return [p[0] - c, p[1] - r];
    });
    return { cells: [[c, r]], path, hold, move, under: '~' };
  });
}

export const MORE_LEVELS = [
  // Intro Apocalypse. Source: frames/IA_01.jpg, IA_02.jpg; LEVELS.md "Intro Apocalypse".
  // Rooftop ring of counters with a full divider (2-4P layout); boards on the left, lettuce +
  // tomato crates on the right, Ever Peckish (pass) on the right with return below, one plate.
  // Bin not seen in the frames (added). Uncertain: exact width (±1).
  {
    id: 'intro', name: 'Intro Apocalypse', world: 0, time: 100, recipes: ['salad', 'tomato_salad'],
    stars: { 1: [0, 0, 0], 2: [0, 0, 0], 3: [0, 0, 0], 4: [0, 0, 0] },
    note: 'Tutorial: finish to get 3 stars. The Ever Peckish is the pass.',
    map: [
      '#CC##lT##',
      '#1..#2..#',
      '#...#...P',
      '#3..#4..R',
      '#...#...#',
      '#X#####L#',
    ],
  },

  // 1-4. Source: SPEC_core.md §3 "1-4"; frames/1-4_01.jpg, 1-4_02.jpg. Two rooms joined by a
  // 1x3 corridor (row 3) between brick pillars wrapped in counters. Matches the video.
  {
    id: '1-4', name: '1-4', world: 1, time: 240, recipes: ALL_BURGERS,
    stars: { 1: [40, 90, 160], 2: [40, 100, 280], 3: [40, 100, 300], 4: [40, 100, 320] },
    map: [
      '##WK##H#FFFF#',
      'T....#H#....E',
      'e.1..###.2..P',
      'u...........P',
      'l....###....R',
      '#.3..#H#.4..L',
      'X....#H#....#',
      '##C#C#H#LLLL#',
    ],
  },

  // 1-6 earthquake. Source: frames/1-6_01.jpg, 1-6_02.jpg (split); SPEC_core.md §3 "1-6";
  // LEVELS.md "1-6". Left: sink, meat/tomato/lettuce crates, extinguisher, bin, 2 boards, 1 pan.
  // Right (raised): plate,pan,plate,pan,plate; pass + return; 1 pan + bun crate on the front.
  // The zig-zag crack is a toggled wall (real game: right half rises, you can drop down from it).
  {
    id: '1-6', name: '1-6', world: 1, time: 240, recipes: ALL_BURGERS,
    stars: { 1: [40, 60, 90], 2: [40, 100, 200], 3: [40, 110, 220], 4: [40, 120, 240] },
    note: 'Earthquake: the kitchen cracks in two every so often.',
    map: [
      '##WK####LFLFL#',
      'e............E',
      'T..1......2..P',
      'l............P',
      'E............R',
      '#..3......4..#',
      'X............#',
      '###C#C#F##F#u#',
    ],
    toggles: [
      { cells: [[7, 1], [7, 2], [7, 3], [8, 3], [8, 4], [8, 5], [9, 5], [9, 6]], a: '.', b: 'H', period: 25, duty: 0.4, phase: 0 },
    ],
  },

  // 2-1 moving trucks. Source: frames/2-1_01.jpg (apart), 2-1_02.jpg (aligned); LEVELS.md "2-1".
  // Upper (rear) truck: bun crate, 3 pans, 3 plates, pass + return. Lower (front) truck: meat,
  // lettuce, tomato crates, bin, 2 boards, extinguisher. Upper truck drifts away/sideways over
  // the road; trucks are walkable across only when aligned. No sink. Cycle timing is a guess.
  {
    id: '2-1', name: '2-1', world: 2, time: 240, recipes: ALL_BURGERS,
    stars: { 1: [50, 100, 180], 2: [60, 120, 240], 3: [60, 140, 260], 4: [80, 160, 300] },
    note: 'Two trucks on the highway: cross only when they line up. Falling off costs 5 s.',
    map: [
      '~~~~~~~~~~~~~~',
      '~~~HH#FFFLLL##',
      '~~~HHu.......P',
      '~~~HH#.......R',
      '~~~~~~~~~~~~~~',
      '~~~HHe.1...2.X',
      '~~~HHl.......C',
      '~~~HHT.3...4.#',
      '~~~HH#E##C####',
    ],
    movers: [
      { cells: rect(3, 1, 13, 3), path: [[0, 1], [0, 0], [-3, 0], [0, 0]], hold: 8, move: 2, under: '~' },
    ],
  },

  // 2-2. Source: frames/2-2_01.jpg, 2-2_02.jpg; LEVELS.md "2-2". Pass in a top alcove with
  // return + extinguisher, 2 sinks, bins in both upper corners, 2 pots per side wall, two
  // islands with 2 plates each, crates bottom-left (M,O) / bottom-right (O,T), 2 boards.
  // Islands slide up/down (opposite phase, guessed); rats are not modelled.
  {
    id: '2-2', name: '2-2', world: 2, time: 240, recipes: ALL_SOUPS,
    stars: { 1: [40, 90, 160], 2: [60, 120, 200], 3: [60, 120, 250], 4: [60, 160, 270] },
    note: 'The plate islands slide up and down. (Rats that steal veg are not in yet.)',
    map: [
      '#####RPPE#####',
      '##KW#....#WK##',
      'X............X',
      'S...L....L...S',
      '#.1.L....L.2.#',
      '#...#....#...#',
      'S.3.#....#.4.S',
      '#...#....#...#',
      '#MO##C##C##OT#',
    ],
    movers: [
      { cells: rect(4, 3, 4, 7), path: [[0, 0], [0, -1]], hold: 10, move: 1.5 },
      { cells: rect(9, 3, 9, 7), path: [[0, -1], [0, 0]], hold: 10, move: 1.5 },
    ],
  },

  // 2-3 conveyor loop. Source: frames/2-3_01.jpg, 2-3_02.jpg; LEVELS.md "2-3". Brick divider
  // splits chefs; clockwise perimeter belt carries items across top and bottom. Left: sink,
  // meat/lettuce/bun/tomato, 2 pans, extinguisher, bin. Right: plates, 2 boards, pass, return, bin.
  {
    id: '2-3', name: '2-3', world: 2, time: 240, recipes: ALL_BURGERS,
    stars: { 1: [40, 70, 120], 2: [60, 100, 180], 3: [60, 110, 220], 4: [60, 120, 240] },
    note: 'Split kitchen: a conveyor runs round the outside to pass things across.',
    map: [
      '>>>>>>>>>>>>>>v',
      '^K....#HL....#v',
      '^W.1..EHL..2.#v',
      '^#....FHC....Pv',
      '^e....#H#....Pv',
      '^l.3..FHC..4.Rv',
      '^u....#H#....#v',
      '^T....XHL....Xv',
      '^<<<<<<<<<<<<<<',
    ],
  },

  // 2-4 conveyors into bins. Source: frames/2-4_01.jpg, 2-4_02.jpg, 2-4_play0.jpg; LEVELS.md "2-4".
  // Top chef: 3 plates, 2 boards, pass + return. Bottom chef: 3 pans, sink, extinguisher, crates.
  // Middle belt row with bins at both ends and in the centre. Belt directions are a guess chosen
  // so each side can hand items to the other before they reach a bin.
  {
    id: '2-4', name: '2-4', world: 2, time: 240, recipes: ALL_BURGERS,
    stars: { 1: [40, 60, 110], 2: [60, 90, 160], 3: [60, 140, 200], 4: [120, 160, 220] },
    note: 'Split kitchen: the middle conveyors run into bins, so grab things in time.',
    map: [
      '##LLL#C#C######',
      '#.1.......3...P',
      '#.............R',
      '####....###...#',
      'X<<<<<<X>>>>>>X',
      '#...###....####',
      'F..2.......4..#',
      'F.............#',
      '##F#WK#E##uTle#',
    ],
  },

  // 3-1 ice floe. Source: frames/3-1_01.jpg, 3-1_02.jpg; LEVELS.md "3-1". Counter block with a
  // red (solid) interior: 2 boards, extinguisher, bin on top; sink left; fish + potato right;
  // 2 fryers bottom-left, 1 right; 3 plates on a lower strip. Pass + return on a small north floe.
  {
    id: '3-1', name: '3-1', world: 3, time: 240, recipes: FISH_CHIPS,
    stars: { 1: [50, 110, 200], 2: [80, 120, 220], 3: [100, 200, 320], 4: [100, 220, 340] },
    note: 'Slippery ice floe. Fall into the sea and you respawn after 5 s.',
    map: [
      '~~~~~HHHH~~~~~',
      '~~~~~~RP~~~~~~',
      '~~~~,,,,,,,,~~',
      '~~,,,,,,,,,,,~',
      '~,,,#C#CE#X,,~',
      '~,1,WHHHHHf,,~',
      '~,,,KHHHHHp2,~',
      ',,,,#DD##HD,,~',
      '~,3,,,,,LLL,,~',
      '~~,,4,,,,,,,,~',
      '~~~~,,,,,,,~~~',
    ],
  },

  // 3-2 ship, separated. Source: frames/3-2_01.jpg, 3-2_02.jpg; LEVELS.md "3-2". Two passes at
  // the back; crate column + middle counter + bottom counter wall off the left chef (plates,
  // boards, return, 2 pots, extinguisher) from the right chef (2 pots, right pass). No sink.
  // Approximation: the strip in front of the left pass (row 1) is floor so it can be reached.
  {
    id: '3-2', name: '3-2', world: 3, time: 240, recipes: ALL_SOUPS,
    stars: { 1: [40, 70, 100], 2: [100, 140, 160], 3: [200, 240, 280], 4: [220, 260, 300] },
    note: 'Separated chefs on deck, two serving hatches. Plates come back clean.',
    map: [
      'HHHHHPPHHHHPPHHHHH',
      '.........H........',
      '...#E##R##........',
      '....1....M..2.....',
      '.........O........',
      '...S.....T......S.',
      '...X#####X........',
      '.3.S.....#......S.',
      '.........#..4.....',
      'HLLL#C##C#........',
    ],
  },

  // 3-3 snowy trucks. Source: frames/3-3_01.jpg, 3-3_02.jpg; LEVELS.md "3-3". Left trailer: 2
  // boards, extinguisher, 3 pots, 2 plates. Right truck: onion/mushroom/tomato/fish/potato
  // crates, bin, pass + return, 2 boards, 3 fryers, 2 plates, extinguisher. The trailer drifts
  // 2 tiles away and back; the cab sits above the gap. How chefs cross in the original is unclear.
  {
    id: '3-3', name: '3-3', world: 3, time: 240, recipes: [...ALL_SOUPS, ...FISH_CHIPS],
    stars: { 1: [100, 130, 150], 2: [100, 200, 270], 3: [100, 220, 320], 4: [100, 240, 340] },
    note: 'Two trucks drive apart and together. Cross only when they meet.',
    map: [
      '~~~~~~~~HH#OMTfpX##',
      '~~~~~~~~HH#.1....2P',
      'C.......~~#.....3.R',
      '#.......~~........C',
      'C.......~~....4...C',
      '#ESLSLS#~~#DLDLDE##',
    ],
    movers: [
      { cells: rect(0, 2, 7, 5), path: [[2, 0], [0, 0]], hold: 12, move: 2, under: '~' },
    ],
  },

  // 3-4 frozen river. Source: frames/3-4_01.jpg, 3-4_03.jpg; LEVELS.md "3-4". Left bank: bin,
  // 2 fryers, fish + potato crates, extinguisher, sink. Right bank: 2 plates, 1 fryer, pass +
  // return, 2 boards. Two big floes drift downstream (they slide back up to loop - approximation).
  {
    id: '3-4', name: '3-4', world: 3, time: 240, recipes: FISH_CHIPS,
    stars: { 1: [60, 100, 170], 2: [60, 120, 180], 3: [100, 160, 220], 4: [120, 180, 240] },
    note: 'Ride the drifting ice floes across the river. Banks are slippery.',
    map: [
      '#XD#D#~~~~LLD###',
      '#.1,,,,,,,..2..#',
      'f.,,,,,,,,,,,,,P',
      '#.,,,,~~~~,,,,,P',
      'p.,,,,,,,,,,,,,R',
      'E3,,,,,,,,..4..#',
      '##WK##~~~~#C#C##',
    ],
    movers: [
      { cells: rect(6, 1, 9, 2), path: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, -1]], hold: 1.5, move: 1.5, under: '~' },
      { cells: rect(6, 4, 9, 5), path: [[0, 0], [0, 1], [0, -4], [0, -3], [0, -2], [0, -1]], hold: 1.5, move: 1.5, under: '~' },
    ],
  },

  // 4-1 pizza, moving counters. Source: frames/4-1_01.jpg vs 4-1_02.jpg (counters visibly moved);
  // LEVELS.md "4-1". Top room: extinguisher, 3 ovens, bin. Middle band between a Z of counters
  // whose gaps flip between two states (toggles), switching which chef reaches the sink or the
  // pass. Crates (dough, tomato, cheese, mushroom, pepperoni) on the bottom wall. Approximate.
  {
    id: '4-1', name: '4-1', world: 4, time: 240, recipes: PIZZAS,
    stars: { 1: [60, 80, 120], 2: [100, 140, 200], 3: [100, 220, 300], 4: [100, 240, 320] },
    note: 'Pizza! The counters shift now and then, changing who can reach what.',
    map: [
      '    #EV#V#VX#   ',
      '....#.1.....#   ',
      '.#LLL...########',
      '.W.3....#......P',
      '.K......#...4..R',
      '.##C###C#....###',
      '......2......#  ',
      'HHH..........#  ',
      '   ###dTcMs###  ',
    ],
    toggles: [
      { cells: [[5, 2], [6, 2], [7, 2]], a: '.', b: '#', period: 30, duty: 0.5, phase: 0 },
      { cells: [[8, 2], [9, 2], [10, 2], [11, 2]], a: '#', b: '.', period: 30, duty: 0.5, phase: 0 },
      { cells: [[7, 3], [7, 4]], a: '.', b: '#', period: 30, duty: 0.5, phase: 0 },
      { cells: [[8, 3], [8, 4]], a: '#', b: '.', period: 30, duty: 0.5, phase: 0 },
      { cells: [[4, 5], [5, 5], [6, 5]], a: '#', b: '.', period: 30, duty: 0.5, phase: 0 },
      { cells: [[9, 5], [10, 5], [11, 5], [12, 5]], a: '.', b: '#', period: 30, duty: 0.5, phase: 0 },
    ],
  },

  // 4-2 darkness. Source: LEVELS.md "4-2" grid (from wiki + gamma-boosted frame); frames/4-2_01.jpg,
  // 4-2_02.jpg are almost black (pots top-centre and left, pass top-right, board left visible).
  // Pass moved off the corner onto the right wall so it is reachable; extinguisher + 2nd board added.
  {
    id: '4-2', name: '4-2', world: 4, time: 240, recipes: ALL_SOUPS,
    stars: { 1: [50, 70, 100], 2: [60, 80, 110], 3: [90, 200, 260], 4: [100, 240, 300] },
    note: 'Lights out: each chef only sees a torch cone.',
    map: [
      '#WKC##S##LL#',
      'C1........2P',
      '#....#X##..R',
      'S....#T##..#',
      'O..3......4#',
      'M..........#',
      '#####E######',
    ],
  },

  // 4-3 quadrants with moving blocks. Source: frames/4-3_01.jpg (start config), 4-3_02.jpg (other
  // config); LEVELS.md "4-3". Single board, sink, extinguisher on a stub, return + pass, bin; crates
  // on the left wall; 2 pans on the right wall. The real game cycles 5 configurations: here the
  // board and both pans slide out and the centre of the cross closes/opens (approximation).
  {
    id: '4-3', name: '4-3', world: 4, time: 240, recipes: ALL_BURGERS,
    stars: { 1: [50, 70, 90], 2: [60, 80, 120], 3: [60, 140, 200], 4: [60, 180, 240] },
    note: 'Blocks move around the mansion, opening and closing the way between quarters.',
    map: [
      '###WK###RP#X#',
      'C...3.E..4..F',
      '#.....#.....#',
      '#LL.......LL#',
      'u...........#',
      'T.1.......2.#',
      'e.....#.....F',
      'l.....#.....#',
      '#############',
    ],
    movers: [
      { cells: [[0, 1]], path: [[0, 0], [4, 0]], hold: 12, move: 2, under: '#' },
      { cells: [[12, 1]], path: [[0, 0], [-3, 0]], hold: 12, move: 2, under: '#' },
      { cells: [[12, 6]], path: [[0, 0], [-3, 0]], hold: 12, move: 2, under: '#' },
    ],
    toggles: [
      { cells: [[4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [6, 4], [6, 5]], a: '.', b: '#', period: 28, duty: 0.5, phase: 0 },
    ],
  },

  // 4-4 split halves, swapped ingredients. Source: frames/4-4_01.jpg, 4-4_02.jpg; LEVELS.md "4-4".
  // Centre conveyor flows down into a bin. Left: sink, extinguisher, 2 pans, board, pass + return,
  // 2 plates, PIZZA crates. Right: board, 2 ovens, sink, BURGER crates, 2 plates, pass + return.
  // Approximation: a 1-tile gap at each wall end of the long counters joins top and bottom.
  {
    id: '4-4', name: '4-4', world: 4, time: 240, recipes: [...ALL_BURGERS, ...PIZZAS],
    stars: { 1: [50, 70, 100], 2: [60, 80, 120], 3: [70, 140, 200], 4: [80, 180, 240] },
    note: 'Each side has the other side\'s ingredients: swap them over the conveyor.',
    map: [
      '#########vC#V#V####',
      'W........v........W',
      'K..3.....v...4....K',
      '#........v#eulTLL.#',
      '#.EF##F#Cv........#',
      'R........v........R',
      'P...1....v...2....P',
      'P........v........P',
      '#LL#sMdc#X#########',
    ],
  },

  // 5-1 shuttle room. Source: frames/5-1_01.jpg, 5-1_02.jpg; LEVELS.md "5-1". Two chambers, each
  // with pan + pot, pass, return, 2 plates, board, extinguisher. The shuttle below holds the bin,
  // sink and all crates and docks under one chamber at a time (buttons in the real game; timed here).
  {
    id: '5-1', name: '5-1', world: 5, time: 240, recipes: BURRITOS,
    stars: { 1: [50, 80, 120], 2: [60, 100, 150], 3: [120, 180, 230], 4: [140, 200, 250] },
    note: 'Burritos! The supply shuttle docks under one kitchen at a time.',
    map: [
      '##RP#SF#  #FS#PRE#',
      'E1.....L  #.2....L',
      'C....3.L  #....4.L',
      '#......#  #......C',
      '##..####  ##..####',
      '##..####          ',
      'X......#          ',
      '#......#          ',
      '#WKrwke#          ',
    ],
    movers: [
      { cells: rect(0, 5, 7, 8), path: [[0, 0], [10, 0]], hold: 15, move: 3, under: ' ' },
    ],
  },

  // 5-2 lava islands. Source: frames/5-2_01.jpg, 5-2_02.jpg; LEVELS.md "5-2". TL: extinguisher,
  // pot, board. TR: bin, 2 pans, 2 plates. BL: sink, crates, a pan. BR: pass + return. Four rock
  // bridges, one sunk at a time, rotating counter-clockwise every 30 s. Fireball cannon not modelled.
  {
    id: '5-2', name: '5-2', world: 5, time: 240, recipes: BURRITOS,
    stars: { 1: [50, 80, 100], 2: [60, 90, 110], 3: [60, 90, 120], 4: [60, 100, 160] },
    note: 'Lava islands: one bridge sinks every 30 s. (Fireball cannon not in yet.)',
    map: [
      '~HES#C~~~~X#F#F#~',
      '~H.1...~~~..2..L~',
      '~..............L~',
      '~..............H~',
      '~~~..~~~~~~~..~~~',
      '~~~..~~~~~~~..~~~',
      '~#.....~~~.....#~',
      '~W..3.......4..P~',
      '~K.............R~',
      '~#ekFwr~~~.....#~',
    ],
    toggles: [
      { cells: rect(7, 2, 9, 3), a: '.', b: '~', period: 120, duty: 0.25, phase: 0 },
      { cells: rect(3, 4, 4, 5), a: '.', b: '~', period: 120, duty: 0.25, phase: 90 },
      { cells: rect(7, 7, 9, 8), a: '.', b: '~', period: 120, duty: 0.25, phase: 60 },
      { cells: rect(12, 4, 13, 5), a: '.', b: '~', period: 120, duty: 0.25, phase: 30 },
    ],
  },

  // 5-3 pressure-plate doors. Source: frames/5-3_01.jpg, 5-3_02.jpg; LEVELS.md "5-3". Top-left:
  // 3 plates, rice, pass + return; top-right: 2 boards; middle counter: extinguisher .. bin;
  // bottom: pan, pot, pan, pot; bottom-right: tortilla, chicken, beef. No sink. Doors are opened by
  // the other half's pressure plate in the real game; here they open/close on a timer.
  {
    id: '5-3', name: '5-3', world: 5, time: 240, recipes: BURRITOS,
    stars: { 1: [50, 70, 110], 2: [60, 80, 120], 3: [100, 200, 240], 4: [120, 220, 280] },
    note: 'Doors to the right-hand rooms open and close (pressure plates in the original).',
    map: [
      '#LLL#r####C#C#',
      'P.....1.H.4..#',
      'R.......H....#',
      '#E##########X#',
      '#.3.....H....#',
      '#.......H..2.#',
      '#F#S#F#S##wke#',
    ],
    toggles: [
      { cells: [[8, 1], [8, 2]], a: 'H', b: '.', period: 20, duty: 0.5, phase: 0 },
      { cells: [[8, 4], [8, 5]], a: 'H', b: '.', period: 20, duty: 0.5, phase: 10 },
    ],
  },

  // 5-4 rocks in a figure-8. Source: frames/5-4_01.jpg, 5-4_02.jpg; LEVELS.md "5-4". Left
  // platform: pass + return, board, beef + rice crates, 2 plates. Right platform: board, chicken +
  // tortilla crates, extinguisher, bin. All cooking happens on 3 burners (pot / pan / empty) riding
  // small rocks with 3 plain counters round an ∞ loop; rocks pass behind the pass (unreachable).
  {
    id: '5-4', name: '5-4', world: 5, time: 240, recipes: BURRITOS,
    stars: { 1: [60, 80, 100], 2: [70, 90, 110], 3: [80, 120, 140], 4: [60, 120, 160] },
    note: 'The stoves ride rocks round the lava in a figure of eight.',
    map: [
      '~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~S~~~~~~~~',
      '~~~~~~~#~~~.......#',
      '~.......~~~.Ck#E..~',
      'GP.LCe#.~~~.w##X..~',
      '~R.##rL.~~~.1...4.~',
      '~.2.....~~~.......~',
      '~...3...~~~~~F~~~~~',
      '~~~~~~#~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~',
    ],
    movers: figure8Rocks([[10, 1], [18, 2], [13, 7], [7, 2], [0, 4], [6, 8]], 0, 0.7),
  },

  // 5-5 sliding side chambers (5:00). Source: frames/5-5_01.jpg, 5-5_02.jpg; LEVELS.md "5-5".
  // Top room: pass + return, sink, buttons. Centre counter: 2 pots, mushroom/tomato/onion crates,
  // extinguisher; its lower side 2 boards. Bottom room: 3 plates. Side chambers (bin each) slide
  // between the top and bottom rooms (buttons in the original, timed here).
  {
    id: '5-5', name: '5-5', world: 5, time: 300, recipes: ALL_SOUPS,
    stars: { 1: [30, 50, 70], 2: [40, 60, 80], 3: [80, 140, 160], 4: [100, 160, 200] },
    note: 'Side chambers ferry chefs between the upper and lower rooms.',
    map: [
      '#X#####RPWK####X#',
      '#......1........#',
      '#........3......#',
      '######SMTOSE#####',
      '    ##C##C###    ',
      '    ...2.....    ',
      '    .....4...    ',
      '    #.......#    ',
      '    ###LLL###    ',
    ],
    movers: [
      { cells: rect(0, 0, 3, 3), path: [[0, 0], [0, 4], [0, 4], [0, 0]], hold: 10, move: 3, under: ' ' },
      { cells: rect(13, 0, 16, 3), path: [[0, 0], [0, 0], [0, 4], [0, 4]], hold: 10, move: 3, under: ' ' },
    ],
  },

  // 5-6 four rooms. Source: frames/5-6_01.jpg, 5-6_02.jpg; LEVELS.md "5-6". TL: return, pass, bin,
  // plate. TR: 2 boards, bin. BL: sink, onion crate, 2 pots, plate, extinguisher. BR: bin, tomato,
  // mushroom, plate. Left belt runs TL->BL, right belt BR->TR. Centre doors open on a timer
  // (held pressure plates in the original).
  {
    id: '5-6', name: '5-6', world: 5, time: 240, recipes: ALL_SOUPS,
    stars: { 1: [30, 40, 65], 2: [30, 50, 65], 3: [80, 120, 140], 4: [80, 120, 140] },
    note: 'Four rooms linked by conveyors and doors (pressure plates in the original).',
    map: [
      'vLRP#X#H##C#CX^',
      'v..1...H......^',
      'v......H..2...^',
      'vHHHHHHHHHHHHH^',
      'v#WKO##H#X##T#^',
      'v......H......^',
      'v..3...H...4..^',
      'v......H......^',
      '#SLS#E#HH#M#L##',
    ],
    toggles: [
      { cells: [[7, 1], [7, 2]], a: 'H', b: '.', period: 20, duty: 0.4, phase: 0 },
      { cells: [[7, 5]], a: 'H', b: '.', period: 20, duty: 0.4, phase: 10 },
    ],
  },

  // 6-1 ship, travelling board strip. Source: frames/6-1_01.jpg, 6-1_02.jpg; LEVELS.md "6-1".
  // Top: plate, return, pass, 2 burners (pots placed here; the video starts with pots on the middle
  // counter). Middle counter: extinguisher, 2 plates, tomato/onion/mushroom, bin. Bottom: 2 burners.
  // The 2-board strip slides down through the middle counter (opening a gap) while a counter on the
  // right slides into the other gap, so the crossing point swaps sides. No sink.
  {
    id: '6-1', name: '6-1', world: 6, time: 240, recipes: ALL_SOUPS,
    stars: { 1: [100, 120, 140], 2: [100, 140, 160], 3: [240, 260, 280], 4: [220, 340, 400] },
    note: 'The chopping strip travels across the deck; the way through keeps moving.',
    map: [
      '.....#LRPPS#S#....',
      '.....C..1.....#...',
      '.....C....3.......',
      'E#####LLTOM#X#.###',
      '.........2........',
      '............4.....',
      '..................',
      '......G#G#####....',
    ],
    movers: [
      { cells: [[5, 1], [5, 2], [5, 3]], path: [[0, 0], [0, 3]], hold: 12, move: 3 },
      { cells: [[14, 1]], path: [[0, 0], [0, 2]], hold: 12, move: 3 },
    ],
  },

  // 6-2 twin kitchens. Source: frames/6-2_01.jpg, 6-2_02.jpg; LEVELS.md "6-2" (2P layout; the 4P
  // layout differs and is not modelled). Left half: sink, 2 pots, extinguisher, tomato + onion,
  // board, pass + return, 2 plates, bin. Right half: bins, 2 plates, return + pass, board,
  // extinguisher, 2 pots, onion + mushroom, sink. Centre belts run into bins.
  {
    id: '6-2', name: '6-2', world: 6, time: 240, recipes: ALL_SOUPS,
    stars: { 1: [120, 160, 200], 2: [160, 200, 260], 3: [300, 340, 380], 4: [120, 145, 165] },
    note: 'Twin kitchens with different ingredients; the middle belts end in bins.',
    map: [
      '##WK###X##X##L#',
      'S..1..T^#.....L',
      'S.....O^C..2..R',
      'E......^#.....P',
      '#####.#X#.#####',
      'P.....#v......E',
      'R..3..Cv#..4..S',
      'L.....#vO.....#',
      'L......vM.....S',
      '###X###X####WK#',
    ],
  },

  // 6-3 frozen river, two floe streams. Source: frames/6-3_01.jpg, 6-3_02.jpg; LEVELS.md "6-3".
  // Left: 2 pots, middle counter with extinguisher at the river end, mushroom + onion, bin.
  // Right: 2 boards, sink, pass + return, tomato, 3 plates. Left stream floes go up, right go down
  // (each floe slides back to the far end to loop - approximation).
  {
    id: '6-3', name: '6-3', world: 6, time: 240, recipes: ALL_SOUPS,
    stars: { 1: [50, 70, 90], 2: [60, 80, 100], 3: [60, 120, 140], 4: [100, 140, 160] },
    note: 'Two streams of ice floes flow in opposite directions.',
    map: [
      '######~~,,#C#C##',
      'S.3,,,~~,,.....W',
      'S..,,,,,~~,,,,,K',
      '#####E,,~~,,4,,P',
      '#..,2,~~,,,,,,,R',
      'M.1,,,~~,,,,,,,#',
      'O..,,,,,~~,,,,,#',
      '#..,,,,,~~,,,,,T',
      '#X####~~~~#LLL##',
    ],
    movers: [
      { cells: rect(6, 6, 7, 7), path: [[0, 0], [0, -1], [0, -2], [0, -3], [0, -4], [0, -5], [0, -6], [0, 1]], hold: 0.6, move: 0.9, under: '~' },
      { cells: rect(6, 2, 7, 3), path: [[0, 0], [0, -1], [0, -2], [0, 5], [0, 4], [0, 3], [0, 2], [0, 1]], hold: 0.6, move: 0.9, under: '~' },
      { cells: rect(8, 0, 9, 1), path: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7]], hold: 0.6, move: 0.9, under: '~' },
      { cells: rect(8, 4, 9, 5), path: [[0, 0], [0, 1], [0, 2], [0, 3], [0, -4], [0, -3], [0, -2], [0, -1]], hold: 0.6, move: 0.9, under: '~' },
    ],
  },

  // 6-4 rotating ring of chambers. Source: frames/6-4_01.jpg, 6-4_02.jpg; LEVELS.md "6-4".
  // Hub: 2 pans + 2 pots on the back, island with 2 boards + plate, extinguisher, bin, sink.
  // Only the chambers lined up with the hub doors (W/E) are reachable. Pair 1 (lettuce + pass +
  // return + plates / mushroom + pass + return + plates) and pair 2 (tomato + onion / bun + beef)
  // swap places: modelled as lifts sliding the chambers in and out (buttons in the original).
  {
    id: '6-4', name: '6-4', world: 6, time: 240, recipes: ['salad', 'tomato_salad', ...ALL_SOUPS, ...ALL_BURGERS],
    stars: { 1: [120, 170, 190], 2: [140, 180, 200], 3: [180, 220, 260], 4: [200, 240, 300] },
    note: 'The outer chambers rotate: only two are docked to the kitchen at a time.',
    map: [
      '                 ',
      '   H##FSFS###H   ',
      '   H..1...2..H   ',
      'lLLH...CL....HLLM',
      '.........#C......',
      'PR#H.3.....4.H#RP',
      'T#OH.........Hu#e',
      '...H#EX#WK###H...',
      '###           ###',
    ],
    movers: [
      { cells: rect(0, 3, 2, 5), path: [[0, 0], [0, -3]], hold: 25, move: 2, under: ' ' },
      { cells: rect(0, 6, 2, 8), path: [[0, 0], [0, -3]], hold: 25, move: 2, under: ' ' },
      { cells: rect(14, 3, 16, 5), path: [[0, 0], [0, -3]], hold: 25, move: 2, under: ' ' },
      { cells: rect(14, 6, 16, 8), path: [[0, 0], [0, -3]], hold: 25, move: 2, under: ' ' },
    ],
  },

  // The Peckening. Source: frames/peck_01.jpg (phase 1), peck_04.jpg (phase 2), peck_05.jpg
  // (phase 3); LEVELS.md + RECIPES.md §6. Left rooftop: E-shaped counters with burners on the
  // spine, oven, extinguisher, bin, fryer. Right rooftop: oven, bin, board, sink, return (3 dirty
  // plates), fryer; the Ever Peckish is the pass. Kevin's platform over the street is the phase-1 H;
  // in the original it changes per phase (conveyor H, rotating S) and brings that phase's crates -
  // here every crate is on the one platform. Meteors that set counters on fire are not modelled.
  {
    id: 'peck', name: 'The Peckening', world: 7, time: 750,
    recipes: ['tomato_soup', 'onion_soup', 'mushroom_soup', 'burger', 'lettuce_burger', 'blt_burger',
      'pizza', 'pepperoni_pizza', 'mushroom_pizza', 'fish_chips', 'tomato_salad'],
    sequence: [
      ['tomato_soup', 'onion_soup', 'mushroom_soup', 'onion_soup', 'tomato_soup'],
      ['burger', 'blt_burger', 'lettuce_burger', 'burger', 'blt_burger'],
      ['pizza', 'fish_chips', 'pepperoni_pizza', 'fish_chips', 'pizza'],
      ['tomato_soup', 'mushroom_pizza', 'blt_burger', 'fish_chips', 'tomato_salad'],
    ],
    dirtyStart: 3,
    stars: { 1: [0, 0, 0], 2: [0, 0, 0], 3: [0, 0, 0], 4: [0, 0, 0] },
    note: 'Final battle: four waves of fixed orders. Finish them all to win.',
    map: [
      '#..#VE~~~~~~#V#X#  ',
      '#.1.............#  ',
      'S.....TOMlue#C##..P',
      'F.......#.....2...P',
      '#X###...C...####..P',
      'F.3.....#........R ',
      '#.....fpdcs###WK.# ',
      'S.............4..# ',
      '#.#D#.~~~~~~##D### ',
    ],
  },
];
