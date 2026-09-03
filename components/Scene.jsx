"use client";

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { BakeShadows, Center, OrbitControls, Stage, Stats, useDetectGPU } from "@react-three/drei";
import { PCFShadowMap } from "three";
import { Escaparate } from "./Escaparate";
import { Michelle } from "./Michelle";

const GPU_QUALITY = {
  1: { dpr: 1.24, reflection: 256, shadows: 1024 },
  2: { dpr: 1.6, reflection: 512, shadows: 2048 },
  3: { dpr: 2, reflection: 1024, shadows: 2048 * 2 },
};

function SceneCanvas() {
  const gpu = useDetectGPU();
  const tier = gpu.tier === 0 || gpu.isMobile ? 1 : gpu.tier;
  const quality = GPU_QUALITY[tier] ?? GPU_QUALITY[1];
  const [piece, setPiece] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  function openPiece(data) {
    setPiece(data);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setModalOpen(true));
    });
  }

  function closePiece() {
    setModalOpen(false);
  }

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows={{ type: PCFShadowMap }}
        dpr={quality.dpr}
        camera={{ position: [0, 1.6, gpu.isMobile ? 12 : 5.5], fov: 45 }}
        gl={{ antialias: tier > 1 }}
      >
        <color attach="background" args={["#fc7f41"]} />
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[4, 6, 5]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[quality.shadows, quality.shadows]}
          shadow-bias={-0.0002}
          shadow-camera-near={0.5}
          shadow-camera-far={20}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
        />
        <Stats />
        <Suspense fallback={null}>
          <BakeShadows />
          <Stage intensity={-2} adjustCamera={false} >
            <Center position={[0, 0.3, 0]}>
              <Escaparate
                reflectionResolution={quality.reflection}
                onSelect={openPiece}
                hideAnnotations={modalOpen}
              />
            </Center>
            <Michelle />
          </Stage>
        </Suspense>
        <OrbitControls
          enableDamping
          makeDefault
          enablePan={false}
          minAzimuthAngle={-Math.PI / 12}
          maxAzimuthAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.9}
          minDistance={gpu.isMobile ? 8 : 5}
          maxDistance={gpu.isMobile ? 16 : 10}
        />
      </Canvas>

      {piece ? (
        <div
          className={`piece-modal-backdrop absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-4 ${modalOpen ? "is-open" : ""}`}
          onClick={closePiece}
          onTransitionEnd={(event) => {
            if (event.propertyName !== "opacity") return;
            if (event.target === event.currentTarget && !modalOpen) setPiece(null);
          }}
        >
          <div
            className="piece-modal-panel w-full max-w-lg overflow-hidden rounded-2xl  text-white"
            onClick={(event) => event.stopPropagation()}
          >
            {piece.image ? (
              <img src={piece.image} alt={piece.title} className="h-auto w-full object-cover" />
            ) : null}
            <div className="p-5 bg-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-600">{piece.label}</p>
              <p className="text-sm mt-2 text-black "><strong>Autor:</strong> {piece.author}</p>
              <p className="mt-2 text-sm leading-6 text-black">{piece.detail}</p>
              <button
                type="button"
                className="mt-4 rounded-full bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500/90"
                onClick={closePiece}
              >
                cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Scene() {
  return (
    <Suspense fallback={null}>
      <SceneCanvas />
    </Suspense>
  );
}
