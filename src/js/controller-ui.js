/**
 * ControllerUI - Mobile Touch Interface
 * Handles touch events and UI interactions on mobile controller
 */

class ControllerUI {
    constructor(peerManager) {
        this.peerManager = peerManager;
        this.buttons = new Map();
        this.isActive = false;
        this.controllerId = null;
        this.isConnected = false;
        this.roomCode = null; // Store room code
    }

    /**
     * Initialize UI and event listeners
     */
    initialize() {
        Utils.log('Initializing controller UI');
        this.setupButtons();
        this.attachEventListeners();
        this.updateConnectionStatus(false, null, false);
    }

    /**
     * Setup button configurations
     */
    setupButtons() {
        // Face buttons
        this.buttons.set('btn-a', { element: document.getElementById('btn-a'), button: 'face_buttons.a' });
        this.buttons.set('btn-b', { element: document.getElementById('btn-b'), button: 'face_buttons.b' });
        this.buttons.set('btn-x', { element: document.getElementById('btn-x'), button: 'face_buttons.x' });
        this.buttons.set('btn-y', { element: document.getElementById('btn-y'), button: 'face_buttons.y' });

        // D-pad
        this.buttons.set('btn-up', { element: document.getElementById('btn-up'), button: 'dpad.up' });
        this.buttons.set('btn-down', { element: document.getElementById('btn-down'), button: 'dpad.down' });
        this.buttons.set('btn-left', { element: document.getElementById('btn-left'), button: 'dpad.left' });
        this.buttons.set('btn-right', { element: document.getElementById('btn-right'), button: 'dpad.right' });

        // Shoulder buttons
        this.buttons.set('btn-l', { element: document.getElementById('btn-l'), button: 'shoulder.l' });
        this.buttons.set('btn-r', { element: document.getElementById('btn-r'), button: 'shoulder.r' });
        this.buttons.set('btn-l2', { element: document.getElementById('btn-l2'), button: 'shoulder.l2' });
        this.buttons.set('btn-r2', { element: document.getElementById('btn-r2'), button: 'shoulder.r2' });

        // System buttons
        this.buttons.set('btn-start', { element: document.getElementById('btn-start'), button: 'system.start' });
        this.buttons.set('btn-select', { element: document.getElementById('btn-select'), button: 'system.select' });
    }

