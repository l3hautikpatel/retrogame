/**
 * Emulator Bridge
 * Bridges controller inputs to EmulatorJS keyboard events
 */

import { log, loadConfig } from './utils.js';

export class EmulatorBridge {
  constructor() {
    this.keyMapping = null;
    this.currentMapping = 'nintendo';
    this.activeKeys = new Set(); // Track currently pressed keys
    this.emulatorElement = null;
  }

  /**
   * Initialize the bridge and load key mappings
   */
  async initialize() {
    try {
      this.keyMapping = await loadConfig('../config/controller-mapping.json');
      if (!this.keyMapping) {
        throw new Error('Failed to load controller mapping');
      }
      log('Emulator bridge initialized with mappings:', this.keyMapping);
      return true;
    } catch (error) {
      console.error('Error initializing emulator bridge:', error);
      return false;
    }
  }

  /**
   * Set the current controller mapping scheme
   */
  setMappingScheme(scheme) {
    if (this.keyMapping.mappings[scheme]) {
      this.currentMapping = scheme;
      log('Switched to mapping scheme:', scheme);
      return true;
    }
    console.warn('Invalid mapping scheme:', scheme);
    return false;
  }

  /**
   * Convert controller button to keyboard key code
   */
  getKeyCode(buttonType, buttonName) {
    const mapping = this.keyMapping.mappings[this.currentMapping];
    
    if (!mapping || !mapping[buttonType]) {
      console.warn('Invalid button type:', buttonType);
      return null;
    }

    const keyChar = mapping[buttonType][buttonName];
    if (!keyChar) {
      console.warn('Button not found in mapping:', buttonName);
      return null;
    }

    return keyChar;
  }

  /**
   * Handle controller input and simulate keyboard event
   * This is the BRIDGE between phone messages and keyboard simulation
   */
  handleControllerInput(data) {
    const { button, action } = data; // action: 'press' or 'release'
    
    log('Controller input received:', data);

    // Parse button type and name (format: "dpad.up", "face_buttons.a", etc.)
    const [buttonType, buttonName] = this.parseButton(button);
    if (!buttonType || !buttonName) {
      console.warn('Invalid button format:', button);
      return;
    }

    // Get the keyboard key for this button
    const keyCode = this.getKeyCode(buttonType, buttonName);
    if (!keyCode) return;

    // Simulate the keyboard event
    if (action === 'press') {
      this.pressKey(keyCode);
    } else if (action === 'release') {
      this.releaseKey(keyCode);
    }
  }

  /**
   * Parse button identifier (e.g., "dpad.up" -> ["dpad", "up"])
   */
  parseButton(button) {
    const parts = button.split('.');
    if (parts.length !== 2) {
      // Try to infer button type
      if (['up', 'down', 'left', 'right'].includes(button)) {
        return ['dpad', button];
      } else if (['a', 'b', 'x', 'y'].includes(button)) {
        return ['face_buttons', button];
      } else if (['start', 'select'].includes(button)) {
        return ['system_buttons', button];
      } else if (['l', 'r', 'l2', 'r2'].includes(button)) {
        return ['shoulder_buttons', button];
      }
      return [null, null];
    }
    return parts;
  }

  /**
   * Simulate key press event
   * This creates a KeyboardEvent that EmulatorJS can intercept
   */
  pressKey(keyCode) {
    // Prevent duplicate press events
    if (this.activeKeys.has(keyCode)) return;
    this.activeKeys.add(keyCode);

    const event = new KeyboardEvent('keydown', {
      key: keyCode,
      code: this.getKeyCodeName(keyCode),
      keyCode: this.getKeyCodeValue(keyCode),
      which: this.getKeyCodeValue(keyCode),
      bubbles: true,
      cancelable: true
    });

    // Dispatch to the emulator container or document
    const target = this.emulatorElement || document;
    target.dispatchEvent(event);
    
    log(`Key pressed: ${keyCode}`);
  }

  /**
   * Simulate key release event
   */
  releaseKey(keyCode) {
    // Only release if the key is currently pressed
    if (!this.activeKeys.has(keyCode)) return;
    this.activeKeys.delete(keyCode);

    const event = new KeyboardEvent('keyup', {
      key: keyCode,
      code: this.getKeyCodeName(keyCode),
      keyCode: this.getKeyCodeValue(keyCode),
      which: this.getKeyCodeValue(keyCode),
      bubbles: true,
      cancelable: true
    });

    const target = this.emulatorElement || document;
    target.dispatchEvent(event);
    
    log(`Key released: ${keyCode}`);
  }

  /**
   * Get key code name for KeyboardEvent
   */
  getKeyCodeName(key) {
    const keyCodeMap = {
      'ArrowUp': 'ArrowUp',
      'ArrowDown': 'ArrowDown',
      'ArrowLeft': 'ArrowLeft',
      'ArrowRight': 'ArrowRight',
      'Enter': 'Enter',
      'Shift': 'ShiftLeft',
      'z': 'KeyZ',
      'x': 'KeyX',
      'a': 'KeyA',
      's': 'KeyS',
      'q': 'KeyQ',
      'w': 'KeyW',
      'e': 'KeyE',
      'r': 'KeyR',
      'c': 'KeyC'
    };
    return keyCodeMap[key] || key;
  }

  /**
   * Get numeric key code value for KeyboardEvent
   */
  getKeyCodeValue(key) {
    const keyCodeValues = {
      'ArrowUp': 38,
      'ArrowDown': 40,
      'ArrowLeft': 37,
      'ArrowRight': 39,
      'Enter': 13,
      'Shift': 16,
      'z': 90,
      'x': 88,
      'a': 65,
      's': 83,
      'q': 81,
      'w': 87,
      'e': 69,
      'r': 82,
      'c': 67
    };
    return keyCodeValues[key] || 0;
  }

  /**
   * Release all currently pressed keys
   */
  releaseAllKeys() {
    this.activeKeys.forEach(keyCode => {
      this.releaseKey(keyCode);
    });
    this.activeKeys.clear();
  }

  /**
   * Set the emulator element for targeted event dispatch
   */
  setEmulatorElement(element) {
    this.emulatorElement = element;
  }

  /**
   * Get current mapping configuration for display
   */
  getCurrentMapping() {
    return this.keyMapping.mappings[this.currentMapping];
  }
}