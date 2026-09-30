export class Events
{
    constructor()
    {
        this.callbacks = new Map()
    }

    on(name, callback, order = 0)
    {
        if(!this.callbacks.has(name))
            this.callbacks.set(name, [])

        const list = this.callbacks.get(name)
        list.push({ callback, order })
        list.sort((a, b) => a.order - b.order)

        return this
    }

    off(name, callback)
    {
        const list = this.callbacks.get(name)

        if(!list)
            return this

        if(callback)
            this.callbacks.set(name, list.filter((item) => item.callback !== callback))
        else
            this.callbacks.delete(name)

        return this
    }

    trigger(name, ...args)
    {
        const list = this.callbacks.get(name)

        if(!list)
            return this

        for(const item of [ ...list ])
            item.callback(...args)

        return this
    }
}
