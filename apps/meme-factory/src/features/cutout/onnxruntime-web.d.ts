// onnxruntime-web 1.21 ships its declarations as ambient module definitions in
// types.d.ts but its package.json "exports" map has no "types" condition, so
// TypeScript cannot resolve them. Mirror the declaration here.
declare module 'onnxruntime-web' {
  export * from 'onnxruntime-common'
}

// The WASM-only entry (`onnxruntime-web/wasm`) has the same missing types
// condition in its exports map. It exposes the same runtime surface, so mirror
// the declaration for the subpath as well.
declare module 'onnxruntime-web/wasm' {
  export * from 'onnxruntime-common'
}
