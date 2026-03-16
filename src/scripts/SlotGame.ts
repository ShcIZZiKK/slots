import {
    Application,
    Container,
    Texture,
    Assets,
    Text,
    TextStyle,
    Sprite
} from "pixi.js"
import { TextureAtlas, AtlasAttachmentLoader, SkeletonJson } from "@esotericsoftware/spine-core"
import { SpineTexture } from "@esotericsoftware/spine-pixi-v7"
import { type SpinResult } from "./types.ts"
import { Reel } from "./Reel.ts"
import { SlotEngine } from "./SlotEngine.ts"
import "@esotericsoftware/spine-pixi-v7"
import { Character, type CharacterSpineAssets } from "./Character.ts"
import { AudioManager } from "./AudioManager.ts"
import { SYMBOL_NAMES, REEL_COUNT, REEL_STRIPS, DECORATIONS, CHARACTER_SPINE_ANIMATIONS, LAYOUT_DESIGN_WIDTH, LAYOUT_DESIGN_HEIGHT, LAYOUT_TABLET_MAX_WIDTH, LAYOUT_SHORT_LANDSCAPE_MAX_HEIGHT } from "./settings.ts"

/**
 * Главный класс слот-игры: сцена, UI, загрузка ассетов, Spine-персонаж, адаптив, спин и выигрыш
 * Сцена строится в координатах дизайна (2560×1440) и масштабируется под окно
 */
export class SlotGame {
    /** Экземпляр приложения */
    private app: Application
    /** HTML-элемент к которому привязано приложение */
    private root: HTMLElement
    /** Текстуры со слотами */
    private textures: Texture[] = []
    /** Текстуры для фоновых элементов */
    private decorationsTextures: { [key: string]: Texture } = {}
    /** Данные скелета персонажа (один скелет, анимации idle/wait/win), собираются в loadAssets */
    private characterSpineData: CharacterSpineAssets | null = null
    /** Массив барабанов для игры */
    private reels: Reel[] = []
    /** Стартовый баланс пользователя */
    private balance = 10000
    /** Стоимпость одной игры */
    private bet = 10
    /** Элемент для вывода текущего баланца средств */
    private balanceText!: Text
    /** Элемент для вывода результата игры */
    private resultText!: Text
    /** Движок прокрутки */
    private engine = new SlotEngine()
    /** Счётчик для завершивших прокрутку барабанов (reels) */
    private stopped = 0
    /** Элемент для сцены */
    private panel!: Sprite
    /** Градиентный фон */
    private gradientBg!: Sprite
    /** Корневой контейнер в координатах дизайна (2560×1440), масштабируется под экран. */
    private rootContainer!: Container
    /** Кнопка спина */
    private buttonSpin!: Sprite
    /** Текст кнопки спина */
    private buttonSpinText!: Text
    /** Персонаж */
    private character!: Character
    /** Масштаб барабанов относительно панели (1 = по settings, 2 = в 2 раза крупнее). */
    private static readonly REEL_SCALE = 2
    /** Длительность анимации выигрыша */
    private static readonly WIN_ANIM_DURATION_MS = 3000
    /** Время масштабирования в анимации выигрыша */
    private static readonly WIN_SCALE_IN_MS = 350
    /** Время масштабирования из анимации выигрыша */
    private static readonly WIN_SCALE_OUT_MS = 350
    /** Скорость вращения света в анимации выигрыша */
    private static readonly WIN_LIGHT_ROTATION_SPEED = 0.5

