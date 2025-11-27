/**
 * Utility Functions for Retro Console
 * Common helper functions used across the application
 */

// Generate a random 4-digit room code
export function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Get URL parameter by name
export function getUrlParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Generate QR Code URL
export function generateQRCode(text, elementId) {
  const qrcode = new QRCode(document.getElementById(elementId), {
    text: text,
    width: 256,
    height: 256,
    colorDark: "#00ff00",
    colorLight: "#1a1a2e",
    correctLevel: QRCode.CorrectLevel.H
  });
  return qrcode;
}

// Show notification toast
export function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Vibrate controller (for haptic feedback)
export function vibrateController(duration = 50) {
  if ('vibrate' in navigator) {
    navigator.vibrate(duration);
  }
}

// Prevent scroll on mobile
export function preventScroll() {
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
  document.body.style.height = '100%';
}

// Enable fullscreen
export function requestFullscreen(element = document.documentElement) {
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }
}

// Exit fullscreen
export function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
}

// Load JSON configuration file
export async function loadConfig(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load config: ${path}`);
    return await response.json();
  } catch (error) {
    console.error('Error loading config:', error);
    return null;
  }
}

// Detect mobile device
export function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Format file size
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Debounce function
export function debounce(func, wait) {
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

// Copy to clipboard
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

// Play sound effect
export function playSound(soundPath) {
  const audio = new Audio(soundPath);
  audio.volume = 0.3;
  audio.play().catch(e => console.log('Sound play failed:', e));
}

// Log with timestamp
export function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data || '');
}