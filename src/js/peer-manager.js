/**
 * PeerManager - WebRTC Connection Manager
 * Handles peer-to-peer connections between host and controllers using PeerJS
 */

class PeerManager {
    constructor(isHost = false) {
        this.isHost = isHost;
        this.peer = null;
        this.connections = new Map(); // controllerId -> connection
        this.activeControllerId = null;
        this.roomCode = null;
        this.peerId = null;
        this.connectionTimeout = 20000; // 20 seconds

        // Callbacks
        this.onDataCallback = null;
        this.onConnectionCallback = null;
        this.onDisconnectionCallback = null;
        this.onOpenCallback = null;
        this.onErrorCallback = null;
    }

    /**
     * Initialize PeerJS connection
     * @returns {Promise<{roomCode: string, peerId: string}>}
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            if (this.isHost) {
                // Generate room code and create peer ID
                this.roomCode = Utils.generateRoomCode();
                this.peerId = `host-${this.roomCode}`;
            } else {
                // Controller gets random peer ID
                this.peerId = `controller-${Math.random().toString(36).substr(2, 9)}`;
            }

            Utils.log('Initializing PeerJS with ID:', this.peerId);

            try {
                this.peer = new Peer(this.peerId, {
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' }
                        ]
                    },
                    debug: 2 // Set to 3 for verbose logging
                });

                this.peer.on('open', (id) => {
                    Utils.log('Peer connection opened with ID:', id);

                    if (this.isHost) {
                        this.setupHostListeners();
                    }

                    if (this.onOpenCallback) {
                        this.onOpenCallback(id);
                    }

                    resolve({
                        roomCode: this.roomCode,
                        peerId: id
                    });
                });

                this.peer.on('error', (error) => {
                    Utils.error('Peer error:', error);

                    if (this.onErrorCallback) {
                        this.onErrorCallback(error);
                    }

                    // Handle specific errors
                    if (error.type === 'peer-unavailable') {
                        Utils.showToast('Host not found. Check room code.', 'error');
                    } else if (error.type === 'network') {
                        Utils.showToast('Network error. Check connection.', 'error');
                    }
                });

                this.peer.on('disconnected', () => {
                    Utils.log('Peer disconnected. Attempting to reconnect...');
                    setTimeout(() => {
                        if (this.peer && !this.peer.destroyed) {
                            this.peer.reconnect();
                        }
                    }, 1000);
                });

            } catch (error) {
                Utils.error('Failed to initialize PeerJS:', error);
                reject(error);
            }
        });
    }

    /**
     * Setup listeners for incoming connections (host only)
     */
    setupHostListeners() {
        if (!this.isHost) return;

        this.peer.on('connection', (conn) => {
            const controllerId = this.connections.size + 1;
            Utils.log('Controller connected:', controllerId, conn.peer);

            this.connections.set(controllerId, conn);

            // Set first controller as active
            if (this.activeControllerId === null) {
                this.activeControllerId = controllerId;
                Utils.log('Set active controller:', controllerId);
            }

            // Setup connection event handlers
            conn.on('open', () => {
                Utils.log('Connection opened with controller:', controllerId);

                // Send welcome message with controller ID and active status
                conn.send({
                    type: 'welcome',
                    controllerId: controllerId,
                    isActive: controllerId === this.activeControllerId,
                    timestamp: Date.now()
                });

                if (this.onConnectionCallback) {
                    this.onConnectionCallback(controllerId, conn);
                }
            });

            conn.on('data', (data) => {
                // Only process data from active controller
                if (this.onDataCallback && controllerId === this.activeControllerId) {
                    this.onDataCallback(data, controllerId);
                }
            });

            conn.on('close', () => {
                Utils.log('Controller disconnected:', controllerId);
                this.connections.delete(controllerId);

                // If active controller disconnected, set new active
                if (controllerId === this.activeControllerId) {
                    const remainingControllers = Array.from(this.connections.keys());
                    this.activeControllerId = remainingControllers.length > 0 ? remainingControllers[0] : null;
                    Utils.log('New active controller:', this.activeControllerId);
                }

                if (this.onDisconnectionCallback) {
                    this.onDisconnectionCallback(controllerId);
                }
            });

            conn.on('error', (error) => {
                Utils.error('Connection error with controller', controllerId, error);
            });
        });
    }

