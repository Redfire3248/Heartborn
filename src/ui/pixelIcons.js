/*
 * Heartborn's own pixel icons (no emojis anywhere). Each icon is a 10×10 pixel grid.
 * Palette letters: k outline, w white, g gold, y yellow, o orange, r red, n brown, l tan, s steel,
 * d dark steel, G green, D dark green, b blue, B dark blue, c cyan, p purple, P pink, x grey.
 * Any emoji written in the UI text is swapped for the closest icon automatically (see dom.js).
 */

const PAL = {
  k: '#1b1224', w: '#f4ecd8', g: '#ffcf5a', y: '#ffe98a', o: '#ff8a3d', r: '#e0453a', n: '#7a4a2a', l: '#c08a4a',
  s: '#c8d0dc', d: '#6c7280', G: '#6fcf4f', D: '#2f7a33', b: '#5aa8f0', B: '#2c5aa0', c: '#7fe8f0', p: '#a45ee0', P: '#ff9fc4', x: '#9a9aa2',
};

const I = {
  sword: ['........kw', '.......kwk', '......kwk.', '.....kwk..', '.k..kwk...', '.kkkwk....', '..knk.....', '.knkk.....', 'knk.k.....', 'kk........'],
  shield: ['.kkkkkkkk.', 'kbbbbwbbbk', 'kbbbbwbbbk', 'kbbbbwbbbk', 'kwwwwwwwwk', 'kbbbbwbbbk', '.kbbbwbbk.', '.kbbbwbbk.', '..kbbwbk..', '...kkkk...'],
  people: ['..kk...kk.', '.kllk.kllk', '.kllk.kllk', '..kk...kk.', '.kbbk.krrk', 'kbbbbkrrrr', 'kbbbbkrrrr', 'kbbbbkrrrr', '.kkkk.kkkk', '..........'],
  person: ['...kkkk...', '..kllllk..', '..kllllk..', '...kkkk...', '..kbbbbk..', '.kbbbbbbk.', '.kbbbbbbk.', '.kbbbbbbk.', '..kkkkkk..', '..........'],
  star: ['....kk....', '....kgk...', '...kggk...', 'kkkkggkkkk', 'kgggyggggk', '.kggyyggk.', '..kgggggk.', '.kggkkggk.', '.kgk..kgk.', '.kk....kk.'],
  crown: ['..........', 'k...kk...k', 'kk.kggk.kk', 'kgkkggkkgk', 'kgggrggggk', 'kgggggggrk', 'kggbgggggk', 'kggggggggk', 'kkkkkkkkkk', '..........'],
  coin: ['..kkkkkk..', '.kggggggk.', 'kggykkyggk', 'kgyggkggyk', 'kgygkkkgyk', 'kgygkggkyk', 'kgyykkyygk', 'kggggggggk', '.kggggggk.', '..kkkkkk..'],
  scale: ['....kk....', 'kkkkggkkkk', 'k...gg...k', 'kk..gg..kk', 'gk..gg..kg', 'ggk.gg.kgg', '....gg....', '....gg....', '..kkggkk..', '..kggggk..'],
  hands: ['..........', '.kk....kk.', 'kllk..kllk', 'kllkkkkllk', 'klllllllk.', '.kllllllk.', '..kllllk..', '...kkkk...', '..........', '..........'],
  trash: ['...kkkk...', 'kkkkkkkkkk', 'kxxxxxxxxk', '.kssssssk.', '.ksdsdsdk.', '.ksdsdsdk.', '.ksdsdsdk.', '.ksdsdsdk.', '.kssssssk.', '..kkkkkk..'],
  fire: ['....k.....', '...kok....', '...kook.k.', '..koookkok', '.kooyyookk', 'kooyyyyok.', 'koyywwyok.', 'koyywwyyok', '.kooyyook.', '..kkkkkk..'],
  lock: ['..kkkkkk..', '.kxk..kxk.', '.kxk..kxk.', 'kkkkkkkkkk', 'kggggggggk', 'kgggkkgggk', 'kgggkkgggk', 'kggggggggk', 'kggggggggk', 'kkkkkkkkkk'],
  unlock: ['..kkkkkk..', '.kxk..kxk.', '.kxk......', 'kkkkkkkkkk', 'kggggggggk', 'kgggkkgggk', 'kgggkkgggk', 'kggggggggk', 'kggggggggk', 'kkkkkkkkkk'],
  scroll: ['.kkkkkkkk.', 'klwwwwwwlk', '.kwkkkkwk.', '.kwwwwwwk.', '.kwkkkkwk.', '.kwwwwwwk.', '.kwkkkwwk.', '.kwwwwwwk.', 'klwwwwwwlk', '.kkkkkkkk.'],
  dagger: ['.......kk.', '......kwk.', '.....kwk..', '....kwk...', '...kwk....', '.kkwk.....', '..kgk.....', '.knkk.....', 'knk.......', 'kk........'],
  bomb: ['.......ko.', '......k.y.', '.....k....', '...kkkk...', '..kddddk..', '.kddwdddk.', '.kdwdddd k'.replace(' ', 'd'), '.kdddddkd.'.replace('kd.', 'dk.'), '..kddddk..', '...kkkk...'],
  wheat: ['....k.....', '...kyk....', '..kykyk...', '...kyk....', '..kykyk...', '...kyk....', '..kykyk...', '....n.....', '....n.....', '....n.....'],
  house: ['....kk....', '...krrk...', '..krrrrk..', '.krrrrrrk.', 'kkkkkkkkkk', '.kllllllk.', '.klbllnlk.', '.klbllnlk.', '.kllllnlk.', '.kkkkkkkk.'],
  sun: ['....k.....', '.k..g..k..', '..kgggk...', '.kgyyygk..', 'kgyyyyygk.', '.kgyyygk..', '..kgggk...', '.k..g..k..', '....k.....', '..........'],
  moon: ['...kkkk...', '..kyyk....', '.kyyk.....', '.kyk......', 'kyyk......', 'kyyk......', '.kyyk.....', '.kyyykkk..', '..kyyyyk..', '...kkkk...'],
  boom: ['k..k..k..k', '.kokkook..', '.koyyyok..', 'kooywyook.', '.koywwyok.', 'kkoyyyokkk', '..koookk..', '.k.kkk.k..', 'k...k...k.', '..........'],
  eye: ['..........', '..kkkkkk..', '.kwwwwwwk.', 'kwwkbbkwwk', 'kwwbkkbwwk', 'kwwbkkbwwk', 'kwwkbbkwwk', '.kwwwwwwk.', '..kkkkkk..', '..........'],
  globe: ['..kkkkkk..', '.kbGGbbbk.', 'kbGGGbbbbk', 'kbbGbbGGbk', 'kbbbbbGGbk', 'kbGbbbbGbk', 'kbGGbbbbbk', 'kbbGbbbbbk', '.kbbbbbbk.', '..kkkkkk..'],
  karma: ['..kkkkkk..', '.kwwwwkkk.', 'kwwkwwkkkk', 'kwwwwwkkkk', 'kwwwwkkkkk', 'kwwwkkkkkk', 'kwwkkkkwkk', 'kwwkkkkkkk', '.kwkkkkkk.', '..kkkkkk..'],
  pick: ['.kkkkkkk..', 'kssssssssk', 'kdk.kn.kdk', 'kk..kn..kk', '....kn....', '....kn....', '....kn....', '....kn....', '....kn....', '....kk....'],
  hammer: ['.kkkkkk...', 'kssssssk..', 'kssssssk..', '.kkknkk...', '...kn.....', '...kn.....', '...kn.....', '...kn.....', '...kn.....', '...kk.....'],
  axe: ['..kkkk....', '.kssssk...', 'kssssssk..', 'kssskknk..', '.kkk.kn...', '.....kn...', '.....kn...', '.....kn...', '.....kn...', '.....kk...'],
  book: ['.kkkkkkkk.', 'kbbbbbbbbk', 'kbwwwwwwbk', 'kbwkkkkwbk', 'kbwwwwwwbk', 'kbwkkkkwbk', 'kbwwwwwwbk', 'kbbbbbbbbk', 'kwwwwwwwwk', '.kkkkkkkk.'],
  robot: ['....kk....', '....kk....', '.kkkkkkkk.', 'ksssssssk.', 'kscksckks.'.replace('kks.', 'sk.'), 'ksssssssk.', 'kskkkkssk.'.replace('kssk.', 'ssk.'), '.kkkkkkk..', '.kd.k.kd..', '.kk...kk..'],
  chain: ['..........', '.kkk......', 'kd.dk.....', 'kd.kkkk...', '.kkkd.dk..', '...kd.dkk.', '...kkkkd.k', '......kd.k', '.......kkk', '..........'],
  flask: ['...kkkk...', '....kk....', '....kk....', '...kwwk...', '..kwwwwk..', '.kwcccwwk.', '.kcccccck.', 'kcccwcccck', 'kcccccccck', '.kkkkkkkk.'],
  pillar: ['kkkkkkkkkk', 'kwwwwwwwwk', '.kkkkkkkk.', '.kwk.kwk..', '.kwk.kwk..', '.kwk.kwk..', '.kwk.kwk..', '.kwk.kwk..', 'kkkkkkkkkk', 'kwwwwwwwwk'],
  bolt: ['.....kkk..', '....kyyk..', '...kyyk...', '..kyyk....', '.kyyyyyk..', '.kkkyyk...', '...kyk....', '..kyk.....', '..kk......', '..........'],
  rocket: ['....kk....', '...kwwk...', '...kwbk...', '...kwwk...', '...kwwk...', '..kkwwkk..', '.krkwwkrk.', '.kk.kk.kk.', '....oy....', '....o.....'],
  dove: ['..........', '.kk.......', 'kwwk......', '.kwwkkkk..', '..kwwwwwk.', '.kwwwwwwwk', 'kwwwwwwkk.', '.kkwwwk...', '...kkk....', '..........'],
  warning: ['....kk....', '...kyyk...', '...kyyk...', '..kykkyk..', '..kykkyk..', '.kyykkyyk.', '.kyyyyyyk.', 'kyyykkyyyk', 'kyyyyyyyyk', 'kkkkkkkkkk'],
  map: ['kkkkkkkkkk', 'klllkllllk', 'klGlklrllk', 'kllGkllllk', 'kllllkbblk', 'kllrlkbblk', 'kllllllklk', 'kGGllllklk', 'klllllllk.', 'kkkkkkkkk.'],
  target: ['..kkkkkk..', '.krrrrrrk.', 'krrwwwwrrk', 'krwwrrwwrk', 'krwrkkrwrk', 'krwrkkrwrk', 'krwwrrwwrk', 'krrwwwwrrk', '.krrrrrrk.', '..kkkkkk..'],
  box: ['..........', '.kkkkkkkk.', 'klllnnlllk', 'kkkkkkkkkk', 'klllnnlllk', 'klllnnlllk', 'klllnnlllk', 'klllllllk.', 'kkkkkkkkk.', '..........'],
  calendar: ['.k.k..k.k.', 'kkkkkkkkkk', 'krrrrrrrrk', 'kkkkkkkkkk', 'kwwwwwwwwk', 'kwkwkwkwwk', 'kwwwwwwwwk', 'kwkwkwkwwk', 'kwwwwwwwwk', 'kkkkkkkkkk'],
  chart: ['.........k', '........kG', '.......kGk', '..k...kGk.', '.kGk.kGk..', 'kGkGkGk...', 'Gk.kGk....', 'k...k.....', 'kkkkkkkkkk', '..........'],
  gear: ['...kkkk...', '.kkxxxxkk.', '.kxxxxxxk.', 'kxxxkkxxxk', 'kxxk..kxxk', 'kxxk..kxxk', 'kxxxkkxxxk', '.kxxxxxxk.', '.kkxxxxkk.', '...kkkk...'],
  boot: ['..........', '..kkkk....', '..knnk....', '..knnk....', '..knnk....', '..knnkkkk.', '.knnnnnnnk', '.knnnnnnnk', '.kkkkkkkkk', '..........'],
  smile: ['..kkkkkk..', '.kyyyyyyk.', 'kyykyykyyk', 'kyykyykyyk', 'kyyyyyyyyk', 'kykyyyykyk', 'kyykkkkyyk', '.kyyyyyyk.', '..kkkkkk..', '..........'],
  frown: ['..kkkkkk..', '.kbbbbbbk.', 'kbbkbbkbbk', 'kbbkbbkbbk', 'kbbbbbbbbk', 'kbbkkkkbbk', 'kbkbbbbkbk', '.kbbbbbbk.', '..kkkkkk..', '..........'],
  heart: ['..........', '.kk....kk.', 'krrk..krrk', 'krwrkkrrrk', 'krrrrrrrrk', '.krrrrrrk.', '..krrrrk..', '...krrk...', '....kk....', '..........'],
  plus: ['..........', '...kkkk...', '...kGGk...', '.kkkGGkkk.', '.kGGGGGGk.', '.kGGGGGGk.', '.kkkGGkkk.', '...kGGk...', '...kkkk...', '..........'],
  halo: ['..kkkkkk..', '.kyyyyyyk.', '..kkkkkk..', '..........', '...kkkk...', '..kllllk..', '..kllllk..', '.kwwwwwwk.', 'kwwwwwwwwk', '.kkkkkkkk.'],
  devil: ['.k......k.', 'krk....krk', '.kkkkkkkk.', '.krrrrrrk.', 'krrkrrkrrk', 'krrrrrrrrk', 'krkkkkkkrk', '.krrrrrrk.', '..kkkkkk..', '..........'],
  wave: ['..........', '..kkk.....', '.kbbbk....', 'kbbwbbk..k', 'kbk.kbbkkb', '.k...kbbbk', 'kkk...kkk.', 'kbbkkk....', '.kbbbbkkk.', '..kkkkbbbk'],
  meat: ['......kkk.', '.....kwwwk', '....kwkkk.', '..kkkwk...', '.krrrrk...', 'krrorrrk..', 'krrrrork..', 'krorrrrk..', '.krrrrk...', '..kkkk....'],
  rock: ['..........', '...kkkk...', '..kxxxxkk.', '.kxwxxxxxk', 'kxxxxxdxxk', 'kxxdxxxxxk', 'kxxxxxxdxk', '.kxxxxxxk.', '..kkkkkk..', '..........'],
  tent: ['....kk....', '...kllk...', '..kllnlk..', '..kllnlk..', '.kllnnllk.', '.kllnnllk.', 'kllnkknllk', 'kllnkknllk', 'kkkkkkkkkk', '..........'],
  bow: ['.kk.......', 'knwk......', 'kn.wk.....', 'kn..wk....', 'kn...wkkkk', 'kn..wk....', 'kn.wk.....', 'knwk......', '.kk.......', '..........'],
  clipboard: ['...kkkk...', '.kkxxxxkk.', 'klllllllk.', 'klwwwwwlk.', 'klwkkkwlk.', 'klwwwwwlk.', 'klwkkkwlk.', 'klwwwwwlk.', 'klllllllk.', 'kkkkkkkkk.'],
  gem: ['..........', '..kkkkkk..', '.kcwccpck.', 'kccwcpppck', 'kkkkkkkkkk', '.kcpppcck.', '..kcppck..', '...kcck...', '....kk....', '..........'],
  dice: ['kkkkkkkkkk', 'kwwwwwwwwk', 'kwkwwwwkwk', 'kwwwwwwwwk', 'kwwwkkwwwk', 'kwwwkkwwwk', 'kwwwwwwwwk', 'kwkwwwwkwk', 'kwwwwwwwwk', 'kkkkkkkkkk'],
  search: ['..kkkk....', '.kccccк...'.replace('к', 'k'), 'kccwwcck..', 'kcwccccck.', 'kccccccck.', '.kcccck...', '..kkkkkk..', '......kkk.', '.......kkk', '........kk'],
  clock: ['..kkkkkk..', '.kwwwwwwk.', 'kwwwkwwwwk', 'kwwwkwwwwk', 'kwwwkkkwwk', 'kwwwwwwwwk', 'kwwwwwwwwk', '.kwwwwwwk.', '..kkkkkk..', '..........'],
  skull: ['..kkkkkk..', '.kwwwwwwk.', 'kwwwwwwwwk', 'kwkkwwkkwk', 'kwkkwwkkwk', 'kwwwkkwwwk', '.kwwwwwwk.', '..kwkwkk..', '..kkkkkk..', '..........'],
  castle: ['k.k.kk.k.k', 'kkkkkkkkkk', 'kxxxxxxxxk', 'kxkxxxxkxk', 'kxxxxxxxxk', 'kxxxkkxxxk', 'kxxkggkxxk', 'kxxkggkxxk', 'kxxkggkxxk', 'kkkkkkkkkk'],
  ship: ['....k.....', '....kw....', '....kww...', '....kwww..', '....kwwww.', '....k.....', 'kkkkkkkkkk', 'knnnnnnnnk', '.knnnnnnk.', '..kkkkkk..'],
  factory: ['.......kk.', '.......kxk', '.k..k..kxk', 'kxkkxkkkxk', 'kxxxxxxxxk', 'kxwxxwxxwk', 'kxxxxxxxxk', 'kxwxxwxxwk', 'kxxxxxxxxk', 'kkkkkkkkkk'],
  gift: ['..kk..kk..', '.krrkkrrk.', '..kkggkk..', 'kkkkggkkkk', 'kbbbggbbbk', 'kkkkggkkkk', 'kbbbggbbbk', 'kbbbggbbbk', 'kbbbggbbbk', 'kkkkkkkkkk'],
  key: ['..........', '.kkk......', 'kgggk.....', 'kg.gkkkkkk', 'kgggggggggk'.slice(0, 10), '.kkkk.kg.k', '......kk..', '..........', '..........', '..........'],
  repeat: ['..kkkkkk..', '.kGGGGGGk.', 'kGk....kGk', 'kGk...kGGk', '.k...kGGGk', 'kGGGk...k.', 'kGGk...kGk', 'kGk....kGk', '.kGGGGGGk.', '..kkkkkk..'],
  door: ['.kkkkkkkk.', 'knnnnnnnnk', 'knllllllnk', 'knllllllnk', 'knllllllnk', 'knllllgllk', 'knllllllnk', 'knllllllnk', 'knllllllnk', 'kkkkkkkkkk'],
  brain: ['..kkkkkk..', '.kPPkPPPk.', 'kPPkPPkPPk', 'kPkPPkPPPk', 'kPPPkPPkPk', 'kPkPPPkPPk', '.kPPkPPPk.', '..kkkPPk..', '....kPPk..', '....kkkk..'],
  sparkle: ['....k.....', '....y.....', '....y.....', 'kyyywyyyk.', '....y.....', '....y...k.', '....k..kyk', '........k.', '..........', '..........'],
  hourglass: ['kkkkkkkkkk', '.kyyyyyyk.', '..kyyyyk..', '...kyyk...', '....kk....', '...kwwk...', '..kwyywk..', '.kyyyyyyk.', 'kkkkkkkkkk', '..........'],
  pin: ['...kkkk...', '..krrrrk..', '.krrwwrrk.', '.krwwwwrk.', '.krrwwrrk.', '..krrrrk..', '...krrk...', '....kk....', '....k.....', '..........'],
  phone: ['..kkkkkk..', '..kddddk..', '..kccccck.'.slice(0, 10), '..kcccck..', '..kcccck..', '..kcccck..', '..kcccck..', '..kddddk..', '..kdkkdk..', '..kkkkkk..'],
  dragon: ['..kk......', '.krrk.kk..', 'krkrrkrrk.', 'krrrrrrrk.', '.kkrrrrrrk', '...krrrkrk', '..krkrrk.k', '..krkkrk..', '.krk..krk.', '.kk....kk.'],
  cloud: ['..........', '...kkkk...', '..kwwwwk..', '.kwwwwwwkk', 'kwwwwwwwwk', 'kwwwwwwwwk', '.kkkkkkkk.', '..........', '..........', '..........'],
  arrow: ['..........', '....k.....', '....kk....', 'kkkkkGk...', 'kGGGGGGk..', 'kkkkkGk...', '....kk....', '....k.....', '..........', '..........'],
  bell: ['....kk....', '...kggk...', '..kggggk..', '..kgyggk..', '.kggyyggk.', '.kggggggk.', '.kggggggk.', 'kggggggggk', 'kkkkkkkkkk', '....kk....'],
  speaker: ['....k.....', '...kk..k..', 'kkkwk...k.', 'kwwwk.k.k.', 'kwwwk.k.k.', 'kwwwk.k.k.', 'kkkwk...k.', '...kk..k..', '....k.....', '..........'],
  mute: ['....k.....', '...kk.....', 'kkkwk.....', 'kwwwk.r..r', 'kwwwk..rr.', 'kwwwk..rr.', 'kkkwk.r..r', '...kk.....', '....k.....', '..........'],
  undo: ['..........', '..k.......', '.kGk......', 'kGGkkkkk..', 'kGGGGGGGk.', '.kGkkkkGGk', '..k....kGk', '.......kGk', '...kkkkGGk', '...kGGGGk.'],
  flag: ['kk........', 'kkkkkkkk..', 'kkrrrrrrk.', 'kkrrrrrrrk', 'kkrrrrrrk.', 'kkkkkkkk..', 'kk........', 'kk........', 'kk........', 'kk........'],
  dot: ['..........', '..........', '...kkkk...', '..kggggk..', '..kggggk..', '..kggggk..', '..kggggk..', '...kkkk...', '..........', '..........'],
};

