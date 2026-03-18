// Type declarations for binary msgpack data files imported as ArrayBuffer
// via Wrangler's "Data" module rule (see wrangler.jsonc).
declare module '*.pack' {
  const content: ArrayBuffer;
  export default content;
}
