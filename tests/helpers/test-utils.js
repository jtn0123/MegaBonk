import { vi } from 'vitest';

/**
 * Waits for DOM updates to complete
 */
export function waitForDOMUpdate(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Simulates user input in a text field
 */
export function simulateInput(element, value) {
  if (!element) throw new Error('Element is null');
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Simulates select change
 */
export function simulateSelect(element, value) {
  if (!element) throw new Error('Element is null');
  element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Simulates checkbox toggle
 */
export function simulateCheckbox(element, checked) {
  if (!element) throw new Error('Element is null');
  element.checked = checked;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Simulates a click event
 */
export function simulateClick(element) {
  if (!element) throw new Error('Element is null');
  element.dispatchEvent(new Event('click', { bubbles: true }));
}

/**
 * Gets all items rendered in a container
 */
export function getRenderedCards(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll('.item-card, .weapon-card, .tome-card, .character-card, .shrine-card'));
}

/**
 * Extracts basic data from a rendered card
 */
export function extractCardData(card) {
  return {
    name: card.querySelector('.item-name, .shrine-name')?.textContent?.trim(),
    tier: card.querySelector('[class*="tier-"]')?.textContent?.trim(),
    rarity: card.querySelector('[class*="rarity-"]')?.textContent?.trim()
  };
}

/**
 * Gets the number of cards in a container
 */
export function getCardCount(containerId) {
  return getRenderedCards(containerId).length;
}

/**
 * Finds a card by item name
 */
export function findCardByName(containerId, name) {
  const cards = getRenderedCards(containerId);
  return cards.find(card => {
    const cardName = card.querySelector('.item-name, .shrine-name')?.textContent?.trim();
    return cardName === name;
  });
}

/**
 * Checks if a modal is visible
 */
export function isModalVisible(modalId) {
  const modal = document.getElementById(modalId);
  return modal && modal.style.display !== 'none';
}

/**
 * Gets text content from element by selector
 */
export function getTextContent(selector) {
  const element = document.querySelector(selector);
  return element?.textContent?.trim() || '';
}

/**
 * Gets all text content from elements by selector
 */
export function getAllTextContent(selector) {
  const elements = document.querySelectorAll(selector);
  return Array.from(elements).map(el => el.textContent?.trim());
}

/**
 * Waits for an element to appear in DOM
 */
export async function waitForElement(selector, timeout = 1000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await waitForDOMUpdate(50);
  }
  return null;
}

/**
 * Creates a mock clipboard API
 */
export function createMockClipboard() {
  let clipboardContent = '';
  return {
    writeText: vi.fn((text) => {
      clipboardContent = text;
      return Promise.resolve();
    }),
    readText: vi.fn(() => Promise.resolve(clipboardContent)),
    getContent: () => clipboardContent
  };
}

/**
 * Counts items with a specific class in a container
 */
export function countItemsWithClass(containerId, className) {
  const container = document.getElementById(containerId);
  if (!container) return 0;
  return container.querySelectorAll(`.${className}`).length;
}

/**
 * Gets all checkbox values that are checked
 */
export function getCheckedValues(selector) {
  const checkboxes = document.querySelectorAll(selector);
  return Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);
}

/**
 * Sets multiple checkboxes by values
 */
export function setCheckboxValues(selector, values) {
  const checkboxes = document.querySelectorAll(selector);
  checkboxes.forEach(cb => {
    const shouldBeChecked = values.includes(cb.value);
    if (cb.checked !== shouldBeChecked) {
      simulateCheckbox(cb, shouldBeChecked);
    }
  });
}

/**
 * Gets the current value of a select element
 */
export function getSelectValue(selector) {
  const select = document.querySelector(selector);
  return select?.value || '';
}

/**
 * Verifies that an element contains expected text
 */
export function elementContainsText(selector, text) {
  const element = document.querySelector(selector);
  return element?.textContent?.includes(text) || false;
}

/**
 * Gets computed style of an element
 */
export function getStyle(selector, property) {
  const element = document.querySelector(selector);
  if (!element) return null;
  return window.getComputedStyle(element)[property];
}
