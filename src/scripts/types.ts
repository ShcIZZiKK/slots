/** Результат одного спина */
export type SpinResult = {
    /** Индексы остановки для каждого барабана */
    stopPositions: number[]
    /** Символы по барабанам и рядам */
    symbols: number[][]
    /** Сумма выигрыша */
    win: number
}
