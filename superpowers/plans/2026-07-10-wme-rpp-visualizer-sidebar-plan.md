# WME RPP Visualizer — Sidebar Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace floating button + panel UI in WME RPP Visualizer with a sidebar tab panel (following INSPIRE script pattern).

**Architecture:** Single-file modification. Strip all floating UI code (button, panel, drag, positioning). Add `W.userscripts.registerSidebarTab('RPP')` to host the same controls inline in the WME sidebar. Keep all data/rendering logic untouched.

**Tech Stack:** WME Legacy API, OpenLayers, localStorage.

**Files modified:** `scripts/WME_RPP_Visualizer.js`

---

### Task 1: Strip floating UI state, storage keys, and dead code

**Files:**
- Modify: `scripts/WME_RPP_Visualizer.js`

- [ ] **Step 1: Remove floating button storage key and state variables**

Remove `floatingButtonPos` from STORAGE_KEYS:

```javascript
    const STORAGE_KEYS = {
        enabled: 'wme-rpp-visualizer-enabled',
        labelZoom: 'wme-rpp-visualizer-label-zoom',
        lineZoom: 'wme-rpp-visualizer-line-zoom',
        debug: 'wme-rpp-visualizer-debug'
    };
```

Remove `floatingButton` and `floatingPanel` from state:

```javascript
    let vectorLayer = null;
    let enabled = false;
    let debug = false;
    let labelZoomThreshold = DEFAULT_LABEL_ZOOM;
    let lineZoomThreshold = DEFAULT_LINE_ZOOM;
    let refreshTimeout = null;
    let isRefreshing = false;
    let pendingRefresh = false;
```

- [ ] **Step 2: Remove button position saving from savePreferences**

Replace the savePreferences function:

```javascript
    function savePreferences() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEYS.enabled, JSON.stringify(enabled));
                localStorage.setItem(STORAGE_KEYS.labelZoom, JSON.stringify(labelZoomThreshold));
                localStorage.setItem(STORAGE_KEYS.lineZoom, JSON.stringify(lineZoomThreshold));
                localStorage.setItem(STORAGE_KEYS.debug, JSON.stringify(debug));
            } catch (e) {
                console.warn('[WME RPP Visualizer] Failed to save preferences:', e);
            }
        }, 500);
    }
```

- [ ] **Step 3: Remove loadButtonPosition function entirely**

Delete the entire `loadButtonPosition` function (current lines 113-126).

- [ ] **Step 4: Commit**

```bash
git add scripts/WME_RPP_Visualizer.js
git commit -m "refactor(rpp): remove floating UI state and storage keys"
```

---

### Task 2: Remove floating UI creation and event functions

**Files:**
- Modify: `scripts/WME_RPP_Visualizer.js`

- [ ] **Step 1: Remove the entire FLOATING UI section**

Delete from `function createFloatingUI()` through `function updatePanelContent()` (current lines 329-593). Keep `countVisibleRPPs`.

The section to remove includes:
- `createFloatingUI()` — all floating DOM creation
- `setupFloatingButtonEvents()` — all drag/click handlers
- `toggleEnabled()` — button-based toggle with panel show/hide
- `updateButtonStyle()` — floating button color/border updates
- `updatePanelContent()` — floating panel innerHTML rebuild

- [ ] **Step 2: Commit**

```bash
git add scripts/WME_RPP_Visualizer.js
git commit -m "refactor(rpp): remove floating button and panel code"
```

---

### Task 3: Add sidebar panel creation function

**Files:**
- Modify: `scripts/WME_RPP_Visualizer.js`

- [ ] **Step 1: Add sidebar panel state and creation function**

Insert after the `// === VECTOR LAYER ===` section (after `doRefreshAnnotations` function ends, before `// === INITIALIZATION ===`):

