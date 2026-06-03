const words = [
  'apple', 'apricot', 'banana', 'berry', 'cherry', 'grape', 'lemon', 'lime', 'mango', 'melon',
  'orange', 'peach', 'pear', 'plum', 'active', 'bright', 'calm', 'clever', 'swift', 'brave',
  'river', 'lake', 'ocean', 'sea', 'pond', 'stream', 'brook', 'creek', 'wave', 'tide',
  'forest', 'woods', 'jungle', 'grove', 'mountain', 'hill', 'valley', 'canyon', 'cliff', 'ridge',
  'stone', 'rock', 'pebble', 'sand', 'dust', 'clay', 'mud', 'soil', 'earth', 'ground',
  'cloud', 'rain', 'snow', 'wind', 'storm', 'breeze', 'gale', 'mist', 'fog', 'frost',
  'summer', 'spring', 'autumn', 'winter', 'morning', 'noon', 'evening', 'night', 'dawn', 'dusk',
  'tiger', 'lion', 'bear', 'wolf', 'fox', 'deer', 'elk', 'hare', 'eagle', 'hawk',
  'lamp', 'light', 'fire', 'spark', 'flame', 'shadow', 'shade', 'beam', 'glow', 'flare',
  'house', 'home', 'room', 'door', 'gate', 'wall', 'roof', 'floor', 'window', 'steps'
];

export function generateCode(): string {
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  const number = Math.floor(10 + Math.random() * 90); // random two-digit number (10 to 99)
  return `${word1}-${word2}-${number}`.toLowerCase();
}
