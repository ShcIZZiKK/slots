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
import { SYMBOL_NAMES, REEL_COUNT, REEL_STRIPS, DECORATIONS, CHARACTER_SPINE_ANIMATIONS, LAYOUT_DESIGN_WIDTH, LAYOUT_DESIGN_HEIGHT, LAYOUT_TABLET_MAX_WIDTH, LAYOUT_SHORT_LANDSCAPE_MAX_HEIGHT } from "./settings.ts"

export class SlotGame {
    /**
     * Экземпляр приложения
     * @private
     */
    private app: Application

    /**
     * HTML-элемент к которому привязано приложение
     * @private
     */
    private root: HTMLElement

    /**
     * Текстуры со слотами
     * @private
     */
    private textures: Texture[] = []
    
    /**
     * Текстуры для фоновых элементов
     * @private
     */
    private decorationsTextures: { [key: string]: Texture } = {}

    /** Данные скелета персонажа (один скелет, анимации idle/wait/win), собираются в loadAssets */
    private characterSpineData: CharacterSpineAssets | null = null


    /**
     * Массив барабанов для игры
     * @private
     */
    private reels: Reel[] = []

    /**
     * Стартовый баланс пользователя
     * @private
     */
    private balance = 10000

    /**
     * Стоимпость одной игры
     * @private
     */
    private bet = 10

    /**
     * Элемент для вывода текущего баланца средств
     * @private
     */
    private balanceText!: Text

    /**
     * Элемент для вывода результата игры
     * @private
     */
    private resultText!: Text

    /**
     * Движок прокрутки
     * @private
     */
    private engine = new SlotEngine()

    /**
     * Счётчик для завершивших прокрутку барабанов (reels)
     * @private
     */
    private stopped = 0

    /**
     * Элемент для сцены
     * @private
     */
    private panel!: Sprite

    private gradientBg!: Sprite

    /** Корневой контейнер в координатах дизайна (2560×1440), масштабируется под экран. */
    private rootContainer!: Container

    private buttonSpin!: Sprite
    private buttonSpinText!: Text

    private character!: Character

    /**
     * Нормализация JSON скелета Spine 3.8 для парсера spine-core 4.x:
     * в ключах rotate анимаций поле "angle" заменяется на "value".
     */
    private static normalizeSpine38Animations(skeletonJson: Record<string, unknown>): Record<string, unknown> {
        const anims = skeletonJson.animations as Record<string, { bones?: Record<string, { rotate?: unknown[] }> }> | undefined
        if (!anims || typeof anims !== "object") return skeletonJson
        for (const animName of Object.keys(anims)) {
            const anim = anims[animName]
            if (!anim?.bones || typeof anim.bones !== "object") continue
            for (const boneName of Object.keys(anim.bones)) {
                const boneTimelines = anim.bones[boneName]
                if (!boneTimelines?.rotate || !Array.isArray(boneTimelines.rotate)) continue
                for (const keyframe of boneTimelines.rotate) {
                    const k = keyframe as Record<string, unknown>
                    if (k && "angle" in k && !("value" in k)) k.value = k.angle
                }
            }
        }
        return skeletonJson
    }

    /**
     * Создаёт спрайт с линейным градиентом (сверху вниз) на весь экран.
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
        if (!ctx) return new Sprite(Texture.WHITE)
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height)
        g.addColorStop(0, "#" + colorTop.toString(16).padStart(6, "0"))
        g.addColorStop(1, "#" + colorBottom.toString(16).padStart(6, "0"))
        ctx.fillStyle = g
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        const texture = Texture.from(canvas)
        const sprite = new Sprite(texture)
        sprite.width = width
        sprite.height = height
        sprite.position.set(0, 0)
        sprite.eventMode = "none"
        return sprite
    }

    /** Масштабирует root под экран и скрывает персонажа на планшете. Градиент всегда на весь viewport. */
    private applyLayout() {
        const w = this.app.screen.width
        const h = this.app.screen.height
        this.gradientBg.width = w
        this.gradientBg.height = h
        this.gradientBg.position.set(0, 0)
        const isPortrait = w < h
        const isShortLandscape = !isPortrait && h <= LAYOUT_SHORT_LANDSCAPE_MAX_HEIGHT
        const scale = isPortrait || isShortLandscape
            ? h / LAYOUT_DESIGN_HEIGHT
            : Math.min(w / LAYOUT_DESIGN_WIDTH, h / LAYOUT_DESIGN_HEIGHT)
        this.rootContainer.scale.set(scale)
        this.rootContainer.x = (w - LAYOUT_DESIGN_WIDTH * scale) / 2
        this.rootContainer.y = (isPortrait || isShortLandscape) ? 0 : (h - LAYOUT_DESIGN_HEIGHT * scale) / 2
        const showCharacter = w > LAYOUT_TABLET_MAX_WIDTH
        this.character.setVisible(showCharacter)
    }

