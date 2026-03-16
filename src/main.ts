/**
 * Точка входа слот-игры.
 */
import "./styles/style.css"
import "@esotericsoftware/spine-pixi-v7"
import { SlotGame } from "./scripts/SlotGame.ts"

const appRoot = document.querySelector<HTMLDivElement>("#app")
if (!appRoot) {
    throw new Error("Root element #app not found")
}

const loaderOverlay = document.getElementById("loader-overlay")
const loaderFill = document.getElementById("loader-fill")
const loaderLabel = document.getElementById("loader-label")

if (!loaderOverlay || !loaderFill || !loaderLabel) {
    console.warn("Loader elements not found")
}

function onProgress(percent: number, label: string) {
    if (loaderFill) {
        (loaderFill as HTMLElement).style.width = `${Math.min(100, Math.round(percent))}%`
    }

    if (loaderLabel) {
        loaderLabel.textContent = label
    }
}

SlotGame.create(appRoot, { onProgress })
    .then(() => {
        loaderOverlay?.classList.add("hidden")

        requestAnimationFrame(() => {
            setTimeout(() => loaderOverlay?.remove(), 500)
        })
    })
    .catch((error) => {
        console.error("Failed to initialize slot game", error)

        if (loaderLabel) {
            loaderLabel.textContent = "Ошибка загрузки"
        }
    })