    /**
     * Attach event listeners to all buttons
     */
    attachEventListeners() {
        this.buttons.forEach((config, buttonId) => {
            const element = config.element;

            if (!element) {
                Utils.error('Button element not found:', buttonId);
                return;
            }

            // Touch events
            element.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.handleTouchStart(e, buttonId);
            }, { passive: false });

            element.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.handleTouchEnd(e, buttonId);
            }, { passive: false });

            element.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                this.handleTouchEnd(e, buttonId);
            }, { passive: false });

            // Mouse events (for desktop testing)
            element.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.handleTouchStart(e, buttonId);
            });

            element.addEventListener('mouseup', (e) => {
                e.preventDefault();
                this.handleTouchEnd(e, buttonId);
            });

            element.addEventListener('mouseleave', (e) => {
                this.handleTouchEnd(e, buttonId);
            });
        });

        // Toggle triggers button
        const toggleTriggersBtn = document.getElementById('toggle-triggers');
        if (toggleTriggersBtn) {
            toggleTriggersBtn.addEventListener('click', () => {
                this.toggleTriggers();
            });
        }

        // Toggle D-Pad/Joystick button
        const toggleDpadBtn = document.getElementById('toggle-dpad');
        if (toggleDpadBtn) {
            toggleDpadBtn.addEventListener('click', () => {
                this.toggleDpadMode();
            });
        }

        // Setup virtual joystick
        this.setupVirtualJoystick();
    }

    /**
     * Setup virtual joystick
     */
    setupVirtualJoystick() {
        const joystick = document.getElementById('virtual-joystick');
        const stick = document.getElementById('joystick-stick');

        if (!joystick || !stick) return;

        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let currentDirection = null;
        let touchId = null; // Track which touch is controlling the joystick

        const handleStart = (e) => {
            if (!this.isActive || !this.isConnected) return;

            // Only start if touch is within joystick bounds
            const touch = e.touches ? e.touches[0] : e;
            const rect = joystick.getBoundingClientRect();

            // Check if touch is within joystick area
            if (touch.clientX < rect.left || touch.clientX > rect.right ||
                touch.clientY < rect.top || touch.clientY > rect.bottom) {
                return; // Touch is outside joystick, ignore
            }

            isDragging = true;
            touchId = e.touches ? e.touches[0].identifier : null;
            startX = rect.left + rect.width / 2;
            startY = rect.top + rect.height / 2;
        };

        const handleMove = (e) => {
            if (!isDragging) return;

            // Find the correct touch if using touch events
            let touch;
            if (e.touches) {
                // Find the touch that started the drag
                for (let i = 0; i < e.touches.length; i++) {
                    if (e.touches[i].identifier === touchId) {
                        touch = e.touches[i];
                        break;
                    }
                }
                if (!touch) return; // Our touch ended
            } else {
                touch = e;
            }

            e.preventDefault();

            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;

            // Limit stick movement to joystick radius
            const maxDistance = 60;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const limitedDistance = Math.min(distance, maxDistance);
            const angle = Math.atan2(deltaY, deltaX);

            const x = limitedDistance * Math.cos(angle);
            const y = limitedDistance * Math.sin(angle);

            // Move stick
            stick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

            // Determine direction
            const threshold = 20;
            let newDirection = null;

            if (limitedDistance > threshold) {
                const degrees = (angle * 180 / Math.PI + 360) % 360;

                if (degrees >= 315 || degrees < 45) newDirection = 'right';
                else if (degrees >= 45 && degrees < 135) newDirection = 'down';
                else if (degrees >= 135 && degrees < 225) newDirection = 'left';
                else if (degrees >= 225 && degrees < 315) newDirection = 'up';
            }

            // Send direction changes
            if (newDirection !== currentDirection) {
                // Release old direction
                if (currentDirection) {
                    this.sendInput(`dpad.${currentDirection}`, 'release');
                }

                // Press new direction
                if (newDirection) {
                    this.sendInput(`dpad.${newDirection}`, 'press');
                }

                currentDirection = newDirection;
            }
        };

        const handleEnd = (e) => {
            if (!isDragging) return;

            // Check if our specific touch ended
            if (e.changedTouches) {
                let ourTouchEnded = false;
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === touchId) {
                        ourTouchEnded = true;
                        break;
                    }
                }
                if (!ourTouchEnded) return; // Different touch ended
            }

            isDragging = false;
            touchId = null;
            stick.style.transform = 'translate(-50%, -50%)';

            // Release current direction
            if (currentDirection) {
                this.sendInput(`dpad.${currentDirection}`, 'release');
                currentDirection = null;
            }
        };

        // Touch events
        joystick.addEventListener('touchstart', handleStart, { passive: false });
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', handleEnd);
        document.addEventListener('touchcancel', handleEnd);

        // Mouse events for testing
        joystick.addEventListener('mousedown', handleStart);
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
    }

    /**
     * Handle touch start event
     * @param {Event} event - Touch or mouse event
     * @param {string} buttonId - Button identifier
     */
    handleTouchStart(event, buttonId) {
        if (!this.isActive || !this.isConnected) {
            return; // Only active controller can send input
        }

        this.pressButton(buttonId);
    }

    /**
     * Handle touch end event
     * @param {Event} event - Touch or mouse event
     * @param {string} buttonId - Button identifier
     */
    handleTouchEnd(event, buttonId) {
        if (!this.isActive || !this.isConnected) {
            return;
        }

        this.releaseButton(buttonId);
    }

    /**
     * Press button
     * @param {string} buttonId - Button identifier
     */
    pressButton(buttonId) {
        const config = this.buttons.get(buttonId);

        if (!config) return;

        // Visual feedback
        config.element.classList.add('active');

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(30);
        }

        // Send input to host
        this.sendInput(config.button, 'press');
    }

    /**
     * Release button
     * @param {string} buttonId - Button identifier
     */
    releaseButton(buttonId) {
        const config = this.buttons.get(buttonId);

        if (!config) return;

        // Visual feedback
        config.element.classList.remove('active');

        // Send input to host
        this.sendInput(config.button, 'release');
    }

    /**
     * Send input to host
     * @param {string} button - Button path (e.g., "face_buttons.a")
     * @param {string} action - Action (press/release)
     */
    sendInput(button, action) {
        if (!this.peerManager || !this.isConnected) {
            Utils.log('Cannot send input - not connected');
            return;
        }

        const inputData = {
            type: 'input',
            button: button,
            action: action,
            timestamp: Date.now()
        };

        Utils.log('Sending input:', button, action);
        this.peerManager.send(inputData);
    }

    /**
     * Release all buttons
     */
    releaseAllButtons() {
        this.buttons.forEach((config, buttonId) => {
            config.element.classList.remove('active');
        });
    }

    /**
     * Update connection status
     * @param {boolean} connected - Connection status
     * @param {number} controllerId - Controller ID
     * @param {boolean} active - Active status
     * @param {string} roomCode - Room code (optional)
     */
    updateConnectionStatus(connected, controllerId, active, roomCode) {
        this.isConnected = connected;
        this.controllerId = controllerId;
        this.isActive = active;
        if (roomCode) {
            this.roomCode = roomCode;
        }

        const statusText = document.getElementById('status-text');
        const statusDot = document.getElementById('status-dot');
        const controllerInfo = document.getElementById('controller-info');

        if (connected) {
            if (active) {
                statusText.textContent = `Controller ${controllerId} (Active)`;
                statusDot.className = 'status-dot connected';
                this.setEnabled(true);
            } else {
                statusText.textContent = `Controller ${controllerId} (Standby)`;
                statusDot.className = 'status-dot inactive';
                this.setEnabled(false);
            }
            controllerInfo.textContent = `Room: ${this.roomCode || 'N/A'}`;
        } else {
            statusText.textContent = 'Not Connected';
            statusDot.className = 'status-dot disconnected';
            controllerInfo.textContent = '';
            this.setEnabled(false);
        }
    }

    /**
     * Set active status
     * @param {boolean} active - Active status
     */
    setActiveStatus(active) {
        this.isActive = active;
        this.updateConnectionStatus(this.isConnected, this.controllerId, active);

        if (!active) {
            this.releaseAllButtons();
        }
    }

    /**
     * Enable/disable controller
     * @param {boolean} enabled - Enabled status
     */
    setEnabled(enabled) {
        const gamepad = document.getElementById('gamepad');

        if (enabled) {
            gamepad.classList.remove('disabled');
        } else {
            gamepad.classList.add('disabled');
            this.releaseAllButtons();
        }
    }

    /**
     * Toggle triggers visibility
     */
    toggleTriggers() {
        const triggers = document.getElementById('triggers');
        const toggleBtn = document.getElementById('toggle-triggers');

        if (triggers.style.display === 'none') {
            triggers.style.display = 'flex';
            toggleBtn.textContent = 'Hide Triggers';
        } else {
            triggers.style.display = 'none';
            toggleBtn.textContent = 'Show Triggers';
        }
    }

    /**
     * Toggle between D-Pad and Joystick
     */
    toggleDpadMode() {
        const dpad = document.getElementById('dpad');
        const joystick = document.getElementById('virtual-joystick');
        const toggleBtn = document.getElementById('toggle-dpad');

        if (joystick.classList.contains('active')) {
            // Switch to D-Pad
            joystick.classList.remove('active');
            dpad.style.display = 'grid';
            toggleBtn.textContent = '🕹️ Joystick';
        } else {
            // Switch to Joystick
            joystick.classList.add('active');
            dpad.style.display = 'none';
            toggleBtn.textContent = '🎮 D-Pad';
        }
    }

    /**
     * Show controller info overlay
     * @param {number} controllerId - Controller ID
     */
    showControllerInfo(controllerId) {
        this.controllerId = controllerId;
        Utils.showToast(`You are Controller ${controllerId}`, 'success');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ControllerUI;
}
