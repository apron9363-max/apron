// Shim for Next.js "server-only" virtual module when running via tsx.
// In Next.js build this is a hard boundary that throws if imported from client code;
// for CLI scripts everything runs server-side so this is a no-op.
