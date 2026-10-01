import * as THREE from 'three/webgpu'
import { Experience } from '../Experience.js'

const FLOATS = [
    { speed: 1.2, rotationIntensity: 0.3, floatIntensity: 0.6, floatingRange: [ - 0.07, 0.07 ] },
    { speed: 1.6, rotationIntensity: 0.25, floatIntensity: 0.65, floatingRange: [ - 0.08, 0.08 ] },
    { speed: 1.35, rotationIntensity: 0.35, floatIntensity: 0.55, floatingRange: [ - 0.065, 0.065 ] },
]

export class Escaparate
{
    constructor(parent)
    {
        this.experience = Experience.getInstance()

        const gltf = this.experience.resources.escaparateModel

        this.model = gltf.scene
        parent.add(this.model)

        this.cameras = gltf.cameras ?? []

        this.setMeshes()
        this.setTextures()
        this.setFloats()

        this.anchors = {
            poster: this.poster,
            movil: this.skates[1],
        }

        this.experience.ticker.events.on('tick', () => this.update())
    }

    setMeshes()
    {
        this.model.traverse((child) =>
        {
            if(!child.isMesh)
                return

            child.receiveShadow = true
        })

        // Each spot redraws its casters every frame, so only what sits under the spots casts shadows
        for(const name of [ 'Skates', 'Cubos' ])
            this.model.getObjectByName(name).traverse((child) =>
            {
                if(child.isMesh)
                    child.castShadow = true
            })

        this.poster = this.model.getObjectByName('poster')
        this.letrero = this.model.getObjectByName('letrero')
        this.letreroBig = this.model.getObjectByName('letrero-big')
        this.frame = this.model.getObjectByName('marco')
        this.lamps = [ 'lampara', 'lampara-small', 'lampara-small1' ].map((name) => this.model.getObjectByName(name))
        this.skates = this.model.getObjectByName('Skates').children.filter((child) => child.isMesh)

        this.spots = this.model.getObjectByName('spots').children.map((group) => ({
            group,
            disc: group.children.find((child) => child.name.startsWith('Disco')),
        }))
    }

    /**
     * poster and letreros share their material with the walls in the glb, so each one gets its own
     */
    setTextures()
    {
        const resources = this.experience.resources

        this.applyTexture(this.poster, resources.posterTexture)
        this.applyTexture(this.letrero, resources.letreroTexture)
        this.applyTexture(this.letreroBig, resources.letreroBigTexture)
    }

    applyTexture(mesh, texture)
    {
        this.normalizeUvs(mesh.geometry)

        mesh.material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 1,
            metalness: 0,
        })
    }

    /**
     * The glb UVs of these planes are a sub-region of a shared unwrap; stretch them to 0-1 so the whole image fits
     */
    normalizeUvs(geometry)
    {
        const uv = geometry.attributes.uv
        const min = new THREE.Vector2(Infinity, Infinity)
        const max = new THREE.Vector2(- Infinity, - Infinity)
        const point = new THREE.Vector2()

        for(let i = 0; i < uv.count; i++)
        {
            point.fromBufferAttribute(uv, i)
            min.min(point)
            max.max(point)
        }

        const size = max.clone().sub(min)

        for(let i = 0; i < uv.count; i++)
        {
            point.fromBufferAttribute(uv, i).sub(min).divide(size)
            uv.setXY(i, point.x, point.y)
        }

        uv.needsUpdate = true
    }

    setFloats()
    {
        this.floats = this.skates.map((skate, index) => ({
            object: skate,
            ...FLOATS[index % FLOATS.length],
            offset: Math.random() * 10000,
            basePosition: skate.position.clone(),
            baseQuaternion: skate.quaternion.clone(),
            euler: new THREE.Euler(),
            quaternion: new THREE.Quaternion(),
        }))
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
