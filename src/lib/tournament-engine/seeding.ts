function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

export function generateSeedOrder(bracketSize: number): number[] {
  if (bracketSize < 2 || !isPowerOfTwo(bracketSize)) {
    throw new Error("bracketSize debe ser potencia de 2 y mayor o igual a 2.");
  }

  let order = [1, 2];
  while (order.length < bracketSize) {
    const nextSize = order.length * 2;
    const expanded: number[] = [];
    for (const seed of order) {
      expanded.push(seed, nextSize + 1 - seed);
    }
    order = expanded;
  }

  return order;
}
