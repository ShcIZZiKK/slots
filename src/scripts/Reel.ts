import {
    Application,
    Container,
    Graphics,
    Sprite,
    Texture
} from "pixi.js"
import {ROW_HEIGHT, REEL_VIEW_HEIGHT, SYMBOL_SIZE} from "./settings.ts"

/**
 * Один барабан слотов: лента символов с маской, прокрутка до заданной остановки
 */
export class Reel {
    /** Контейнер барабана */
    public container = new Container()
    /** Контейнер символов */
    private symbolsContainer = new Container()
    private app: Application
    /** Индексы символов ленты */
    private strip: number[]
    /** Текстуры символов */
    private textures: Texture[]
    /** Слоты символов */
    private symbols: Sprite[] = []
    /** Смещение ленты по Y (прокрутка) */
    private scrollOffset = 0
    /** Высота панели */
    private panelHeight: number
    /** Скорость прокрутки (пикселей/мс) */
    private static readonly SPIN_SPEED_PX_MS = 165 / 80

    /** Ширина барабана */
    private static readonly REEL_WIDTH = 110

    /**
     * Вертикальный центр видимой области барабана в локальных координатах container (для центрирования на панели)
     * @param panelHeight — высота панели в пикселях
     * @returns Y центра видимой области
     */
    static getVisibleCenterY(panelHeight: number): number {
        return panelHeight / 2
    }

    /**
     * @param app — экземпляр Pixi Application
     * @param textures — массив текстур символов (индекс = индекс символа)
     * @param strip — лента: массив индексов символов по порядку
     * @param options.panelHeight — высота панели для центрирования видимой области
     */
    constructor(
        app: Application,
        textures: Texture[],
        strip: number[],
        options?: { panelHeight: number }
    ) {
        this.app = app
        this.textures = textures
        this.strip = strip
        this.panelHeight = options?.panelHeight ?? 360

        this.create()
    }

    /** Создаёт ленту символов */
    private create() {
        const maskY = ROW_HEIGHT - SYMBOL_SIZE / 2
        const effectiveViewHeight = REEL_VIEW_HEIGHT
        const mask = new Graphics()

        mask.beginFill(0xffffff)
        mask.drawRect(0, maskY, Reel.REEL_WIDTH, effectiveViewHeight)
        mask.endFill()

        this.symbolsContainer.addChild(mask)
        this.symbolsContainer.mask = mask

        const panelCenterY = this.panelHeight / 2
        const visibleCenterY = maskY + effectiveViewHeight / 2

        // Центрирование ленты символов на панели
        this.symbolsContainer.y = panelCenterY - visibleCenterY

        const centerX = Reel.REEL_WIDTH / 2
        const len = this.strip.length

        // Заранее создаём все слоты ленты
        for (let i = 0; i < len; i++) {
            const texture = this.textures[this.strip[i]]
            const sprite = new Sprite(texture)

            sprite.anchor.set(0.5)
            sprite.width = SYMBOL_SIZE * 0.9
            sprite.height = SYMBOL_SIZE * 0.9
            sprite.x = centerX
            sprite.y = i * ROW_HEIGHT
            
            this.symbolsContainer.addChild(sprite)
            this.symbols.push(sprite)
        }

        this.container.addChild(this.symbolsContainer)
        this.applyScrollOffset()
    }

    /** Длина одного цикла ленты (пикселей) */
    private get cycle(): number {
        return this.strip.length * ROW_HEIGHT
    }

    /** Выставляет Y всем слотам по текущему scrollOffset */
    private applyScrollOffset() {
        const length = this.symbols.length
        const cycle = this.cycle

        for (let i = 0; i < length; i++) {
            const y = (i * ROW_HEIGHT + this.scrollOffset) % cycle

            this.symbols[i].y = y < 0 ? y + cycle : y
        }

        // Порядок отрисовки по Y
        const symbolsByY = [...this.symbols].sort((a, b) => a.y - b.y)

        symbolsByY.forEach((symbol, index) => this.symbolsContainer.setChildIndex(symbol, index))
    }

    /**
     * Запускает прокрутку до остановки на заданном индексе по центральной линии
     * @param stop — индекс символа в strip, который должен оказаться на центральной линии после остановки (учитывается strip[stop+2])
     * @param done — колбэк по завершении анимации
     */
    spinTo(stop: number, done: () => void) {
        const length = this.strip.length
        const cycle = length * ROW_HEIGHT
        const centerRowY = 2 * ROW_HEIGHT
        const minWraps = 3
        let wrapCount = 0

        // Целевое смещение по центральной линии должен быть strip[stop+2]
        const targetOffset = (centerRowY - (stop + 2) * ROW_HEIGHT + cycle) % cycle

        const tickerFn = (deltaTime: number) => {
            // Pixi 7 тикер передаёт deltaTime (~1 за кадр), не в мс. Преобразуем в мс
            const raw = (deltaTime > 0 && deltaTime < 100) ? deltaTime * (1000 / 60) : 16
            const deltaMs = Math.min(Math.max(raw, 8), 40)
            const move = Reel.SPIN_SPEED_PX_MS * deltaMs

            // Прокрутка вниз — увеличиваем смещение
            this.scrollOffset += move

            if (this.scrollOffset >= cycle) {
                this.scrollOffset -= cycle

                // Счётчик оборотов
                wrapCount++
            }

            // Выставляем Y всем слотам по текущему scrollOffset
            this.applyScrollOffset()

            const reached = wrapCount >= minWraps && this.scrollOffset >= targetOffset - 0.5

            if (reached) {
                this.app.ticker.remove(tickerFn)
                this.scrollOffset = targetOffset
                this.applyScrollOffset()
                
                done()
            }
        }

        this.app.ticker.add(tickerFn)
    }
}