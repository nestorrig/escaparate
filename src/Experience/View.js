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
        this.controls.minAzimuthAngle = - Math.PI / 4
        this.controls.maxAzimuthAngle = Math.PI / 4
        this.controls.minPolarAngle = Math.PI / 4
        this.controls.maxPolarAngle = Math.PI / 1.9
        this.controls.minDistance = isMobile ? 8 : 5
        this.controls.maxDistance = isMobile ? 16 : 10

        this.facadeZ = 0.85

        this.experience.ticker.events.on('tick', () => this.controls.update(this.experience.ticker.delta), 1)
        this.experience.viewport.events.on('change', () => this.resize())
    }

    /**
     * Uses the cameras authored in the glb: the first one on desktop, the second (further away) on mobile.
     * The orbit target is where the camera's forward ray reaches the facade depth.
     */
    setFromCameras(cameras)
    {
        const source = (this.experience.quality.isMobile && cameras[1]) || cameras[0]

        if(!source)
            return

        source.updateWorldMatrix(true, false)

        const position = source.getWorldPosition(new THREE.Vector3())
        const forward = source.getWorldDirection(new THREE.Vector3())
        const distance = forward.z < 0 ? (position.z - this.facadeZ) / - forward.z : 5

        this.camera.position.copy(position)
        this.controls.target.copy(position).addScaledVector(forward, distance)

        if(source.isPerspectiveCamera)
            this.camera.fov = source.fov

        this.camera.updateProjectionMatrix()

        const radius = position.distanceTo(this.controls.target)
        this.controls.minDistance = radius * 0.6
        this.controls.maxDistance = radius * 1.5
        this.controls.update()
    }

    resize()
    {
        this.camera.aspect = this.experience.viewport.ratio
        this.camera.updateProjectionMatrix()
    }
}