```javascript
    // === SIDEBAR UI ===

    let sidebarPanel = null;

    async function createSidebarPanel() {
        console.log('[WME RPP Visualizer] Creating sidebar panel...');

        const { tabLabel, tabPane } = W.userscripts.registerSidebarTab('RPP');
        tabLabel.textContent = 'RPP';
        tabLabel.title = 'RPP Visualizer';

        const divRoot = createElem('div', {
            style: {
                padding: '8px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '12px'
            }
        });

        // Header
        const header = createElem('div', {
            style: {
                fontWeight: 'bold',
                marginBottom: '8px',
                fontSize: '14px',
                color: '#0052A5',
                borderBottom: '1px solid #0052A5',
                paddingBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            },
            innerHTML: '<span>RPP Visualizer</span><span style="font-size:10px;color:#999;">v' + SCRIPT_VERSION + '</span>'
        });
        divRoot.appendChild(header);

        // Enable toggle
        const enableContainer = createElem('div', { style: { marginBottom: '10px' } });
        const enableCheckbox = createElem('input', {
            type: 'checkbox',
            id: 'rpp-enable',
            checked: enabled,
            style: { marginRight: '6px', accentColor: '#2E7D32', width: '18px', height: '18px' }
        });
        enableCheckbox.addEventListener('change', function(e) {
            enabled = e.target.checked;
            savePreferences();
            if (enabled) {
                refreshAnnotations();
            } else {
                removeVectorLayer();
            }
            updateSidebarCount();
        });
        const enableLabel = createElem('label', {
            htmlFor: 'rpp-enable',
            style: { cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#2E7D32' },
            textContent: 'Näytä RPP-tiedot'
        });
        enableContainer.appendChild(enableCheckbox);
        enableContainer.appendChild(enableLabel);
        divRoot.appendChild(enableContainer);

        // Zoom settings section
        const zoomSection = createElem('div', {
            style: { marginBottom: '10px', padding: '8px', background: '#f9f9f9', borderRadius: '4px', border: '1px solid #e0e0e0' }
        });

        const labelZoomContainer = createElem('div', { style: { marginBottom: '6px' } });
        const labelZoomLabel = createElem('label', {
            style: { fontSize: '11px', color: '#666', marginRight: '8px' },
            textContent: 'Näytä numerot zoom:'
        });
        const labelZoomInput = createElem('input', {
            type: 'number',
            id: 'rpp-label-zoom',
            value: labelZoomThreshold.toString(),
            min: '1',
            max: '22',
            step: '1',
            style: { width: '60px', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }
        });
        labelZoomInput.addEventListener('change', function(e) {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value) && value >= 1 && value <= 22) {
                labelZoomThreshold = value;
                savePreferences();
                refreshAnnotations();
            }
        });
        labelZoomContainer.appendChild(labelZoomLabel);
        labelZoomContainer.appendChild(labelZoomInput);
        zoomSection.appendChild(labelZoomContainer);

        const lineZoomContainer = createElem('div', {});
        const lineZoomLabel = createElem('label', {
            style: { fontSize: '11px', color: '#666', marginRight: '8px' },
            textContent: 'Näytä viivat zoom:'
        });
        const lineZoomInput = createElem('input', {
            type: 'number',
            id: 'rpp-line-zoom',
            value: lineZoomThreshold.toString(),
            min: '1',
            max: '22',
            step: '1',
            style: { width: '60px', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }
        });
        lineZoomInput.addEventListener('change', function(e) {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value) && value >= 1 && value <= 22) {
                lineZoomThreshold = value;
                savePreferences();
                refreshAnnotations();
            }
        });
        lineZoomContainer.appendChild(lineZoomLabel);
        lineZoomContainer.appendChild(lineZoomInput);
        zoomSection.appendChild(lineZoomContainer);

        divRoot.appendChild(zoomSection);

        // RPP count
        const countDiv = createElem('div', {
            id: 'rpp-count',
            style: { padding: '8px', background: '#f5f5f5', borderRadius: '4px', textAlign: 'center', fontSize: '12px', color: '#666', marginBottom: '10px' },
            textContent: countVisibleRPPs() + ' RPP näkyvillä'
        });
        divRoot.appendChild(countDiv);

        // Debug toggle
        const debugContainer = createElem('div', { style: {} });
        const debugCheckbox = createElem('input', {
            type: 'checkbox',
            id: 'rpp-debug',
            checked: debug,
            style: { marginRight: '6px', accentColor: '#666', width: '14px', height: '14px' }
        });
        debugCheckbox.addEventListener('change', function(e) {
            debug = e.target.checked;
            savePreferences();
        });
        const debugLabel = createElem('label', {
            htmlFor: 'rpp-debug',
            style: { cursor: 'pointer', fontSize: '11px', color: '#999' },
            textContent: 'Debug'
        });
        debugContainer.appendChild(debugCheckbox);
        debugContainer.appendChild(debugLabel);
        divRoot.appendChild(debugContainer);

        tabPane.appendChild(divRoot);
        tabPane.id = 'rpp-sidebar-panel';
        await W.userscripts.waitForElementConnected(tabPane);

        sidebarPanel = {
            countDiv: document.getElementById('rpp-count'),
            enableCheckbox: document.getElementById('rpp-enable')
        };
    }

    function updateSidebarCount() {
        if (!sidebarPanel?.countDiv) return;
        const count = enabled ? countVisibleRPPs() : 0;
        sidebarPanel.countDiv.textContent = count + ' RPP näkyvillä';
    }
```

