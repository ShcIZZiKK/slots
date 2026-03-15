import './styles/style.css'
import '@esotericsoftware/spine-pixi-v7'
import {SlotGame} from './scripts/SlotGame.ts'

const appRoot = document.querySelector<HTMLDivElement>('#app')

if (!appRoot) {
    throw new Error('Root element #app not found')
}

SlotGame.create(appRoot).catch((error) => {
    console.error('Failed to initialize slot game', error)
})
