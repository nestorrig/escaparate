"use client";

import { Html } from "@react-three/drei";

export function Annotation({
  label,
  title,
  author,
  detail,
  image,
  onSelect,
  hidden = false,
  position = [0, 0.35, 0],
}) {
  return (
    <Html
      position={position}
      center

      // distanceFactor={6}
      zIndexRange={[100, 0]}
    // occlude={false}
    >
      <button
        type="button"
        className={`annotation-btn cursor-pointer rounded-lg border text-orange-50 px-2 py-1 text-[8px] md:text-[11px] font-semibold uppercase tracking-wide bg-orange-500 shadow-lg hover:bg-white hover:text-black ${hidden ? "is-hidden" : ""}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.({
            id: label,
            label,
            author,
            title,
            detail,
            image,
          });
        }}
      >
        {label}
      </button>
    </Html>
  );
}
