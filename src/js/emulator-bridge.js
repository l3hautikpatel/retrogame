/**
 * EmulatorBridge - Input Translation Layer
 * Converts controller button presses to keyboard events for EmulatorJS
 */

class EmulatorBridge {
    constructor() {
        this.mappings = null;
        this.currentScheme = 'nintendo';
        this.activeKeys = new Set();
        this.targetElement = document;
    }

    /**
     * Initialize and load key mappings
     * @returns {Promise<boolean>}
     */
    async initialize() {
        try {
            const response = await fetch('../config/controller-mapping.json');
            this.mappings = await response.json();
            Utils.log('Controller mappings loaded:', Object.keys(this.mappings));
            return true;
        } catch (error) {
            Utils.error('Failed to load controller mappings:', error);
            return false;
        }
    }

    /**
     * Set mapping scheme
     * @param {string} scheme - Mapping scheme name (nintendo, sega, playstation)
     * @returns {boolean} Success status
     */
    setMappingScheme(scheme) {
        if (this.mappings && this.mappings[scheme]) {
            this.currentScheme = scheme;
            Utils.log('Mapping scheme set to:', scheme);
            return true;
        }
        Utils.error('Invalid mapping scheme:', scheme);
        return false;
    }

    /**
     * Handle controller input (main entry point)
     * @param {object} data - Input data from controller
     */
    handleControllerInput(data) {
        if (!data || !data.button || !data.action) {
            Utils.error('Invalid input data:', data);
            return;
        }

        const { button, action } = data;

        // Parse button path (e.g., "face_buttons.a" -> ["face_buttons", "a"])
        const buttonParts = button.split('.');

        if (buttonParts.length !== 2) {
            Utils.error('Invalid button format:', button);
            return;
        }

        const [category, buttonName] = buttonParts;

        // Get key code from mapping
        const keyCode = this.getKeyCode(category, buttonName);

        if (!keyCode) {
            Utils.error('No key mapping found for:', button);
            return;
        }

        // Execute action
        if (action === 'press') {
            this.pressKey(keyCode);
        } else if (action === 'release') {
            this.releaseKey(keyCode);
        }
    }

    /**
     * Get key code from mapping
     * @param {string} category - Button category (face_buttons, dpad, shoulder, system)
     * @param {string} buttonName - Button name (a, b, up, down, etc.)
     * @returns {string|null} Key code
     */
    getKeyCode(category, buttonName) {
        if (!this.mappings || !this.mappings[this.currentScheme]) {
            return null;
        }

        const scheme = this.mappings[this.currentScheme];

        if (!scheme[category]) {
            return null;
        }

        return scheme[category][buttonName] || null;
    }

    /**
   * Simulate key press
   * @param {string} keyCode - Key to press
   */
    pressKey(keyCode) {
        if (this.activeKeys.has(keyCode)) {
            return; // Already pressed
        }

        this.activeKeys.add(keyCode);

        const event = new KeyboardEvent('keydown', {
            key: keyCode,
            code: this.getKeyCodeValue(keyCode),
            keyCode: this.getKeyCodeNumber(keyCode),
            which: this.getKeyCodeNumber(keyCode),
            bubbles: true,
            cancelable: true,
            view: window
        });

        // Try multiple dispatch targets
        let dispatched = false;

        // 1. Try EmulatorJS iframe
        const gameContainer = document.getElementById('game');
        if (gameContainer) {
            const iframe = gameContainer.querySelector('iframe');
            if (iframe) {
                try {
                    // Try iframe's contentWindow
                    if (iframe.contentWindow) {
                        iframe.contentWindow.dispatchEvent(event);
                        dispatched = true;
                        Utils.log('Key pressed (iframe window):', keyCode);
                    }
                } catch (e) {
                    Utils.log('Cannot access iframe (cross-origin):', e.message);
                }
            }

            // 2. Try game container itself
            if (!dispatched) {
                gameContainer.dispatchEvent(event);
                dispatched = true;
                Utils.log('Key pressed (game container):', keyCode);
            }
        }

        // 3. Fallback to document and window
        if (!dispatched) {
            this.targetElement.dispatchEvent(event);
            window.dispatchEvent(event);
            Utils.log('Key pressed (document):', keyCode);
        }

        // 4. Also dispatch to document body for good measure
        document.body.dispatchEvent(event);
    }

