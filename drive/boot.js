// The HTML registers an independent failure path before this module loads.
// Keep startup dependency-free so a failed loading helper cannot strand it.
let reportFailure=globalThis.driveStartupFailure;
try {
 const {loadingStage,failLoading}=await import('./loading.js?rev=world21d');
 reportFailure=failLoading;
 // Let the silent compositor-only Yaris paint before heavy modules/WASM.
 await loadingStage('读取驾驶与物理模块');
 await import('./app.js?rev=world21s');
} catch (error) {
 console.error('Drive could not initialise:',error);
 reportFailure?.(error);
}
