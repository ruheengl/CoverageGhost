export function enableXRLayer({ zOffset = 0, depth = 0, zIndex = 0, backgroundMaterial = 'none' } = {}) {
  return {
    enableXr: true,
    '--xr-back': String(zOffset),
    '--xr-depth': String(depth),
    '--xr-z-index': String(zIndex),
    '--xr-background-material': backgroundMaterial,
  };
}
