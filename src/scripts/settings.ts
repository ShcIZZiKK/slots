export const REEL_COUNT = 3

export const ROWS = 3

export const SYMBOL_SIZE = 100

/** Отступ по вертикали между символами (слотами) */
export const ROW_GAP = 0

/** Высота одной строки: символ + отступ */
export const ROW_HEIGHT = SYMBOL_SIZE + ROW_GAP

/** Высота видимой области барабана: от верха 1-го до низа 3-го ряда (без части 4-го) */
export const REEL_VIEW_HEIGHT = 2 * ROW_HEIGHT + SYMBOL_SIZE

export const SYMBOL_NAMES = [
    "apple", "bell", "cherry", "clover", "coin", "diamond",
    "heart", "horseshoe", "lemon", "plum", "seven", "watermelon"
]

export const AWARDS_SIZE = {
    "0": {
        "doumble": 10,
        "triple": 200
    },
    "1": {
        "doumble": 20,
        "triple": 300
    },
    "2": {
        "doumble": 10,
        "triple": 200
    },
    "3": {
        "doumble": 20,
        "triple": 1000
    },
    "4": {
        "doumble": 20,
        "triple": 1000
    },
    "5": {
        "doumble": 20,
        "triple": 2000
    },
    "6": {
        "doumble": 10,
        "triple": 200
    },
    "7": {
        "doumble": 20,
        "triple": 5000
    },
    "8": {
        "doumble": 20,
        "triple": 5000
    },
    "9": {
        "doumble": 10,
        "triple": 200
    },
    "10": {
        "doumble": 20,
        "triple": 10000
    },
    "11": {
        "doumble": 10,
        "triple": 200
    }
}

export const DECORATIONS = {
    "background": "background",
    "button": "button",
    "panel-front": "panel-front",
    "prize1": "prize1",
    "prize2": "prize2",
    "prize3": "prize3",
    "sunlight": "sunlight"
}

/** Адаптив: размер «дизайна» (2K), всё масштабируется под экран. */
export const LAYOUT_DESIGN_WIDTH = 2560
export const LAYOUT_DESIGN_HEIGHT = 1440
/** При ширине экрана ≤ этого значения персонаж скрывается (планшет и меньше). */
export const LAYOUT_TABLET_MAX_WIDTH = 1024
/** Горизонтальный планшет: при высоте ≤ этого в landscape масштаб по высоте (крупнее, обрез по бокам). Выше — обычный fit (1920×1200, Full HD, 2K). */
export const LAYOUT_SHORT_LANDSCAPE_MAX_HEIGHT = 1080

/** Имена анимаций в Spine-экспорте (должны совпадать с именами в редакторе Spine). Один скелет в папке character с анимациями idle, wait, win. */
export const CHARACTER_SPINE_ANIMATIONS = {
    idle: "idle",
    wait: "wait",
    win: "win"
} as const

export const REEL_STRIPS: number[][] = [
    [0, 2, 4, 1, 3, 7, 10, 8, 5, 2, 9, 4],
    [2, 4, 6, 3, 1, 7, 10, 5, 8, 2, 11, 4],
    [3, 2, 4, 1, 9, 7, 10, 8, 5, 2, 6, 4]
]