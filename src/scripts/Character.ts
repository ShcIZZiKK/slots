import type { SkeletonData } from "@esotericsoftware/spine-core"
import { Application, Container, Graphics, Text } from "pixi.js"
import { Spine } from "@esotericsoftware/spine-pixi-v7"

export type CharacterSpineAssets = {
    skeletonData: SkeletonData
}

export type CharacterAnimationNames = {
    idle: string
    wait: string
    win: string
}

const SHOW_PLACEHOLDER = false
/** Включить лог анимации в консоль (trackTime, углы костей рук). */
const DEBUG_ANIMATION = true

export class Character {
    private app: Application
    private assets: CharacterSpineAssets
    private animationNames: CharacterAnimationNames
    private parentContainer: Container
    private container: Container | null = null
    /** Текущий Spine, чтобы обновлять его вручную (delta в секундах). */
    private currentSpine: Spine | null = null
    private tickerBound: (() => void) | null = null
    private rafId = 0
    private lastAnimTime = 0
    private debugAnimFrames = 0
    private debugCallbackLogged = false
    private debugFirstFrameLogged = false

    constructor(
        app: Application,
        assets: CharacterSpineAssets,
        animationNames: CharacterAnimationNames,
        parentContainer: Container
    ) {
        this.app = app
        this.assets = assets
        this.animationNames = animationNames
        this.parentContainer = parentContainer
    }

    /** Позиция в координатах дизайна (корневой контейнер). */
    private static readonly MARGIN_LEFT = 280
    private static readonly DESIGN_CENTER_Y = 720
    private static readonly SPINE_SCALE = 0.15
    private static readonly SPINE_Z_INDEX = 9999
    private static readonly PLACEHOLDER_WIDTH = 200
    private static readonly PLACEHOLDER_HEIGHT = 400

    private get position() {
        return {
            x: Character.MARGIN_LEFT,
            y: Character.DESIGN_CENTER_Y - 20
        }
    }

    getContainer(): Container | null {
        return this.container
    }

    setVisible(visible: boolean) {
        if (this.container) this.container.visible = visible
    }

    private createContainer(): Container {
        const c = new Container()
        const { x, y } = this.position
        c.x = x
        c.y = y
        c.zIndex = Character.SPINE_Z_INDEX

        if (SHOW_PLACEHOLDER) {
            const g = new Graphics()
            g.beginFill(0xff0000, 0.5)
            g.drawRect(
                -Character.PLACEHOLDER_WIDTH / 2,
                -Character.PLACEHOLDER_HEIGHT / 2,
                Character.PLACEHOLDER_WIDTH,
                Character.PLACEHOLDER_HEIGHT
            )
            g.endFill()
            c.addChild(g)
        }

        return c
    }

    /** Ставит анимацию по имени; при отсутствии пробует "idle", "wait", "animation". */
    private setAnimationSafe(spine: Spine, name: string) {
        const fallbacks = [name, "idle", "wait", "animation"]
        for (const animName of fallbacks) {
            try {
                spine.state.setAnimation(0, animName, true)
                return
            } catch {
                continue
            }
        }
    }

    private createSpine(skeletonData: SkeletonData): Spine | null {
        try {
            const spine = new Spine({
                skeletonData,
                autoUpdate: false,
                ticker: this.app.ticker
            })
            const data = spine.skeleton.data as { x?: number; y?: number }
            const scale = Character.SPINE_SCALE
            spine.skeleton.x = -(data.x ?? 0)
            spine.skeleton.y = 0
            spine.skeleton.setToSetupPose()
            spine.x = 0
            spine.y = 0
            spine.scale.set(scale)
            spine.update(0)
            return spine
        } catch (e) {
            console.error("[Character] Ошибка создания Spine:", e)
            return null
        }
    }

    public playIdle() {
        if (DEBUG_ANIMATION) console.log("[Anim DEBUG] playIdle вызван")
        this.removeCurrent()
        const container = this.createContainer()
        this.container = container

        if (SHOW_PLACEHOLDER) this.addFallbackPlaceholder(container)
        const spine = this.createSpine(this.assets.skeletonData)
        if (DEBUG_ANIMATION) console.log("[Anim DEBUG] spine создан:", !!spine)
        if (spine) {
            this.setAnimationSafe(spine, this.animationNames.idle)
            spine.update(0)
            this.currentSpine = spine
            container.addChild(spine)
            this.parentContainer.sortableChildren = true
            this.parentContainer.addChild(container)
            this.addTickerUpdate()
        } else {
            this.parentContainer.sortableChildren = true
            this.parentContainer.addChild(container)
        }
    }

