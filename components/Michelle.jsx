'use client'

import { useEffect, useRef } from 'react'
import { ContactShadows, useGLTF, useAnimations } from '@react-three/drei'

export function Michelle(props) {
  const group = useRef()
  const { nodes, materials, animations } = useGLTF('/Michelle.glb')
  const { actions } = useAnimations(animations, group)

  useEffect(() => {
    const action = actions.SambaDance
    if (!action) return
    action.reset().fadeIn(0.2).play()
    return () => action.fadeOut(0.2)
  }, [actions])

  return (
    <>
      <group ref={group} {...props} dispose={null} position={[-0.6, -0.44, -0.5]}>
        <group name="Scene">
          <group name="Character" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
            <skinnedMesh
              name="Ch03"
              geometry={nodes.Ch03.geometry}
              material={materials.Ch03_Body}
              skeleton={nodes.Ch03.skeleton}
              castShadow={false}
              receiveShadow={false}
            />
            <primitive object={nodes.mixamorigHips} />
          </group>
        </group>
      </group>
      <ContactShadows
        position={[0, -0.44, 0]}
        opacity={0.55}
        scale={3}
        blur={2}
        far={1.6}
        resolution={256}
        color="#000000"
      />  </>
  )
}

useGLTF.preload('/Michelle.glb')
