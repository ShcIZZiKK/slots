import {
    Application,
    Container,
    Graphics,
    Sprite,
    Texture
} from "pixi.js"
import {ROW_HEIGHT, REEL_VIEW_HEIGHT, SYMBOL_SIZE} from "./settings.ts"

export class Reel {
    public container = new Container()
    private symbolsContainer = new Container()
    private app: Application
    private strip: number[]
    private textures: Texture[]
    /** Все слоты ленты созданы заранее, текстуры не меняются во время спина */
    private symbols: Sprite[] = []
    /** Смещение ленты по Y (прокрутка); при спинe только меняется он */
    private scrollOffset = 0

    static createReels(_panel: Graphics): void {}

    /** Вертикальный центр видимой области барабана в локальных координатах container (для центрирования на панели) */
    static getVisibleCenterY(panelHeight: number): number {
        return panelHeight / 2
    }

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

    private panelHeight: number

    private static readonly REEL_WIDTH = 110

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
        this.symbolsContainer.y = panelCenterY - visibleCenterY

        const centerX = Reel.REEL_WIDTH / 2
        const len = this.strip.length

        // Заранее создаём все слоты ленты по strip — без генерации на лету
        for (let i = 0; i < len; i++) {
            const texture = this.textures[this.strip[i]]
            const s = new Sprite(texture)
            s.anchor.set(0.5)
            s.width = SYMBOL_SIZE * 0.9
            s.height = SYMBOL_SIZE * 0.9
            s.x = centerX
            s.y = i * ROW_HEIGHT
            this.symbolsContainer.addChild(s)
            this.symbols.push(s)
        }

        this.container.addChild(this.symbolsContainer)
        this.applyScrollOffset()
    }

    /** Длина одного цикла ленты (пикселей) */
    private get cycle(): number {
        return this.strip.length * ROW_HEIGHT
    }

    /** Выставить Y всем слотам по текущему scrollOffset; позиции по модулю цикла — лента всегда заполняет экран */
    private applyScrollOffset() {
        const len = this.symbols.length
        const cycle = this.cycle
        for (let i = 0; i < len; i++) {
            const y = (i * ROW_HEIGHT + this.scrollOffset) % cycle
            this.symbols[i].y = y < 0 ? y + cycle : y
        }
        // Порядок отрисовки по Y — сортируем копию, не сам массив (symbols[i] должен соответствовать strip[i])
        const byY = [...this.symbols].sort((a, b) => a.y - b.y)
        byY.forEach((s, i) => this.symbolsContainer.setChildIndex(s, i))
    }

    /** Пикселей в миллисекунду (~2 с на 3 оборота) */
    private static readonly SPIN_SPEED_PX_MS = 165 / 80

    spinTo(stop: number, done: () => void) {
        const len = this.strip.length
        const cycle = len * ROW_HEIGHT
        const centerRowY = 2 * ROW_HEIGHT
        const minWraps = 3

        // Целевое смещение (в [0, cycle)): по центральной линии должен быть strip[stop+2]
        const targetOffset =
            (centerRowY - (stop + 2) * ROW_HEIGHT + cycle) % cycle

        let wrapCount = 0

        const tickerFn = (deltaTime: number) => {
            // Pixi 7 ticker passes deltaTime (~1 per frame), not ms.
            const raw = (deltaTime > 0 && deltaTime < 100) ? deltaTime * (1000 / 60) : 16
            const deltaMs = Math.min(Math.max(raw, 8), 40)
            const move = Reel.SPIN_SPEED_PX_MS * deltaMs

            // Прокрутка вниз — увеличиваем смещение
            this.scrollOffset += move

            if (this.scrollOffset >= cycle) {
                this.scrollOffset -= cycle
                wrapCount++
            }

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