    /**
     * Статичный метод для создания экземпляра игры
     * @param {HTMLElement} root - контейнер для игры
     */
    static async create(root: HTMLElement) {
        const app = new Application({
            resizeTo: window,
            backgroundColor: 0x2d1b4e,
            backgroundAlpha: 0
        })

        const game = new SlotGame(app, root)

        await game.loadAssets()

        game.createUI()
        game.createScene()

        return game
    }

    /**
     * Инициализация
     * @param app
     * @param root
     * @private
     */
    private constructor(app: Application, root: HTMLElement) {
        this.app = app
        this.root = root

        root.innerHTML = ""

        root.appendChild(app.view as HTMLCanvasElement)
    }

    /**
     * Загрузка ассетов для игры
     * @private
     */
    private async loadAssets() {
        for (const name of SYMBOL_NAMES) {
            const t = await Assets.load(`assets/images/symbols/${name}.png`)
            this.textures.push(t)
        }

        for (const name in DECORATIONS) {
            const t = await Assets.load(`assets/images/decorations/${name}.png`)
            this.decorationsTextures[name] = t
        }

        // Spine-персонаж: одна папка character с атласом и тремя анимациями (idle, wait, win).
        // Если на стыках частей руки видны тёмные швы: в Spine 3.8 при экспорте попробуйте снять галочку "Premultiplied alpha" (или наоборот — включить).
        const base = "assets/images/character"
        const characterPng = `${base}/dialogIdle.png`
        const characterTexture = await Assets.load<Texture>(characterPng)

        const baseUrl = typeof document !== "undefined" && document.baseURI ? new URL(base, document.baseURI).href : `/${base}`
        const atlasUrl = `${baseUrl}/dialogIdle.atlas`
        const jsonUrl = `${baseUrl}/dialogIdle.json`

        const [atlasText, skeletonJsonRaw] = await Promise.all([
            fetch(atlasUrl).then((r) => { if (!r.ok) throw new Error(`Atlas: ${r.status}`); return r.text() }),
            fetch(jsonUrl).then((r) => { if (!r.ok) throw new Error(`JSON: ${r.status}`); return r.json() })
        ])
        const skeletonJson = SlotGame.normalizeSpine38Animations(skeletonJsonRaw)

        const atlas = new TextureAtlas(atlasText)
        const page = atlas.pages[0]
        if (!page) throw new Error("Character atlas has no pages")
        const spineTexture = SpineTexture.from(characterTexture.baseTexture)
        page.setTexture(spineTexture)
        for (const region of atlas.regions) {
            if (region.page === page) region.texture = spineTexture
        }
        const loader = new AtlasAttachmentLoader(atlas)
        const parser = new SkeletonJson(loader)
        const skeletonData = parser.readSkeletonData(skeletonJson)

        this.characterSpineData = { skeletonData }
    }

    /**
     * Создание сцены
     * @private
     */
    /** Масштаб барабанов относительно панели (1 = размер по settings, 2 = в 2 раза крупнее) */
    private static readonly REEL_SCALE = 2

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

        if (!this.characterSpineData) throw new Error("characterSpineData not loaded")
        this.character = new Character(this.app, this.characterSpineData, CHARACTER_SPINE_ANIMATIONS, this.rootContainer)
        this.character.playIdle()

