export default {
    root: 'src/',
    publicDir: '../public/',
    base: './',
    server:
    {
        host: true,
        open: true
    },
    build:
    {
        outDir: '../dist',
        emptyOutDir: true,
        sourcemap: false,
        target: 'esnext'
    }
}
