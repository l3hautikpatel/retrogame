/**
 * Game Manager
 * Handles game library, ROM loading, and EmulatorJS integration
 */

import { loadConfig, showNotification, log, formatFileSize } from './utils.js';

export class GameManager {
  constructor() {
    this.games = [];
    this.systems = {};
    this.currentGame = null;
    this.emulatorInstance = null;
    this.onGameStartCallback = null;
  }

  /**
   * Initialize game manager and load game library
   */
  async initialize() {
    try {
      const config = await loadConfig('../config/games-library.json');
      if (!config) {
        throw new Error('Failed to load games library');
      }

      this.games = config.games || [];
      this.systems = config.systems || {};

      log('Game library loaded:', this.games.length, 'games');
      return true;
    } catch (error) {
      console.error('Error initializing game manager:', error);
      return false;
    }
  }

  /**
   * Get all games in the library
   */
  getGames() {
    return this.games;
  }

  /**
   * Get game by ID
   */
  getGameById(id) {
    return this.games.find(game => game.id === id);
  }

  /**
   * Get games by system
   */
  getGamesBySystem(system) {
    return this.games.filter(game => game.system === system);
  }

  /**
   * Load and start a game from the library
   */
  async loadGame(gameId) {
    const game = this.getGameById(gameId);
    if (!game) {
      showNotification('Game not found', 'error');
      return false;
    }

    try {
      showNotification(`Loading ${game.title}...`, 'info');

      // Check if ROM file exists
      const romExists = await this.checkRomExists(game.romPath);
      if (!romExists) {
        showNotification(`ROM file not found: ${game.title}`, 'error');
        return false;
      }

      // Start emulator with the game
      await this.startEmulator(game.romPath, game.core);

      this.currentGame = game;
      showNotification(`${game.title} loaded!`, 'success');

      if (this.onGameStartCallback) {
        this.onGameStartCallback(game);
      }

      return true;
    } catch (error) {
      console.error('Error loading game:', error);
      showNotification('Failed to load game', 'error');
      return false;
    }
  }

  /**
   * Load a custom ROM file uploaded by user
   */
  async loadCustomRom(file) {
    try {
      showNotification(`Loading ${file.name}...`, 'info');

      // Detect system from file extension
      const extension = '.' + file.name.split('.').pop().toLowerCase();
      const system = this.detectSystemFromExtension(extension);

      if (!system) {
        showNotification('Unsupported ROM format', 'error');
        return false;
      }

      log('Detected system:', system.name);

      // Create object URL for the ROM file
      const romUrl = URL.createObjectURL(file);

      // Start emulator
      await this.startEmulator(romUrl, system.core);

      this.currentGame = {
        id: 'custom',
        title: file.name,
        system: system.core,
        romPath: romUrl,
        custom: true
      };

      showNotification(`${file.name} loaded! (${formatFileSize(file.size)})`, 'success');

      if (this.onGameStartCallback) {
        this.onGameStartCallback(this.currentGame);
      }

      return true;
    } catch (error) {
      console.error('Error loading custom ROM:', error);
      showNotification('Failed to load ROM file', 'error');
      return false;
    }
  }

  /**
   * Detect system from file extension
   */
  detectSystemFromExtension(extension) {
    for (const [key, system] of Object.entries(this.systems)) {
      if (system.extensions.includes(extension)) {
        return system;
      }
    }
    return null;
  }

