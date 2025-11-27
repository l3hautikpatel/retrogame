/**
 * PeerJS Connection Manager
 * Handles WebRTC peer-to-peer connections between Host and Controllers
 */

import { generateRoomCode, showNotification, log } from './utils.js';

export class PeerManager {
  constructor(isHost = false) {
    this.isHost = isHost;
    this.peer = null;
    this.connections = new Map(); // Store multiple controller connections
    this.onDataCallback = null;
    this.onConnectionCallback = null;
    this.onDisconnectionCallback = null;
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
          reject(error);
        });

        this.peer.on('disconnected', () => {
          log('Peer disconnected from server');
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
      log('New controller connection:', conn.peer);
      
      conn.on('open', () => {
        const controllerId = this.connections.size + 1;
        const isFirstController = this.connections.size === 0;
        
        this.connections.set(conn.peer, { 
          conn, 
          controllerId,
          active: isFirstController // First controller is active by default
        });
        
        showNotification(`Controller ${controllerId} connected!`, 'success');
        
        // Send welcome message to controller
        conn.send({
          type: 'welcome',
          controllerId: controllerId,
          active: isFirstController,
          message: `You are Controller ${controllerId}`
        });

        if (this.onConnectionCallback) {
          this.onConnectionCallback(controllerId, conn.peer);
        }
      });

      conn.on('data', (data) => {
        // Route incoming controller data to callback
        if (this.onDataCallback) {
          const controllerData = this.connections.get(conn.peer);
          // Only process input if controller is active
          if (controllerData && controllerData.active) {
            this.onDataCallback(data, controllerData.controllerId);
          }
        }
      });

      conn.on('close', () => {
        const controllerData = this.connections.get(conn.peer);
        if (controllerData) {
          log(`Controller ${controllerData.controllerId} disconnected`);
          showNotification(`Controller ${controllerData.controllerId} disconnected`, 'warning');
          
          if (this.onDisconnectionCallback) {
            this.onDisconnectionCallback(controllerData.controllerId);
          }
          
          this.connections.delete(conn.peer);
        }
      });

      conn.on('error', (error) => {
        console.error('Connection error:', error);
      });
    });
  }

  /**
   * Controller: Connect to host using room code
   */
  async connectToHost(roomCode) {
    return new Promise((resolve, reject) => {
      const hostId = `host-${roomCode}`;
      log('Attempting to connect to host:', hostId);
      showNotification('Connecting...', 'info');
      
      log('Creating connection...');
      const conn = this.peer.connect(hostId, {
        reliable: true,
        serialization: 'json'
      });

      log('Connection object created, waiting for open event...');

      conn.on('open', () => {
        log('✅ Connection OPEN event fired!');
        this.connections.set('host', { conn, controllerId: null });
        showNotification('Connected to console!', 'success');
        resolve(conn);
      });

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
        this.connections.delete('host');
        
        if (this.onDisconnectionCallback) {
          this.onDisconnectionCallback();
        }
      });

      conn.on('error', (error) => {
        log('❌ Connection error:', error);
        console.error('Connection error:', error);
        showNotification('Failed to connect - check room code', 'error');
        reject(error);
      });

      // Add a reasonable timeout
      setTimeout(() => {
        if (!this.connections.has('host')) {
          log('⏱️ Connection timeout after 20 seconds');
          showNotification('Connection timeout', 'error');
          reject(new Error('Connection timeout'));
        }
      }, 20000);
    });
  }

  /**
   * Send data to peer(s)
   */
  send(data) {
    try {
      if (this.isHost) {
        // Broadcast to all controllers
        this.connections.forEach((controllerData) => {
          if (controllerData.conn.open) {
            controllerData.conn.send(data);
          }
        });
      } else {
        // Send to host
        const hostConnection = this.connections.get('host');
        if (hostConnection && hostConnection.conn.open) {
          hostConnection.conn.send(data);
        }
      }
    } catch (error) {
      console.error('Error sending data:', error);
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
   * Set which controller is active (for passing control)
   */
  setActiveController(controllerId) {
    if (!this.isHost) return;
    
    this.connections.forEach((data, peer) => {
      const wasActive = data.active;
      data.active = data.controllerId === controllerId;
      
      // Notify controller of status change
      if (data.conn.open) {
        data.conn.send({
          type: 'active_status',
          active: data.active,
          message: data.active ? 'You now have control' : 'Control passed to another player'
        });
      }
      
      if (wasActive !== data.active) {
        log(`Controller ${data.controllerId} active status: ${data.active}`);
      }
    });
  }

  /**
   * Get active controller ID
   */
  getActiveController() {
    for (const [peer, data] of this.connections) {
      if (data.active) return data.controllerId;
    }
    return null;
  }

  /**
   * Get number of connected controllers (Host only)
   */
  getConnectionCount() {
    return this.connections.size;
  }

  /**
   * Cleanup and destroy peer connection
   */
  destroy() {
    this.connections.forEach((controllerData) => {
      controllerData.conn.close();
    });
    this.connections.clear();
    
    if (this.peer) {
      this.peer.destroy();
    }
  }
}