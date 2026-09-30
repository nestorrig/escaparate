import { Experience } from './Experience/Experience.js'

if(import.meta.env.DEV)
    window.experience = new Experience()
else
    new Experience()
