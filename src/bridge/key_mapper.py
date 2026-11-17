"""Map action names to the keyboard keys Tony-Hands presses.

These values match RetroArch's stock keyboard layout:

    RetroPad B (Cross)    -> Z
    RetroPad A (Circle)   -> X
    RetroPad Y (Square)   -> A
    RetroPad X (Triangle) -> S
    RetroPad R2           -> E

If your RetroArch Port 1 binds differ, change either the emulator
settings or this table - they only have to agree.
"""

from pynput.keyboard import Key, KeyCode

RETROARCH_KEYS: dict[str, Key | KeyCode] = {
    "dpad_left": Key.left,
    "dpad_right": Key.right,
    "dpad_up": Key.up,
    "dpad_down": Key.down,
    "cross": KeyCode.from_vk(0x5A),  # Z
    "circle": KeyCode.from_vk(0x58),  # X
    "square": KeyCode.from_vk(0x41),  # A
    "triangle": KeyCode.from_vk(0x53),  # S
    "start": Key.enter,
    "select": Key.shift_r,
    "l1": KeyCode.from_vk(0x51),  # Q
    "r1": KeyCode.from_vk(0x57),  # W
    "r2": KeyCode.from_vk(0x45),  # E
}