    /**
     * Нормализация JSON скелета Spine 3.8 для парсера spine-core 4.x
     * в ключах rotate анимаций поле "angle" заменяется на "value"
     * @param skeletonJson — распарсенный JSON скелета (мутируется)
     * @returns Тот же объект с подставленными value в ключах rotate
     */
    private static normalizeSpine38Animations(skeletonJson: Record<string, unknown>): Record<string, unknown> {
        const anims = skeletonJson.animations as Record<string, { bones?: Record<string, { rotate?: unknown[] }> }> | undefined

        if (!anims || typeof anims !== "object") {
            return skeletonJson
        }

        // Нормализация ключей rotate в анимациях
        for (const animName of Object.keys(anims)) {
            const anim = anims[animName]

            if (!anim?.bones || typeof anim.bones !== "object") {
                continue
            }

            for (const boneName of Object.keys(anim.bones)) {
                const boneTimelines = anim.bones[boneName]

                if (!boneTimelines?.rotate || !Array.isArray(boneTimelines.rotate)) {
                    continue
                }

                for (const keyframe of boneTimelines.rotate) {
                    const k = keyframe as Record<string, unknown>

                    if (k && "angle" in k && !("value" in k)) {
                        k.value = k.angle
                    }
                }
            }
        }

        return skeletonJson
    }

    /**
     * Создаёт спрайт с линейным градиентом
     * @param width — ширина в пикселях
     * @param height — высота в пикселях
     * @param colorTop — цвет сверху (0xRRGGBB)
     * @param colorBottom — цвет снизу (0xRRGGBB)
     * @returns Спрайт с градиентной текстурой
     */
    private static createGradientBackground(
        width: number,
        height: number,
        colorTop: number,
        colorBottom: number
    ): Sprite {
        const canvas = document.createElement("canvas")

        canvas.width = Math.max(1, Math.floor(width))
        canvas.height = Math.max(1, Math.floor(height))

        const ctx = canvas.getContext("2d")

        if (!ctx) {
            return new Sprite(Texture.WHITE)
        }

        // Создаем градиент
        const gradientBackground = ctx.createLinearGradient(0, 0, 0, canvas.height)

        gradientBackground.addColorStop(0, "#" + colorTop.toString(16).padStart(6, "0"))
        gradientBackground.addColorStop(1, "#" + colorBottom.toString(16).padStart(6, "0"))
        ctx.fillStyle = gradientBackground
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Создаем текстуру из канваса
        const texture = Texture.from(canvas)

        // Создаем спрайт из текстуры
        const sprite = new Sprite(texture)

        sprite.width = width
        sprite.height = height
        sprite.position.set(0, 0)
        sprite.eventMode = "none"

        return sprite
    }

    /** Масштабирует root под экран и скрывает персонажа на планшете */
    private applyLayout() {
        const width = this.app.screen.width
        const height = this.app.screen.height

        this.gradientBg.width = width
        this.gradientBg.height = height
        this.gradientBg.position.set(0, 0)

        const isPortrait = width < height
        const isShortLandscape = !isPortrait && height <= LAYOUT_SHORT_LANDSCAPE_MAX_HEIGHT
        const scale = isPortrait || isShortLandscape
            ? height / LAYOUT_DESIGN_HEIGHT
            : Math.min(width / LAYOUT_DESIGN_WIDTH, height / LAYOUT_DESIGN_HEIGHT)

        // Масштабируем rootContainer
        this.rootContainer.scale.set(scale)
        this.rootContainer.x = (width - LAYOUT_DESIGN_WIDTH * scale) / 2
        this.rootContainer.y = (isPortrait || isShortLandscape) ? 0 : (height - LAYOUT_DESIGN_HEIGHT * scale) / 2

        // Показываем персонажа на десктопе
        const showCharacter = width > LAYOUT_TABLET_MAX_WIDTH

        this.character.setVisible(showCharacter)
    }

    /**
     * Создаёт экземпляр игры: инициализирует Pixi, загружает ассеты, строит UI и сцену
     * @param root — HTML-элемент, в который вставляется канвас
     * @param options.onProgress — колбэк прогресса загрузки (percent 0-100, label)
     * @returns Экземпляр SlotGame после полной загрузки
     */
    static async create(
        root: HTMLElement,
        options?: { onProgress?: (percent: number, label: string) => void }
    ) {
        const app = new Application({
            resizeTo: window,
            resolution: Math.max(1, Math.min(2, window.devicePixelRatio ?? 1)),
            autoDensity: true,
            backgroundColor: 0x2d1b4e,
            backgroundAlpha: 0
        })

        const game = new SlotGame(app, root)

        await game.loadAssets(options?.onProgress)

        game.createUI()
        game.createScene()

        return game
    }

