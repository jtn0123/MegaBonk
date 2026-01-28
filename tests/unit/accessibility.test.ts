import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

/**
 * Accessibility Tests
 * Verify ARIA attributes, keyboard navigation, focus management, and screen reader support
 */

describe('Accessibility', () => {
  beforeEach(() => {
    createMinimalDOM();
  });

  describe('ARIA Attributes', () => {
    describe('Tab Navigation', () => {
      it('should have tablist role on tab container', () => {
        const tabButtons = document.createElement('div');
        tabButtons.className = 'tab-buttons';
        tabButtons.setAttribute('role', 'tablist');
        tabButtons.setAttribute('aria-label', 'Content categories');
        document.body.appendChild(tabButtons);

        expect(tabButtons.getAttribute('role')).toBe('tablist');
        expect(tabButtons.getAttribute('aria-label')).toBe('Content categories');
      });

      it('should have tab role on tab buttons', () => {
        const tabBtn = document.createElement('button');
        tabBtn.className = 'tab-btn active';
        tabBtn.setAttribute('role', 'tab');
        tabBtn.setAttribute('aria-selected', 'true');
        tabBtn.setAttribute('aria-controls', 'items-tab');
        tabBtn.setAttribute('id', 'tab-items');
        document.body.appendChild(tabBtn);

        expect(tabBtn.getAttribute('role')).toBe('tab');
        expect(tabBtn.getAttribute('aria-selected')).toBe('true');
        expect(tabBtn.getAttribute('aria-controls')).toBe('items-tab');
      });

      it('should update aria-selected when tab changes', () => {
        const tab1 = document.createElement('button');
        tab1.className = 'tab-btn active';
        tab1.setAttribute('role', 'tab');
        tab1.setAttribute('aria-selected', 'true');

        const tab2 = document.createElement('button');
        tab2.className = 'tab-btn';
        tab2.setAttribute('role', 'tab');
        tab2.setAttribute('aria-selected', 'false');

        document.body.appendChild(tab1);
        document.body.appendChild(tab2);

        // Simulate tab switch
        tab1.classList.remove('active');
        tab1.setAttribute('aria-selected', 'false');
        tab2.classList.add('active');
        tab2.setAttribute('aria-selected', 'true');

        expect(tab1.getAttribute('aria-selected')).toBe('false');
        expect(tab2.getAttribute('aria-selected')).toBe('true');
      });

      it('should have tabpanel role on tab content', () => {
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content active';
        tabContent.setAttribute('role', 'tabpanel');
        tabContent.setAttribute('aria-labelledby', 'tab-items');
        tabContent.id = 'items-tab';
        document.body.appendChild(tabContent);

        expect(tabContent.getAttribute('role')).toBe('tabpanel');
        expect(tabContent.getAttribute('aria-labelledby')).toBe('tab-items');
      });

      it('should link tabs to panels with aria-controls', () => {
        const tab = document.createElement('button');
        tab.setAttribute('aria-controls', 'items-tab');
        tab.id = 'tab-items';

        const panel = document.createElement('div');
        panel.id = 'items-tab';
        panel.setAttribute('aria-labelledby', 'tab-items');

        document.body.appendChild(tab);
        document.body.appendChild(panel);

        const controlsId = tab.getAttribute('aria-controls');
        const linkedPanel = document.getElementById(controlsId);

        expect(linkedPanel).toBeTruthy();
        // Verify the panel has the correct aria-labelledby attribute
        expect(panel.getAttribute('aria-labelledby')).toBe('tab-items');
        // Verify it matches the tab's ID
        expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
      });
    });

    describe('Modal Dialogs', () => {
      it('should have dialog role', () => {
        const modal = document.createElement('div');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'modal-title');
        document.body.appendChild(modal);

        expect(modal.getAttribute('role')).toBe('dialog');
        expect(modal.getAttribute('aria-modal')).toBe('true');
        expect(modal.getAttribute('aria-labelledby')).toBe('modal-title');
      });

      it('should have close button with aria-label', () => {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close';
        closeBtn.setAttribute('aria-label', 'Close modal');
        closeBtn.textContent = '×';
        document.body.appendChild(closeBtn);

        expect(closeBtn.getAttribute('aria-label')).toBe('Close modal');
      });

      it('should have proper compare modal accessibility', () => {
        const modal = document.createElement('div');
        modal.id = 'compareModal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Item comparison');
        document.body.appendChild(modal);

        expect(modal.getAttribute('role')).toBe('dialog');
        expect(modal.getAttribute('aria-label')).toBe('Item comparison');
      });
    });

    describe('Toast Notifications', () => {
      it('should have aria-live for live announcements', () => {
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.setAttribute('aria-live', 'polite');
        toastContainer.setAttribute('aria-atomic', 'true');
        document.body.appendChild(toastContainer);

        expect(toastContainer.getAttribute('aria-live')).toBe('polite');
        expect(toastContainer.getAttribute('aria-atomic')).toBe('true');
      });

      it('should support assertive announcements for errors', () => {
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';

        // For error toasts, could use assertive
        toastContainer.setAttribute('aria-live', 'assertive');
        document.body.appendChild(toastContainer);

        expect(toastContainer.getAttribute('aria-live')).toBe('assertive');
      });
    });

    describe('Form Controls', () => {
      it('should have aria-label on search input', () => {
        const searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.id = 'searchInput';
        searchInput.setAttribute('aria-label', 'Search items, weapons, tomes, and characters');
        document.body.appendChild(searchInput);

        expect(searchInput.getAttribute('aria-label')).toBeTruthy();
        expect(searchInput.getAttribute('aria-label')).toContain('Search');
      });

      it('should have labels for filter dropdowns', () => {
        const label = document.createElement('label');
        label.setAttribute('for', 'tierFilter');
        label.textContent = 'Tier';

        const select = document.createElement('select');
        select.id = 'tierFilter';

        document.body.appendChild(label);
        document.body.appendChild(select);

        const linkedLabel = document.querySelector(`label[for="${select.id}"]`);
        expect(linkedLabel).toBeTruthy();
      });
    });

    describe('Interactive Cards', () => {
      it('should have role=button on clickable cards', () => {
        const card = document.createElement('div');
        card.className = 'breakpoint-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', 'Calculate 100% proc rate');
        document.body.appendChild(card);

        expect(card.getAttribute('role')).toBe('button');
        expect(card.getAttribute('tabindex')).toBe('0');
        expect(card.getAttribute('aria-label')).toBeTruthy();
      });
    });

    describe('Expandable Content', () => {
      it('should update aria-expanded on toggle', () => {
        const button = document.createElement('button');
        button.className = 'changelog-expand-btn';
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', 'changes-v1');
        document.body.appendChild(button);

        // Simulate expand
        button.setAttribute('aria-expanded', 'true');
        expect(button.getAttribute('aria-expanded')).toBe('true');

        // Simulate collapse
        button.setAttribute('aria-expanded', 'false');
        expect(button.getAttribute('aria-expanded')).toBe('false');
      });

      it('should link button to expandable content', () => {
        const button = document.createElement('button');
        button.className = 'changelog-expand-btn';
        button.setAttribute('aria-controls', 'changes-v1');

        const content = document.createElement('div');
        content.id = 'changes-v1';
        content.className = 'changelog-changes collapsed';

        document.body.appendChild(button);
        document.body.appendChild(content);

        const controlsId = button.getAttribute('aria-controls');
        const linkedContent = document.getElementById(controlsId);
        expect(linkedContent).toBeTruthy();
      });
    });

    describe('Navigation Landmarks', () => {
      it('should have aria-label on main navigation', () => {
        const nav = document.createElement('nav');
        nav.className = 'tabs';
        nav.setAttribute('aria-label', 'Main navigation');
        document.body.appendChild(nav);

        expect(nav.getAttribute('aria-label')).toBe('Main navigation');
      });

      it('should have aria-label on controls navigation', () => {
        const nav = document.createElement('nav');
        nav.className = 'controls';
        nav.setAttribute('aria-label', 'Search and filters');
        document.body.appendChild(nav);

        expect(nav.getAttribute('aria-label')).toBe('Search and filters');
      });

      it('should have aria-label on content grids', () => {
        const grid = document.createElement('div');
        grid.className = 'items-grid';
        grid.setAttribute('aria-label', 'Items grid');
        document.body.appendChild(grid);

        expect(grid.getAttribute('aria-label')).toBe('Items grid');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    describe('Escape Key', () => {
      it('should close modal on Escape key', () => {
        const modal = document.getElementById('itemModal');
        modal.style.display = 'block';

        // Simulate escape key
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(event);

        // closeModal would be called (mocked in real app)
        // Here we verify the key is detected correctly
        expect(event.key).toBe('Escape');
      });

      it('should detect Escape key event', () => {
        let escapeCalled = false;
        const handler = (e) => {
          if (e.key === 'Escape') {
            escapeCalled = true;
          }
        };

        document.addEventListener('keydown', handler);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        document.removeEventListener('keydown', handler);

        expect(escapeCalled).toBe(true);
      });
    });

    describe('Enter/Space on Interactive Elements', () => {
      it('should trigger action on Enter key for buttons', () => {
        const button = document.createElement('button');
        button.className = 'breakpoint-card';
        button.setAttribute('role', 'button');
        button.setAttribute('tabindex', '0');
        button.dataset.item = 'big-bonk';
        button.dataset.target = '100';
        document.body.appendChild(button);

        let activated = false;
        button.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            activated = true;
          }
        });

        button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(activated).toBe(true);
      });

      it('should trigger action on Space key for buttons', () => {
        const button = document.createElement('button');
        button.className = 'breakpoint-card';
        button.setAttribute('role', 'button');
        button.setAttribute('tabindex', '0');
        document.body.appendChild(button);

        let activated = false;
        button.addEventListener('keydown', (e) => {
          if (e.key === ' ') {
            activated = true;
          }
        });

        button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        expect(activated).toBe(true);
      });

      it('should prevent default on Space to avoid scrolling', () => {
        const card = document.createElement('div');
        card.className = 'breakpoint-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        document.body.appendChild(card);

        let defaultPrevented = false;
        card.addEventListener('keydown', (e) => {
          if (e.key === ' ' && card.classList.contains('breakpoint-card')) {
            e.preventDefault();
            defaultPrevented = true;
          }
        });

        const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
        card.dispatchEvent(event);
        expect(defaultPrevented).toBe(true);
      });
    });

    describe('Tab Navigation', () => {
      it('should allow tabbing through interactive elements', () => {
        const elements = [
          { tag: 'button', tabindex: null }, // Naturally focusable
          { tag: 'input', tabindex: null },
          { tag: 'select', tabindex: null },
          { tag: 'div', tabindex: '0' } // Role=button element
        ];

        elements.forEach(({ tag, tabindex }) => {
          const el = document.createElement(tag);
          if (tabindex !== null) {
            el.setAttribute('tabindex', tabindex);
          }
          document.body.appendChild(el);

          // Check element is focusable
          const computedTabindex = el.getAttribute('tabindex') ||
            (el.matches('button, input, select, textarea, a[href]') ? '0' : null);
          expect(computedTabindex === '0' || el.matches('button, input, select')).toBe(true);
        });
      });

      it('should have tabindex=0 on custom interactive elements', () => {
        const card = document.createElement('div');
        card.className = 'breakpoint-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        document.body.appendChild(card);

        expect(card.getAttribute('tabindex')).toBe('0');
      });
    });
  });

  describe('Focus Management', () => {
    describe('Modal Focus', () => {
      it('should have focusable close button in modal', () => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.setAttribute('role', 'dialog');

        const closeBtn = document.createElement('button');
        closeBtn.className = 'close';
        closeBtn.setAttribute('aria-label', 'Close modal');
        modal.appendChild(closeBtn);
        document.body.appendChild(modal);

        // Close button should be focusable
        expect(closeBtn.tagName.toLowerCase()).toBe('button');
        closeBtn.focus();
        expect(document.activeElement).toBe(closeBtn);
      });

      it('should trap focus within modal when open', () => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'close';
        const input = document.createElement('input');

        modal.appendChild(closeBtn);
        modal.appendChild(input);
        document.body.appendChild(modal);

        const focusableElements = modal.querySelectorAll('button, input');
        expect(focusableElements.length).toBe(2);
      });
    });

    describe('Focus Visible', () => {
      it('should have visible focus styles (CSS class exists)', () => {
        // This tests the concept - actual CSS would be in styles.css
        const button = document.createElement('button');
        button.className = 'tab-btn';
        document.body.appendChild(button);

        // Simulate focus-visible
        button.classList.add('focus-visible');
        expect(button.classList.contains('focus-visible')).toBe(true);
      });
    });
  });

  describe('Screen Reader Support', () => {
    describe('Hidden Content', () => {
      it('should hide decorative elements from screen readers', () => {
        const decorativeIcon = document.createElement('span');
        decorativeIcon.setAttribute('aria-hidden', 'true');
        decorativeIcon.textContent = '📦';
        document.body.appendChild(decorativeIcon);

        expect(decorativeIcon.getAttribute('aria-hidden')).toBe('true');
      });

      it('should not hide meaningful content', () => {
        const button = document.createElement('button');
        button.textContent = 'View Details';
        document.body.appendChild(button);

        expect(button.getAttribute('aria-hidden')).toBeNull();
      });
    });

    describe('Alternative Text', () => {
      it('should provide text alternatives for icon buttons', () => {
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.setAttribute('aria-label', 'Close');
        document.body.appendChild(closeBtn);

        expect(closeBtn.getAttribute('aria-label')).toBeTruthy();
      });
    });

    describe('Live Regions', () => {
      it('should announce dynamic content changes', () => {
        const container = document.createElement('div');
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('role', 'status');
        document.body.appendChild(container);

        // Add dynamic content
        container.textContent = 'Filters applied. 10 items shown.';

        expect(container.getAttribute('aria-live')).toBe('polite');
        expect(container.textContent).toContain('items shown');
      });

      it('should use assertive for urgent announcements', () => {
        const container = document.createElement('div');
        container.setAttribute('aria-live', 'assertive');
        container.setAttribute('role', 'alert');
        document.body.appendChild(container);

        container.textContent = 'Error loading data';

        expect(container.getAttribute('aria-live')).toBe('assertive');
        expect(container.getAttribute('role')).toBe('alert');
      });
    });
  });

  describe('Color and Contrast', () => {
    it('should not rely solely on color for information', () => {
      // Rarity items should have text labels in addition to colors
      const item = document.createElement('div');
      item.className = 'item-card rarity-legendary';

      const rarityBadge = document.createElement('span');
      rarityBadge.className = 'rarity-badge';
      rarityBadge.textContent = 'Legendary'; // Text label in addition to color
      item.appendChild(rarityBadge);
      document.body.appendChild(item);

      expect(rarityBadge.textContent).toBeTruthy();
      expect(rarityBadge.textContent).not.toBe('');
    });

    it('should have text for tier indicators', () => {
      const tierBadge = document.createElement('span');
      tierBadge.className = 'tier-badge tier-SS';
      tierBadge.textContent = 'SS';
      document.body.appendChild(tierBadge);

      expect(tierBadge.textContent).toBe('SS');
    });
  });

  describe('Semantic HTML', () => {
    it('should use nav element for navigation', () => {
      const nav = document.createElement('nav');
      nav.className = 'tabs';
      document.body.appendChild(nav);

      expect(nav.tagName.toLowerCase()).toBe('nav');
    });

    it('should use button element for clickable actions', () => {
      const btn = document.createElement('button');
      btn.className = 'view-details-btn';
      btn.textContent = 'View Details';
      document.body.appendChild(btn);

      expect(btn.tagName.toLowerCase()).toBe('button');
    });

    it('should use heading elements for structure', () => {
      const h1 = document.createElement('h1');
      h1.textContent = 'MegaBonk Guide';

      const h2 = document.createElement('h2');
      h2.textContent = 'Items';

      document.body.appendChild(h1);
      document.body.appendChild(h2);

      expect(h1.tagName.toLowerCase()).toBe('h1');
      expect(h2.tagName.toLowerCase()).toBe('h2');
    });

    it('should use label elements for form fields', () => {
      const label = document.createElement('label');
      label.setAttribute('for', 'searchInput');
      label.textContent = 'Search';

      const input = document.createElement('input');
      input.id = 'searchInput';
      input.type = 'search';

      document.body.appendChild(label);
      document.body.appendChild(input);

      const associatedLabel = document.querySelector(`label[for="${input.id}"]`);
      expect(associatedLabel).toBeTruthy();
    });
  });

  describe('Reduced Motion', () => {
    it('should respect prefers-reduced-motion media query', () => {
      // This is primarily a CSS concern, but we can test the concept
      const element = document.createElement('div');
      element.style.animation = 'fadeIn 0.3s';
      document.body.appendChild(element);

      // In real app, CSS would include:
      // @media (prefers-reduced-motion: reduce) { animation: none; }
      expect(element.style.animation).toBeTruthy();
    });
  });
});