        this.updateBalance()
        this.applyLayout()
        window.addEventListener("resize", () => this.applyLayout())
    }

    private createUI() {
        this.app.stage.sortableChildren = true
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

        const backgroundGold = document.createElement("div")
        const imageGold = document.createElement("img")
        imageGold.src = "assets/images/gold.png"
        backgroundGold.className = "background-gold"
        backgroundGold.appendChild(imageGold)

        this.root.appendChild(backgroundGold)
    }

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
        this.buttonSpin.on('pointerdown', this.spin.bind(this));


        this.buttonSpinText = new Text("КРУТИТЬ", {fill: 0xffffff, fontSize: 40, fontWeight: "bold"})
        this.buttonSpinText.anchor.set(0.5)
        this.buttonSpinText.x = this.buttonSpin.width / 2;
        this.buttonSpinText.y = this.buttonSpin.height / 2 - 10;
        this.buttonSpinText.pivot.x = this.buttonSpin.width / 2;
        this.buttonSpinText.pivot.y = this.buttonSpin.height / 2;

        this.buttonSpin.addChild(this.buttonSpinText)
        this.rootContainer.addChild(this.buttonSpin)
    }

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

    private createTextUI() {
        const root = this.rootContainer
        const cw = LAYOUT_DESIGN_WIDTH / 2
        const ch = LAYOUT_DESIGN_HEIGHT / 2
        const styleLabel = new TextStyle({fill: 0xffffff, fontSize: 18, fontWeight: "bold"})
        const styleText = new TextStyle({fill: 0xffffff, fontSize: 26, fontWeight: "bold"})

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

        this.balanceText = new Text("", styleText)
        this.balanceText.x = cw + 116
        this.balanceText.y = ch + 350
        this.balanceText.pivot.x = this.panel.width / 2
        this.balanceText.pivot.y = this.panel.height / 2
        root.addChild(this.balanceText)

        this.resultText = new Text("Сделай спин", styleText)
        this.resultText.x = cw + 180
        this.resultText.y = ch + 446
        this.resultText.pivot.x = this.panel.width / 2
        this.resultText.pivot.y = this.panel.height / 2
        root.addChild(this.resultText)

        const resultLabel = new Text("результат", styleLabel)
        resultLabel.x = cw + 216
        resultLabel.y = ch + 414
        resultLabel.pivot.x = this.panel.width / 2
        resultLabel.pivot.y = this.panel.height / 2
        root.addChild(resultLabel)

        const balacneLabel = new Text("баланс", styleLabel)
        balacneLabel.x = cw + 106
        balacneLabel.y = ch + 312
        balacneLabel.pivot.x = this.panel.width / 2
        balacneLabel.pivot.y = this.panel.height / 2
        root.addChild(balacneLabel)

        const betLabel = new Text("ставка", styleLabel)
        betLabel.x = cw + 362
        betLabel.y = ch + 312
        betLabel.pivot.x = this.panel.width / 2
        betLabel.pivot.y = this.panel.height / 2
        root.addChild(betLabel)

        const betText = new Text(`${this.bet}`, styleText)
        betText.x = cw + 382
        betText.y = ch + 350
        betText.pivot.x = this.panel.width / 2
        betText.pivot.y = this.panel.height / 2
        root.addChild(betText)
    }

    private spin() {
        if (this.balance < this.bet) {
            return
        }

        this.balance -= this.bet
        this.updateBalance()
        this.updateButtonSpin(true)

        const result = this.engine.spin()

        this.character.playWait()
        this.animate(result)
    }

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

    private checkStop(result: SpinResult) {
        this.stopped++

        if (this.stopped === REEL_COUNT) {
            this.stopped = 0

            if (result.win > 0) {
                this.balance += result.win
                this.resultText.text = `Выигрыш ${result.win}`
                const [c0, c1, c2] = [result.symbols[0][1], result.symbols[1][1], result.symbols[2][1]]
                const isTriple = c0 === c1 && c1 === c2
                this.playWinAnimation(isTriple)
                this.character.playWin()
            } else {
                this.resultText.text = "Нет выигрыша"
                this.character.playIdle()
            }

            this.updateBalance()
            this.updateButtonSpin(false)
        }
    }

    private static readonly WIN_ANIM_DURATION_MS = 3000
    private static readonly WIN_SCALE_IN_MS = 350
    private static readonly WIN_SCALE_OUT_MS = 350
    private static readonly WIN_LIGHT_ROTATION_SPEED = 0.5

    private playWinAnimation(isTriple: boolean) {
        const root = this.rootContainer
        const centerX = LAYOUT_DESIGN_WIDTH / 2
        const centerY = LAYOUT_DESIGN_HEIGHT / 2

        const container = new Container()
        container.x = centerX
        container.y = centerY
        container.sortableChildren = true

        const light = new Sprite(this.decorationsTextures["sunlight"])
        light.anchor.set(0.5)
        light.width = 520
        light.height = 520
        light.x = 0
        light.y = 0
        light.zIndex = 0
        container.addChild(light)

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

        const tickerFn = (deltaTime: number) => {
            // Pixi 7 ticker passes deltaTime (~1 per frame), not ms. Convert to ms.
            const dt = deltaTime <= 0 || deltaTime > 100
                ? 16
                : Math.min(deltaTime * (1000 / 60), 50)
            elapsedMs += dt

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

            if (elapsedMs >= totalMs) {
                this.app.ticker.remove(tickerFn)
                root.removeChild(container)
                container.destroy({ children: true })
            }
        }

        this.app.ticker.add(tickerFn)
    }

    private updateBalance() {
        this.balanceText.text = `${this.balance.toLocaleString('ru-RU')}`
    }

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