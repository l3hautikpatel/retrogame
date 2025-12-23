/**
 * GameManager - ROM Loading and Emulator Initialization
 * Handles game library, ROM loading, and EmulatorJS lifecycle
 */

class GameManager {
    constructor() {
        this.games = [];
        this.currentGame = null;
        this.emulatorLoaded = false;
        this.onGameStartCallback = null;
    }

    /**
     * Initialize game manager and load library
     * @returns {Promise<boolean>}
     */
    async initialize() {
        try {
            const response = await fetch('../config/games-library.json');
            const data = await response.json();
            this.games = data.games || [];
            Utils.log('Game library loaded:', this.games.length, 'games');
            return true;
        } catch (error) {
            Utils.error('Failed to load game library:', error);
            this.games = [];
            return false;
        }
    }

    /**
     * Get all games
     * @returns {Array<object>} Array of game objects
     */
    getGames() {
        return this.games;
    }

    /**
     * Get game by ID
     * @param {string} id - Game ID
     * @returns {object|null} Game object or null
     */
    getGameById(id) {
        return this.games.find(game => game.id === id) || null;
    }

    /**
     * Load game from library
     * @param {string} gameId - Game ID to load
     * @returns {Promise<boolean>}
     */
    async loadGame(gameId) {
        const game = this.getGameById(gameId);

        if (!game) {
            Utils.error('Game not found:', gameId);
            Utils.showToast('Game not found', 'error');
            return false;
        }

        Utils.log('Loading game:', game.title);

        try {
            await this.initializeEmulator(game.core, game.romPath, game.mapping);
            this.currentGame = game;

            if (this.onGameStartCallback) {
                this.onGameStartCallback(game);
            }

            Utils.showToast(`Loaded: ${game.title}`, 'success');
            return true;
        } catch (error) {
            Utils.error('Failed to load game:', error);
            Utils.showToast('Failed to load game', 'error');
            return false;
        }
    }

    /**
     * Load custom ROM file
     * @param {File} file - ROM file
     * @returns {Promise<boolean>}
     */
    async loadCustomRom(file) {
        if (!file) {
            Utils.error('No file provided');
            return false;
        }

        Utils.log('Loading custom ROM:', file.name, Utils.formatFileSize(file.size));

        // Detect emulator core from file extension
        const core = Utils.detectEmulatorCore(file.name);

        if (!core) {
            Utils.error('Unsupported file type:', file.name);
            Utils.showToast('Unsupported file type', 'error');
            return false;
        }

        try {
            // Read file as Data URL
            const dataUrl = await this.readFileAsDataUrl(file);

            // Determine mapping scheme based on core
            const mapping = this.getMappingForCore(core);

            // Initialize emulator
            await this.initializeEmulator(core, dataUrl, mapping);

            // Create custom game object
            this.currentGame = {
                id: 'custom',
                title: file.name,
                system: core.toUpperCase(),
                core: core,
                romPath: dataUrl,
                custom: true,
                mapping: mapping
            };

            if (this.onGameStartCallback) {
                this.onGameStartCallback(this.currentGame);
            }

            Utils.showToast(`Loaded: ${file.name}`, 'success');
            return true;
        } catch (error) {
            Utils.error('Failed to load custom ROM:', error);
            Utils.showToast('Failed to load ROM', 'error');
            return false;
        }
    }

    /**
     * Read file as Data URL
     * @param {File} file - File to read
     * @returns {Promise<string>} Data URL
     */
    readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                resolve(e.target.result);
            };

            reader.onerror = (e) => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsDataURL(file);
        });
    }

    /**
     * Get mapping scheme for emulator core
     * @param {string} core - Emulator core
     * @returns {string} Mapping scheme name
     */
    getMappingForCore(core) {
        const coreMapping = {
            'nes': 'nintendo',
            'snes': 'nintendo',
            'n64': 'nintendo',
            'gba': 'nintendo',
            'gb': 'nintendo',
            'gbc': 'nintendo',
            'segaMD': 'sega',
            'segaMS': 'sega',
            'segaGG': 'sega',
            'psx': 'playstation',
            'atari2600': 'nintendo' // Default to nintendo
        };

        return coreMapping[core] || 'nintendo';
    }

    /**
     * Initialize EmulatorJS
     * @param {string} core - Emulator core
     * @param {string} romUrl - ROM URL or Data URL
     * @param {string} mapping - Controller mapping scheme
     * @returns {Promise<void>}
     */
    async initializeEmulator(core, romUrl, mapping) {
        Utils.log('Initializing emulator:', core);

        // Stop existing emulator
        this.stopEmulator();

        // Configure EmulatorJS globals
        window.EJS_player = '#game';
        window.EJS_core = core;
        window.EJS_gameUrl = romUrl;
        window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
        window.EJS_startOnLoaded = true;
        window.EJS_color = '#00ff00';
        window.EJS_VirtualGamepadSettings = { enabled: false }; // Disable built-in virtual gamepad

        // Load EmulatorJS script
        return new Promise((resolve, reject) => {
            // Remove existing script if present
            const existingScript = document.getElementById('emulatorjs-script');
            if (existingScript) {
                existingScript.remove();
            }

            const script = document.createElement('script');
            script.id = 'emulatorjs-script';
            script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';

            script.onload = () => {
                Utils.log('EmulatorJS loaded successfully');
                this.emulatorLoaded = true;

                // Wait a bit for emulator to initialize
                setTimeout(() => {
                    resolve();
                }, 1000);
            };

            script.onerror = () => {
                Utils.error('Failed to load EmulatorJS');
                reject(new Error('Failed to load EmulatorJS'));
            };

            document.body.appendChild(script);
        });
    }

    /**
     * Stop current emulator
     */
    stopEmulator() {
        Utils.log('Stopping emulator');

        // Clear game container completely
        const gameContainer = document.getElementById('game');
        if (gameContainer) {
            gameContainer.innerHTML = '';
        }

        // Remove EmulatorJS script
        const script = document.getElementById('emulatorjs-script');
        if (script) {
            script.remove();
        }

        // Reset globals
        if (window.EJS_emulator) {
            try {
                window.EJS_emulator.pause();
            } catch (e) {
                // Ignore errors
            }
        }

        window.EJS_player = null;
        window.EJS_core = null;
        window.EJS_gameUrl = null;
        window.EJS_emulator = null;

        this.emulatorLoaded = false;
        this.currentGame = null;

        Utils.log('Emulator stopped');
    }

    /**
     * Get current game
     * @returns {object|null} Current game object
     */
    getCurrentGame() {
        return this.currentGame;
    }

    /**
     * Register game start callback
     * @param {Function} callback - Callback function
     */
    onGameStart(callback) {
        this.onGameStartCallback = callback;
    }

    /**
     * Get supported systems
     * @returns {object} Supported systems and their cores
     */
    getSupportedSystems() {
        return {
            'NES': 'nes',
            'SNES': 'snes',
            'Nintendo 64': 'n64',
            'Game Boy Advance': 'gba',
            'Game Boy': 'gb',
            'Game Boy Color': 'gbc',
            'Sega Genesis': 'segaMD',
            'Sega Master System': 'segaMS',
            'Sega Game Gear': 'segaGG',
            'PlayStation': 'psx',
            'Atari 2600': 'atari2600'
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameManager;
}
