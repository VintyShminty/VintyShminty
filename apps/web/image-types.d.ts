// Next.js writes next-env.d.ts on each machine and it is git-ignored, so CI never has it.
// This committed copy of its type references lets static image imports (lib/browse-photos.ts) type check everywhere.
/// <reference types="next" />
/// <reference types="next/image-types/global" />
