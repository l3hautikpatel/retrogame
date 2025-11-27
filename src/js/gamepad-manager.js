/**
 * Physical Gamepad Manager
 * Detects and handles physical gamepads connected to the host computer
 */

import { log, showNotification } from './utils.js';

export class GamepadManager {
  constructor(emulatorBridge) {
    this.emulatorBridge = emulatorBridge;
    this.gamepads = {};
    this.activeGamepad = null;
    this.animationFrame = null;
    this.buttonStates = {};
    this.axisThreshold = 0.5; // Deadzone for analog sticks
    this.enabled = false;
  }

  /**
   * Initialize gamepad support
   */
  initialize() {
    if (!('getGamepads' in navigator)) {
      console.warn('Gamepad API not supported');
      return false;
    }

    // Listen for gamepad connection events
    window.addEventListener('gamepadconnected', (e) => this.onGamepadConnected(e));
    window.addEventListener('gamepaddisconnected', (e) => this.onGamepadDisconnected(e));

    // Check for already connected gamepads
    this.scanGamepads();

    log('Gamepad manager initialized');
    return true;
  }

  /**
   * Scan for connected gamepads
   */
  scanGamepads() {
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        this.addGamepad(gamepads[i]);
      }
    }
  }

  /**
   * Handle gamepad connection
   */
  onGamepadConnected(event) {
    const gamepad = event.gamepad;
    log('Gamepad connected:', gamepad.id, 'at index', gamepad.index);
    showNotification(`Gamepad connected: ${gamepad.id}`, 'success');
    
    this.addGamepad(gamepad);
  }

  /**
   * Handle gamepad disconnection
   */
  onGamepadDisconnected(event) {
    const gamepad = event.gamepad;
    log('Gamepad disconnected:', gamepad.id);
    showNotification('Gamepad disconnected', 'warning');
    
    this.removeGamepad(gamepad);
  }

  /**
   * Add gamepad to tracking
   */
  addGamepad(gamepad) {
    this.gamepads[gamepad.index] = gamepad;
    
    // Set first gamepad as active
    if (!this.activeGamepad) {
      this.activeGamepad = gamepad.index;
    }

    // Initialize button states
    this.buttonStates[gamepad.index] = {};
    for (let i = 0; i < gamepad.buttons.length; i++) {
      this.buttonStates[gamepad.index][i] = false;
    }
  }

  /**
   * Remove gamepad from tracking
   */
  removeGamepad(gamepad) {
    delete this.gamepads[gamepad.index];
    delete this.buttonStates[gamepad.index];
    
    if (this.activeGamepad === gamepad.index) {
      // Find another active gamepad
      const keys = Object.keys(this.gamepads);
      this.activeGamepad = keys.length > 0 ? parseInt(keys[0]) : null;
    }
  }

  /**
   * Start polling gamepad state
   */
  start() {
    if (this.enabled) return;
    
    this.enabled = true;
    this.pollGamepads();
    log('Gamepad polling started');
  }

  /**
   * Stop polling gamepad state
   */
  stop() {
    this.enabled = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    // Release all pressed buttons
    this.releaseAllButtons();
    log('Gamepad polling stopped');
  }

  /**
   * Poll gamepad state (called every frame)
   */
  pollGamepads() {
    if (!this.enabled) return;

    // Get fresh gamepad state
    const gamepads = navigator.getGamepads();
    
    if (this.activeGamepad !== null && gamepads[this.activeGamepad]) {
      const gamepad = gamepads[this.activeGamepad];
      this.processGamepad(gamepad);
    }

    this.animationFrame = requestAnimationFrame(() => this.pollGamepads());
  }

  /**
   * Process gamepad inputs
   */
  processGamepad(gamepad) {
    // Standard gamepad button mapping
    // https://www.w3.org/TR/gamepad/#remapping
    const buttonMapping = {
      0: 'face_buttons.a',      // A / Cross
      1: 'face_buttons.b',      // B / Circle
      2: 'face_buttons.x',      // X / Square
      3: 'face_buttons.y',      // Y / Triangle
      4: 'shoulder_buttons.l',  // L1 / LB
      5: 'shoulder_buttons.r',  // R1 / RB
      6: 'shoulder_buttons.l2', // L2 / LT
      7: 'shoulder_buttons.r2', // R2 / RT
      8: 'system_buttons.select', // Select / Back
      9: 'system_buttons.start',  // Start
      12: 'dpad.up',            // D-pad Up
      13: 'dpad.down',          // D-pad Down
      14: 'dpad.left',          // D-pad Left
      15: 'dpad.right'          // D-pad Right
    };

    // Process buttons
    gamepad.buttons.forEach((button, index) => {
      const isPressed = button.pressed || button.value > 0.5;
      const wasPressed = this.buttonStates[gamepad.index][index];

      if (isPressed && !wasPressed) {
        // Button pressed
        if (buttonMapping[index]) {
          this.emulatorBridge.handleControllerInput({
            button: buttonMapping[index],
            action: 'press'
          });
        }
      } else if (!isPressed && wasPressed) {
        // Button released
        if (buttonMapping[index]) {
          this.emulatorBridge.handleControllerInput({
            button: buttonMapping[index],
            action: 'release'
          });
        }
      }

      this.buttonStates[gamepad.index][index] = isPressed;
    });

    // Process analog sticks as D-pad (axes[0,1] = left stick, axes[2,3] = right stick)
    if (gamepad.axes.length >= 2) {
      this.processAnalogStick(gamepad.axes[0], gamepad.axes[1], gamepad.index);
    }
  }

  /**
   * Process analog stick as D-pad
   */
  processAnalogStick(xAxis, yAxis, gamepadIndex) {
    const stateKey = `${gamepadIndex}_analog`;
    
    if (!this.buttonStates[stateKey]) {
      this.buttonStates[stateKey] = {
        up: false,
        down: false,
        left: false,
        right: false
      };
    }

    // Horizontal axis
    if (xAxis < -this.axisThreshold && !this.buttonStates[stateKey].left) {
      this.emulatorBridge.handleControllerInput({ button: 'dpad.left', action: 'press' });
      this.buttonStates[stateKey].left = true;
    } else if (xAxis >= -this.axisThreshold && this.buttonStates[stateKey].left) {
      this.emulatorBridge.handleControllerInput({ button: 'dpad.left', action: 'release' });
      this.buttonStates[stateKey].left = false;
    }

    if (xAxis > this.axisThreshold && !this.buttonStates[stateKey].right) {
      this.emulatorBridge.handleControllerInput({ button: 'dpad.right', action: 'press' });
      this.buttonStates[stateKey].right = true;
    } else if (xAxis <= this.axisThreshold && this.buttonStates[stateKey].right) {
      this.emulatorBridge.handleControllerInput({ button: 'dpad.right', action: 'release' });
      this.buttonStates[stateKey].right = false;
    }

    // Vertical axis
    if (yAxis < -this.axisThreshold && !this.buttonStates[stateKey].up) {
      this.emulatorBridge.handleControllerInput({ button: 'dpad.up', action: 'press' });
      this.buttonStates[stateKey].up = true;
    } else if (yAxis >= -this.axisThreshold && this.buttonStates[stateKey].up) {
      this.emulatorBridge.handleControllerInput({ button: 'dpad.up', action: 'release' });
      this.buttonStates[stateKey].up = false;
    }

    if (yAxis > this.axisThreshold && !this.buttonStates[stateKey].down) {
      this.emulatorBridge.handleControllerInput({ button: 'dpad.down', action: 'press' });
      this.buttonStates[stateKey].down = true;
    } else if (yAxis <= this.axisThreshold && this.buttonStates[stateKey].down) {
      this.emulatorBridge.handleControllerInput({ button: 'dpad.down', action: 'release' });
      this.buttonStates[stateKey].down = false;
    }
  }

  /**
   * Release all pressed buttons (cleanup)
   */
  releaseAllButtons() {
    Object.keys(this.buttonStates).forEach(key => {
      if (typeof this.buttonStates[key] === 'object') {
        Object.keys(this.buttonStates[key]).forEach(btnKey => {
          this.buttonStates[key][btnKey] = false;
        });
      }
    });
  }

  /**
   * Get list of connected gamepads
   */
  getConnectedGamepads() {
    return Object.values(this.gamepads).filter(gp => gp !== null);
  }

  /**
   * Check if any gamepad is connected
   */
  hasGamepad() {
    return Object.keys(this.gamepads).length > 0;
  }
}