    public playWait() {
        this.removeCurrent()
        const container = this.createContainer()
        this.container = container
        if (SHOW_PLACEHOLDER) this.addFallbackPlaceholder(container)
        const spine = this.createSpine(this.assets.skeletonData)
        if (spine) {
            this.setAnimationSafe(spine, this.animationNames.wait)
            spine.update(0)
            this.currentSpine = spine
            container.addChild(spine)
            this.parentContainer.sortableChildren = true
            this.parentContainer.addChild(container)
            this.addTickerUpdate()
        } else {
            this.parentContainer.sortableChildren = true
            this.parentContainer.addChild(container)
        }
    }

    public playWin() {
        this.removeCurrent()
        const container = this.createContainer()
        this.container = container

        if (SHOW_PLACEHOLDER) this.addFallbackPlaceholder(container)
        const spine = this.createSpine(this.assets.skeletonData)
        if (spine) {
            this.setAnimationSafe(spine, this.animationNames.win)
            spine.update(0)
            this.currentSpine = spine
            container.addChild(spine)
            this.parentContainer.sortableChildren = true
            this.parentContainer.addChild(container)
            this.addTickerUpdate()
        } else {
            this.parentContainer.sortableChildren = true
            this.parentContainer.addChild(container)
        }
    }

    /** Обновление Spine по requestAnimationFrame (тикер Pixi может не вызывать колбэк). */
    private addTickerUpdate() {
        this.removeTickerUpdate()
        this.debugAnimFrames = 0
        this.debugCallbackLogged = false
        this.debugFirstFrameLogged = false
        this.lastAnimTime = performance.now()
        if (DEBUG_ANIMATION) console.log("[Anim DEBUG] запуск цикла rAF")
        const loop = () => {
            this.rafId = requestAnimationFrame(loop)
            const spine = this.currentSpine
            if (DEBUG_ANIMATION && !this.debugCallbackLogged) {
                this.debugCallbackLogged = true
                console.log("[Anim DEBUG] rAF кадр, spine=", !!spine, "parent=", !!spine?.parent)
            }
            if (!spine?.parent) return
            const now = performance.now()
            let deltaSec = (now - this.lastAnimTime) / 1000
            this.lastAnimTime = now
            if (deltaSec > 0.1) deltaSec = 0.016
            spine.update(deltaSec)
            if (DEBUG_ANIMATION) {
                this.debugAnimFrames++
                if (!this.debugFirstFrameLogged) {
                    this.debugFirstFrameLogged = true
                    console.log("[Anim DEBUG] первый кадр, deltaSec=", deltaSec.toFixed(4))
                }
                if (this.debugAnimFrames >= 60) {
                    this.debugAnimFrames = 0
                    const cur = spine.state.getCurrent(0)
                    const trackTime = cur?.trackTime ?? 0
                    const rightHand = spine.skeleton.findBone("rightHand")
                    const handLeft = spine.skeleton.findBone("handLeft")
                    console.log(
                        "[Anim DEBUG] trackTime=", trackTime.toFixed(2),
                        "rightHand.rotation=", rightHand?.rotation?.toFixed(2) ?? "—",
                        "handLeft.rotation=", handLeft?.rotation?.toFixed(2) ?? "—"
                    )
                }
            }
        }
        this.rafId = requestAnimationFrame(loop)
    }

    /** Отменяет только цикл rAF/тикер. currentSpine не трогаем — обнуляется в removeCurrent(). */
    private removeTickerUpdate() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId)
            this.rafId = 0
        }
        if (this.tickerBound) {
            this.app.ticker.remove(this.tickerBound)
            this.tickerBound = null
        }
    }

    /** Плейсхолдер области персонажа (всегда рисуем, чтобы контейнер был виден). */
    private addFallbackPlaceholder(container: Container) {
        const g = new Graphics()
        g.beginFill(0xff6600, 0.85)
        g.drawRect(-100, -200, 200, 400)
        g.endFill()
        container.addChild(g)
        const label = new Text("Персонаж", { fill: 0xffffff, fontSize: 22, fontWeight: "bold" })
        label.anchor.set(0.5)
        label.y = -220
        container.addChild(label)
    }

    private removeCurrent() {
        this.currentSpine = null
        this.removeTickerUpdate()
        if (this.container && this.container.parent) {
            this.container.parent.removeChild(this.container)
            this.container.destroy({ children: true })
            this.container = null
        }
    }
}