    /**
     * @param app — экземпляр Pixi Application
     * @param root — контейнер для канваса
     */
    private constructor(app: Application, root: HTMLElement) {
        this.app = app
        this.root = root

        root.innerHTML = ""

        root.appendChild(app.view as HTMLCanvasElement)
    }

    /**
     * Загружает текстуры символов, декораций, Spine-персонажа и звуки.
     * При наличии onProgress вызывает его по ходу загрузки.
     */
    private async loadAssets(onProgress?: (percent: number, label: string) => void) {
        const audioSteps = 5
        const totalSteps = SYMBOL_NAMES.length + Object.keys(DECORATIONS).length + 3 + audioSteps
        let step = 0

        const report = (label: string) => {
            step++
            onProgress?.(Math.min(100, (step / totalSteps) * 100), label)
        }

        onProgress?.(0, "Символы...")

        // Загружаем текстуры символов
        for (const name of SYMBOL_NAMES) {
            const texture = await Assets.load(`assets/images/symbols/${name}.png`)

            this.textures.push(texture)

            report(`Символы (${this.textures.length}/${SYMBOL_NAMES.length})`)
        }

        onProgress?.(Math.min(100, (step / totalSteps) * 100), "Декорации...")

        // Загружаем текстуры декораций
        for (const name in DECORATIONS) {
            const texture = await Assets.load(`assets/images/decorations/${name}.png`)

            this.decorationsTextures[name] = texture

            report(`Декорации`)
        }

        onProgress?.(Math.min(100, (step / totalSteps) * 100), "Персонаж...")

        // Загружаем Spine-персонажа
        const base = "assets/images/character"
        const characterPng = `${base}/dialogIdle.png`
        const characterTexture = await Assets.load<Texture>(characterPng)

        report("Персонаж")

        report("Анимация...")

        const baseUrl = typeof document !== "undefined" && document.baseURI ? new URL(base, document.baseURI).href : `/${base}`
        const atlasUrl = `${baseUrl}/dialogIdle.atlas`
        const jsonUrl = `${baseUrl}/dialogIdle.json`

        // Загружаем атлас и JSON-скелета
        const [atlasText, skeletonJsonRaw] = await Promise.all([
            fetch(atlasUrl).then((r) => { if (!r.ok) throw new Error(`Atlas: ${r.status}`); return r.text() }),
            fetch(jsonUrl).then((r) => { if (!r.ok) throw new Error(`JSON: ${r.status}`); return r.json() })
        ])

        // Нормализуем JSON-скелета
        const skeletonJson = SlotGame.normalizeSpine38Animations(skeletonJsonRaw)

        const atlas = new TextureAtlas(atlasText)
        const page = atlas.pages[0]

        if (!page) {
            throw new Error("Character atlas has no pages")
        }

        const spineTexture = SpineTexture.from(characterTexture.baseTexture)

        page.setTexture(spineTexture)

        // Заменяем текстуры в атласе на Spine-текстуру
        for (const region of atlas.regions) {
            if (region.page === page) {
                region.texture = spineTexture
            }
        }

        const loader = new AtlasAttachmentLoader(atlas)
        const parser = new SkeletonJson(loader)
        const skeletonData = parser.readSkeletonData(skeletonJson)

        this.characterSpineData = { skeletonData }

        // Звуки
        report("Звуки...")

        await AudioManager.loadAll((label) => report(label))

        report("Готово")
    }

