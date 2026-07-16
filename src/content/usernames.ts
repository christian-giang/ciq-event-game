/**
 * Public display names: color-animal, e.g. "blue-panda". Hand-curated:
 * short, unambiguous, easy to shout across a loud table, no near-homophones
 * (no teal/tea, hare/bear pairs), nothing that combines embarrassingly.
 */

export const COLORS = [
  "red",
  "blue",
  "green",
  "gold",
  "silver",
  "purple",
  "orange",
  "pink",
  "black",
  "white",
  "brown",
  "coral",
  "ivory",
  "olive",
  "navy",
  "mint",
  "ruby",
  "amber",
  "jade",
  "plum",
  "rose",
  "smoke",
  "honey",
  "cocoa",
  "lilac",
  "denim",
] as const;

export const ANIMALS = [
  "panda",
  "fox",
  "owl",
  "wolf",
  "tiger",
  "lion",
  "koala",
  "otter",
  "rabbit",
  "falcon",
  "dolphin",
  "penguin",
  "badger",
  "moose",
  "lynx",
  "heron",
  "gecko",
  "bison",
  "raven",
  "seal",
  "ibex",
  "swan",
  "crane",
  "hedgehog",
  "squirrel",
  "walrus",
  "puffin",
  "yak",
  "llama",
  "toucan",
  "marmot",
  "magpie",
] as const;

export function buildUsernameCombinations(): string[] {
  const names: string[] = [];
  for (const color of COLORS) {
    for (const animal of ANIMALS) {
      names.push(`${color}-${animal}`);
    }
  }
  return names;
}
