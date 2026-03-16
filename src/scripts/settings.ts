/**
 * Конфигурация слот-игры: размеры, символы, призы, ленты барабанов, адаптив, Spine-анимации
 */

/** Количество барабанов */
export const REEL_COUNT = 3

/** Количество видимых рядов на линии выигрыша */
export const ROWS = 3

/** Размер одного символа (пиксели) */
export const SYMBOL_SIZE = 100

/** Отступ по вертикали между символами (слотами) */
export const ROW_GAP = 0

/** Высота одной строки: символ + отступ */
export const ROW_HEIGHT = SYMBOL_SIZE + ROW_GAP

/** Высота видимой области барабана: от верха 1-го до низа 3-го ряда */
export const REEL_VIEW_HEIGHT = 2 * ROW_HEIGHT + SYMBOL_SIZE

/** Имена файлов символов? индекс совпадает с ключами AWARDS_SIZE */
export const SYMBOL_NAMES = [
    "apple", "bell", "cherry", "clover", "coin", "diamond",
    "heart", "horseshoe", "lemon", "plum", "seven", "watermelon"
]

/** Выигрыши по индексу символа: пара и тройка на линии */
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

/** Ключи декораций (фоны, кнопка, панель, призы, солнечный свет) */
export const DECORATIONS = {
    "background": "background",
    "button": "button",
    "panel-front": "panel-front",
    "prize1": "prize1",
    "prize2": "prize2",
    "prize3": "prize3",
    "sunlight": "sunlight"
}

/** Адаптив: размер «дизайна» (2K) */
export const LAYOUT_DESIGN_WIDTH = 2560
export const LAYOUT_DESIGN_HEIGHT = 1440

/** При ширине экрана ≤ этого значения персонаж скрывается */
export const LAYOUT_TABLET_MAX_WIDTH = 1024

/** Горизонтальный планшет */
export const LAYOUT_SHORT_LANDSCAPE_MAX_HEIGHT = 1080

/** Имена анимаций в Spine-экспорте (должны совпадать с именами в редакторе Spine) */
export const CHARACTER_SPINE_ANIMATIONS = {
    idle: "idle",
    wait: "wait",
    win: "win"
} as const

/** Ленты барабанов: для каждого барабана — массив индексов символов (порядок сверху вниз) */
export const REEL_STRIPS: number[][] = [
    [0, 2, 4, 1, 3, 7, 10, 8, 5, 2, 9, 4],
    [2, 4, 6, 3, 1, 7, 10, 5, 8, 2, 11, 4],
    [3, 2, 4, 1, 9, 7, 10, 8, 5, 2, 6, 4]
]