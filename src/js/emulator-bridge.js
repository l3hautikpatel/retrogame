/**
 * Emulator Bridge
 * Bridges controller inputs to EmulatorJS keyboard events
 */

import { log, loadConfig } from './utils.js';

export class EmulatorBridge {
  constructor() {
    this.keyMapping = null;
    this.currentMapping = 'nintendo';
    this.activeKeys = new Set(); // Track currently pressed keys (Player 1 only, legacy)
    this.activeKeysByPlayer = new Map(); // Track per-player active keys: Map<playerSlot, Set<keyCode>>
    this.emulatorElement = null;

    // Initialize player key sets
    for (let i = 1; i <= 4; i++) {
      this.activeKeysByPlayer.set(i, new Set());
    }

    // Multi-player key mappings
    this.playerKeyMappings = this.initializePlayerKeyMappings();
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
   * Handle controller input and simulate keyboard event (Player 1 only - backward compatibility)
   * This is the BRIDGE between phone messages and keyboard simulation
   */
  handleControllerInput(data) {
    // Route to Player 1 for backward compatibility
    this.handleMultiPlayerInput(data, 1);
  }

  /**
   * Handle multi-player controller input with player slot routing
   * @param {Object} data - Input data with button and action
   * @param {number} playerSlot - Player slot (1-4)
   */
  handleMultiPlayerInput(data, playerSlot = 1) {
    const { button, action } = data; // action: 'press' or 'release'

    log(`Player ${playerSlot} input:`, data);

    // Parse button type and name (format: "dpad.up", "face_buttons.a", etc.)
    const [buttonType, buttonName] = this.parseButton(button);
    if (!buttonType || !buttonName) {
      console.warn('Invalid button format:', button);
      return;
    }

    // Get the keyboard key for this button and player
    const keyCode = this.getKeyCodeForPlayer(buttonType, buttonName, playerSlot);
    if (!keyCode) return;

    // Simulate the keyboard event
    if (action === 'press') {
      this.pressKeyForPlayer(keyCode, playerSlot);
    } else if (action === 'release') {
      this.releaseKeyForPlayer(keyCode, playerSlot);
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
   * Simulate key press event (Player 1 only - backward compatibility)
   */
  pressKey(keyCode) {
    this.pressKeyForPlayer(keyCode, 1);
  }

  /**
   * Simulate key release event (Player 1 only - backward compatibility)
   */
  releaseKey(keyCode) {
    this.releaseKeyForPlayer(keyCode, 1);
  }

  /**
   * Simulate key press event for specific player
   */
  pressKeyForPlayer(keyCode, playerSlot) {
    const activeKeys = this.activeKeysByPlayer.get(playerSlot);
    if (!activeKeys) {
      console.warn(`Invalid player slot: ${playerSlot}`);
      return;
    }

    // Prevent duplicate press events
    if (activeKeys.has(keyCode)) return;
    activeKeys.add(keyCode);

    // Also track in legacy set for Player 1
    if (playerSlot === 1) {
      this.activeKeys.add(keyCode);
    }

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

    log(`Player ${playerSlot} key pressed: ${keyCode}`);
  }

  /**
   * Simulate key release event for specific player
   */
  releaseKeyForPlayer(keyCode, playerSlot) {
    const activeKeys = this.activeKeysByPlayer.get(playerSlot);
    if (!activeKeys) {
      console.warn(`Invalid player slot: ${playerSlot}`);
      return;
    }

    // Only release if the key is currently pressed
    if (!activeKeys.has(keyCode)) return;
    activeKeys.delete(keyCode);

    // Also remove from legacy set for Player 1
    if (playerSlot === 1) {
      this.activeKeys.delete(keyCode);
    }

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

    log(`Player ${playerSlot} key released: ${keyCode}`);
  }

  /**
   * Initialize player-specific key mappings
   */
  initializePlayerKeyMappings() {
    return {
      1: { // Player 1: Arrow keys, Z/X, Shift/Enter
        dpad: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
        face_buttons: { a: 'x', b: 'z', x: 's', y: 'a' },
        shoulder_buttons: { l: 'q', r: 'w', l2: 'e', r2: 'r' },
        system_buttons: { start: 'Enter', select: 'Shift' }
      },
      2: { // Player 2: WASD, 1/2, Tab/Space
        dpad: { up: 'w', down: 's', left: 'a', right: 'd' },
        face_buttons: { a: '2', b: '1', x: '4', y: '3' },
        shoulder_buttons: { l: '5', r: '6', l2: '7', r2: '8' },
        system_buttons: { start: ' ', select: 'Tab' }
      },
      3: { // Player 3: IJKL, 7/8, U/O
        dpad: { up: 'i', down: 'k', left: 'j', right: 'l' },
        face_buttons: { a: 'n', b: 'm', x: ',', y: '.' },
        shoulder_buttons: { l: 'u', r: 'o', l2: 'p', r2: '[' },
        system_buttons: { start: 'h', select: 'g' }
      },
      4: { // Player 4: Numpad (if available)
        dpad: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }, // Fallback to arrows
        face_buttons: { a: '-', b: '+', x: '*', y: '/' },
        shoulder_buttons: { l: '9', r: '0', l2: '=', r2: 'Backspace' },
        system_buttons: { start: ']', select: '\\' }
      }
    };
  }

  /**
   * Get key code for specific player and button
   */
  getKeyCodeForPlayer(buttonType, buttonName, playerSlot) {
    const playerMapping = this.playerKeyMappings[playerSlot];
    if (!playerMapping) {
      console.warn(`No mapping for player ${playerSlot}`);
      return null;
    }

    if (!playerMapping[buttonType]) {
      console.warn(`Invalid button type for player ${playerSlot}:`, buttonType);
      return null;
    }

    const keyChar = playerMapping[buttonType][buttonName];
    if (!keyChar) {
      console.warn(`Button not found for player ${playerSlot}:`, buttonName);
      return null;
    }

    return keyChar;
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
      'Tab': 'Tab',
      ' ': 'Space',
      'z': 'KeyZ',
      'x': 'KeyX',
      'a': 'KeyA',
      's': 'KeyS',
      'q': 'KeyQ',
      'w': 'KeyW',
      'e': 'KeyE',
      'r': 'KeyR',
      'c': 'KeyC',
      'd': 'KeyD',
      'i': 'KeyI',
      'j': 'KeyJ',
      'k': 'KeyK',
      'l': 'KeyL',
      'n': 'KeyN',
      'm': 'KeyM',
      'u': 'KeyU',
      'o': 'KeyO',
      'p': 'KeyP',
      'g': 'KeyG',
      'h': 'KeyH',
      '1': 'Digit1',
      '2': 'Digit2',
      '3': 'Digit3',
      '4': 'Digit4',
      '5': 'Digit5',
      '6': 'Digit6',
      '7': 'Digit7',
      '8': 'Digit8',
      '9': 'Digit9',
      '0': 'Digit0',
      ',': 'Comma',
      '.': 'Period',
      '-': 'Minus',
      '+': 'Equal',
      '*': 'Multiply',
      '/': 'Slash',
      '=': 'Equal',
      '[': 'BracketLeft',
      ']': 'BracketRight',
      '\\': 'Backslash',
      'Backspace': 'Backspace'
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
      'Tab': 9,
      ' ': 32,
      'z': 90,
      'x': 88,
      'a': 65,
      's': 83,
      'q': 81,
      'w': 87,
      'e': 69,
      'r': 82,
      'c': 67,
      'd': 68,
      'i': 73,
      'j': 74,
      'k': 75,
      'l': 76,
      'n': 78,
      'm': 77,
      'u': 85,
      'o': 79,
      'p': 80,
      'g': 71,
      'h': 72,
      '1': 49,
      '2': 50,
      '3': 51,
      '4': 52,
      '5': 53,
      '6': 54,
      '7': 55,
      '8': 56,
      '9': 57,
      '0': 48,
      ',': 188,
      '.': 190,
      '-': 189,
      '+': 187,
      '*': 106,
      '/': 191,
      '=': 187,
      '[': 219,
      ']': 221,
      '\\': 220,
      'Backspace': 8
    };
    return keyCodeValues[key] || 0;
  }

  /**
   * Release all currently pressed keys for all players
   */
  releaseAllKeys() {
    // Release all keys for all players
    for (let playerSlot = 1; playerSlot <= 4; playerSlot++) {
      this.releaseAllKeysForPlayer(playerSlot);
    }

    // Also clear legacy set
    this.activeKeys.clear();
  }

  /**
   * Release all keys for a specific player
   */
  releaseAllKeysForPlayer(playerSlot) {
    const activeKeys = this.activeKeysByPlayer.get(playerSlot);
    if (!activeKeys) return;

    activeKeys.forEach(keyCode => {
      this.releaseKeyForPlayer(keyCode, playerSlot);
    });
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