// every emoji used in the game → its icon
const EMOJI = {
  '⚔': 'sword', '🗡': 'dagger', '🛡': 'shield', '🔰': 'shield', '👥': 'people', '👤': 'person', '👷': 'person', '🚶': 'person', '💃': 'person', '👶': 'person',
  '⭐': 'star', '🌟': 'star', '★': 'star', '🏆': 'star', '👑': 'crown', '💰': 'coin', '🪙': 'coin', '🏦': 'coin', '⚖': 'scale', '🤝': 'hands',
  '🗑': 'trash', '🔥': 'fire', '♨': 'fire', '🧨': 'bomb', '💣': 'bomb', '🔒': 'lock', '🔓': 'unlock', '🗝': 'key', '🔑': 'key', '📜': 'scroll', '📋': 'clipboard', '📰': 'scroll', '🖼': 'scroll',
  '🌾': 'wheat', '🥬': 'wheat', '🌿': 'wheat', '🌷': 'wheat', '🍀': 'wheat', '🏠': 'house', '🏕': 'tent', '🛏': 'house', '🏙': 'castle', '🏰': 'castle', '🏛': 'pillar', '⛩': 'pillar', '🏟': 'pillar', '🗿': 'pillar', '🗼': 'castle',
  '☀': 'sun', '🌙': 'moon', '💥': 'boom', '☄': 'boom', '🎆': 'sparkle', '💡': 'sparkle', '✨': 'sparkle', '👁': 'eye', '🔭': 'eye', '🕶': 'eye', '🌍': 'globe', '🗺': 'map', '🛰': 'globe', '📡': 'globe',
  '☯': 'karma', '⛏': 'pick', '🔨': 'hammer', '⚒': 'hammer', '🏗': 'hammer', '🔩': 'gear', '🪓': 'axe', '📚': 'book', '📖': 'book', '🎓': 'book', '🗣': 'book',
  '🤖': 'robot', '🦾': 'robot', '🧠': 'brain', '⛓': 'chain', '🔬': 'flask', '🧪': 'flask', '🧬': 'flask', '💉': 'flask', '⚡': 'bolt', '🚀': 'rocket', '🛸': 'rocket', '🪂': 'rocket',
  '🕊': 'dove', '⚠': 'warning', '☢': 'warning', '☠': 'skull', '💀': 'skull', '🎯': 'target', '📦': 'box', '🗄': 'box', '🧰': 'box', '🧱': 'rock', '🪨': 'rock', '⚫': 'rock',
  '📅': 'calendar', '⏰': 'clock', '⏳': 'hourglass', '📈': 'chart', '⚙': 'gear', '🏃': 'boot', '😊': 'smile', '😇': 'halo', '🙏': 'halo', '✝': 'halo', '💒': 'halo', '😟': 'frown', '😈': 'devil', '🤒': 'frown',
  '❤': 'heart', '♥': 'heart', '💍': 'heart', '✚': 'plus', '➕': 'plus', '🌊': 'wave', '💧': 'wave', '🛁': 'wave', '🌬': 'cloud', '☁': 'cloud', '🍖': 'meat', '🍞': 'meat', '🍯': 'meat', '🍺': 'meat', '🐄': 'meat', '🐟': 'meat', '🎣': 'meat', '🪵': 'axe',
  '🏹': 'bow', '📯': 'bow', '🐎': 'boot', '🐪': 'boot', '💎': 'gem', '🎲': 'dice', '🔍': 'search', '🔎': 'search', '🕵': 'eye', '🩸': 'heart', '🐉': 'dragon', '🎁': 'gift',
  '⛵': 'ship', '🚢': 'ship', '🚂': 'factory', '🚄': 'factory', '🏭': 'factory', '🔁': 'repeat', '🚪': 'door', '📍': 'pin', '📲': 'phone', '♀': 'person', '♂': 'person',
};

