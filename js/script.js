// Theme management
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
        setTheme(savedTheme);
    } else if (systemPrefersDark) {
        setTheme('dark');
    } else {
        setTheme('light');
    }
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
    }
});

// Synchronized scrolling functionality
function setupSyncScrolling() {
    const syncElements = document.querySelectorAll('[data-sync-group="diff"]');

    syncElements.forEach(element => {
        element.addEventListener('scroll', function () {
            const scrollPercentage = this.scrollTop / (this.scrollHeight - this.clientHeight);

            syncElements.forEach(otherElement => {
                if (otherElement !== this) {
                    const targetScrollTop = scrollPercentage * (otherElement.scrollHeight - otherElement.clientHeight);
                    otherElement.scrollTop = targetScrollTop;
                }
            });
        });
    });
}

// Calculate statistics for the diff
function calculateStats(originalText, modifiedText, diffResult, mode) {
    // Get units based on mode
    const originalUnits = splitTextByMode(originalText.trim(), mode).filter(unit => unit.length > 0);
    const modifiedUnits = splitTextByMode(modifiedText.trim(), mode).filter(unit => unit.length > 0);

    // Count changes from diff result
    let unitsAdded = 0;
    let unitsRemoved = 0;

    diffResult.original.forEach(item => {
        if (item.type === 'removed' && item.text.trim()) {
            if (mode === 'word') {
                unitsAdded += item.text.trim().split(/\s+/).filter(word => word.length > 0).length;
            } else {
                unitsAdded += 1;
            }
        }
    });

    diffResult.modified.forEach(item => {
        if (item.type === 'added' && item.text.trim()) {
            if (mode === 'word') {
                unitsRemoved += item.text.trim().split(/\s+/).filter(word => word.length > 0).length;
            } else {
                unitsRemoved += 1;
            }
        }
    });

    const totalChanges = unitsAdded + unitsRemoved;
    const maxUnits = Math.max(originalUnits.length, modifiedUnits.length);
    const percentChanged = maxUnits > 0 ? Math.round((totalChanges / maxUnits) * 100) : 0;

    return {
        unitsAdded,
        unitsRemoved,
        totalChanges,
        percentChanged,
        originalUnitCount: originalUnits.length,
        modifiedUnitCount: modifiedUnits.length
    };
}

// Update the statistics display
function updateStats(stats) {
    document.getElementById('wordsAdded').textContent = stats.unitsRemoved; // Note: swapped because we count from perspective
    document.getElementById('wordsRemoved').textContent = stats.unitsAdded; // Note: swapped because we count from perspective
    document.getElementById('percentChanged').textContent = `${stats.percentChanged}%`;
}

// Display the diff results with appropriate styling
function displayDiff(diffArray, elementId, mode) {
    const element = document.getElementById(elementId);
    let html = '';

    for (const item of diffArray) {
        if (item.type === 'unchanged') {
            html += escapeHtml(item.text);
        } else if (item.type === 'added') {
            html += `<span class="added">${escapeHtml(item.text)}</span>`;
        } else if (item.type === 'removed') {
            html += `<span class="removed">${escapeHtml(item.text)}</span>`;
        }
    }

    // Set innerHTML and preserve formatting
    element.innerHTML = html || '<div class="no-changes">No changes detected</div>';
}

// Current diff mode
let currentDiffMode = 'word';

// Diff mode management
function initDiffModeButtons() {
    const buttons = document.querySelectorAll('.diff-mode-btn');
    const hintElement = document.getElementById('modeHint');

    const hints = {
        'word': 'Best for general text editing',
        'character': 'Best for catching typos and small changes',
        'line': 'Best for structured text and code'
    };

    buttons.forEach(button => {
        button.addEventListener('click', function () {
            // Remove active class from all buttons
            buttons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            // Update current mode
            currentDiffMode = this.dataset.mode;
            // Update hint
            if (hintElement) {
                hintElement.textContent = hints[currentDiffMode];
            }
            // Re-run comparison with new mode
            debouncedAutoCompare();
        });
    });
}