    /**
     * Connect to host (controller only)
     * @param {string} roomCode - Room code to join
     * @returns {Promise<Connection>}
     */
    async connectToHost(roomCode) {
        if (this.isHost) {
            throw new Error('Host cannot connect to another host');
        }

        return new Promise((resolve, reject) => {
            const hostPeerId = `host-${roomCode}`;
            Utils.log('Connecting to host:', hostPeerId);

            const conn = this.peer.connect(hostPeerId, {
                reliable: true
            });

            const timeout = setTimeout(() => {
                Utils.error('Connection timeout');
                conn.close();
                reject(new Error('Connection timeout'));
            }, this.connectionTimeout);

            conn.on('open', () => {
                clearTimeout(timeout);
                Utils.log('Connected to host');
                this.connections.set('host', conn);
                resolve(conn);
            });

            conn.on('data', (data) => {
                if (this.onDataCallback) {
                    this.onDataCallback(data);
                }
            });

            conn.on('close', () => {
                Utils.log('Disconnected from host');
                this.connections.delete('host');

                if (this.onDisconnectionCallback) {
                    this.onDisconnectionCallback();
                }
            });

            conn.on('error', (error) => {
                clearTimeout(timeout);
                Utils.error('Connection error:', error);
                reject(error);
            });
        });
    }

    /**
     * Send data to peer(s)
     * @param {object} data - Data to send
     * @param {number} [targetControllerId] - Specific controller to send to (host only)
     */
    send(data, targetControllerId = null) {
        if (this.isHost) {
            // Host sending to controllers
            if (targetControllerId !== null) {
                const conn = this.connections.get(targetControllerId);
                if (conn && conn.open) {
                    conn.send(data);
                }
            } else {
                // Broadcast to all controllers
                this.connections.forEach((conn) => {
                    if (conn.open) {
                        conn.send(data);
                    }
                });
            }
        } else {
            // Controller sending to host
            const conn = this.connections.get('host');
            if (conn && conn.open) {
                conn.send(data);
            }
        }
    }

    /**
     * Register callback for incoming data
     * @param {Function} callback - Callback function (data, controllerId)
     */
    onData(callback) {
        this.onDataCallback = callback;
    }

    /**
     * Register callback for new connections
     * @param {Function} callback - Callback function (controllerId, connection)
     */
    onConnection(callback) {
        this.onConnectionCallback = callback;
    }

    /**
     * Register callback for disconnections
     * @param {Function} callback - Callback function (controllerId)
     */
    onDisconnection(callback) {
        this.onDisconnectionCallback = callback;
    }

    /**
     * Register callback for peer open event
     * @param {Function} callback - Callback function (peerId)
     */
    onOpen(callback) {
        this.onOpenCallback = callback;
    }

    /**
     * Register callback for errors
     * @param {Function} callback - Callback function (error)
     */
    onError(callback) {
        this.onErrorCallback = callback;
    }

    /**
     * Set active controller (host only)
     * @param {number} controllerId - Controller ID to set as active
     */
    setActiveController(controllerId) {
        if (!this.isHost) return;

        const oldActive = this.activeControllerId;
        this.activeControllerId = controllerId;

        Utils.log('Active controller changed:', oldActive, '->', controllerId);

        // Notify all controllers of active status change
        this.connections.forEach((conn, id) => {
            if (conn.open) {
                conn.send({
                    type: 'active_status',
                    controllerId: id,
                    isActive: id === controllerId,
                    timestamp: Date.now()
                });
            }
        });
    }

    /**
     * Get active controller ID
     * @returns {number|null}
     */
    getActiveController() {
        return this.activeControllerId;
    }

    /**
     * Get connection count
     * @returns {number}
     */
    getConnectionCount() {
        return this.connections.size;
    }

    /**
     * Get all controller IDs
     * @returns {Array<number>}
     */
    getControllerIds() {
        return Array.from(this.connections.keys());
    }

    /**
     * Check if connected
     * @returns {boolean}
     */
    isConnected() {
        return this.connections.size > 0;
    }

    /**
     * Cleanup and destroy peer connection
     */
    destroy() {
        Utils.log('Destroying peer connection');

        // Close all connections
        this.connections.forEach((conn) => {
            conn.close();
        });
        this.connections.clear();

        // Destroy peer
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }

        this.activeControllerId = null;
        this.roomCode = null;
        this.peerId = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PeerManager;
}
