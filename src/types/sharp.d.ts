// Sharp 0.35's package.json "exports" map has no "types" condition that
// resolves under moduleResolution "bundler", causing TS7016. Declare the
// module ambiently (typed as `any`) since it's only used dynamically in
// src/lib/ai.ts.
declare module "sharp";