const EMOJI_RE = /(\p{Extended_Pictographic})️?/gu;
const urlCache = new Map();

function svgFor(name) {
  let url = urlCache.get(name);
  if (url) return url;
  const grid = I[name] || I.dot;
  let rects = '';
  grid.forEach((row, y) => [...row.padEnd(10, '.').slice(0, 10)].forEach((ch, x) => { if (PAL[ch]) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${PAL[ch]}"/>`; }));
  url = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" shape-rendering="crispEdges">${rects}</svg>`)}")`;
  urlCache.set(name, url);
  return url;
}

/** A pixel icon element. */
export function pxIcon(name, size = null) {
  const el = document.createElement('i');
  el.className = 'px-icon';
  el.style.backgroundImage = svgFor(name);
  if (size) { el.style.width = `${size}px`; el.style.height = `${size}px`; }
  el.setAttribute('aria-hidden', 'true');
  return el;
}

export const hasEmoji = s => typeof s === 'string' && /\p{Extended_Pictographic}/u.test(s);

/** Remove emojis from text that can't hold icons (tooltips, <option>s, canvas text). */
export const stripEmoji = s => (hasEmoji(s) ? s.replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim() : s);

/** Text → nodes, with every emoji swapped for its pixel icon. */
export function iconizeText(s) {
  const out = [];
  let last = 0;
  for (const m of s.matchAll(EMOJI_RE)) {
    if (m.index > last) out.push(document.createTextNode(s.slice(last, m.index)));
    out.push(pxIcon(EMOJI[m[1]] || 'dot'));
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(document.createTextNode(s.slice(last)));
  return out;
}
