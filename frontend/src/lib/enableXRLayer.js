const inWebSpatial = /WebSpatial\//.test(navigator.userAgent);

export function enableXRLayer({ zOffset = 0, depth = 0, zIndex = 0, backgroundMaterial = 'none' } = {}) {
  return {
    ...(inWebSpatial ? { enableXr: true } : {}),
    '--xr-back': String(zOffset),
    '--xr-depth': String(depth),
    '--xr-z-index': String(zIndex),
    '--xr-background-material': backgroundMaterial,
  };
}
