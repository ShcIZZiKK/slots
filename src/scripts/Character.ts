import type { SkeletonData } from "@esotericsoftware/spine-core"
import { Application, Container } from "pixi.js"
import { Spine } from "@esotericsoftware/spine-pixi-v7"

/** Данные скелета для персонажа (один скелет с несколькими анимациями) */
export type CharacterSpineAssets = {
    skeletonData: SkeletonData
}

/** Имена анимаций в данных Spine */
export type CharacterAnimationNames = {
    idle: string
    wait: string
    win: string
}

/**
 * Персонаж на сцене: Spine-анимация
 */
export class Character {
    /** Экземпляр Pixi Application */
    private app: Application
    /** Данные скелета Spine */
    private assets: CharacterSpineAssets
    /** Имена анимаций */
    private animationNames: CharacterAnimationNames
    /** Контейнер, в который добавляется персонаж */
    private parentContainer: Container
    /** Контейнер персонажа */
    private container: Container | null = null
    /** Текущий Spine, чтобы обновлять его вручную (delta в секундах) */
    private currentSpine: Spine | null = null
    /** Тикер Pixi */
    private tickerBound: (() => void) | null = null
    /** ID requestAnimationFrame */
    private rafId = 0
    /** Время последнего обновления анимации */
    private lastAnimTime = 0

    /** Позиция в координатах дизайна (корневой контейнер) */
    private static readonly MARGIN_LEFT = 280
    private static readonly DESIGN_CENTER_Y = 720
    private static readonly SPINE_SCALE = 0.15
    private static readonly SPINE_Z_INDEX = 9999

    /**
     * @param app — экземпляр Pixi Application
     * @param assets — данные скелета Spine
     * @param animationNames — имена анимаций (idle, wait, win)
     * @param parentContainer — контейнер, в который добавляется персонаж (корень сцены с координатами дизайна)
     */
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

    /** Позиция в координатах дизайна */
    private get position() {
        return {
            x: Character.MARGIN_LEFT,
            y: Character.DESIGN_CENTER_Y - 20
        }
    }

    /** Контейнер персонажа на сцене (или null, если не создан) */
    public getContainer(): Container | null {
        return this.container
    }

    /** Включает или скрывает персонажа (используется для планшетов при адаптиве) */
    public setVisible(visible: boolean) {
        if (this.container) this.container.visible = visible
    }

    /** Создаёт контейнер персонажа. */
    private createContainer(): Container {
        const container = new Container()
        const { x, y } = this.position

        container.x = x
        container.y = y
        container.zIndex = Character.SPINE_Z_INDEX

        return container
    }

    /** Ставит анимацию по имени */
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

    /** Создаёт Spine-анимацию */
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

    /** Показывает анимацию ожидания */
    public playIdle() {
        this.removeCurrent()

        const container = this.createContainer()

        this.container = container

        const spine = this.createSpine(this.assets.skeletonData)
        
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

    /** Показывает анимацию ожидания во время прокрутки барабанов */
    public playWait() {
        this.removeCurrent()

        const container = this.createContainer()

        this.container = container
        
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

    /** Показывает анимацию выигрыша */
    public playWin() {
        this.removeCurrent()

        const container = this.createContainer()

        this.container = container

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

    /** Обновление Spine по requestAnimationFrame (тикер Pixi может не вызывать колбэк) */
    private addTickerUpdate() {
        this.removeTickerUpdate()
        this.lastAnimTime = performance.now()
        
        const loop = () => {
            this.rafId = requestAnimationFrame(loop)

            const spine = this.currentSpine
            
            if (!spine?.parent) {
                return
            }

            const now = performance.now()

            let deltaSec = (now - this.lastAnimTime) / 1000

            this.lastAnimTime = now

            if (deltaSec > 0.1) {
                deltaSec = 0.016
            }

            spine.update(deltaSec)
        }

        this.rafId = requestAnimationFrame(loop)
    }

    /** Отменяет цикл rAF/тикер */
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

    /** Удаляет текущий Spine */
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
