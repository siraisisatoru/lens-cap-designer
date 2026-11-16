// Loads the manifold-3d WebAssembly module once. Vite bundles the .wasm file and gives us its URL.
import Module from 'manifold-3d/manifold.js';
import wasmUrl from 'manifold-3d/manifold.wasm?url';

let loading = null;

export function loadEngine() {
  if (!loading) {
    loading = Module({ locateFile: () => wasmUrl }).then((wasm) => {
      wasm.setup();
      return wasm;
    });
  }
  return loading;
}
