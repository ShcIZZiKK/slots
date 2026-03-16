import type {SpinResult} from "./types.ts"
import {REEL_STRIPS, REEL_COUNT, AWARDS_SIZE} from "./settings.ts"

/**
 * Движок логики слотов: случайная остановка барабанов и расчёт выигрыша по центральной линии.
 */
export class SlotEngine {
    /**
     * Выполняет один спин: выбирает случайные позиции остановки для каждого барабана и считает выигрыш
     * @returns Результат спина (позиции, символы по рядам, сумма выигрыша)
     */
    spin(): SpinResult {
        const stopPositions: number[] = []
        const symbols: number[][] = []

        for (let reelIndex = 0; reelIndex < REEL_COUNT; reelIndex++) {
            const strip = REEL_STRIPS[reelIndex]
            const length = strip.length
            const stop = Math.floor(Math.random() * length)

            stopPositions.push(stop)

            // Ряды как на барабане: [0] = верх, [1] = центр (линия выигрыша), [2] = низ
            symbols.push([
                strip[(stop + 1) % length],
                strip[(stop + 2) % length],
                strip[(stop + 3) % length]
            ])
        }

        let win = 0

        const center0 = symbols[0][1]
        const center1 = symbols[1][1]
        const center2 = symbols[2][1]

        const awards = AWARDS_SIZE as Record<number, { doumble: number; triple: number }>

        // Рассчитываем выигрыш по центральной линии
        if (center0 === center1 && center1 === center2) {
            win = awards[center0].triple
        } else if (center0 === center1 || center1 === center2 || center0 === center2) {
            if (center0 === center1) {
                win = awards[center0].doumble
            } else if (center1 === center2) {
                win = awards[center1].doumble
            } else {
                win = awards[center0].doumble
            }
        }

        return {
            stopPositions,
            symbols,
            win
        }
    }
}