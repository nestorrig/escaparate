# Escaparate

Escaparate 3D hecho con [Vite](https://vite.dev) y [Three.js WebGPU](https://threejs.org/docs/#api/en/renderers/webgpu/WebGPURenderer) (`three/webgpu` + TSL), con una arquitectura de clases inspirada en [folio-2025](https://github.com/brunosimon/folio-2025).

## Scripts

```bash
npm install
npm run dev      # servidor de desarrollo (abierto a la red local)
npm run build    # build de producción en dist/
npm run preview  # sirve el build
```

## Parámetros de URL

- `#inspector`: activa el Inspector de three (rendimiento, memoria y parámetros de luces y espejo).
- `?quality=1|2|3`: fuerza el nivel de calidad (pixel ratio, resolución del espejo, tamaño de sombras).

## Estructura

```
src/
  index.html, index.js, style.css
  data/pieces.js          datos de las anotaciones (poster, móvil)
  Experience/
    Experience.js         singleton que crea y orquesta todos los módulos
    Events.js             eventos con orden de ejecución
    Ticker.js             loop (lo mueve renderer.setAnimationLoop)
    Viewport.js           tamaño y pixel ratio
    Quality.js            niveles de calidad según el dispositivo
    ResourcesLoader.js    GLTF y texturas + barra de carga
    Rendering.js          WebGPURenderer, toneMapping, Inspector
    View.js               cámara (tomada de las cámaras del glb) + OrbitControls
    Lighting.js           luz ambiental + RectAreaLight sobre la geometría "lampara"
    Overlay.js            fade de entrada
    Annotations.js        puntos HTML proyectados con oclusión por raycast (sin usar por ahora)
    Modal.js              detalle de cada pieza (sin usar por ahora)
    World/
      World.js            agrupa la escena en las coordenadas del glb
      Escaparate.js       escaparate_2.glb: texturas de poster y letreros, flotación de los Skates
      Michelle.js         personaje animado frente al "marco"
      Mirror.js           espejo con FBO (sin usar en esta escena)
```

## Orden del tick

1. `World` (flotación, animación) y `View` (controles)
2. `Rendering` renderiza el frame final
