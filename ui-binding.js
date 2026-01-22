/**
 * The Memory Index - UI Binding
 * Copyright (C) 2025 Nguyen Thu Trang (s3926717)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
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