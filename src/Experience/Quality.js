const TIERS = {
    1: { maxPixelRatio: 1.24, reflection: 256, shadows: 1024, antialias: false },
    2: { maxPixelRatio: 1.6, reflection: 512, shadows: 2048, antialias: true },
    3: { maxPixelRatio: 2, reflection: 1024, shadows: 4096, antialias: true },
}

export class Quality
{
    constructor()
    {
        this.isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
            || (navigator.maxTouchPoints > 1 && window.matchMedia('(pointer: coarse)').matches)

        const forced = Number(new URLSearchParams(location.search).get('quality'))

        if(TIERS[forced])
            this.tier = forced
        else if(this.isMobile)
            this.tier = 1
        else if(window.devicePixelRatio >= 2 && (navigator.hardwareConcurrency ?? 4) >= 8)
            this.tier = 3
        else
            this.tier = 2

        Object.assign(this, TIERS[this.tier])
    }
}