- [ ] **Step 2: Commit**

```bash
git add scripts/WME_RPP_Visualizer.js
git commit -m "feat(rpp): add sidebar panel UI"
```

---

### Task 4: Update initialization and map events

**Files:**
- Modify: `scripts/WME_RPP_Visualizer.js`

- [ ] **Step 1: Replace initializeScript**

Replace the current `initializeScript` function:

```javascript
    function initializeScript() {
        console.log('[WME RPP Visualizer] Initializing...');

        loadPreferences();
        createSidebarPanel();

        if (enabled) {
            refreshAnnotations();
        }

        const olMap = W.map.getOLMap();
        olMap.events.register('zoomend', null, function() {
            if (enabled) { updateSidebarCount(); refreshAnnotations(); }
        });
        olMap.events.register('moveend', null, function() {
            if (enabled) { updateSidebarCount(); refreshAnnotations(); }
        });

        console.log('[WME RPP Visualizer] Initialized');
    }
```

- [ ] **Step 2: Commit**

```bash
git add scripts/WME_RPP_Visualizer.js
git commit -m "refactor(rpp): update initialization to use sidebar panel"
```

---

### Task 5: Self-review and final verification

- [ ] **Step 1: Verify file structure**

The file should flow as:
```
1.  UserScript header (11 lines)
2.  IIFE + init guard (5 lines)
3.  Constants/config (18 lines)
4.  State variables (9 lines)
5.  Utility functions (debugLog, createElem) (22 lines)
6.  Persistence (savePreferences, loadPreferences) (~35 lines)
7.  Data model (getViewportBounds, isInViewport, buildAnnotationFeatures) (~85 lines)
8.  Styles (3 style objects) (~30 lines)
9.  Vector layer (createVectorLayer, removeVectorLayer, refreshAnnotations, doRefreshAnnotations) (~55 lines)
10. Sidebar UI (createSidebarPanel, updateSidebarCount, countVisibleRPPs) (~140 lines)
11. Initialization (initializeScript) (~22 lines)
12. Startup + IIFE close (~10 lines)
```

Check:
- No references to `floatingButton`, `floatingPanel`, `loadButtonPosition`, `floatingButtonPos`
- `toggleEnabled`, `updateButtonStyle`, `updatePanelContent`, `createFloatingUI`, `setupFloatingButtonEvents` all removed
- `createSidebarPanel` is called instead of `createFloatingUI`
- `countVisibleRPPs` is still present
- Enable checkbox directly sets `enabled` and calls `savePreferences()`

- [ ] **Step 2: Final commit**

```bash
git add scripts/WME_RPP_Visualizer.js
git commit -m "refactor(rpp): finalize sidebar panel migration"
```