// Split text based on current diff mode
function splitTextByMode(text, mode) {
    switch (mode) {
        case 'character':
            // For character mode, preserve whitespace and structure better
            return text.split('');
        case 'line':
            // For line mode, split on actual line breaks and preserve empty lines
            return text.split(/(\r?\n)/);
        case 'word':
        default:
            // For word mode, split on whitespace but preserve the whitespace
            return text.split(/(\s+)/);
    }
}

// Update statistics labels based on diff mode
function updateStatLabels(mode) {
    const addedLabel = document.querySelector('.stat-item:nth-child(1) .stat-label');
    const removedLabel = document.querySelector('.stat-item:nth-child(2) .stat-label');

    switch (mode) {
        case 'character':
            addedLabel.textContent = 'Chars Added';
            removedLabel.textContent = 'Chars Removed';
            break;
        case 'line':
            addedLabel.textContent = 'Lines Added';
            removedLabel.textContent = 'Lines Removed';
            break;
        case 'word':
        default:
            addedLabel.textContent = 'Added';
            removedLabel.textContent = 'Removed';
            break;
    }
}

// Auto-compare function that runs when text changes
function autoCompare() {
    const originalText = document.getElementById('originalText').value;
    const modifiedText = document.getElementById('modifiedText').value;

    // Only compare if both inputs have some text
    if (originalText.trim() && modifiedText.trim()) {
        const originalUnits = splitTextByMode(originalText, currentDiffMode);
        const modifiedUnits = splitTextByMode(modifiedText, currentDiffMode);

        const diff = computeDiff(originalUnits, modifiedUnits);

        displayDiff(diff.original, 'originalDiff', currentDiffMode);
        displayDiff(diff.modified, 'modifiedDiff', currentDiffMode);

        // Calculate and update statistics
        const stats = calculateStats(originalText, modifiedText, diff, currentDiffMode);
        updateStats(stats);
        updateStatLabels(currentDiffMode);

        // Show results section
        document.getElementById('resultsSection').style.display = 'block';

        // Set up synchronized scrolling after content is loaded
        setTimeout(setupSyncScrolling, 100);
    } else {
        // Hide results if either input is empty but keep sidebar visible
        document.getElementById('resultsSection').style.display = 'none';
        // Reset stats to empty state
        resetStats();
    }
}

// Reset statistics to empty state
function resetStats() {
    document.getElementById('wordsAdded').textContent = '–';
    document.getElementById('wordsRemoved').textContent = '–';
    document.getElementById('percentChanged').textContent = '–';
}

// Debounced version of autoCompare to avoid excessive calculations
let compareTimeout;
function debouncedAutoCompare() {
    clearTimeout(compareTimeout);
    compareTimeout = setTimeout(autoCompare, 300); // Wait 300ms after user stops typing
}

// Main comparison function (kept for any manual calls)
function compareTexts() {
    const originalText = document.getElementById('originalText').value;
    const modifiedText = document.getElementById('modifiedText').value;

    if (!originalText.trim() && !modifiedText.trim()) {
        alert('Please enter some text to compare.');
        return;
    }

    const originalWords = originalText.split(/(\s+)/);
    const modifiedWords = modifiedText.split(/(\s+)/);

    const diff = computeDiff(originalWords, modifiedWords);

    displayDiff(diff.original, 'originalDiff');
    displayDiff(diff.modified, 'modifiedDiff');

    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

// Compute differences using dynamic programming (Levenshtein distance algorithm)
function computeDiff(original, modified) {
    const dp = [];
    const m = original.length;
    const n = modified.length;

    // Initialize DP table
    for (let i = 0; i <= m; i++) {
        dp[i] = [];
        for (let j = 0; j <= n; j++) {
            if (i === 0) {
                dp[i][j] = j;
            } else if (j === 0) {
                dp[i][j] = i;
            } else if (original[i - 1] === modified[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],      // deletion
                    dp[i][j - 1],      // insertion
                    dp[i - 1][j - 1]   // substitution
                );
            }
        }
    }

    // Backtrack to find the actual differences
    const originalResult = [];
    const modifiedResult = [];
    let i = m;
    let j = n;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && original[i - 1] === modified[j - 1]) {
            // Characters match
            originalResult.unshift({ text: original[i - 1], type: 'unchanged' });
            modifiedResult.unshift({ text: modified[j - 1], type: 'unchanged' });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] <= dp[i - 1][j])) {
            // Insertion in modified text
            originalResult.unshift({ text: '', type: 'placeholder' });
            modifiedResult.unshift({ text: modified[j - 1], type: 'added' });
            j--;
        } else if (i > 0) {
            // Deletion from original text
            originalResult.unshift({ text: original[i - 1], type: 'removed' });
            modifiedResult.unshift({ text: '', type: 'placeholder' });
            i--;
        }
    }

    return { original: originalResult, modified: modifiedResult };
}

