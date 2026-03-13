function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizePlayerName(value: string) {
  return collapseWhitespace(value);
}

export function buildPlayerIdentityKey(value: string) {
  return normalizePlayerName(value).toLocaleLowerCase();
}

export function areSamePlayerIdentity(left: string, right: string) {
  return buildPlayerIdentityKey(left) === buildPlayerIdentityKey(right);
}
