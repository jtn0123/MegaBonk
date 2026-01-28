import { vi, type Mock } from 'vitest';

/**
 * Card data extracted from a rendered card element
 */
export interface CardData {
    name: string | undefined;
    tier: string | undefined;
    rarity: string | undefined;
}

/**
 * Mock clipboard interface
 */
export interface MockClipboard {
    writeText: Mock<(text: string) => Promise<void>>;
    readText: Mock<() => Promise<string>>;
    getContent: () => string;
}

/**
 * Waits for DOM updates to complete
 */
export function waitForDOMUpdate(ms: number = 0): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Simulates user input in a text field
 */
export function simulateInput(element: HTMLInputElement | null, value: string): void {
    if (!element) throw new Error('Element is null');
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Simulates select change
 */
export function simulateSelect(element: HTMLSelectElement | null, value: string): void {
    if (!element) throw new Error('Element is null');
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Simulates checkbox toggle
 */
export function simulateCheckbox(element: HTMLInputElement | null, checked: boolean): void {
    if (!element) throw new Error('Element is null');
    element.checked = checked;
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Simulates a click event
 */
export function simulateClick(element: Element | null): void {
    if (!element) throw new Error('Element is null');
    element.dispatchEvent(new Event('click', { bubbles: true }));
}

/**
 * Gets all items rendered in a container
 */
export function getRenderedCards(containerId: string): Element[] {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return Array.from(
        container.querySelectorAll('.item-card, .weapon-card, .tome-card, .character-card, .shrine-card')
    );
}

/**
 * Extracts basic data from a rendered card
 */
export function extractCardData(card: Element): CardData {
    return {
        name: card.querySelector('.item-name, .shrine-name')?.textContent?.trim(),
        tier: card.querySelector('[class*="tier-"]')?.textContent?.trim(),
        rarity: card.querySelector('[class*="rarity-"]')?.textContent?.trim(),
    };
}

/**
 * Gets the number of cards in a container
 */
export function getCardCount(containerId: string): number {
    return getRenderedCards(containerId).length;
}

/**
 * Finds a card by item name
 */
export function findCardByName(containerId: string, name: string): Element | undefined {
    const cards = getRenderedCards(containerId);
    return cards.find(card => {
        const cardName = card.querySelector('.item-name, .shrine-name')?.textContent?.trim();
        return cardName === name;
    });
}

/**
 * Checks if a modal is visible
 */
export function isModalVisible(modalId: string): boolean {
    const modal = document.getElementById(modalId);
    return modal !== null && modal.style.display !== 'none';
}

/**
 * Gets text content from element by selector
 */
export function getTextContent(selector: string): string {
    const element = document.querySelector(selector);
    return element?.textContent?.trim() || '';
}

/**
 * Gets all text content from elements by selector
 */
export function getAllTextContent(selector: string): (string | undefined)[] {
    const elements = document.querySelectorAll(selector);
    return Array.from(elements).map(el => el.textContent?.trim());
}

/**
 * Waits for an element to appear in DOM
 */
export async function waitForElement(selector: string, timeout: number = 1000): Promise<Element | null> {
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
export function createMockClipboard(): MockClipboard {
    let clipboardContent = '';
    return {
        writeText: vi.fn((text: string): Promise<void> => {
            clipboardContent = text;
            return Promise.resolve();
        }),
        readText: vi.fn((): Promise<string> => Promise.resolve(clipboardContent)),
        getContent: (): string => clipboardContent,
    };
}

/**
 * Counts items with a specific class in a container
 */
export function countItemsWithClass(containerId: string, className: string): number {
    const container = document.getElementById(containerId);
    if (!container) return 0;
    return container.querySelectorAll(`.${className}`).length;
}

/**
 * Gets all checkbox values that are checked
 */
export function getCheckedValues(selector: string): string[] {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(selector);
    return Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
}

/**
 * Sets multiple checkboxes by values
 */
export function setCheckboxValues(selector: string, values: string[]): void {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(selector);
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
export function getSelectValue(selector: string): string {
    const select = document.querySelector<HTMLSelectElement>(selector);
    return select?.value || '';
}

/**
 * Verifies that an element contains expected text
 */
export function elementContainsText(selector: string, text: string): boolean {
    const element = document.querySelector(selector);
    return element?.textContent?.includes(text) || false;
}

/**
 * Gets computed style of an element
 */
export function getStyle(selector: string, property: string): string | null {
    const element = document.querySelector(selector);
    if (!element) return null;
    return window.getComputedStyle(element).getPropertyValue(property);
}
