import * as THREE from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Events } from './Events.js'

export class ResourcesLoader
{
    constructor()
    {
        this.events = new Events()
        this.loadingBarElement = document.querySelector('.loading-bar')

        this.manager = new THREE.LoadingManager(
            () =>
            {
                window.setTimeout(() =>
                {
                    this.loadingBarElement.classList.add('ended')
                    this.loadingBarElement.style.transform = ''
                    this.events.trigger('ended')
                }, 500)
            },
            (itemUrl, itemsLoaded, itemsTotal) =>
            {
                this.loadingBarElement.style.transform = `scaleX(${itemsLoaded / itemsTotal})`
            }
        )

        this.loaders = {
            gltf: new GLTFLoader(this.manager),
            texture: new THREE.TextureLoader(this.manager),
        }
    }

    /**
     * @param {Array<[string, string, 'gltf' | 'texture', Function?]>} files [ name, path, type, callback ]
     */
    async load(files)
    {
        const entries = await Promise.all(files.map(async ([ name, path, type, callback ]) =>
        {
            const resource = await this.loaders[type].loadAsync(path)

            if(callback)
                callback(resource)

            return [ name, resource ]
        }))

        return Object.fromEntries(entries)
    }
}
