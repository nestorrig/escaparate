import * as THREE from 'three/webgpu'
import { Experience } from '../Experience.js'
import { Escaparate } from './Escaparate.js'
import { Michelle } from './Michelle.js'

export class World
{
    constructor()
    {
        this.experience = Experience.getInstance()

        this.group = new THREE.Group()
        this.experience.scene.add(this.group)

        this.escaparate = new Escaparate(this.group)
        this.michelle = new Michelle(this.group)

        this.center()
    }

    center()
    {
        this.group.updateMatrixWorld(true)

        const box = new THREE.Box3().setFromObject(this.group)
        const center = box.getCenter(new THREE.Vector3())
        this.group.position.sub(center)
    }
}
