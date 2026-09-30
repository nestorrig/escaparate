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
    Experience.js               singleton que crea y orquesta todos los módulos
    Events.js             eventos con orden de ejecución
    Ticker.js             loop (lo mueve renderer.setAnimationLoop)
    Viewport.js           tamaño y pixel ratio
    Quality.js            niveles de calidad según el dispositivo
    ResourcesLoader.js    GLTF y texturas + barra de carga
    Rendering.js          WebGPURenderer, sombras, Inspector
    View.js               cámara + OrbitControls
    Lighting.js           entorno (RoomEnvironment), luz ambiental y direccional
    Overlay.js            fade de entrada
    Annotations.js        puntos HTML proyectados con oclusión por raycast
    Modal.js              detalle de cada pieza
    World/
      World.js            agrupa y centra la escena
      Escaparate.js       modelo, alpha de los posters, flotación de los patos
      Mirror.js           espejo con FBO (RenderTarget + cámara reflejada)
      Michelle.js         personaje animado
```

## Orden del tick

1. `World` (flotación, animación) y `View` (controles)
2. `Mirror` renderiza la escena desde la cámara reflejada en su FBO
3. `Annotations` actualiza la posición y visibilidad de los puntos HTML
4. `Rendering` renderiza el frame final
