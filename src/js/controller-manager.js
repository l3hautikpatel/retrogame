/**
 * Controller Manager
 * Manages multiple controller connections with automatic player slot assignment,
 * reconnection handling, and game state preservation.
 */

import { log, showNotification } from './utils.js';

export class ControllerManager {
    constructor() {
        // Controller tracking: Map<physicalId, ControllerInfo>
        this.controllers = new Map();

        // Settings
        this.settings = {
            maxControllers: 4,
            autoEnablePlayer2: true,
            showControllerSwitch: false,
            hideTriggers: false,
            buttonSizeMultiplier: 1.0
        };

        // Reconnection timeout (30 seconds)
        this.reconnectTimeout = 30000;

        // Debounce timer
        this.debounceTimers = new Map();
        this.debounceDelay = 200; // ms

        // Event callbacks
        this.onControllerConnectCallback = null;
        this.onControllerDisconnectCallback = null;
        this.onPlayerAssignedCallback = null;
        this.onAllControllersDisconnectedCallback = null;
        this.onGameShouldStartCallback = null;

        // Game state tracking
        this.isGameRunning = false;
        this.currentGameIsMultiplayer = false;

        // Load settings from localStorage
        this.loadSettings();

        log('[ControllerManager] Initialized with settings:', this.settings);
    }

    /**
     * Get human-readable controller name + raw ID
     */
    getControllerDisplayName(physicalId, type = 'unknown') {
        const controller = this.controllers.get(physicalId);
        if (!controller) return physicalId;

        const humanName = this.getHumanReadableName(type, physicalId);
        const rawId = this.getRawIdShort(physicalId);

        return `${humanName} (${rawId})`;
    }