    /**
     * Simulate key release
     * @param {string} keyCode - Key to release
     */
    releaseKey(keyCode) {
        if (!this.activeKeys.has(keyCode)) {
            return; // Not pressed
        }

        this.activeKeys.delete(keyCode);

        const event = new KeyboardEvent('keyup', {
            key: keyCode,
            code: this.getKeyCodeValue(keyCode),
            keyCode: this.getKeyCodeNumber(keyCode),
            which: this.getKeyCodeNumber(keyCode),
            bubbles: true,
            cancelable: true,
            view: window
        });

        // Try multiple dispatch targets
        let dispatched = false;

        // 1. Try EmulatorJS iframe
        const gameContainer = document.getElementById('game');
        if (gameContainer) {
            const iframe = gameContainer.querySelector('iframe');
            if (iframe) {
                try {
                    if (iframe.contentWindow) {
                        iframe.contentWindow.dispatchEvent(event);
                        dispatched = true;
                        Utils.log('Key released (iframe window):', keyCode);
                    }
                } catch (e) {
                    // Cross-origin, ignore
                }
            }

            // 2. Try game container itself
            if (!dispatched) {
                gameContainer.dispatchEvent(event);
                dispatched = true;
                Utils.log('Key released (game container):', keyCode);
            }
        }

        // 3. Fallback to document and window
        if (!dispatched) {
            this.targetElement.dispatchEvent(event);
            window.dispatchEvent(event);
            Utils.log('Key released (document):', keyCode);
        }

        // 4. Also dispatch to document body
        document.body.dispatchEvent(event);
    }

    /**
     * Release all active keys
     */
    releaseAllKeys() {
        this.activeKeys.forEach((keyCode) => {
            this.releaseKey(keyCode);
        });
        this.activeKeys.clear();
        Utils.log('All keys released');
    }

    /**
     * Get key code value for KeyboardEvent
     * @param {string} key - Key string
     * @returns {string} Code value
     */
    getKeyCodeValue(key) {
        const codeMap = {
            'ArrowUp': 'ArrowUp',
            'ArrowDown': 'ArrowDown',
            'ArrowLeft': 'ArrowLeft',
            'ArrowRight': 'ArrowRight',
            'Enter': 'Enter',
            'Shift': 'ShiftLeft',
            ' ': 'Space'
        };

        return codeMap[key] || `Key${key.toUpperCase()}`;
    }

    /**
     * Get numeric key code for KeyboardEvent
     * @param {string} key - Key string
     * @returns {number} Numeric key code
     */
    getKeyCodeNumber(key) {
        const keyCodeMap = {
            'ArrowUp': 38,
            'ArrowDown': 40,
            'ArrowLeft': 37,
            'ArrowRight': 39,
            'Enter': 13,
            'Shift': 16,
            ' ': 32,
            'a': 65, 'b': 66, 'c': 67, 'd': 68, 'e': 69,
            'f': 70, 'g': 71, 'h': 72, 'i': 73, 'j': 74,
            'k': 75, 'l': 76, 'm': 77, 'n': 78, 'o': 79,
            'p': 80, 'q': 81, 'r': 82, 's': 83, 't': 84,
            'u': 85, 'v': 86, 'w': 87, 'x': 88, 'y': 89,
            'z': 90,
            '0': 48, '1': 49, '2': 50, '3': 51, '4': 52,
            '5': 53, '6': 54, '7': 55, '8': 56, '9': 57
        };

        return keyCodeMap[key] || 0;
    }

    /**
     * Set target element for keyboard events
     * @param {HTMLElement} element - Target element
     */
    setEmulatorElement(element) {
        this.targetElement = element || document;
        Utils.log('Emulator target element set');
    }

    /**
     * Get current key mapping
     * @returns {object} Current mapping scheme
     */
    getCurrentMapping() {
        return this.mappings ? this.mappings[this.currentScheme] : null;
    }

    /**
     * Get active keys
     * @returns {Set<string>} Set of active key codes
     */
    getActiveKeys() {
        return new Set(this.activeKeys);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmulatorBridge;
}
