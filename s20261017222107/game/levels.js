// Kitchens, reconstructed from reference screenshots (see reference/SPEC_core.md for sources and
// uncertainty: positions are ±1 tile). Legend:
//   .  floor        #  counter      C  chopping board   S  stove with pot   P  serving pass
//   W  sink         K  plate rack   R  plate return     X  bin              E  counter with extinguisher
//   L  counter with a clean plate   O/T/M  onion / tomato / mushroom crate  H  solid wall / grill
//   1-4 chef spawn (floor)          space  nothing
// stars: thresholds for 1/2/3 stars by number of players (TrueAchievements walkthrough).
import { MORE_LEVELS } from './levels_more.js';

const WORLD1 = [
  {
    id: '1-1', name: '1-1', world: 1, time: 150, clockAfterServe: true, recipes: ['onion_soup'],
    stars: { 1: [10, 40, 60], 2: [10, 40, 60], 3: [20, 40, 100], 4: [20, 40, 120] },
    map: [
      '####O####S#####',
      '#...1....2....E',
      '#....3....4...#',
      '#.............W',
      '###########...K',
      'R.............#',
      'P.............#',
      'P.............X',
      '####C#C###LL###',
    ],
  },
  {
    id: '1-2', name: '1-2', world: 1, env: 'street', time: 240, recipes: ['onion_soup', 'tomato_soup'],
    crosswalk: [8, 10],   // pedestrians cross the street here (est. pace; SPEC_core 1-2)
    walkers: [
      { from: [8.5, -1.5], to: [8.5, 8.5], period: 14, phase: 0 },
      { from: [9.5, 8.5], to: [9.5, -1.5], period: 16, phase: 5 },
      { from: [10.4, -1.5], to: [10.4, 8.5], period: 18, phase: 11, look: 2 },
    ],
    stars: { 1: [20, 60, 80], 2: [20, 60, 150], 3: [20, 60, 200], 4: [20, 60, 210] },
    map: [
      '..##S#S#...###EX.#',
      '.......#..1......P',
      'W......L...L..2..P',
      'K..3.......#.....R',
      '...........#..4...',
      '.##C#C##...#T#O###',
      '..................',
    ],
  },
  {
    id: '1-3', name: '1-3', world: 1, env: 'ship', time: 240, recipes: ['onion_soup', 'tomato_soup', 'mushroom_soup'],
    stars: { 1: [40, 80, 100], 2: [40, 90, 200], 3: [60, 100, 250], 4: [60, 120, 260] },
    map: [
      '..S#S##PPRE',
      '.L...#.1.2.',
      '.L...#.....',
      '.L...#..3..',
      'X#...#...4.',
      '#C#C##OTM..',
      '...........',
    ],
    // the two counter strips slide back and forth as the ship rocks (period est.)
    movers: [
      { cells: [[1, 1], [1, 2], [1, 3], [1, 4]], path: [[0, 0], [1, 0]], hold: 7, move: 1.2, under: '.' },
      { cells: [[5, 1], [5, 2], [5, 3], [5, 4]], path: [[0, 0], [-1, 0]], hold: 7, move: 1.2, under: '.' },
    ],
  },
  {
    id: '1-5', name: '1-5', world: 1, time: 240, recipes: ['onion_soup', 'tomato_soup', 'mushroom_soup'],
    stars: { 1: [30, 70, 120], 2: [40, 80, 160], 3: [50, 180, 250], 4: [60, 200, 260] },
    map: [
      '##MOT#RPPE#WK#X',
      '#......12.....#',
      '#.###########.#',
      '#.#HHHHHHHHH#.#',
      '#.#HHHHHHHHH#.#',
      '#3##########LL#',
      '#............4#',
      '#C#C#####S#S#S#',
    ],
  },
];

// every kitchen in campaign order: the intro, worlds 1-6, then The Peckening
const ORDER = id => id === 'intro' ? -1 : id === 'peck' ? 99 : +id.split('-')[0] * 10 + +id.split('-')[1];
export const LEVELS = [...WORLD1, ...MORE_LEVELS].sort((a, b) => ORDER(a.id) - ORDER(b.id));