// Display the diff results with appropriate styling
function displayDiff(diffArray, elementId) {
    const element = document.getElementById(elementId);
    let html = '';

    for (const item of diffArray) {
        if (item.type === 'unchanged') {
            html += escapeHtml(item.text);
        } else if (item.type === 'added') {
            html += `<span class="added">${escapeHtml(item.text)}</span>`;
        } else if (item.type === 'removed') {
            html += `<span class="removed">${escapeHtml(item.text)}</span>`;
        }
        // Skip placeholders (empty items used for alignment)
    }

    element.innerHTML = html || '<div class="no-changes">No changes detected</div>';
}

// Escape HTML to prevent XSS attacks
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Clear all input and results
function clearAll() {
    document.getElementById('originalText').value = '';
    document.getElementById('modifiedText').value = '';
    document.getElementById('resultsSection').style.display = 'none';
    resetStats();
    document.getElementById('originalText').focus();
}

// Draggable resize functionality
function initResizeDivider() {
    const divider = document.getElementById('resizeDivider');
    const textInputs = document.querySelector('.text-inputs');
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    divider.addEventListener('mousedown', function (e) {
        isResizing = true;
        startY = e.clientY;
        startHeight = textInputs.offsetHeight;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
        if (!isResizing) return;

        const deltaY = e.clientY - startY;
        const newHeight = Math.max(200, Math.min(600, startHeight + deltaY));
        textInputs.style.height = newHeight + 'px';

        e.preventDefault();
    });

    document.addEventListener('mouseup', function () {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });

    // Touch support for mobile
    divider.addEventListener('touchstart', function (e) {
        isResizing = true;
        startY = e.touches[0].clientY;
        startHeight = textInputs.offsetHeight;
        e.preventDefault();
    });

    document.addEventListener('touchmove', function (e) {
        if (!isResizing) return;

        const deltaY = e.touches[0].clientY - startY;
        const newHeight = Math.max(200, Math.min(600, startHeight + deltaY));
        textInputs.style.height = newHeight + 'px';

        e.preventDefault();
    });

    document.addEventListener('touchend', function () {
        if (isResizing) {
            isResizing = false;
        }
    });
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    // Initialize theme
    initTheme();

    // Initialize diff mode buttons
    initDiffModeButtons();

    // Initialize resize divider
    initResizeDivider();

    // Set up theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Set up auto-compare for textareas (removed auto-resize since we have manual resize now)
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
        textarea.addEventListener('input', function () {
            // Trigger auto-compare on text change
            debouncedAutoCompare();
        });

        // Also trigger on paste events
        textarea.addEventListener('paste', function () {
            // Small delay to let paste complete
            setTimeout(debouncedAutoCompare, 100);
        });
    });

    // Focus on first textarea when page loads
    document.getElementById('originalText').focus();
});

// Keyboard shortcuts
document.addEventListener('keydown', function (event) {
    // Ctrl/Cmd + Delete to clear
    if ((event.ctrlKey || event.metaKey) && event.key === 'Delete') {
        event.preventDefault();
        clearAll();
    }
});