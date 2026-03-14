import { AnimatedSprite, Application, Texture, Ticker } from 'pixi.js';

/** Скорость смены кадров: больше = плавнее (чаще смена текстуры). 0.1 было ~6 fps, 0.4 даёт ~24 fps. */
const IDLE_ANIMATION_SPEED = 0.1;
const WIN_ANIMATION_SPEED = 0.1;

export class Character {
    private app: Application
    private idleTextures: Texture[]
    private winTextures: Texture[]
    private anim!: AnimatedSprite
    private tickerBound: (ticker: Ticker) => void

    constructor(app: Application, textures: {[key: string]: Texture[]}) {
        this.app = app
        this.idleTextures = textures["idle"]
        this.winTextures = textures["win"]
        this.tickerBound = (ticker: Ticker) => {
            if (this.anim?.playing) this.anim.update(ticker)
        }
    }

    public playIdle() {
        if (this.anim) {
            this.app.ticker.remove(this.tickerBound)
            this.anim.destroy()
        }

        this.anim = new AnimatedSprite({
            textures: this.idleTextures,
            autoUpdate: false,
            animationSpeed: IDLE_ANIMATION_SPEED,
        });
        this.anim.x = this.app.screen.width / 2 - 600;
        this.anim.y = this.app.screen.height / 2 + 200;
        this.anim.anchor.set(0.5);
        this.anim.loop = true;
        this.anim.play();
        this.app.ticker.add(this.tickerBound);
        this.app.stage.addChild(this.anim);
    }

    public playWin() {
        if (this.anim) {
            this.anim.destroy()
            this.app.ticker.remove(this.tickerBound);
        }

        this.anim = new AnimatedSprite({
            textures: this.winTextures,
            autoUpdate: false,
            animationSpeed: WIN_ANIMATION_SPEED,
        });
        this.anim.x = this.app.screen.width / 2 - 600;
        this.anim.y = this.app.screen.height / 2 + 200;
        this.anim.anchor.set(0.5);
        this.anim.loop = true;
        this.anim.play();
        this.app.ticker.add(this.tickerBound);
        this.app.stage.addChild(this.anim);
    }
}