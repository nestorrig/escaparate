import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Experience } from './Experience.js'

export class View
{
    constructor()
    {
        this.experience = Experience.getInstance()

        const isMobile = this.experience.quality.isMobile

        this.camera = new THREE.PerspectiveCamera(45, this.experience.viewport.ratio, 0.1, 100)
        this.camera.position.set(0, 1.6, isMobile ? 12 : 5.5)
        this.experience.scene.add(this.camera)

        this.controls = new OrbitControls(this.camera, this.experience.canvasElement)
        this.controls.enableDamping = true
        this.controls.enablePan = false
        this.controls.minAzimuthAngle = - Math.PI / 12
        this.controls.maxAzimuthAngle = Math.PI / 2
        this.controls.minPolarAngle = Math.PI / 4
        this.controls.maxPolarAngle = Math.PI / 1.9
        this.controls.minDistance = isMobile ? 8 : 5
        this.controls.maxDistance = isMobile ? 16 : 10

        this.experience.ticker.events.on('tick', () => this.controls.update(this.experience.ticker.delta), 1)
        this.experience.viewport.events.on('change', () => this.resize())
    }

    resize()
    {
        this.camera.aspect = this.experience.viewport.ratio
        this.camera.updateProjectionMatrix()
    }
}
