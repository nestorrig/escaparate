import * as THREE from 'three/webgpu'

import { Events } from './Events.js'
import { Quality } from './Quality.js'
import { Ticker } from './Ticker.js'
import { Viewport } from './Viewport.js'
import { ResourcesLoader } from './ResourcesLoader.js'
import { Rendering } from './Rendering.js'
import { View } from './View.js'
import { Lighting } from './Lighting.js'
import { Overlay } from './Overlay.js'
import { World } from './World/World.js'
import { Modal } from './Modal.js'
import { Annotations } from './Annotations.js'

export class Experience
{
    static getInstance()
    {
        return Experience.instance
    }

    constructor()
    {
        if(Experience.instance)
            return Experience.instance

        Experience.instance = this

        this.init()
    }

    async init()
    {
        this.domElement = document.querySelector('.experience')
        this.canvasElement = this.domElement.querySelector('canvas.webgl')

        this.events = new Events()
        this.sceneReady = false

        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color('#fc7f41')

        this.quality = new Quality()
        this.ticker = new Ticker()
        this.viewport = new Viewport(this.domElement)
        this.resourcesLoader = new ResourcesLoader()
        this.rendering = new Rendering()
        await this.rendering.setRenderer()

        this.view = new View()
        this.overlay = new Overlay()
        this.rendering.start()

        this.resourcesLoader.events.on('ended', () =>
        {
            this.overlay.reveal()

            window.setTimeout(() =>
            {
                this.sceneReady = true
                this.events.trigger('ready')
            }, 1500)
        })

        this.resources = await this.resourcesLoader.load([
            [ 'escaparateModel', './escaparate_modelo.glb', 'gltf' ],
            [ 'michelleModel', './Michelle.glb', 'gltf' ],
            [ 'alphaTexture', './alpha.png', 'texture', (texture) =>
            {
                texture.colorSpace = THREE.NoColorSpace
                texture.flipY = false
                texture.wrapS = THREE.ClampToEdgeWrapping
                texture.wrapT = THREE.ClampToEdgeWrapping
            } ],
        ])

        this.lighting = new Lighting()
        this.world = new World()
        this.modal = new Modal()
        this.annotations = new Annotations()
    }
}
