import * as THREE from 'three/webgpu'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { Experience } from './Experience.js'

export class Lighting
{
    constructor()
    {
        this.experience = Experience.getInstance()

        this.setEnvironment()
        this.setAmbient()
        this.setDirectional()
        this.setDebug()
    }

    setEnvironment()
    {
        const pmrem = new THREE.PMREMGenerator(this.experience.rendering.renderer)
        this.environmentMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
        pmrem.dispose()

        this.experience.scene.environment = this.environmentMap
        this.experience.scene.environmentIntensity = 0.6
    }

    setAmbient()
    {
        this.ambient = new THREE.AmbientLight('#ffffff', 0.45)
        this.experience.scene.add(this.ambient)
    }

    setDirectional()
    {
        const shadowSize = this.experience.quality.shadows

        this.directional = new THREE.DirectionalLight('#ffffff', 1.4)
        this.directional.position.set(4, 6, 5)
        this.directional.castShadow = true
        this.directional.shadow.mapSize.set(shadowSize, shadowSize)
        this.directional.shadow.bias = - 0.0002
        this.directional.shadow.camera.near = 0.5
        this.directional.shadow.camera.far = 20
        this.directional.shadow.camera.left = - 6
        this.directional.shadow.camera.right = 6
        this.directional.shadow.camera.top = 6
        this.directional.shadow.camera.bottom = - 6
        this.experience.scene.add(this.directional, this.directional.target)
    }

    setDebug()
    {
        const parameters = this.experience.rendering.createParameters('Lighting')

        if(!parameters)
            return

        parameters.add(this.experience.scene, 'environmentIntensity', 0, 3, 0.01).name('environment')
        parameters.add(this.ambient, 'intensity', 0, 3, 0.01).name('ambient')
        parameters.add(this.directional, 'intensity', 0, 5, 0.01).name('directional')
        parameters.add(this.directional.position, 'x', - 10, 10, 0.1).name('directional x')
        parameters.add(this.directional.position, 'y', 0, 10, 0.1).name('directional y')
        parameters.add(this.directional.position, 'z', - 10, 10, 0.1).name('directional z')
        parameters.add(this.experience.rendering.renderer, 'toneMappingExposure', 0, 3, 0.01).name('exposure')
    }
}