    /** Создаёт барабаны на панели и персонажа */
    private createScene() {
        this.app.stage.sortableChildren = true

        const reelWidth = 110
        const spacing = 10
        const scale = SlotGame.REEL_SCALE
        const step = (reelWidth + spacing) * scale
        const panelH = this.panel.height
        const reelVisibleCenterY = Reel.getVisibleCenterY(panelH)
        const pivotX = reelWidth / 2
        const pivotY = reelVisibleCenterY
        const startX = -((REEL_COUNT - 1) / 2) * step
        /** Сдвиг вверх, чтобы не наезжать на тень панели снизу */
        const offsetY = -20

        // Создаем барабаны на панели
        for (let i = 0; i < REEL_COUNT; i++) {
            const reel = new Reel(this.app, this.textures, REEL_STRIPS[i], {
                panelHeight: panelH
            })

            reel.container.pivot.set(pivotX, pivotY)
            reel.container.scale.set(scale)
            reel.container.position.set(startX + i * step, offsetY)

            this.panel.addChild(reel.container)
            this.reels.push(reel)
        }

        if (!this.characterSpineData) {
            throw new Error("characterSpineData not loaded")
        }

        this.character = new Character(this.app, this.characterSpineData, CHARACTER_SPINE_ANIMATIONS, this.rootContainer)
        this.character.playIdle()

        this.updateBalance()
        this.applyLayout()

        window.addEventListener("resize", () => this.applyLayout())
    }

    /** Создаёт градиент на stage, rootContainer, фон, панель, тексты, кнопку спина и золотой декор */
    private createUI() {
        this.app.stage.sortableChildren = true

        // Создаем градиентный фон
        this.gradientBg = SlotGame.createGradientBackground(
            this.app.screen.width,
            this.app.screen.height,
            0x2d1b4e,
            0x483D8B
        )
        this.app.stage.addChildAt(this.gradientBg, 0)
        this.rootContainer = new Container()
        this.app.stage.addChild(this.rootContainer)

        this.createBGGame()
        this.createTextUI()
        this.createButtonSpin()

        // Создаем фон из денег
        const backgroundGold = document.createElement("div")
        const imageGold = document.createElement("img")

        imageGold.src = (typeof document !== "undefined" && document.baseURI ? new URL("assets/images/gold.png", document.baseURI).href : "assets/images/gold.png")
        backgroundGold.className = "background-gold"
        backgroundGold.appendChild(imageGold)

        this.root.appendChild(backgroundGold)
    }

    /** Создаёт кнопку «Крутить» в координатах дизайна и вешает обработчик spin */
    private createButtonSpin() {
        const cw = LAYOUT_DESIGN_WIDTH / 2
        const ch = LAYOUT_DESIGN_HEIGHT / 2

        this.buttonSpin = new Sprite(this.decorationsTextures["button"])
        this.buttonSpin.anchor.set(0.5)
        this.buttonSpin.width = 232
        this.buttonSpin.height = 77
        this.buttonSpin.x = cw + 10
        this.buttonSpin.y = ch + 340

        this.buttonSpin.cursor = 'pointer'
        this.buttonSpin.eventMode = 'static';
        this.buttonSpin.on('pointerdown', () => {
            AudioManager.playSpinButton()
            this.spin()
        })


        this.buttonSpinText = new Text("КРУТИТЬ", {fill: 0xffffff, fontSize: 40, fontWeight: "bold"})
        this.buttonSpinText.anchor.set(0.5)
        this.buttonSpinText.x = this.buttonSpin.width / 2;
        this.buttonSpinText.y = this.buttonSpin.height / 2 - 10;
        this.buttonSpinText.pivot.x = this.buttonSpin.width / 2;
        this.buttonSpinText.pivot.y = this.buttonSpin.height / 2;

        this.buttonSpin.addChild(this.buttonSpinText)
        this.rootContainer.addChild(this.buttonSpin)
    }

    /** Добавляет в rootContainer фон (спрайт) и панель с барабанами в координатах дизайна */
    private createBGGame() {
        const root = this.rootContainer
        const cw = LAYOUT_DESIGN_WIDTH / 2
        const ch = LAYOUT_DESIGN_HEIGHT / 2

        const backgroundGame = new Sprite(this.decorationsTextures["background"])
        backgroundGame.anchor.set(0.5)
        backgroundGame.width = 603
        backgroundGame.height = 763
        backgroundGame.x = cw
        backgroundGame.y = ch
        root.addChild(backgroundGame)

        this.panel = new Sprite(this.decorationsTextures["panel-front"])
        this.panel.anchor.set(0.5)
        this.panel.width = 512
        this.panel.height = 412
        this.panel.x = cw + 10
        this.panel.y = ch - 120

        root.addChild(this.panel)
    }

