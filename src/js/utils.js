/**
 * Utility Functions for Retro Console
 * Provides helper functions for room codes, QR codes, logging, and URL parsing
 */

class Utils {
    /**
     * Generate a random 4-digit room code
     * @returns {string} Room code (1000-9999)
     */
    static generateRoomCode() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    /**
     * Generate QR code for controller pairing
     * @param {string} roomCode - The room code
     * @param {string} elementId - ID of container element
     * @param {string} baseUrl - Base URL for the application
     */
    static generateQRCode(roomCode, elementId, baseUrl) {
        const controllerUrl = `${baseUrl}/controllers/?code=${roomCode}`;
        const container = document.getElementById(elementId);

        if (!container) {
            console.error('QR code container not found:', elementId);
            return;
        }

        // Clear existing QR code
        container.innerHTML = '';

        try {
            new QRCode(container, {
                text: controllerUrl,
                width: 256,
                height: 256,
                colorDark: '#00ff00',
                colorLight: '#1a1a2e',
                correctLevel: QRCode.CorrectLevel.H
            });

            this.log('QR code generated:', controllerUrl);
        } catch (error) {
            console.error('Failed to generate QR code:', error);
            container.innerHTML = `<p style="color: #ff4444;">QR Code Error: ${error.message}</p>`;
        }
    }

    /**
     * Get URL parameter by name
     * @param {string} name - Parameter name
     * @returns {string|null} Parameter value or null
     */
    static getUrlParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    /**
     * Log with timestamp
     * @param {...any} args - Arguments to log
     */
    static log(...args) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}]`, ...args);
    }

    /**
     * Log error with timestamp
     * @param {...any} args - Arguments to log
     */
    static error(...args) {
        const timestamp = new Date().toLocaleTimeString();
        console.error(`[${timestamp}]`, ...args);
    }

    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type of toast (success, error, info)
     */
    static showToast(message, type = 'info') {
        // Create toast element if it doesn't exist
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      `;
            document.body.appendChild(toast);
        }

        // Set color based on type
        const colors = {
            success: '#00ff00',
            error: '#ff4444',
            info: '#00bfff'
        };
        toast.style.backgroundColor = colors[type] || colors.info;

        // Show toast
        toast.textContent = message;
        toast.style.opacity = '1';

        // Hide after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
        }, 3000);
    }

    /**
     * Detect emulator core from file extension
     * @param {string} filename - ROM filename
     * @returns {string|null} Emulator core name
     */
    static detectEmulatorCore(filename) {
        const ext = filename.split('.').pop().toLowerCase();

        const coreMap = {
            'nes': 'nes',
            'sfc': 'snes',
            'smc': 'snes',
            'bin': 'segaMD',
            'md': 'segaMD',
            'gen': 'segaMD',
            'n64': 'n64',
            'z64': 'n64',
            'gba': 'gba',
            'gb': 'gb',
            'gbc': 'gbc',
            'iso': 'psx',
            'a26': 'atari2600'
        };

        return coreMap[ext] || null;
    }

    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted size
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Check if device is mobile
     * @returns {boolean} True if mobile device
     */
    static isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Check if browser supports required features
     * @returns {object} Support status for each feature
     */
    static checkBrowserSupport() {
        return {
            webrtc: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            peerjs: typeof Peer !== 'undefined',
            vibration: 'vibrate' in navigator,
            gamepad: 'getGamepads' in navigator,
            fullscreen: document.fullscreenEnabled || document.webkitFullscreenEnabled
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
