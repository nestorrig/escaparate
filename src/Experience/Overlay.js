import * as THREE from 'three/webgpu'
import { positionGeometry, uniform, vec4 } from 'three/tsl'
import { gsap } from 'gsap'
import { Experience } from './Experience.js'

export class Overlay
{
    constructor()
    {
        this.experience = Experience.getInstance()

        this.alpha = uniform(1)

        const material = new THREE.MeshBasicNodeMaterial({
            transparent: true,
            depthTest: false,
            depthWrite: false,
        })
        material.vertexNode = vec4(positionGeometry.xy, 0, 1)
        material.colorNode = vec4(0, 0, 0, 1)
        material.opacityNode = this.alpha

        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
        this.mesh.frustumCulled = false
        this.mesh.renderOrder = 999
        this.experience.scene.add(this.mesh)
    }

    reveal()
    {
        gsap.to(this.alpha, {
            value: 0,
            duration: 3,
            delay: 1,
            onComplete: () =>
            {
                this.mesh.visible = false
            }
        })
    }
}
