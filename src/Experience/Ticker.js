import { Events } from './Events.js'

export class Ticker
{
    constructor()
    {
        this.elapsed = 0
        this.delta = 1 / 60
        this.maxDelta = 1 / 30
        this.started = false

        this.events = new Events()
    }

    update(elapsedMs)
    {
        const elapsed = elapsedMs / 1000

        this.delta = this.started ? Math.min(elapsed - this.elapsed, this.maxDelta) : 1 / 60
        this.elapsed = elapsed
        this.started = true

        this.events.trigger('tick')
    }
}
