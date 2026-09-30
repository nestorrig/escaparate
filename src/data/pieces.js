/**
 * anchor: name of the anchor registered by the Escaparate
 * position: local position relative to that anchor
 */
export default [
    {
        id: 'poster',
        label: 'Poster',
        title: 'Poster',
        author: 'Diego Herrera',
        detail: 'Pieza gráfica del escaparate. Una abstraccion geometrica de un pato.',
        image: './detalles/imagen.png',
        anchor: 'poster',
        position: [ 0.1, 0.55, 0.8 ],
    },
    {
        id: 'movil',
        label: 'Móvil',
        title: 'Móvil',
        author: 'Porfirio Díaz',
        detail: 'Producto en exhibición sobre el mueble. El móvil de madera hecho a partir de la abstraccion del poster.',
        image: './detalles/modelo.jpg',
        anchor: 'movil',
        position: [ 0, 0.28, 0 ],
    },
]
