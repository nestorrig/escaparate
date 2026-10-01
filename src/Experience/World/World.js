import * as THREE from 'three/webgpu'
import { Experience } from '../Experience.js'
import { Escaparate } from './Escaparate.js'
import { Michelle } from './Michelle.js'

export class World
{
    constructor()
    {
        this.experience = Experience.getInstance()

        // Kept in the glb coordinates so the cameras authored in the model stay valid
        this.group = new THREE.Group()
        this.experience.scene.add(this.group)

        this.escaparate = new Escaparate(this.group)
        this.michelle = new Michelle(this.escaparate.frame)
    }
}
