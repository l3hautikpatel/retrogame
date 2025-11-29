/**
 * PeerJS Connection Manager
 * Handles WebRTC peer-to-peer connections between Host and Controllers
 */

import { generateRoomCode, showNotification, log } from './utils.js';

export class PeerManager {
  constructor(isHost = false) {
    this.isHost = isHost;
    this.peer = null;
    this.activeConnections = new Map(); // Map<peerId, connection> - support multiple controllers
    this.onDataCallback = null;
    this.onConnectionCallback = null;
    this.onDisconnectionCallback = null;
    this.onPeerErrorCallback = null;
    this.roomCode = null;
  }

  /**
   * Initialize PeerJS with custom configuration and fallback servers
   */
  async initialize() {
    try {
      // Generate or retrieve room code
      this.roomCode = this.isHost ? generateRoomCode() : null;

      const peerId = this.isHost ? `host-${this.roomCode}` : null;

      // Simple PeerJS configuration - using default cloud server
      this.peer = new Peer(peerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        },
        debug: 0
      });

      return new Promise((resolve, reject) => {
        this.peer.on('open', (id) => {
          log('Peer initialized with ID:', id);

          if (this.isHost) {
            this.setupHostListeners();
            resolve({ roomCode: this.roomCode, peerId: id });
          } else {
            resolve({ peerId: id });
          }
        });

        this.peer.on('error', (error) => {
          console.error('Peer error:', error);
          showNotification(`Connection error: ${error.type}`, 'error');

          if (this.onPeerErrorCallback) {
            this.onPeerErrorCallback(error);
          }

          // Only reject if we haven't resolved yet (initialization phase)
          // Otherwise this is a runtime error
          if (!this.peer.id) {
            reject(error);
          }
        });

        this.peer.on('disconnected', () => {
          log('Peer disconnected from server');

          if (this.onPeerErrorCallback) {
            this.onPeerErrorCallback({ type: 'disconnected', message: 'Disconnected from signaling server' });
          }

          // Don't auto-reconnect immediately to avoid connection spam
          setTimeout(() => {
            if (!this.peer.destroyed) {
              log('Attempting to reconnect...');
              this.peer.reconnect();
            }
          }, 3000); // Wait 3 seconds before reconnecting
        });

        this.peer.on('close', () => {
          log('Peer connection closed');
          showNotification('Connection closed', 'warning');

          if (this.onPeerErrorCallback) {
            this.onPeerErrorCallback({ type: 'closed', message: 'Connection closed' });
          }
        });
      });
    } catch (error) {
      console.error('Failed to initialize peer:', error);
      throw error;
    }
  }

  /**
   * Host: Setup listeners for incoming controller connections
   */
  setupHostListeners() {
    this.peer.on('connection', (conn) => {
      log('New controller connection attempt:', conn.peer);

      // Check if this peer is already connected
      if (this.activeConnections.has(conn.peer)) {
        log('Peer already connected, closing old connection');
        const oldConn = this.activeConnections.get(conn.peer);
        oldConn.close();
      }

      this.activeConnections.set(conn.peer, conn);

      // Monitor connection state changes for debugging
      this.monitorConnection(conn);

      conn.on('open', () => {
        log('✅ Controller connection OPEN:', conn.peer);
        showNotification(`Controller connected: ${conn.peer}`, 'success');

        // Send welcome  message
        conn.send({
          type: 'welcome',
          message: 'Connected to Host',
          peerId: conn.peer
        });

        if (this.onConnectionCallback) {
          this.onConnectionCallback(conn.peer);
        }
      });

      conn.on('data', (data) => {
        // Route incoming controller data to callback with peer ID
        if (this.onDataCallback) {
          this.onDataCallback(data, conn.peer);
        }
      });

      conn.on('close', () => {
        log('Controller connection closed:', conn.peer);
        showNotification(`Controller disconnected: ${conn.peer}`, 'warning');

        if (this.activeConnections.get(conn.peer) === conn) {
          this.activeConnections.delete(conn.peer);
        }

        if (this.onDisconnectionCallback) {
          this.onDisconnectionCallback(conn.peer);
        }
      });

      conn.on('error', (error) => {
        console.error('Connection error:', conn.peer, error);
      });
    });
  }

  /**
   * Monitor connection state for debugging
   */
  monitorConnection(conn) {
    // These are internal PeerJS/WebRTC properties, might vary by version
    // but useful for debugging
    if (conn.peerConnection) {
      conn.peerConnection.onicestatechange = () => {
        log(`ICE State: ${conn.peerConnection.iceConnectionState}`);
      };
      conn.peerConnection.onconnectionstatechange = () => {
        log(`Connection State: ${conn.peerConnection.connectionState}`);
      };
      conn.peerConnection.onsignalingstatechange = () => {
        log(`Signaling State: ${conn.peerConnection.signalingState}`);
      };
    }
  }

  /**
   * Controller: Connect to host using room code
   */
  async connectToHost(roomCode, retryCount = 0) {
    return new Promise((resolve, reject) => {
      const hostId = `host-${roomCode}`;
      log(`Attempting to connect to host: ${hostId} (Attempt ${retryCount + 1})`);

      if (retryCount === 0) {
        showNotification('Connecting...', 'info');
      }

      log('Creating connection...');
      const conn = this.peer.connect(hostId, {
        reliable: true,
        serialization: 'json'
      });

      log('Connection object created, waiting for open event...');

      let connectionTimeout;

      const cleanup = () => {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        conn.off('open');
        conn.off('error');
        conn.off('close');
      };

      conn.on('open', () => {
        log('✅ Connection OPEN event fired!');
        this.activeConnection = conn;
        showNotification('Connected to console!', 'success');

        // Setup listeners for the established connection
        this.setupControllerConnectionListeners(conn);

        resolve(conn);
      });

      conn.on('error', (error) => {
        log('❌ Connection error:', error);
        console.error('Connection error:', error);
      });

      // We handle the actual connection failure via timeout or close events mostly
      // PeerJS connect() doesn't always fire 'error' when host is missing

      // Add a reasonable timeout
      connectionTimeout = setTimeout(() => {
        if (!this.activeConnection) {
          cleanup();
          log('⏱️ Connection timeout after 5 seconds');

          if (retryCount < 2) {
            log('Retrying connection...');
            showNotification(`Connection timed out. Retrying... (${retryCount + 1}/3)`, 'warning');
            conn.close();

            setTimeout(() => {
              this.connectToHost(roomCode, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, 1000);
          } else {
            showNotification('Connection timeout. Is the Host online?', 'error');
            reject(new Error('Connection timeout'));
          }
        }
      }, 5000); // 5 second timeout per attempt
    });
  }

  setupControllerConnectionListeners(conn) {
    conn.on('data', (data) => {
      log('Received data from host:', data);
      // Handle messages from host
      if (this.onDataCallback) {
        this.onDataCallback(data);
      }
    });

    conn.on('close', () => {
      log('Connection closed');
      showNotification('Disconnected from console', 'warning');
      this.activeConnection = null;

      if (this.onDisconnectionCallback) {
        this.onDisconnectionCallback();
      }
    });

    conn.on('error', (error) => {
      log('❌ Connection error:', error);
      console.error('Connection error:', error);
      showNotification('Connection error occurred', 'error');
    });
  }

  /**
   * Send data to all connected peers (broadcast)
   */
  send(data) {
    try {
      let sentCount = 0;
      for (const [peerId, conn] of this.activeConnections.entries()) {
        if (conn && conn.open) {
          conn.send(data);
          sentCount++;
        }
      }
      if (sentCount === 0) {
        log('Attempted to send data but no active connections are open.');
      }
    } catch (error) {
      console.error('Error sending data:', error);
    }
  }

  /**
   * Send data to a specific peer
   */
  sendToPeer(peerId, data) {
    try {
      const conn = this.activeConnections.get(peerId);
      if (conn && conn.open) {
        conn.send(data);
      } else {
        log(`Attempted to send data to ${peerId} but connection is not open.`);
      }
    } catch (error) {
      console.error(`Error sending data to ${peerId}:`, error);
    }
  }

  /**
   * Set callback for incoming data
   */
  onData(callback) {
    this.onDataCallback = callback;
  }

  /**
   * Set callback for new connections (Host only)
   */
  onConnection(callback) {
    this.onConnectionCallback = callback;
  }

  /**
   * Set callback for disconnections
   */
  onDisconnection(callback) {
    this.onDisconnectionCallback = callback;
  }

  /**
   * Set callback for peer errors/status changes
   */
  onPeerError(callback) {
    this.onPeerErrorCallback = callback;
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.activeConnections.size > 0;
  }

  /**
   * Get list of connected peer IDs
   */
  getConnectedPeers() {
    const peers = [];
    for (const [peerId, conn] of this.activeConnections.entries()) {
      if (conn && conn.open) {
        peers.push(peerId);
      }
    }
    return peers;
  }

  /**
   * Get number of connected peers
   */
  getConnectionCount() {
    return this.getConnectedPeers().length;
  }

  /**
   * Cleanup and destroy peer connection
   */
  destroy() {
    // Close all active connections
    for (const conn of this.activeConnections.values()) {
      if (conn) {
        conn.close();
      }
    }
    this.activeConnections.clear();

    if (this.peer) {
      this.peer.destroy();
    }
  }
}