  /**
   * Check if ROM file exists
   */
  async checkRomExists(romPath) {
    try {
      const response = await fetch(romPath, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start EmulatorJS with the given ROM
   */
  async startEmulator(romPath, core) {
    return new Promise((resolve, reject) => {
      try {
        // Clear any existing emulator
        this.stopEmulator();

        // Ensure the game container is ready
        const gameContainer = document.getElementById('game');
        if (!gameContainer) {
          throw new Error('Game container not found');
        }

        // Make sure container is visible and has dimensions
        gameContainer.style.display = 'flex';
        gameContainer.style.width = '100%';
        gameContainer.style.height = '100%';

        // Configure EmulatorJS global settings
        window.EJS_player = '#game';
        window.EJS_core = core;
        window.EJS_gameUrl = romPath;

        // Data path - using STABLE EmulatorJS CDN
        window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';

        // Start settings - DISABLE AUTO-START to avoid settings menu
        window.EJS_startOnLoaded = false; // Don't auto-start, let user start manually
        window.EJS_biosUrl = '';
        window.EJS_gameID = this.currentGame?.id || 'custom';

        // Visual settings
        window.EJS_color = '#00ff00';
        window.EJS_backgroundColor = '#0f0f23';

        // Language
        window.EJS_language = 'en-US';

        // Multi-player support (allows 2+ controllers)
        window.EJS_numPlayers = 2; // Support 2 players simultaneously

        // CRITICAL: Disable UI overlays and virtual controls
        window.EJS_VirtualGamepadSettings = false; // Disable virtual gamepad overlay
        window.EJS_oldCores = false;
        window.EJS_Buttons = false; // Hide control buttons
        window.EJS_defaultControllers = 1; // Default to keyboard control
        window.EJS_gamepadLayout = 'none'; // No gamepad layout overlay
        window.EJS_menuWidth = 0; // Hide menu

        // Cache settings
        window.EJS_cacheBlobSize = 4 * 1024 * 1024; // 4MB chunks

        // Remove any existing EmulatorJS script
        const existingScript = document.querySelector('script[src*="EmulatorJS"]');
        if (existingScript) {
          existingScript.remove();
        }

        // Load EmulatorJS - using STABLE CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
        script.async = true;

        script.onload = () => {
          log('EmulatorJS script loaded');

          // Give EmulatorJS time to initialize
          setTimeout(() => {
            // Check if canvas was created
            const canvas = gameContainer.querySelector('canvas');
            if (canvas) {
              log('EmulatorJS canvas created successfully');

              // FORCE HIDE ALL EMULATORJS UI OVERLAYS
              setTimeout(() => {
                // Hide settings menu overlay
                const menuOverlay = document.querySelector('.ejs-menu');
                if (menuOverlay) {
                  menuOverlay.style.display = 'none';
                  log('Hid EmulatorJS menu overlay');
                }

                // Hide any control panels
                const controlPanels = document.querySelectorAll('[class*="control"], [class*="settings"], [class*="menu"]');
                controlPanels.forEach(panel => {
                  if (panel !== gameContainer && !gameContainer.contains(panel.closest('canvas'))) {
                    panel.style.display = 'none';
                  }
                });

                // Try to click/trigger play if there's a play button
                const playButton = document.querySelector('.ejs-play-button, [class*="play"]');
                if (playButton) {
                  playButton.click();
                  log('Clicked play button');
                }

                log('Force-closed all EmulatorJS UI overlays');
              }, 500); // Wait half second after canvas creation

              resolve(true);
            } else {
              log('Warning: EmulatorJS canvas not found, but continuing...');
              resolve(true);
            }
          }, 2000);
        };

        script.onerror = (error) => {
          console.error('Failed to load EmulatorJS:', error);
          reject(error);
        };

        document.body.appendChild(script);

      } catch (error) {
        console.error('Error starting emulator:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the current emulator
   */
  stopEmulator() {
    log('Stopping emulator...');

    // Try to stop EmulatorJS properly - CRITICAL FIX
    if (window.EJS_emulator) {
      try {
        // Pause the emulator
        if (typeof window.EJS_emulator.pause === 'function') {
          window.EJS_emulator.pause();
        }

        // Stop the emulator
        if (typeof window.EJS_emulator.stop === 'function') {
          window.EJS_emulator.stop();
        }

        // Exit/destroy the emulator
        if (typeof window.EJS_emulator.exit === 'function') {
          window.EJS_emulator.exit();
        }

        // Additional cleanup
        if (typeof window.EJS_emulator.destroy === 'function') {
          window.EJS_emulator.destroy();
        }
      } catch (e) {
        console.log('Error stopping emulator:', e);
      }

      delete window.EJS_emulator;
    }

    // Stop all audio contexts
    try {
      // Get all audio/video elements and stop them
      const audioElements = document.querySelectorAll('audio, video');
      audioElements.forEach(el => {
        el.pause();
        el.src = '';
        el.load();
      });

      // Stop Web Audio API contexts
      if (window.AudioContext || window.webkitAudioContext) {
        if (window.audioContext) {
          window.audioContext.close();
        }
      }
    } catch (e) {
      console.log('Error stopping audio:', e);
    }

    // Remove EmulatorJS container content - IMPORTANT
    const gameContainer = document.getElementById('game');
    if (gameContainer) {
      // Clear all content
      gameContainer.innerHTML = '';

      // Reset styles to ensure it's ready for next game
      gameContainer.style.display = 'flex';
      gameContainer.style.width = '100%';
      gameContainer.style.height = '100%';

      // Force a reflow to ensure DOM is updated
      gameContainer.offsetHeight;
    }

    // Clean up object URLs
    if (this.currentGame?.custom && this.currentGame?.romPath) {
      try {
        URL.revokeObjectURL(this.currentGame.romPath);
      } catch (e) {
        console.log('Error revoking URL:', e);
      }
    }

    // Clear all EmulatorJS globals - CRITICAL
    delete window.EJS_player;
    delete window.EJS_core;
    delete window.EJS_gameUrl;
    delete window.EJS_pathtodata;
    delete window.EJS_gameID;
    delete window.EJS_startOnLoaded;
    delete window.EJS_biosUrl;
    delete window.EJS_color;
    delete window.EJS_backgroundColor;
    delete window.EJS_language;
    delete window.EJS_numPlayers;
    delete window.EJS_VirtualGamepadSettings;
    delete window.EJS_oldCores;
    delete window.EJS_cacheBlobSize;

    // Remove EmulatorJS scripts to force clean reload - CRITICAL
    const scripts = document.querySelectorAll('script[src*="emulator"]');
    scripts.forEach(script => script.remove());

    this.currentGame = null;
    log('Emulator stopped and cleaned up completely');
  }

  /**
   * Get current game info
   */
  getCurrentGame() {
    return this.currentGame;
  }

  /**
   * Set callback for game start events
   */
  onGameStart(callback) {
    this.onGameStartCallback = callback;
  }

  /**
   * Get supported systems
   */
  getSupportedSystems() {
    return this.systems;
  }
}