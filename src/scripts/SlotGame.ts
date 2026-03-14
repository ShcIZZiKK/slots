import {
    Application,
    Container,
    Texture,
    Assets,
    Text,
    TextStyle,
    Sprite,
    Ticker
} from "pixi.js"
import {type SpinResult} from "./types.ts"
import {Reel} from "./Reel.ts"
import {SlotEngine} from "./SlotEngine.ts"
import {Character} from "./Character.ts"
import {SYMBOL_NAMES, REEL_COUNT, REEL_STRIPS, DECORATIONS, CHARACTER_COUNT_ANIMATION} from "./settings.ts"

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
    private decorationsTextures: {[key: string]: Texture} = []

    private characterTextures: {[key: string]: Texture[]} = {}

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
     * Кнопка для запуска игры
     * @private
     */
    private spinButton!: HTMLButtonElement

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
    private panel: Sprite

    private buttonSpin: Sprite
    private buttonSpinText: Text

    private character: Character

    /**
     * Статичный метод для создания экземпляра игры
     * @param {HTMLElement} root - контейнер для игры
     */
    static async create(root: HTMLElement) {
        const app = new Application()

        await app.init({
            resizeTo: window,
            backgroundColor: 0x483D8B,
            preference: "webgl"
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

        const canvas = (app.renderer as any).view?.canvas ?? (app.view as any)

        root.appendChild(canvas)
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
        
        for (const key in CHARACTER_COUNT_ANIMATION) {
            for (let i = 0; i < CHARACTER_COUNT_ANIMATION[key]; i++) {
                const t = await Assets.load(`assets/images/character/${key}/${key}${i}.png`)

                if (key in this.characterTextures) {
                    this.characterTextures[key].push(t)
                } else {
                    this.characterTextures[key] = [t]
                }
            }
        }
    }

    /**
     * Создание сцены
     * @private
     */
    /** Масштаб барабанов относительно панели (1 = размер по settings, 2 = в 2 раза крупнее) */
    private static readonly REEL_SCALE = 2

    private createScene() {
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

        this.character = new Character(this.app, this.characterTextures)
        this.character.playIdle()

        this.updateBalance()
    }

    private createUI() {
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
        const stage = this.app.stage

        this.buttonSpin = new Sprite(this.decorationsTextures["button"])
        this.buttonSpin.anchor.set(0.5)
        this.buttonSpin.width = 232
        this.buttonSpin.height = 77
        this.buttonSpin.x = this.app.screen.width / 2 + 10
        this.buttonSpin.y = this.app.screen.height / 2 + 340

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
        stage.addChild(this.buttonSpin)
    }

    private createBGGame() {
        const stage = this.app.stage

        const backgroundGame = new Sprite(this.decorationsTextures["background"])
        backgroundGame.anchor.set(0.5)
        backgroundGame.width = 603
        backgroundGame.height = 763
        backgroundGame.x = this.app.screen.width / 2
        backgroundGame.y = this.app.screen.height / 2
        stage.addChild(backgroundGame)

        // Панель с барабанами — на stage, не внутри фона: размер в экранных пикселях
        this.panel = new Sprite(this.decorationsTextures["panel-front"])
        this.panel.anchor.set(0.5)
        this.panel.width = 512
        this.panel.height = 412
        this.panel.x = this.app.screen.width / 2 + 10
        this.panel.y = this.app.screen.height / 2 - 120
        stage.addChild(this.panel)
    }

    private createTextUI() {
        const stage = this.app.stage
        const styleLabel = new TextStyle({fill: 0xffffff, fontSize: 18, fontWeight: "bold"})
        const styleText = new TextStyle({fill: 0xffffff, fontSize: 26, fontWeight: "bold"})

        // Баланс
        this.balanceText = new Text("", styleText)
        this.balanceText.x = this.app.screen.width / 2 + 116;
        this.balanceText.y = this.app.screen.height / 2 + 350;
        this.balanceText.pivot.x = this.panel.width / 2;
        this.balanceText.pivot.y = this.panel.height / 2;

        stage.addChild(this.balanceText)

        // Результат
        this.resultText = new Text("Сделай спин", styleText)
        this.resultText.x = this.app.screen.width / 2 + 180;
        this.resultText.y = this.app.screen.height / 2 + 446;
        this.resultText.pivot.x = this.panel.width / 2;
        this.resultText.pivot.y = this.panel.height / 2;

        stage.addChild(this.resultText)

        // Лейбл баланса
        const resultLabel = new Text("результат", styleLabel)

        resultLabel.x = this.app.screen.width / 2 + 216;
        resultLabel.y = this.app.screen.height / 2 + 414;
        resultLabel.pivot.x = this.panel.width / 2;
        resultLabel.pivot.y = this.panel.height / 2;

        stage.addChild(resultLabel)

        // Лейбл баланса
        const balacneLabel = new Text("баланс", styleLabel)

        balacneLabel.x = this.app.screen.width / 2 + 106;
        balacneLabel.y = this.app.screen.height / 2 + 312;
        balacneLabel.pivot.x = this.panel.width / 2;
        balacneLabel.pivot.y = this.panel.height / 2;

        stage.addChild(balacneLabel)

        // Лейбл баланса
        const betLabel = new Text("ставка", styleLabel)

        betLabel.x = this.app.screen.width / 2 + 362;
        betLabel.y = this.app.screen.height / 2 + 312;
        betLabel.pivot.x = this.panel.width / 2;
        betLabel.pivot.y = this.panel.height / 2;

        stage.addChild(betLabel)

        // Размер ставки
        const betText = new Text(`${this.bet}`, styleText)

        betText.x = this.app.screen.width / 2 + 382;
        betText.y = this.app.screen.height / 2 + 350;
        betText.pivot.x = this.panel.width / 2;
        betText.pivot.y = this.panel.height / 2;

        stage.addChild(betText)
    }

    private spin() {
        if (this.balance < this.bet) {
            return
        }

        this.balance -= this.bet
        this.updateBalance()
        this.updateButtonSpin(true)

        const result = this.engine.spin()

        this.animate(result)
        this.character.playIdle()
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
            }

            this.updateBalance()
            this.updateButtonSpin(false)
        }
    }

    private static readonly WIN_ANIM_DURATION_MS = 2500
    private static readonly WIN_SCALE_IN_MS = 400
    private static readonly WIN_SCALE_OUT_MS = 400
    private static readonly WIN_LIGHT_ROTATION_SPEED = 2

    private playWinAnimation(isTriple: boolean) {
        const stage = this.app.stage
        const centerX = this.app.screen.width / 2
        const centerY = this.app.screen.height / 2

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
        stage.addChild(container)

        const totalMs = SlotGame.WIN_ANIM_DURATION_MS
        const scaleInMs = SlotGame.WIN_SCALE_IN_MS
        const scaleOutMs = SlotGame.WIN_SCALE_OUT_MS
        const scaleOutStartMs = totalMs - scaleOutMs

        let elapsedMs = 0

        const tickerFn = (ticker: Ticker) => {
            const dt = Math.min(ticker.deltaMS, 50)
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
                stage.removeChild(container)
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