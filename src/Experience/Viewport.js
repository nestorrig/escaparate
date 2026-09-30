import { Events } from './Events.js'
import { Experience } from './Experience.js'

export class Viewport
{
    constructor(domElement)
    {
        this.experience = Experience.getInstance()
        this.domElement = domElement
        this.events = new Events()

        this.measure()

        window.addEventListener('resize', () =>
        {
            this.measure()
            this.events.trigger('change')
        })
    }

    measure()
    {
        this.width = window.innerWidth
        this.height = window.innerHeight
        this.ratio = this.width / this.height
        this.pixelRatio = Math.min(window.devicePixelRatio, this.experience.quality.maxPixelRatio)
    }
}
