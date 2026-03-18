/**
 * Univer Script Loader
 * Dynamically loads the Univer bundle (JS + CSS) only when needed.
 * Follows the same pattern as Luckysheet's global loading but on-demand.
 */

let _loadPromise = null;

/**
 * Load the Univer preset bundle. Returns a promise that resolves
 * with the UniverPresets global object when ready.
 * Multiple calls return the same promise (singleton pattern).
 */
export function loadUniver() {
  if (window.UniverPresets) {
    return Promise.resolve(window.UniverPresets);
  }
  if (_loadPromise) {
    return _loadPromise;
  }
  _loadPromise = new Promise(function (resolve, reject) {
    // Load CSS
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/static/univer/univer-preset.css';
    document.head.appendChild(link);

    // Load JS
    var script = document.createElement('script');
    script.src = '/static/univer/univer-preset.js';
    script.onload = function () {
      if (window.UniverPresets) {
        resolve(window.UniverPresets);
      } else {
        reject(new Error('UniverPresets not found after script load'));
      }
    };
    script.onerror = function () {
      _loadPromise = null;
      reject(new Error('Failed to load Univer script'));
    };
    document.head.appendChild(script);
  });
  return _loadPromise;
}
