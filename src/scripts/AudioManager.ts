import { Howl } from "howler"

type SoundKey = "background" | "spin" | "win" | "lose" | "spinButton"

/**
 * Централизованное управление звуком.
 */
export class AudioManager {
    private static sounds: Partial<Record<SoundKey, Howl>> = {}
    private static spinId: number | null = null

    private static readonly sources: Record<SoundKey, string> = {
        background: "assets/audio/background.mp3",
        spin: "assets/audio/spin.mp3",
        win: "assets/audio/win.mp3",
        lose: "assets/audio/lose.mp3",
        spinButton: "assets/audio/spin-button.mp3"
    }

    /** Загружает все звуки */
    static async loadAll(onStep?: (label: string) => void): Promise<void> {
        const entries = Object.entries(this.sources) as [SoundKey, string][]

        await Promise.all(
            entries.map(([key, src]) => {
                return new Promise<void>((resolve) => {
                    const sound = new Howl({
                        src: [src],
                        preload: true,
                        html5: false,
                        onload: () => {
                            this.sounds[key] = sound
                            onStep?.(this.labelFor(key))
                            resolve()
                        },
                        onloaderror: () => {
                            // При ошибке просто пропускаем звук
                            resolve()
                        }
                    })
                })
            })
        )
    }

    /** Возвращает название звука для отчёта */
    private static labelFor(key: SoundKey): string {
        switch (key) {
            case "background":
                return "Музыка"
            case "spin":
                return "Звук спина"
            case "win":
                return "Звук выигрыша"
            case "lose":
                return "Звук проигрыша"
            case "spinButton":
                return "Звук кнопки"
        }
    }

    /** Фоновая музыка */
    static playBackground(): void {
        const sound = this.sounds.background

        if (!sound) {
            return
        }

        sound.loop(true)
        sound.volume(0.3)

        if (!sound.playing()) {
            sound.play()
        }
    }

    /** Останавливает фоновую музыку */
    static stopBackground(): void {
        this.sounds.background?.stop()
    }

    /** Звук нажатия кнопки спина */
    static playSpinButton(): void {
        this.sounds.spinButton?.play()
    }

    /** Цикличный звук вращения барабанов */
    static startSpinLoop(): void {
        const sound = this.sounds.spin

        if (!sound) {
            return
        }

        sound.loop(true)

        if (this.spinId !== null && sound.playing(this.spinId)) {
            return
        }

        this.spinId = sound.play()
    }

    /** Останавливает цикличный звук вращения барабанов */
    static stopSpinLoop(): void {
        const sound = this.sounds.spin

        if (!sound) {
            return
        }

        if (this.spinId !== null) {
            sound.stop(this.spinId)
            this.spinId = null
        } else {
            sound.stop()
        }
    }

    /** Звук выигрыша */
    static playWin(): void {
        this.sounds.win?.play()
    }

    /** Звук проигрыша */
    static playLose(): void {
        this.sounds.lose?.play()
    }
}

