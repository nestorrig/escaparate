import * as THREE from 'three/webgpu'
import { Experience } from './Experience.js'
import pieces from '../data/pieces.js'

const _screenPosition = new THREE.Vector3()
const _cameraPosition = new THREE.Vector3()

export class Annotations
{
    constructor()
    {
        this.experience = Experience.getInstance()

        this.container = document.querySelector('.points')
        this.raycaster = new THREE.Raycaster()
        this.occluders = [ this.experience.world.escaparate.model ]

        this.points = pieces.map((piece, index) => this.createPoint(piece, index))

        this.experience.modal.events.on('open', () => this.setHidden(true))
        this.experience.modal.events.on('close', () => this.setHidden(false))

        this.experience.ticker.events.on('tick', () => this.update(), 950)
    }

    createPoint(piece, index)
    {
        const element = document.createElement('div')
        element.className = 'point'

        const label = document.createElement('button')
        label.type = 'button'
        label.className = 'label'
        label.textContent = index + 1
        label.setAttribute('aria-label', piece.title)
        label.addEventListener('pointerdown', (event) => event.stopPropagation())
        label.addEventListener('click', (event) =>
        {
            event.stopPropagation()
            this.experience.modal.open(piece)
        })

        const text = document.createElement('div')
        text.className = 'text'
        text.innerHTML = `<strong>${piece.label}</strong>${piece.detail}`

        element.append(label, text)
        this.container.append(element)

        const anchor = new THREE.Object3D()
        anchor.position.fromArray(piece.position)
        this.experience.world.escaparate.anchors[piece.anchor].add(anchor)

        return { piece, element, anchor, position: new THREE.Vector3() }
    }

    setHidden(hidden)
    {
        for(const point of this.points)
            point.element.classList.toggle('is-hidden', hidden)
    }

    update()
    {
        if(!this.experience.sceneReady)
            return

        const camera = this.experience.view.camera
        const { width, height } = this.experience.viewport

        camera.getWorldPosition(_cameraPosition)

        for(const point of this.points)
        {
            point.anchor.getWorldPosition(point.position)

            _screenPosition.copy(point.position).project(camera)

            this.raycaster.setFromCamera(_screenPosition, camera)
            const intersects = this.raycaster.intersectObjects(this.occluders, true)

            const behindCamera = _screenPosition.z > 1
            const occluded = behindCamera || (intersects.length > 0
                && intersects[0].distance < point.position.distanceTo(_cameraPosition))

            point.element.classList.toggle('visible', !occluded)

            const translateX = _screenPosition.x * width * 0.5
            const translateY = - _screenPosition.y * height * 0.5
            point.element.style.transform = `translate(${translateX}px, ${translateY}px)`
        }
    }
}
