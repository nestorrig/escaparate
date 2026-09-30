import * as THREE from 'three/webgpu'
import { Inspector } from 'three/addons/inspector/Inspector.js'
import { Experience } from './Experience.js'

export class Rendering
{
    constructor()
    {
        this.experience = Experience.getInstance()
    }

    async setRenderer()
    {
        this.renderer = new THREE.WebGPURenderer({
            canvas: this.experience.canvasElement,
            powerPreference: 'high-performance',
            antialias: this.experience.quality.antialias,
        })
        this.renderer.setSize(this.experience.viewport.width, this.experience.viewport.height)
        this.renderer.setPixelRatio(this.experience.viewport.pixelRatio)
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping
        this.renderer.outputColorSpace = THREE.SRGBColorSpace
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFShadowMap

        if(location.hash.match(/inspector/i))
        {
            this.inspector = new Inspector()
            this.renderer.inspector = this.inspector
        }

        this.renderer.setAnimationLoop((elapsed) => this.experience.ticker.update(elapsed))

        return this.renderer.init()
    }

    /**
     * Returns an Inspector parameters group, or null when the inspector is disabled
     */
    createParameters(name)
    {
        return this.inspector ? this.inspector.createParameters(name) : null
    }

    start()
    {
        this.experience.ticker.events.on('tick', () => this.render(), 998)
        this.experience.viewport.events.on('change', () => this.resize())
    }

    resize()
    {
        this.renderer.setSize(this.experience.viewport.width, this.experience.viewport.height)
        this.renderer.setPixelRatio(this.experience.viewport.pixelRatio)
    }

    render()
    {
        this.renderer.render(this.experience.scene, this.experience.view.camera)
    }
}
