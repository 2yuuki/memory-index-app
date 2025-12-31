document.addEventListener('DOMContentLoaded', () => {
  console.log("UI Binding Loaded");

  // --- Tab Switching Logic ---
  const tabs = document.querySelectorAll('.tab-btn');
  const workspaces = document.querySelectorAll('.workspace');

  tabs.forEach(tab => {
    // Skip tabs that don't have data-tab attribute (e.g., Top Bar navigation tabs)
    if (!tab.hasAttribute('data-tab')) return;

    tab.onclick = () => {
      // Ignore disabled tabs
      if(tab.style.cursor === 'default') return;

      // 1. Remove 'active' class from all tabs and workspaces
      tabs.forEach(t => t.classList.remove('active'));
      workspaces.forEach(w => w.classList.remove('active'));

      // 2. Add 'active' to the clicked tab
      tab.classList.add('active');

      // 3. Find and activate the corresponding workspace
      const targetId = tab.getAttribute('data-tab'); // e.g., "tab-input"
      const targetWorkspace = document.getElementById(targetId);
      if (targetWorkspace) {
        targetWorkspace.classList.add('active');
      }

      // 4. Notify sketch.js to move/resize the canvas
      if (window.switchTab && targetId) {
        window.switchTab(targetId);
      }
    };
  });

  // Now that the DOM is ready, we can safely call the p5-dependent setup functions
  setTimeout(() => {
    if(window.switchTab) window.switchTab('tab-input');
  }, 100);
});