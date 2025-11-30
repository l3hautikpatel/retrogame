/**
 * GamepadManager - Physical Gamepad Support
 * Handles USB/Bluetooth gamepad input using Browser Gamepad API
 */

class GamepadManager {
    constructor(emulatorBridge) {
        this.emulatorBridge = emulatorBridge;
        this.isPolling = false;
        this.animationFrameId = null;
        this.previousState = {};
        this.deadzone = 0.3; // Analog stick deadzone
    }

    /**
     * Initialize gamepad support
     * @returns {boolean} Success status
     */
    initialize() {
        if (!('getGamepads' in navigator)) {
            Utils.log('Gamepad API not supported');
            return false;
        }

        Utils.log('Gamepad support initialized');

        // Listen for gamepad connection events
        window.addEventListener('gamepadconnected', (e) => {
            Utils.log('Gamepad connected:', e.gamepad.id);
            Utils.showToast(`Gamepad connected: ${e.gamepad.id}`, 'success');

            if (!this.isPolling) {
                this.start();
            }
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            Utils.log('Gamepad disconnected:', e.gamepad.id);
            Utils.showToast('Gamepad disconnected', 'info');

            // Stop polling if no gamepads connected
            if (!this.hasGamepad()) {
                this.stop();
            }
        });

        return true;
    }

    /**
     * Start polling gamepad state
     */
    start() {
        if (this.isPolling) return;

        Utils.log('Starting gamepad polling');
        this.isPolling = true;
        this.pollGamepads();
    }

    /**
     * Stop polling gamepad state
     */
    stop() {
        if (!this.isPolling) return;

        Utils.log('Stopping gamepad polling');
        this.isPolling = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Poll gamepad state (60fps loop)
     */
    pollGamepads() {
        if (!this.isPolling) return;

        const gamepads = navigator.getGamepads();

        // Process first connected gamepad
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];

            if (gamepad) {
                this.processGamepad(gamepad);
                break; // Only process first gamepad
            }
        }

        this.animationFrameId = requestAnimationFrame(() => this.pollGamepads());
    }

    /**
     * Process gamepad input
     * @param {Gamepad} gamepad - Gamepad object
     */
    processGamepad(gamepad) {
        // Process buttons
        gamepad.buttons.forEach((button, index) => {
            const isPressed = button.pressed;
            const wasPressed = this.previousState[`button_${index}`] || false;

            if (isPressed && !wasPressed) {
                this.handleButtonPress(index);
            } else if (!isPressed && wasPressed) {
                this.handleButtonRelease(index);
            }

            this.previousState[`button_${index}`] = isPressed;
        });

        // Process analog sticks (convert to D-pad)
        this.processAnalogStick(gamepad.axes[0], gamepad.axes[1], 'left');
    }

    /**
     * Handle button press
     * @param {number} buttonIndex - Button index
     */
    handleButtonPress(buttonIndex) {
        const buttonMapping = this.getStandardButtonMapping(buttonIndex);

        if (buttonMapping) {
            this.emulatorBridge.handleControllerInput({
                button: buttonMapping,
                action: 'press'
            });
        }
    }

    /**
     * Handle button release
     * @param {number} buttonIndex - Button index
     */
    handleButtonRelease(buttonIndex) {
        const buttonMapping = this.getStandardButtonMapping(buttonIndex);

        if (buttonMapping) {
            this.emulatorBridge.handleControllerInput({
                button: buttonMapping,
                action: 'release'
            });
        }
    }

    /**
     * Process analog stick input
     * @param {number} xAxis - X axis value (-1 to 1)
     * @param {number} yAxis - Y axis value (-1 to 1)
     * @param {string} stick - Stick identifier (left/right)
     */
    processAnalogStick(xAxis, yAxis, stick) {
        // Horizontal axis
        if (Math.abs(xAxis) > this.deadzone) {
            const direction = xAxis > 0 ? 'right' : 'left';
            const stateKey = `${stick}_stick_x`;
            const currentDirection = this.previousState[stateKey];

            if (currentDirection !== direction) {
                // Release previous direction
                if (currentDirection) {
                    this.emulatorBridge.handleControllerInput({
                        button: `dpad.${currentDirection}`,
                        action: 'release'
                    });
                }

                // Press new direction
                this.emulatorBridge.handleControllerInput({
                    button: `dpad.${direction}`,
                    action: 'press'
                });

                this.previousState[stateKey] = direction;
            }
        } else {
            // Release horizontal
            const stateKey = `${stick}_stick_x`;
            const currentDirection = this.previousState[stateKey];

            if (currentDirection) {
                this.emulatorBridge.handleControllerInput({
                    button: `dpad.${currentDirection}`,
                    action: 'release'
                });
                this.previousState[stateKey] = null;
            }
        }

        // Vertical axis
        if (Math.abs(yAxis) > this.deadzone) {
            const direction = yAxis > 0 ? 'down' : 'up';
            const stateKey = `${stick}_stick_y`;
            const currentDirection = this.previousState[stateKey];

            if (currentDirection !== direction) {
                // Release previous direction
                if (currentDirection) {
                    this.emulatorBridge.handleControllerInput({
                        button: `dpad.${currentDirection}`,
                        action: 'release'
                    });
                }

                // Press new direction
                this.emulatorBridge.handleControllerInput({
                    button: `dpad.${direction}`,
                    action: 'press'
                });

                this.previousState[stateKey] = direction;
            }
        } else {
            // Release vertical
            const stateKey = `${stick}_stick_y`;
            const currentDirection = this.previousState[stateKey];

            if (currentDirection) {
                this.emulatorBridge.handleControllerInput({
                    button: `dpad.${currentDirection}`,
                    action: 'release'
                });
                this.previousState[stateKey] = null;
            }
        }
    }

    /**
     * Get standard button mapping
     * @param {number} buttonIndex - Button index
     * @returns {string|null} Button path
     */
    getStandardButtonMapping(buttonIndex) {
        const mapping = {
            0: 'face_buttons.a',      // A (Bottom)
            1: 'face_buttons.b',      // B (Right)
            2: 'face_buttons.x',      // X (Left)
            3: 'face_buttons.y',      // Y (Top)
            4: 'shoulder.l',          // L
            5: 'shoulder.r',          // R
            6: 'shoulder.l2',         // L2
            7: 'shoulder.r2',         // R2
            8: 'system.select',       // Select/Back
            9: 'system.start',        // Start
            12: 'dpad.up',            // D-pad Up
            13: 'dpad.down',          // D-pad Down
            14: 'dpad.left',          // D-pad Left
            15: 'dpad.right'          // D-pad Right
        };

        return mapping[buttonIndex] || null;
    }

    /**
     * Get connected gamepads
     * @returns {Array<Gamepad>} Array of connected gamepads
     */
    getConnectedGamepads() {
        const gamepads = navigator.getGamepads();
        return Array.from(gamepads).filter(gp => gp !== null);
    }

    /**
     * Check if any gamepad is connected
     * @returns {boolean}
     */
    hasGamepad() {
        return this.getConnectedGamepads().length > 0;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GamepadManager;
}
