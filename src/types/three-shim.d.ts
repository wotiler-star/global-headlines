// Ambient module declaration for three (the package ships no bundled types).
// SignalDeck only uses THREE at runtime to construct the globe material,
// so an untyped "any" module is sufficient and keeps the dep tree light.
declare module "three";
