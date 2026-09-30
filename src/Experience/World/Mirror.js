import * as THREE from 'three/webgpu'
import { color, Fn, positionWorld, texture, uniform, vec2, vec4 } from 'three/tsl'
import { Experience } from '../Experience.js'

const _normal = new THREE.Vector3()
const _mirrorPosition = new THREE.Vector3()
const _cameraPosition = new THREE.Vector3()
const _rotation = new THREE.Matrix4()
const _lookAt = new THREE.Vector3()
const _target = new THREE.Vector3()
const _view = new THREE.Vector3()
const _plane = new THREE.Plane()
const _clipPlane = new THREE.Vector4()
const _q = new THREE.Vector4()
const _toCenter = new THREE.Vector3()

export class Mirror
{
    constructor(mesh)
    {
        this.experience = Experience.getInstance()
        this.mesh = mesh

        this.enabled = true
        this.offset = 0.2
        this.resolution = this.experience.quality.reflection
        this.mixStrength = uniform(2.8)
        this.tint = uniform(color('#ffffff'))

        this.setLocalNormal()
        this.setRenderTarget()
        this.setMaterial()
        this.setDebug()

        this.experience.ticker.events.on('tick', () => this.update(), 900)
        this.experience.viewport.events.on('change', () => this.resize())
    }

    /**
     * The glass faces the room: pick the local Z direction that points to the scene center
     */
    setLocalNormal()
    {
        this.mesh.updateWorldMatrix(true, false)

        _normal.set(0, 0, 1).transformDirection(this.mesh.matrixWorld)
        _mirrorPosition.setFromMatrixPosition(this.mesh.matrixWorld)
        _toCenter.set(0, _mirrorPosition.y, 0).sub(_mirrorPosition)

        this.localNormal = new THREE.Vector3(0, 0, _normal.dot(_toCenter) >= 0 ? 1 : - 1)
    }

    setRenderTarget()
    {
        this.renderTarget = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType })
        this.renderTarget.texture.name = 'mirrorFBO'
        this.resize()

        this.camera = new THREE.PerspectiveCamera()

        this.textureMatrix = uniform(new THREE.Matrix4())
    }

    resize()
    {
        const ratio = this.experience.viewport.ratio
        const resolution = Number(this.resolution)
        const width = ratio >= 1 ? Math.round(resolution * ratio) : resolution
        const height = ratio >= 1 ? resolution : Math.round(resolution / ratio)

        this.renderTarget.setSize(width, height)
    }

    setMaterial()
    {
        const reflectionUv = Fn(() =>
        {
            const projected = this.textureMatrix.mul(vec4(positionWorld, 1))
            const uv = projected.xy.div(projected.w)

            // Render target textures are sampled with a top-left origin
            return vec2(uv.x, uv.y.oneMinus())
        })

        const reflection = texture(this.renderTarget.texture, reflectionUv())

        this.material = new THREE.MeshStandardNodeMaterial({
            roughness: 0.4,
            metalness: 0.8,
        })
        this.material.colorNode = this.tint.mul(reflection.rgb).mul(this.mixStrength)

        this.mesh.material = this.material
        this.mesh.castShadow = true
        this.mesh.receiveShadow = true
    }

    update()
    {
        if(!this.enabled)
            return

        const renderer = this.experience.rendering.renderer
        const scene = this.experience.scene
        const camera = this.experience.view.camera

        this.mesh.updateWorldMatrix(true, false)
        camera.updateMatrixWorld()

        _mirrorPosition.setFromMatrixPosition(this.mesh.matrixWorld)
        _cameraPosition.setFromMatrixPosition(camera.matrixWorld)

        _rotation.extractRotation(this.mesh.matrixWorld)
        _normal.copy(this.localNormal).applyMatrix4(_rotation)

        _view.subVectors(_mirrorPosition, _cameraPosition)

        // Camera behind the mirror
        if(_view.dot(_normal) > 0)
            return

        // Reflected camera position
        _view.reflect(_normal).negate()
        _view.add(_mirrorPosition)

        // Reflected look-at target
        _rotation.extractRotation(camera.matrixWorld)
        _lookAt.set(0, 0, - 1).applyMatrix4(_rotation).add(_cameraPosition)

        _target.subVectors(_mirrorPosition, _lookAt)
        _target.reflect(_normal).negate()
        _target.add(_mirrorPosition)

        this.camera.coordinateSystem = camera.coordinateSystem
        this.camera.position.copy(_view)
        this.camera.up.set(0, 1, 0).applyMatrix4(_rotation).reflect(_normal)
        this.camera.lookAt(_target)
        this.camera.near = camera.near
        this.camera.far = camera.far
        this.camera.updateMatrixWorld()
        this.camera.projectionMatrix.copy(camera.projectionMatrix)
        this.camera.projectionMatrixInverse.copy(camera.projectionMatrixInverse)

        // World position -> reflection texture UV
        this.textureMatrix.value.set(
            0.5, 0.0, 0.0, 0.5,
            0.0, 0.5, 0.0, 0.5,
            0.0, 0.0, 0.5, 0.5,
            0.0, 0.0, 0.0, 1.0
        )
        this.textureMatrix.value.multiply(this.camera.projectionMatrix)
        this.textureMatrix.value.multiply(this.camera.matrixWorldInverse)

        // Oblique near plane clipping (http://www.terathon.com/lengyel/Lengyel-Oblique.pdf)
        // so geometry behind the mirror doesn't end up in the reflection
        _plane.setFromNormalAndCoplanarPoint(_normal, _mirrorPosition)
        _plane.constant -= this.offset
        _plane.applyMatrix4(this.camera.matrixWorldInverse)

        _clipPlane.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant)

        const projection = this.camera.projectionMatrix
        _q.x = (Math.sign(_clipPlane.x) + projection.elements[8]) / projection.elements[0]
        _q.y = (Math.sign(_clipPlane.y) + projection.elements[9]) / projection.elements[5]
        _q.z = - 1.0
        _q.w = (1.0 + projection.elements[10]) / projection.elements[14]

        _clipPlane.multiplyScalar(1.0 / _clipPlane.dot(_q))

        projection.elements[2] = _clipPlane.x
        projection.elements[6] = _clipPlane.y
        projection.elements[10] = renderer.coordinateSystem === THREE.WebGPUCoordinateSystem ? _clipPlane.z : _clipPlane.z + 1.0
        projection.elements[14] = _clipPlane.w
        this.camera.projectionMatrixInverse.copy(projection).invert()

        // Render the scene from the reflected camera into the FBO
        const overlay = this.experience.overlay.mesh
        const overlayVisible = overlay.visible
        const currentTarget = renderer.getRenderTarget()

        this.mesh.visible = false
        overlay.visible = false

        renderer.setRenderTarget(this.renderTarget)
        renderer.render(scene, this.camera)
        renderer.setRenderTarget(currentTarget)

        this.mesh.visible = true
        overlay.visible = overlayVisible
    }

    setDebug()
    {
        const parameters = this.experience.rendering.createParameters('Mirror')

        if(!parameters)
            return

        parameters.add(this, 'enabled')
        parameters.add(this.mixStrength, 'value', 0, 6, 0.01).name('mixStrength')
        parameters.add(this, 'offset', - 0.5, 0.5, 0.001).name('reflectorOffset')
        parameters.add(this.material, 'roughness', 0, 1, 0.01)
        parameters.add(this.material, 'metalness', 0, 1, 0.01)
        parameters.add(this, 'resolution', { '256': 256, '512': 512, '1024': 1024, '2048': 2048 }).onChange(() => this.resize())
    }
}