    /** Добавляет в rootContainer заголовок, баланс, результат, ставку и подписи в координатах дизайна */
    private createTextUI() {
        const root = this.rootContainer
        const cw = LAYOUT_DESIGN_WIDTH / 2
        const ch = LAYOUT_DESIGN_HEIGHT / 2
        const styleLabel = new TextStyle({fill: 0xffffff, fontSize: 18, fontWeight: "bold"})
        const styleText = new TextStyle({fill: 0xffffff, fontSize: 26, fontWeight: "bold"})

        // Создаем заголовок
        const pageTitle = new Text("ИСПЫТАЙ УДАЧУ", {
            fill: 0xffffff,
            fontSize: 72,
            fontWeight: "bold",
            dropShadow: true
        })
        pageTitle.x = cw
        pageTitle.y = 200
        pageTitle.anchor.set(0.5)
        root.addChild(pageTitle)

        // Создаем текст баланса
        this.balanceText = new Text("", styleText)
        this.balanceText.x = cw + 116
        this.balanceText.y = ch + 350
        this.balanceText.pivot.x = this.panel.width / 2
        this.balanceText.pivot.y = this.panel.height / 2
        root.addChild(this.balanceText)

        // Создаем текст результата
        this.resultText = new Text("Сделай спин", styleText)
        this.resultText.x = cw + 180
        this.resultText.y = ch + 446
        this.resultText.pivot.x = this.panel.width / 2
        this.resultText.pivot.y = this.panel.height / 2
        root.addChild(this.resultText)

        // Создаем текст лейбла результата
        const resultLabel = new Text("результат", styleLabel)

        resultLabel.x = cw + 216
        resultLabel.y = ch + 414
        resultLabel.pivot.x = this.panel.width / 2
        resultLabel.pivot.y = this.panel.height / 2
        root.addChild(resultLabel)

        // Создаем текст лейбла баланса
        const balacneLabel = new Text("баланс", styleLabel)

        balacneLabel.x = cw + 106
        balacneLabel.y = ch + 312
        balacneLabel.pivot.x = this.panel.width / 2
        balacneLabel.pivot.y = this.panel.height / 2
        root.addChild(balacneLabel)

        // Создаем текст лейбла ставки
        const betLabel = new Text("ставка", styleLabel)

        betLabel.x = cw + 362
        betLabel.y = ch + 312
        betLabel.pivot.x = this.panel.width / 2
        betLabel.pivot.y = this.panel.height / 2
        root.addChild(betLabel)

        // Создаем текст ставки
        const betText = new Text(`${this.bet}`, styleText)
        betText.x = cw + 382
        betText.y = ch + 350
        betText.pivot.x = this.panel.width / 2
        betText.pivot.y = this.panel.height / 2
        root.addChild(betText)
    }

    /** Один спин: списывает ставку, запускает анимацию wait и звук, крутит барабаны через engine.spin() и animate */
    private spin() {
        if (this.balance < this.bet) {
            return
        }

        this.balance -= this.bet
        this.updateBalance()
        this.updateButtonSpin(true)

        const result = this.engine.spin()

        // Анимация персонажа только на десктопе
        if (this.app.screen.width > LAYOUT_TABLET_MAX_WIDTH) {
            this.character.playWait()
        }

        AudioManager.playBackground()
        AudioManager.startSpinLoop()

        this.animate(result)
    }

    /** Запускает прокрутку каждого барабана с задержкой */
    private animate(result: SpinResult) {
        this.reels.forEach((reel, i) => {
            setTimeout(() => {
                reel.spinTo(
                    result.stopPositions[i],
                    () => {
                        this.checkStop(result)
                    })
            }, i * 400)
        })
    }

