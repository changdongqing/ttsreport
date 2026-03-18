/**
 * Univer Service
 *
 * Manages the lifecycle of Univer instances (create, configure, destroy).
 * Provides a clean API for Vue components to interact with Univer.
 */
import { loadUniver } from './univerLoader';

/**
 * Create and initialize a Univer spreadsheet instance.
 *
 * @param {Object} options
 * @param {string} options.container - DOM element ID to mount Univer
 * @param {Object} options.workbookData - Univer IWorkbookData
 * @param {boolean} [options.editable=true] - Whether the sheet is editable
 * @returns {Promise<{univer, univerAPI, workbook}>} Univer instance and API
 */
export async function createUniverSheet(options) {
  var container = options.container;
  var workbookData = options.workbookData;
  var editable = options.editable !== false;

  var presets = await loadUniver();
  var createUniver = presets.createUniver;
  var LocaleType = presets.LocaleType;
  var UniverSheetsCorePreset = presets.UniverSheetsCorePreset;
  var zhCN = presets.locales.zhCN;

  var result = createUniver({
    locale: LocaleType.ZH_CN,
    locales: {
      [LocaleType.ZH_CN]: zhCN
    },
    presets: [
      UniverSheetsCorePreset({
        container: container
      })
    ]
  });

  var univerAPI = result.univerAPI;

  // Create the workbook with data
  var workbook = univerAPI.createWorkbook(workbookData);

  // Set editable state
  if (!editable) {
    try {
      workbook.setEditable(false);
    } catch (e) {
      console.warn('Failed to set read-only mode:', e);
    }
  }

  return {
    univer: result.univer,
    univerAPI: univerAPI,
    workbook: workbook
  };
}

/**
 * Get the workbook snapshot (for saving).
 *
 * @param {Object} univerAPI - The FUniver API instance
 * @returns {Object|null} IWorkbookData snapshot or null
 */
export function getWorkbookSnapshot(univerAPI) {
  if (!univerAPI) return null;
  try {
    var workbook = univerAPI.getActiveWorkbook();
    if (!workbook) return null;
    return workbook.save();
  } catch (e) {
    console.error('Failed to get workbook snapshot:', e);
    return null;
  }
}

/**
 * Destroy a Univer instance and clean up resources.
 *
 * @param {Object} univer - The Univer instance
 */
export function destroyUniver(univer) {
  if (univer) {
    try {
      univer.dispose();
    } catch (e) {
      console.warn('Error disposing Univer:', e);
    }
  }
}
