import type {SpinResult} from "./types.ts"
import {REEL_STRIPS, REEL_COUNT, AWARDS_SIZE} from "./settings.ts"

export class SlotEngine {
    spin(): SpinResult {
        const stopPositions: number[] = []
        const symbols: number[][] = []

        for (let r = 0; r < REEL_COUNT; r++) {
            const strip = REEL_STRIPS[r]
            const len = strip.length
            const stop = Math.floor(Math.random() * len)

            stopPositions.push(stop)

            // Ряды как на барабане: [0]=верх, [1]=центр (линия выигрыша), [2]=низ
            symbols.push([
                strip[(stop + 1) % len],
                strip[(stop + 2) % len],
                strip[(stop + 3) % len]
            ])
        }

        let win = 0

        const center0 = symbols[0][1]
        const center1 = symbols[1][1]
        const center2 = symbols[2][1]

        if (center0 === center1 && center1 === center2) {
            win = AWARDS_SIZE[center0]["triple"]
        } else if (center0 === center1 || center1 === center2 || center0 === center2) {
            if (center0 === center1) {
                win = AWARDS_SIZE[center0]["doumble"]
            } else if (center1 === center2) {
                win = AWARDS_SIZE[center1]["doumble"]
            } else {
                win = AWARDS_SIZE[center0]["doumble"]
            }
        }

        return {
            stopPositions,
            symbols,
            win
        }
    }
}