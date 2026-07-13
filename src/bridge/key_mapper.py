from pynput.keyboard import Key, KeyCode

RETROARCH_KEYS: dict[str, Key | KeyCode] = {
    "dpad_left": Key.left,
    "dpad_right": Key.right,
    "dpad_up": Key.up,
    "dpad_down": Key.down,
    "cross": KeyCode.from_vk(0x5A),
    "circle": KeyCode.from_vk(0x58),
    "square": KeyCode.from_vk(0x53),
    "triangle": KeyCode.from_vk(0x41),
    "start": Key.enter,
    "select": Key.shift_r,
    "l1": KeyCode.from_vk(0x51),
    "r1": KeyCode.from_vk(0x57),
}