    /** Вызывается по остановке каждого барабана; когда остановились все — останавливает звук спина и начисляет выигрыш */
    private checkStop(result: SpinResult) {
        this.stopped++

        if (this.stopped === REEL_COUNT) {
            this.stopped = 0

            AudioManager.stopSpinLoop()

            if (result.win > 0) {
                this.balance += result.win
                this.resultText.text = `Выигрыш ${result.win}`

                // Проверяем является ли выигрыш трипл
                const [c0, c1, c2] = [result.symbols[0][1], result.symbols[1][1], result.symbols[2][1]]
                const isTriple = c0 === c1 && c1 === c2

                this.playWinAnimation(isTriple)

                if (this.app.screen.width > LAYOUT_TABLET_MAX_WIDTH) {
                    this.character.playWin()
                }

                AudioManager.playWin()
            } else {
                this.resultText.text = "Нет выигрыша"

                if (this.app.screen.width > LAYOUT_TABLET_MAX_WIDTH) {
                    this.character.playIdle()
                }

                AudioManager.playLose()
            }

            // Обновляем UI
            this.updateBalance()
            this.updateButtonSpin(false)
        }
    }

    /** Показывает оверлей выигрыша (свет + приз) в центре сцены */
    private playWinAnimation(isTriple: boolean) {
        const root = this.rootContainer
        const centerX = LAYOUT_DESIGN_WIDTH / 2
        const centerY = LAYOUT_DESIGN_HEIGHT / 2

        // Создаем контейнер для оверлея
        const container = new Container()

        container.x = centerX
        container.y = centerY
        container.sortableChildren = true

        // Создаем свет
        const light = new Sprite(this.decorationsTextures["sunlight"])

        light.anchor.set(0.5)
        light.width = 520
        light.height = 520
        light.x = 0
        light.y = 0
        light.zIndex = 0
        container.addChild(light)

        // Создаем приз
        const prizeKey = isTriple ? "prize2" : "prize1"
        const prize = new Sprite(this.decorationsTextures[prizeKey])

        prize.anchor.set(0.5)
        prize.width = 200
        prize.height = 200
        prize.x = 0
        prize.y = 0
        prize.zIndex = 1
        container.addChild(prize)

        container.scale.set(0)
        root.addChild(container)

        const totalMs = SlotGame.WIN_ANIM_DURATION_MS
        const scaleInMs = SlotGame.WIN_SCALE_IN_MS
        const scaleOutMs = SlotGame.WIN_SCALE_OUT_MS
        const scaleOutStartMs = totalMs - scaleOutMs
        let elapsedMs = 0

        // Функция для анимации выигрыша
        const tickerFn = (deltaTime: number) => {
            // Преобразуем deltaTime в мс
            const dt = deltaTime <= 0 || deltaTime > 100
                ? 16
                : Math.min(deltaTime * (1000 / 60), 50)
            elapsedMs += dt

            // Анимация
            if (elapsedMs <= scaleInMs) {
                const t = elapsedMs / scaleInMs
                const s = t * t * (3 - 2 * t)

                container.scale.set(s)
            } else if (elapsedMs >= scaleOutStartMs) {
                const t = (elapsedMs - scaleOutStartMs) / scaleOutMs
                const s = 1 - t * t * (3 - 2 * t)

                container.scale.set(s)
            } else {
                container.scale.set(1)
                light.rotation += (dt / 1000) * SlotGame.WIN_LIGHT_ROTATION_SPEED * Math.PI * 2
            }

            // Если время анимации выигрыша превышено, удаляем контейнер и тикер
            if (elapsedMs >= totalMs) {
                this.app.ticker.remove(tickerFn)

                root.removeChild(container)
                container.destroy({ children: true })
            }
        }

        this.app.ticker.add(tickerFn)
    }

    /** Обновляет текст баланса */
    private updateBalance() {
        let result: string | number = this.balance

        if (result >= 1000000) {
            result = (result / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
        } else if (result >= 100000) {
            result = (result / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        } else {
            result = result.toLocaleString('ru-RU')
        }

        this.balanceText.text = `${result}`
    }

    /** Включает/отключает кнопку спина и меняет подпись */
    private updateButtonSpin(spin: boolean) {
        if (spin) {
            this.buttonSpin.eventMode = 'none'
            this.buttonSpinText.text = "ОЖИДАНИЕ..."
        } else {
            this.buttonSpin.eventMode = 'static'
            this.buttonSpinText.text = "КРУТИТЬ"
        }
    }
}