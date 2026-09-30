import * as THREE from 'three/webgpu'
import { Experience } from '../Experience.js'
import { Mirror } from './Mirror.js'

const FLOATS = [
    { speed: 1.2, rotationIntensity: 0.12, floatIntensity: 0.35, floatingRange: [ - 0.04, 0.04 ] },
    { speed: 1.6, rotationIntensity: 0.1, floatIntensity: 0.4, floatingRange: [ - 0.05, 0.05 ] },
    { speed: 1.35, rotationIntensity: 0.14, floatIntensity: 0.3, floatingRange: [ - 0.035, 0.035 ] },
]

export class Escaparate
{
    constructor(parent)
    {
        this.experience = Experience.getInstance()

        this.group = new THREE.Group()
        this.group.position.set(0, 0.3, 0)
        parent.add(this.group)

        this.model = this.experience.resources.escaparateModel.scene
        this.group.add(this.model)

        this.setMeshes()
        this.center()
        this.setFloats()
        this.setMirror()

        this.anchors = {
            poster: this.images[1].parent,
            movil: this.ducks[1],
        }

        this.experience.ticker.events.on('tick', () => this.update())
    }

    setMeshes()
    {
        const alphaTexture = this.experience.resources.alphaTexture

        this.images = []

        this.model.traverse((child) =>
        {
            if(!child.isMesh)
                return

            child.castShadow = true
            child.receiveShadow = true

            // The sign texture is authored upside down in the glb
            if(child.name.startsWith('LETRERO'))
                child.scale.y = - 1

            if(child.name.startsWith('IMAGEN'))
            {
                child.material.alphaMap = alphaTexture
                child.material.transparent = true
                child.material.needsUpdate = true
                this.images.push(child)
            }
        })

        this.ducks = this.model.children.filter((child) => child.name.startsWith('pato'))
        this.glass = this.model.getObjectByName('VIDRIO')
    }

    center()
    {
        this.model.updateMatrixWorld(true)

        const box = new THREE.Box3().setFromObject(this.model)
        const center = box.getCenter(new THREE.Vector3())

        this.model.worldToLocal(center)
        this.model.position.sub(center)
    }

    setFloats()
    {
        this.floats = this.ducks.map((duck, index) => ({
            object: duck,
            ...FLOATS[index % FLOATS.length],
            offset: Math.random() * 10000,
            basePosition: duck.position.clone(),
            baseQuaternion: duck.quaternion.clone(),
            euler: new THREE.Euler(),
            quaternion: new THREE.Quaternion(),
        }))
    }

    setMirror()
    {
        this.mirror = new Mirror(this.glass)
    }

    update()
    {
        const elapsed = this.experience.ticker.elapsed

        for(const float of this.floats)
        {
            const t = (float.offset + elapsed) / 4 * float.speed
            const sin = Math.sin(t)

            float.euler.set(
                Math.cos(t) / 8 * float.rotationIntensity,
                sin / 8 * float.rotationIntensity,
                sin / 20 * float.rotationIntensity
            )
            float.quaternion.setFromEuler(float.euler)
            float.object.quaternion.copy(float.baseQuaternion).multiply(float.quaternion)

            const y = THREE.MathUtils.mapLinear(sin / 10, - 0.1, 0.1, float.floatingRange[0], float.floatingRange[1])
            float.object.position.copy(float.basePosition)
            float.object.position.y += y * float.floatIntensity
        }
    }
}