    /**
     * Generate human-readable name
     */
    getHumanReadableName(type, physicalId) {
        if (type === 'gamepad') {
            // Extract gamepad name from physicalId if available
            const match = physicalId.match(/^gamepad-(.+)-\d+$/);
            if (match) {
                return match[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
            return 'Physical Gamepad';
        } else if (type === 'peer') {
            return 'Mobile Controller';
        } else if (type === 'touch') {
            return 'Touch Screen';
        }
        return 'Controller';
    }

    /**
     * Get shortened raw ID for display
     */
    getRawIdShort(physicalId) {
        if (physicalId.length <= 12) return physicalId;
        return physicalId.substring(0, 8) + '...' + physicalId.substring(physicalId.length - 4);
    }

    /**
     * Connect a controller (with debouncing)
     */
    connectController(physicalId, type = 'peer', metadata = {}) {
        // Clear any existing debounce timer
        if (this.debounceTimers.has(physicalId)) {
            clearTimeout(this.debounceTimers.get(physicalId));
        }

        // Debounce the connection
        const timer = setTimeout(() => {
            this._performConnect(physicalId, type, metadata);
            this.debounceTimers.delete(physicalId);
        }, this.debounceDelay);

        this.debounceTimers.set(physicalId, timer);
    }

    /**
     * Internal: Actually perform the connection
     */
    _performConnect(physicalId, type, metadata) {
        const timestamp = new Date().toISOString();
        log(`[${timestamp}] Controller connect: ${physicalId} (type: ${type})`);

        // Check if controller already exists (reconnection scenario)
        if (this.controllers.has(physicalId)) {
            const controller = this.controllers.get(physicalId);

            // Check if we can reclaim previous slot
            const timeSinceDisconnect = Date.now() - (controller.lastSeenTimestamp || 0);
            if (timeSinceDisconnect <= this.reconnectTimeout && controller.previouslyAssignedSlot) {
                // Reclaim previous slot
                controller.connected = true;
                controller.playerSlot = controller.previouslyAssignedSlot;
                controller.lastSeenTimestamp = Date.now();
                controller.metadata = { ...controller.metadata, ...metadata };

                const displayName = this.getControllerDisplayName(physicalId, type);
                log(`[${timestamp}] Controller ${physicalId} reclaimed slot: Player ${controller.playerSlot}`);
                showNotification(`${displayName} reconnected → Player ${controller.playerSlot}`, 'success');

                if (this.onPlayerAssignedCallback) {
                    this.onPlayerAssignedCallback(physicalId, controller.playerSlot, type);
                }

                // Check if this brings us out of "all disconnected" state
                if (this.getConnectedCount() === 1 && this.isGameRunning) {
                    // Resume game
                    log(`[${timestamp}] First controller reconnected, game can resume`);
                }

                return;
            }
        }

        // Check if we've reached max controllers
        const connectedCount = this.getConnectedCount();
        if (connectedCount >= this.settings.maxControllers) {
            const displayName = this.getControllerDisplayName(physicalId, type);
            showNotification(`Max controllers reached (${this.settings.maxControllers})`, 'warning');
            log(`[${timestamp}] Controller ${physicalId} rejected: max controllers (${this.settings.maxControllers})`);
            return;
        }

        // Assign to lowest available slot
        const playerSlot = this.getLowestAvailableSlot();

        // For single-player games, force all controllers to Player 1
        const actualSlot = this.currentGameIsMultiplayer ? playerSlot : 1;

        // Create/update controller entry
        const controller = {
            physicalId,
            type,
            playerSlot: actualSlot,
            connected: true,
            lastSeenTimestamp: Date.now(),
            previouslyAssignedSlot: actualSlot,
            metadata
        };

        this.controllers.set(physicalId, controller);

        const displayName = this.getControllerDisplayName(physicalId, type);
        log(`[${timestamp}] Assigned ${physicalId} → Player ${actualSlot}`);

        if (this.currentGameIsMultiplayer && actualSlot > 1) {
            showNotification(`${displayName} connected → Player ${actualSlot}`, 'success');
        } else {
            showNotification(`${displayName} connected → Player ${actualSlot}`, 'success');
        }

        // Fire callbacks
        if (this.onControllerConnectCallback) {
            this.onControllerConnectCallback(physicalId, type, metadata);
        }

        if (this.onPlayerAssignedCallback) {
            this.onPlayerAssignedCallback(physicalId, actualSlot, type);
        }

        // Check if we should start game selection
        if (connectedCount === 0 && !this.isGameRunning) {
            log(`[${timestamp}] First controller connected, triggering game selection`);
            if (this.onGameShouldStartCallback) {
                this.onGameShouldStartCallback();
            }
        }

        // Check for multiplayer auto-enable
        if (this.currentGameIsMultiplayer && this.settings.autoEnablePlayer2 && actualSlot === 2 && this.isGameRunning) {
            showNotification(`${displayName} detected. Enabling Player 2...`, 'info', 1500);
        }
    }

    /**
     * Disconnect a controller (with debouncing)
     */
    disconnectController(physicalId) {
        // Clear any existing debounce timer
        if (this.debounceTimers.has(physicalId)) {
            clearTimeout(this.debounceTimers.get(physicalId));
        }

        // Debounce the disconnection
        const timer = setTimeout(() => {
            this._performDisconnect(physicalId);
            this.debounceTimers.delete(physicalId);
        }, this.debounceDelay);

        this.debounceTimers.set(physicalId, timer);
    }

    /**
     * Internal: Actually perform the disconnection
     */
    _performDisconnect(physicalId) {
        const timestamp = new Date().toISOString();
        log(`[${timestamp}] Controller disconnect: ${physicalId}`);

        const controller = this.controllers.get(physicalId);
        if (!controller || !controller.connected) {
            log(`[${timestamp}] Controller ${physicalId} was not connected, skipping disconnect`);
            return;
        }

        const wasPlayer1 = controller.playerSlot === 1;
        const displayName = this.getControllerDisplayName(physicalId, controller.type);

        // Mark as disconnected
        controller.connected = false;
        controller.lastSeenTimestamp = Date.now();

        showNotification(`${displayName} disconnected`, 'warning');
        log(`[${timestamp}] Controller ${physicalId} disconnected from Player ${controller.playerSlot}`);

        if (this.onControllerDisconnectCallback) {
            this.onControllerDisconnectCallback(physicalId, controller.playerSlot);
        }

        // Check if we need to promote another controller to Player 1
        if (wasPlayer1 && this.getConnectedCount() > 0) {
            this.promoteToPlayer1();
        }

        // Check if all controllers are now disconnected
        if (this.getConnectedCount() === 0) {
            log(`[${timestamp}] All controllers disconnected`);
            if (this.onAllControllersDisconnectedCallback) {
                this.onAllControllersDisconnectedCallback();
            }
        }
    }

    /**
     * Promote another controller to Player 1
     */
    promoteToPlayer1() {
        const timestamp = new Date().toISOString();

        // Find the lowest-indexed connected controller
        let lowestSlotController = null;
        let lowestSlot = Infinity;

        for (const [physicalId, controller] of this.controllers.entries()) {
            if (controller.connected && controller.playerSlot < lowestSlot) {
                lowestSlot = controller.playerSlot;
                lowestSlotController = { physicalId, controller };
            }
        }

        if (lowestSlotController) {
            const { physicalId, controller } = lowestSlotController;
            const oldSlot = controller.playerSlot;
            controller.playerSlot = 1;
            controller.previouslyAssignedSlot = 1;

            const displayName = this.getControllerDisplayName(physicalId, controller.type);
            log(`[${timestamp}] Promoted ${physicalId} → Player 1 (was Player ${oldSlot})`);
            showNotification(`${displayName} promoted to Player 1`, 'info');

            if (this.onPlayerAssignedCallback) {
                this.onPlayerAssignedCallback(physicalId, 1, controller.type);
            }
        }
    }

    /**
     * Get lowest available player slot
     */
    getLowestAvailableSlot() {
        const occupiedSlots = new Set();

        for (const controller of this.controllers.values()) {
            if (controller.connected) {
                occupiedSlots.add(controller.playerSlot);
            }
        }

        for (let slot = 1; slot <= this.settings.maxControllers; slot++) {
            if (!occupiedSlots.has(slot)) {
                return slot;
            }
        }

        return 1; // Fallback
    }

    /**
     * Get number of connected controllers
     */
    getConnectedCount() {
        let count = 0;
        for (const controller of this.controllers.values()) {
            if (controller.connected) count++;
        }
        return count;
    }

    /**
     * Get all connected controllers
     */
    getConnectedControllers() {
        const connected = [];
        for (const [physicalId, controller] of this.controllers.entries()) {
            if (controller.connected) {
                connected.push({ physicalId, ...controller });
            }
        }
        return connected.sort((a, b) => a.playerSlot - b.playerSlot);
    }

    /**
     * Get player slot for a physical controller ID
     */
    getPlayerSlot(physicalId) {
        const controller = this.controllers.get(physicalId);
        return controller?.connected ? controller.playerSlot : null;
    }

    /**
     * Set game running state and multiplayer capability
     */
    setGameState(isRunning, isMultiplayer = false) {
        this.isGameRunning = isRunning;
        this.currentGameIsMultiplayer = isMultiplayer;

        log(`[ControllerManager] Game state: running=${isRunning}, multiplayer=${isMultiplayer}`);

        // If game just started and is not multiplayer, reassign all controllers to Player 1
        if (isRunning && !isMultiplayer) {
            for (const controller of this.controllers.values()) {
                if (controller.connected) {
                    controller.playerSlot = 1;
                    controller.previouslyAssignedSlot = 1;
                }
            }
            if (this.getConnectedCount() > 1) {
                showNotification('Single-player mode: all controllers share Player 1', 'info');
            }
        }
    }

    /**
     * Settings management
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('retroapp_controller_settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
                log('[ControllerManager] Settings loaded from localStorage');
            }
        } catch (e) {
            log('[ControllerManager] Failed to load settings:', e);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('retroapp_controller_settings', JSON.stringify(this.settings));
            log('[ControllerManager] Settings saved to localStorage');
        } catch (e) {
            log('[ControllerManager] Failed to save settings:', e);
        }
    }

    updateSetting(key, value) {
        if (key in this.settings) {
            this.settings[key] = value;
            this.saveSettings();
            log(`[ControllerManager] Setting updated: ${key} = ${value}`);
            return true;
        }
        return false;
    }

    getSetting(key) {
        return this.settings[key];
    }

    getAllSettings() {
        return { ...this.settings };
    }

    /**
     * Event callbacks
     */
    onControllerConnect(callback) {
        this.onControllerConnectCallback = callback;
    }

    onControllerDisconnect(callback) {
        this.onControllerDisconnectCallback = callback;
    }

    onPlayerAssigned(callback) {
        this.onPlayerAssignedCallback = callback;
    }

    onAllControllersDisconnected(callback) {
        this.onAllControllersDisconnectedCallback = callback;
    }

    onGameShouldStart(callback) {
        this.onGameShouldStartCallback = callback;
    }

    /**
     * Cleanup
     */
    destroy() {
        // Clear all debounce timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        // Clear all controllers
        this.controllers.clear();

        log('[ControllerManager] Destroyed');
    }
}
