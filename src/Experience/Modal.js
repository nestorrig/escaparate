import { Events } from './Events.js'

export class Modal
{
    constructor()
    {
        this.events = new Events()
        this.isOpen = false

        this.element = document.querySelector('.piece-modal-backdrop')
        this.panel = this.element.querySelector('.piece-modal-panel')
        this.image = this.element.querySelector('.piece-modal-image')
        this.label = this.element.querySelector('.piece-modal-label')
        this.author = this.element.querySelector('.piece-modal-author span')
        this.detail = this.element.querySelector('.piece-modal-detail')
        this.closeButton = this.element.querySelector('.piece-modal-close')

        this.element.addEventListener('click', () => this.close())
        this.panel.addEventListener('click', (event) => event.stopPropagation())
        this.closeButton.addEventListener('click', () => this.close())

        window.addEventListener('keydown', (event) =>
        {
            if(event.key === 'Escape')
                this.close()
        })
    }

    open(piece)
    {
        this.image.hidden = !piece.image
        this.image.src = piece.image ?? ''
        this.image.alt = piece.title
        this.label.textContent = piece.label
        this.author.textContent = piece.author
        this.detail.textContent = piece.detail

        this.isOpen = true
        this.events.trigger('open', piece)

        // Two frames so the content is laid out before the transition starts
        requestAnimationFrame(() =>
        {
            requestAnimationFrame(() => this.element.classList.add('is-open'))
        })
    }

    close()
    {
        if(!this.isOpen)
            return

        this.isOpen = false
        this.element.classList.remove('is-open')
        this.events.trigger('close')
    }
}
