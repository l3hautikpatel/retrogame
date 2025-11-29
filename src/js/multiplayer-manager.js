/**
 * Multiplayer Manager
 * Handles mapping multiple controllers to different EmulatorJS players
 */

import { log, showNotification } from './utils.js';

export class MultiplayerManager {
  constructor(emulatorBridge, peerManager) {
    this.emulatorBridge = emulatorBridge;
    this.peerManager = peerManager;
    this.playerAssignments = new Map(); // controllerId -> playerNumber
    this.multiplayerEnabled = false;
  }

  /**
   * Enable multiplayer mode - assign controllers to players
   */
  enableMultiplayer() {
    this.multiplayerEnabled = true;
    
    // Assign controllers to player slots
    const controllers = Array.from(this.peerManager.connections.values());
    
    controllers.forEach((controllerData, index) => {
      const playerNumber = index + 1; // Player 1, 2, 3, 4
      this.playerAssignments.set(controllerData.controllerId, playerNumber);
      
      // Notify controller of their player number
      controllerData.conn.send({
        type: 'player_assignment',
        playerNumber: playerNumber,
        message: `You are Player ${playerNumber}`
      });
    });

    log('Multiplayer mode enabled', this.playerAssignments);
    showNotification(`${controllers.length}-Player mode activated!`, 'success');
  }

  /**
   * Disable multiplayer - back to single player mode
   */
  disableMultiplayer() {
    this.multiplayerEnabled = false;
    this.playerAssignments.clear();
    
    // Set first controller as active
    const controllers = Array.from(this.peerManager.connections.values());
    if (controllers.length > 0) {
      this.peerManager.setActiveController(controllers[0].controllerId);
    }
    
    log('Multiplayer mode disabled');
    showNotification('Single player mode', 'info');
  }

  /**
   * Check if multiplayer is enabled
   */
  isMultiplayerEnabled() {
    return this.multiplayerEnabled;
  }

  /**
   * Get player number for a controller
   */
  getPlayerNumber(controllerId) {
    return this.playerAssignments.get(controllerId) || 1;
  }

  /**
   * Handle controller input in multiplayer mode
   */
  handleMultiplayerInput(data, controllerId) {
    if (!this.multiplayerEnabled) {
      // Single player mode - use emulator bridge as normal
      this.emulatorBridge.handleControllerInput(data);
      return;
    }

    // Multiplayer mode - map to specific player
    const playerNumber = this.getPlayerNumber(controllerId);
    
    // Create modified input data with player assignment
    const playerInput = {
      ...data,
      player: playerNumber
    };

    this.handlePlayerInput(playerInput);
  }

  /**
   * Handle input for a specific player
   */
  handlePlayerInput(data) {
    const { button, action, player } = data;
    
    // Parse button type and name
    const [buttonType, buttonName] = this.emulatorBridge.parseButton(button);
    if (!buttonType || !buttonName) return;

    // Get the keyboard key for this button
    const baseKey = this.emulatorBridge.getKeyCode(buttonType, buttonName);
    if (!baseKey) return;

    // Map to player-specific key
    // EmulatorJS uses different keys for each player
    const playerKey = this.getPlayerKey(baseKey, player);

    // Simulate the keyboard event
    if (action === 'press') {
      this.emulatorBridge.pressKey(playerKey);
    } else if (action === 'release') {
      this.emulatorBridge.releaseKey(playerKey);
    }
  }

  /**
   * Get player-specific key mapping
   * EmulatorJS default controls:
   * Player 1: Arrow Keys, Z, X, A, S, Q, W, Enter, Shift
   * Player 2: WASD, N, M, U, I, T, Y, G, H
   * Player 3: IJKL, V, B, 7, 8, 4, 5, 1, 2
   * Player 4: Numpad
   */
  getPlayerKey(baseKey, playerNumber) {
    // Player 1 uses default keys
    if (playerNumber === 1) {
      return baseKey;
    }

    // Mapping for Player 2
    const player2Map = {
      'ArrowUp': 'w',
      'ArrowDown': 's',
      'ArrowLeft': 'a',
      'ArrowRight': 'd',
      'z': 'n', // A button
      'x': 'm', // B button
      'a': 'u', // Y button
      's': 'i', // X button
      'q': 't', // L button
      'w': 'y', // R button
      'e': '6', // L2 button
      'r': '7', // R2 button
      'Enter': 'g',
      'Shift': 'h'
    };

    // Mapping for Player 3
    const player3Map = {
      'ArrowUp': 'i',
      'ArrowDown': 'k',
      'ArrowLeft': 'j',
      'ArrowRight': 'l',
      'z': 'v', // A button
      'x': 'b', // B button
      'a': '7', // Y button
      's': '8', // X button
      'q': '4', // L button
      'w': '5', // R button
      'Enter': '1',
      'Shift': '2'
    };

    // Mapping for Player 4 (numpad)
    const player4Map = {
      'ArrowUp': '8', // Numpad 8
      'ArrowDown': '5', // Numpad 5
      'ArrowLeft': '4', // Numpad 4
      'ArrowRight': '6', // Numpad 6
      'z': '0', // Numpad 0
      'x': '.', // Numpad .
      'Enter': 'Enter' // Numpad Enter
    };

    const maps = [player2Map, player3Map, player4Map];
    const map = maps[playerNumber - 2]; // -2 because Player 1 is default

    return map && map[baseKey] ? map[baseKey] : baseKey;
  }

  /**
   * Get connected player count
   */
  getPlayerCount() {
    return this.playerAssignments.size;
  }
}