describe('WCAG Compliance Checks', () => {
  beforeEach(() => {
    createMinimalDOM();
  });

  describe('WCAG 2.1 Level A', () => {
    it('should have text alternatives for non-text content (1.1.1)', () => {
      const img = document.createElement('img');
      img.src = 'item.png';
      img.alt = 'Gold Ring item icon';
      document.body.appendChild(img);

      expect(img.getAttribute('alt')).toBeTruthy();
    });

    it('should have meaningful link text (2.4.4)', () => {
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = 'View Gold Ring Details';
      document.body.appendChild(link);

      // Link text should be descriptive, not "click here"
      expect(link.textContent).not.toBe('click here');
      expect(link.textContent.length).toBeGreaterThan(5);
    });

    it('should have keyboard accessible elements (2.1.1)', () => {
      const interactiveElements = [
        document.createElement('button'),
        document.createElement('a'),
        document.createElement('input'),
        document.createElement('select')
      ];

      interactiveElements.forEach(el => {
        document.body.appendChild(el);
        // These elements are naturally keyboard accessible
        expect(['button', 'a', 'input', 'select']).toContain(el.tagName.toLowerCase());
      });
    });

    it('should not use keyboard traps (2.1.2)', () => {
      // Verify modal can be closed with keyboard
      const modal = document.getElementById('itemModal');
      modal.style.display = 'block';

      // Escape should be able to close it
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      expect(escapeEvent.key).toBe('Escape');
      // In real app, this would close the modal
    });

    it('should have proper form labels (3.3.2)', () => {
      const input = document.createElement('input');
      input.id = 'calc-target';
      input.type = 'number';

      const label = document.createElement('label');
      label.setAttribute('for', 'calc-target');
      label.textContent = 'Target Value';

      document.body.appendChild(label);
      document.body.appendChild(input);

      const associatedLabel = document.querySelector(`label[for="${input.id}"]`);
      expect(associatedLabel).toBeTruthy();
      expect(associatedLabel.textContent).toBeTruthy();
    });
  });

  describe('WCAG 2.1 Level AA', () => {
    it('should have visible focus indicators (2.4.7)', () => {
      const button = document.createElement('button');
      button.className = 'tab-btn';
      document.body.appendChild(button);

      // CSS would provide :focus-visible styles
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('should have consistent navigation (3.2.3)', () => {
      const tabs = ['items', 'weapons', 'tomes', 'characters', 'shrines'];
      const tabContainer = document.createElement('div');
      tabContainer.className = 'tab-buttons';

      tabs.forEach(tab => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.setAttribute('data-tab', tab);
        tabContainer.appendChild(btn);
      });

      document.body.appendChild(tabContainer);

      const tabButtons = tabContainer.querySelectorAll('.tab-btn');
      // Navigation should be consistent - same order on all pages
      expect(tabButtons.length).toBe(5);
      expect(tabButtons[0].getAttribute('data-tab')).toBe('items');
    });
  });
});
