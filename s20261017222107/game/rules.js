// Gameplay numbers, from reference/SPEC_core.md and reference/RECIPES.md (measured from gameplay video or
// the wiki; "est." = no source found, estimated).

export const RULES = {
  chefSpeed: 4.8,          // tiles per second
  chefRadius: 0.32,
  dashSpeed: 13,           // tiles per second during a dash
  dashTime: 0.16,          // seconds
  dashCooldown: 0.55,      // wiki: just over half a second
  chopTime: 1.5,           // seconds per ingredient with 2+ chefs (measured 1.3-1.5 s)
  chopSoloFactor: 2,       // solo chopping is slower (wiki; factor est.)
  washTime: 3,             // seconds per plate (measured 3-4 s)
  burnWarn: 5,             // seconds after done before the warning starts (wiki)
  burnTime: 13,            // seconds after done before it burns and catches fire (wiki: 5 + 5 + 3)
  fireSpread: 4,           // seconds for a fire to spread to a neighbouring station (est.)
  fireHP: 1.0,             // extinguisher seconds to put out one tile (est.)
  extinguishRange: 2.6,    // tiles
  plateReturn: 6,          // seconds after serving until the plate comes back (measured)
  respawn: 5,              // seconds before a chef who fell in comes back (wiki)
  itemRespawn: 5,          // seconds before a lost pot/pan/extinguisher reappears (wiki: Bin)
  beltStep: 0.9,           // seconds for a conveyor to move an item one tile (est.)
  iceGrip: 2.2,            // how fast velocity follows the stick on ice (per second; est.)
  throwSpeed: 11,          // tiles per second
  catchRadius: 0.6,
  ordersMax: 5,            // up to 5 tickets seen
  orderTime: 105,          // seconds a ticket lasts with 2+ chefs (measured 100-110 s, 1-1 2P)
  orderTimeSolo: 180,      // ... and solo (measured ~180 s, 1-2 solo)
  orderEvery: 25,          // seconds between new tickets (measured 24-26 s)
  orderPenalty: 10,        // points lost when a ticket expires (end card: failed x 10)
  points: 20,              // every recipe scores 20 (all 38 end cards in the longplay)
  tips: [6, 4, 2],         // tip by ticket time left: >2/3, >1/3, else (values sourced, cut-offs est.)
  readyTime: 3,            // "Ready... Go!" seconds
};

// Cooking vessels / heat sources: delay before progress starts, time to cook. Pot numbers are measured;
// pan, fryer and oven are estimates.
export const COOK = {
  pot:    { delay: 2.5, time: 10 },
  pan:    { delay: 0.5, time: 8 },
  basket: { delay: 0.5, time: 9 },
  oven:   { delay: 0.5, time: 10 },
};

// Ingredients. chop: needs chopping first. cook: vessel it is cooked in. plate: goes on a plate as-is
// ('raw' or 'chopped'). top: pizza topping. base: pizza base (toppings stack on it, then the oven).
export const INGREDIENTS = {
  onion:     { name: 'Onion',     chop: true, cook: 'pot' },
  tomato:    { name: 'Tomato',    chop: true, cook: 'pot', plate: 'chopped', top: true },
  mushroom:  { name: 'Mushroom',  chop: true, cook: 'pot', top: true },
  lettuce:   { name: 'Lettuce',   chop: true, plate: 'chopped' },
  bun:       { name: 'Bun',       plate: 'raw' },
  tortilla:  { name: 'Tortilla',  plate: 'raw' },
  meat:      { name: 'Meat',      chop: true, cook: 'pan' },
  chicken:   { name: 'Chicken',   chop: true, cook: 'pan' },
  fish:      { name: 'Fish',      chop: true, cook: 'basket' },
  potato:    { name: 'Potato',    chop: true, cook: 'basket' },
  dough:     { name: 'Dough',     chop: true, base: true, cook: 'oven' },
  cheese:    { name: 'Cheese',    chop: true, top: true },
  pepperoni: { name: 'Pepperoni', chop: true, top: true },
  rice:      { name: 'Rice',      cook: 'pot' },
};
export const SOUP_INGS = ['onion', 'tomato', 'mushroom'];

// Recipes: `plate` = the tokens that must be on the plate; `ings` = ticket icons (left to right) with the
// cooking method shown under each (RECIPES.md §2, §4).
export const RECIPES = {
  salad:           { name: 'Salad',             plate: ['lettuce'],                         ings: [['lettuce']] },
  tomato_salad:    { name: 'Tomato Salad',      plate: ['lettuce', 'tomato'],               ings: [['lettuce'], ['tomato']] },
  onion_soup:      { name: 'Onion Soup',        plate: ['soup:onion'],                      ings: [['onion'], ['onion'], ['onion']], method: 'pot' },
  tomato_soup:     { name: 'Tomato Soup',       plate: ['soup:tomato'],                     ings: [['tomato'], ['tomato'], ['tomato']], method: 'pot' },
  mushroom_soup:   { name: 'Mushroom Soup',     plate: ['soup:mushroom'],                   ings: [['mushroom'], ['mushroom'], ['mushroom']], method: 'pot' },
  burger:          { name: 'Burger',            plate: ['bun', 'meat'],                     ings: [['bun'], ['meat', 'pan']] },
  lettuce_burger:  { name: 'Lettuce Burger',    plate: ['bun', 'lettuce', 'meat'],          ings: [['bun'], ['lettuce'], ['meat', 'pan']] },
  blt_burger:      { name: 'Lettuce & Tomato Burger', plate: ['bun', 'lettuce', 'meat', 'tomato'], ings: [['bun'], ['lettuce'], ['tomato'], ['meat', 'pan']] },
  fish:            { name: 'Fish',              plate: ['fish'],                            ings: [['fish', 'basket']] },
  chips:           { name: 'Chips',             plate: ['chips'],                           ings: [['potato', 'basket']] },
  fish_chips:      { name: 'Fish & Chips',      plate: ['chips', 'fish'],                   ings: [['fish', 'basket'], ['potato', 'basket']] },
  pizza:           { name: 'Pizza',             plate: ['pizza:cheese+tomato'],             ings: [['dough'], ['tomato'], ['cheese']], method: 'oven' },
  pepperoni_pizza: { name: 'Pepperoni Pizza',   plate: ['pizza:cheese+pepperoni+tomato'],   ings: [['dough'], ['tomato'], ['cheese'], ['pepperoni']], method: 'oven' },
  mushroom_pizza:  { name: 'Mushroom Pizza',    plate: ['pizza:cheese+mushroom+tomato'],    ings: [['dough'], ['tomato'], ['cheese'], ['mushroom']], method: 'oven' },
  beef_burrito:    { name: 'Beef Burrito',      plate: ['meat', 'rice', 'tortilla'],        ings: [['tortilla'], ['rice', 'pot'], ['meat', 'pan']] },
  chicken_burrito: { name: 'Chicken Burrito',   plate: ['chicken', 'rice', 'tortilla'],     ings: [['tortilla'], ['rice', 'pot'], ['chicken', 'pan']] },
};
// the dish picture shown on a ticket
export function dishIcon(r) {
  if (r.includes('soup')) return r;
  if (r.includes('burger')) return 'burger';
  if (r === 'fish' || r === 'chips' || r === 'fish_chips') return 'fish_chips';
  if (r.includes('pizza')) return r;
  if (r.includes('burrito')) return 'burrito';
  return r;
}

export const POT_CAPACITY = 3;
