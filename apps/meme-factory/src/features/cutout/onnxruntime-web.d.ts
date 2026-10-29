// onnxruntime-web 1.21 ships its declarations as ambient module definitions in
// types.d.ts but its package.json "exports" map has no "types" condition, so
// TypeScript cannot resolve them. Mirror the declaration here.
declare module 'onnxruntime-web' {
  export * from 'onnxruntime-common'
}
