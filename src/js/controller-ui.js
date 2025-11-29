/**
 * Controller UI Handler
 * Manages mobile controller interface and touch events
 */

import { vibrateController, preventScroll, log } from './utils.js';

export class ControllerUI {
  constructor(peerManager) {
    this.peerManager = peerManager;
    this.buttons = new Map();
    this.activeButtons = new Set();
    this.touchIdentifiers = new Map(); // Track which touch is on which button
    this.touchIdentifiers = new Map(); // Track which touch is on which button
    this.isActive = false; // Whether this controller has control
  }

  /**
   * Initialize controller UI
   */
  initialize() {
    preventScroll();
    this.setupButtons();
    this.attachEventListeners();
    log('Controller UI initialized');
  }

  /**
   * Setup button elements and their configurations
   */
  setupButtons() {
    // D-Pad buttons
    this.buttons.set('dpad-up', { element: document.getElementById('dpad-up'), button: 'dpad.up' });
    this.buttons.set('dpad-down', { element: document.getElementById('dpad-down'), button: 'dpad.down' });
    this.buttons.set('dpad-left', { element: document.getElementById('dpad-left'), button: 'dpad.left' });
    this.buttons.set('dpad-right', { element: document.getElementById('dpad-right'), button: 'dpad.right' });

    // Face buttons
    this.buttons.set('btn-a', { element: document.getElementById('btn-a'), button: 'face_buttons.a' });
    this.buttons.set('btn-b', { element: document.getElementById('btn-b'), button: 'face_buttons.b' });
    this.buttons.set('btn-x', { element: document.getElementById('btn-x'), button: 'face_buttons.x' });
    this.buttons.set('btn-y', { element: document.getElementById('btn-y'), button: 'face_buttons.y' });

    // Shoulder buttons
    this.buttons.set('btn-l', { element: document.getElementById('btn-l'), button: 'shoulder_buttons.l' });
    this.buttons.set('btn-r', { element: document.getElementById('btn-r'), button: 'shoulder_buttons.r' });
    this.buttons.set('btn-l2', { element: document.getElementById('btn-l2'), button: 'shoulder_buttons.l2' });
    this.buttons.set('btn-r2', { element: document.getElementById('btn-r2'), button: 'shoulder_buttons.r2' });

    // System buttons
    this.buttons.set('btn-start', { element: document.getElementById('btn-start'), button: 'system_buttons.start' });
    this.buttons.set('btn-select', { element: document.getElementById('btn-select'), button: 'system_buttons.select' });
  }

  /**
   * Attach touch and mouse event listeners to all buttons
   */
  attachEventListeners() {
    this.buttons.forEach((config, buttonId) => {
      const element = config.element;
      if (!element) {
        console.warn(`Button element not found: ${buttonId}`);
        return;
      }

      // Touch events (mobile)
      element.addEventListener('touchstart', (e) => this.handleTouchStart(e, buttonId), { passive: false });
      element.addEventListener('touchend', (e) => this.handleTouchEnd(e, buttonId), { passive: false });
      element.addEventListener('touchcancel', (e) => this.handleTouchEnd(e, buttonId), { passive: false });

      // Mouse events (desktop testing)
      element.addEventListener('mousedown', (e) => this.handleMouseDown(e, buttonId));
      element.addEventListener('mouseup', (e) => this.handleMouseUp(e, buttonId));
      element.addEventListener('mouseleave', (e) => this.handleMouseUp(e, buttonId));

      // Prevent context menu
      element.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    // Prevent accidental page navigation
    document.body.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });
  }

  /**
   * Handle touch start event
   */
  handleTouchStart(event, buttonId) {
    event.preventDefault();

    const touch = event.changedTouches[0];
    this.touchIdentifiers.set(touch.identifier, buttonId);

    this.pressButton(buttonId);
  }

  /**
   * Handle touch end event
   */
  handleTouchEnd(event, buttonId) {
    event.preventDefault();

    // Find the touch that ended
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const trackedButtonId = this.touchIdentifiers.get(touch.identifier);

      if (trackedButtonId) {
        this.releaseButton(trackedButtonId);
        this.touchIdentifiers.delete(touch.identifier);
      }
    }
  }

  /**
   * Handle mouse down event (for desktop testing)
   */
  handleMouseDown(event, buttonId) {
    event.preventDefault();
    this.pressButton(buttonId);
  }

  /**
   * Handle mouse up event
   */
  handleMouseUp(event, buttonId) {
    event.preventDefault();
    this.releaseButton(buttonId);
  }

  /**
   * Press a button (send to host)
   */
  pressButton(buttonId) {
    if (this.activeButtons.has(buttonId)) return; // Already pressed
    if (!this.isActive) return; // Controller not active

    this.activeButtons.add(buttonId);

    const config = this.buttons.get(buttonId);
    if (!config) return;

    // Add visual feedback
    config.element.classList.add('active');

    // Haptic feedback
    vibrateController(30);

    // Send button press to host
    this.sendInput(config.button, 'press');

    log(`Button pressed: ${config.button}`);
  }

  /**
   * Release a button
   */
  releaseButton(buttonId) {
    if (!this.activeButtons.has(buttonId)) return; // Not pressed
    if (!this.isActive) return; // Controller not active

    this.activeButtons.delete(buttonId);

    const config = this.buttons.get(buttonId);
    if (!config) return;

    // Remove visual feedback
    config.element.classList.remove('active');

    // Send button release to host
    this.sendInput(config.button, 'release');

    log(`Button released: ${config.button}`);
  }

  /**
   * Send input data to host via PeerJS
   */
  sendInput(button, action) {
    const data = {
      type: 'input',
      button: button,
      action: action,
      timestamp: Date.now()
    };

    this.peerManager.send(data);
  }

  /**
   * Release all active buttons (cleanup)
   */
  releaseAllButtons() {
    this.activeButtons.forEach(buttonId => {
      this.releaseButton(buttonId);
    });
    this.activeButtons.clear();
    this.touchIdentifiers.clear();
  }

  /**
   * Update UI based on connection status
   */
  updateConnectionStatus(connected) {
    this.isActive = connected;

    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      if (connected) {
        statusElement.textContent = 'Connected';
        statusElement.className = 'status-connected';
      } else {
        statusElement.textContent = 'Disconnected';
        statusElement.className = 'status-disconnected';
      }
    }

    // Update button opacity based on active status
    this.setEnabled(connected);
  }

  /**
   * Show controller info overlay
   */
  showControllerInfo(message) {
    const infoElement = document.getElementById('controller-info');
    if (infoElement) {
      infoElement.textContent = message || 'Connected to Host';
      infoElement.style.display = 'block';

      setTimeout(() => {
        infoElement.style.display = 'none';
      }, 3000);
    }
  }

  /**
   * Enable/disable controller
   */
  setEnabled(enabled) {
    this.buttons.forEach((config) => {
      if (config.element) {
        config.element.disabled = !enabled;
        config.element.style.opacity = enabled ? '1' : '0.5';
      }
    });

    if (!enabled) {
      this.releaseAllButtons();
    }
  }
}