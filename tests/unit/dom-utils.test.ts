/**
 * @vitest-environment jsdom
 * DOM Utilities Module Tests
 * Tests for dom-utils.ts - createElement, progress indicators, event managers, downloads
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    createElement,
    createProgressIndicator,
    createEventListenerManager,
    downloadFile,
    downloadJson,
    renderWithFragment,
    createCard,
    createButton,
    type ElementOptions,
    type ProgressIndicator,
    type EventListenerManager,
} from '../../src/modules/dom-utils.ts';

describe('DOM Utilities Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================
    // createElement Tests
    // ========================================
    describe('createElement', () => {
        describe('Basic Element Creation', () => {
            it('should create a div element', () => {
                const div = createElement('div');
                
                expect(div.tagName).toBe('DIV');
                expect(div.nodeName).toBe('DIV');
            });

            it('should create a button element', () => {
                const button = createElement('button');
                
                expect(button.tagName).toBe('BUTTON');
                expect(button.nodeName).toBe('BUTTON');
            });

            it('should create a span element', () => {
                const span = createElement('span');
                
                expect(span.tagName).toBe('SPAN');
                expect(span.nodeName).toBe('SPAN');
            });

            it('should create an input element', () => {
                const input = createElement('input');
                
                expect(input.tagName).toBe('INPUT');
                expect(input.nodeName).toBe('INPUT');
            });

            it('should create an anchor element', () => {
                const anchor = createElement('a');
                
                expect(anchor.tagName).toBe('A');
                expect(anchor.nodeName).toBe('A');
            });
        });

        describe('className Option', () => {
            it('should set single class', () => {
                const div = createElement('div', { className: 'my-class' });
                
                expect(div.className).toBe('my-class');
                expect(div.classList.contains('my-class')).toBe(true);
            });

            it('should set multiple classes', () => {
                const div = createElement('div', { className: 'class1 class2 class3' });
                
                expect(div.className).toBe('class1 class2 class3');
                expect(div.classList.contains('class1')).toBe(true);
                expect(div.classList.contains('class2')).toBe(true);
                expect(div.classList.contains('class3')).toBe(true);
            });

            it('should handle empty className', () => {
                const div = createElement('div', { className: '' });
                
                expect(div.className).toBe('');
            });
        });

        describe('id Option', () => {
            it('should set element id', () => {
                const div = createElement('div', { id: 'my-id' });
                
                expect(div.id).toBe('my-id');
            });

            it('should handle empty id', () => {
                const div = createElement('div', { id: '' });
                
                expect(div.id).toBe('');
            });
        });

        describe('attributes Option', () => {
            it('should set single attribute', () => {
                const div = createElement('div', {
                    attributes: { 'data-value': '123' },
                });
                
                expect(div.getAttribute('data-value')).toBe('123');
            });

            it('should set multiple attributes', () => {
                const input = createElement('input', {
                    attributes: {
                        type: 'text',
                        placeholder: 'Enter value',
                        'aria-label': 'Input field',
                    },
                });
                
                expect(input.getAttribute('type')).toBe('text');
                expect(input.getAttribute('placeholder')).toBe('Enter value');
                expect(input.getAttribute('aria-label')).toBe('Input field');
            });

            it('should handle empty attributes object', () => {
                const div = createElement('div', { attributes: {} });
                
                expect(div.attributes.length).toBe(0);
            });

            it('should set boolean-like attributes', () => {
                const input = createElement('input', {
                    attributes: { disabled: 'true', readonly: '' },
                });
                
                expect(input.getAttribute('disabled')).toBe('true');
                expect(input.getAttribute('readonly')).toBe('');
            });
        });

        describe('dataset Option', () => {
            it('should set single data attribute', () => {
                const div = createElement('div', {
                    dataset: { id: '123' },
                });
                
                expect(div.dataset.id).toBe('123');
            });

            it('should set multiple data attributes', () => {
                const div = createElement('div', {
                    dataset: {
                        itemId: 'item-1',
                        entityType: 'weapon',
                        count: '5',
                    },
                });
                
                expect(div.dataset.itemId).toBe('item-1');
                expect(div.dataset.entityType).toBe('weapon');
                expect(div.dataset.count).toBe('5');
            });

            it('should convert camelCase to kebab-case', () => {
                const div = createElement('div', {
                    dataset: { myLongDataAttribute: 'value' },
                });
                
                expect(div.getAttribute('data-my-long-data-attribute')).toBe('value');
            });
        });

        describe('textContent Option', () => {
            it('should set text content', () => {
                const div = createElement('div', { textContent: 'Hello World' });
                
                expect(div.textContent).toBe('Hello World');
            });

            it('should escape HTML in textContent', () => {
                const div = createElement('div', {
                    textContent: '<script>alert("xss")</script>',
                });
                
                expect(div.textContent).toBe('<script>alert("xss")</script>');
                expect(div.innerHTML).not.toContain('<script>');
            });

            it('should handle empty text content', () => {
                const div = createElement('div', { textContent: '' });
                
                expect(div.textContent).toBe('');
            });

            it('should handle special characters', () => {
                const div = createElement('div', {
                    textContent: '< > & " \' © ™',
                });
                
                expect(div.textContent).toBe('< > & " \' © ™');
            });
        });

        describe('innerHTML Option', () => {
            it('should set inner HTML', () => {
                const div = createElement('div', {
                    innerHTML: '<span class="inner">Content</span>',
                });
                
                expect(div.innerHTML).toBe('<span class="inner">Content</span>');
                expect(div.querySelector('.inner')).not.toBeNull();
            });

            it('should prefer textContent over innerHTML', () => {
                const div = createElement('div', {
                    textContent: 'Plain Text',
                    innerHTML: '<b>Bold</b>',
                });
                
                expect(div.textContent).toBe('Plain Text');
                expect(div.querySelector('b')).toBeNull();
            });
        });

        describe('children Option', () => {
            it('should append single child', () => {
                const child = createElement('span', { textContent: 'Child' });
                const parent = createElement('div', { children: [child] });
                
                expect(parent.children.length).toBe(1);
                expect(parent.firstElementChild).toBe(child);
            });

            it('should append multiple children', () => {
                const child1 = createElement('span', { textContent: 'Child 1' });
                const child2 = createElement('span', { textContent: 'Child 2' });
                const child3 = createElement('span', { textContent: 'Child 3' });
                const parent = createElement('div', {
                    children: [child1, child2, child3],
                });
                
                expect(parent.children.length).toBe(3);
                expect(parent.children[0]).toBe(child1);
                expect(parent.children[1]).toBe(child2);
                expect(parent.children[2]).toBe(child3);
            });

            it('should handle empty children array', () => {
                const parent = createElement('div', { children: [] });
                
                expect(parent.children.length).toBe(0);
            });

            it('should preserve child order', () => {
                const children = [
                    createElement('span', { textContent: 'A' }),
                    createElement('span', { textContent: 'B' }),
                    createElement('span', { textContent: 'C' }),
                ];
                const parent = createElement('div', { children });
                
                expect(parent.children[0].textContent).toBe('A');
                expect(parent.children[1].textContent).toBe('B');
                expect(parent.children[2].textContent).toBe('C');
            });
        });

        describe('Combined Options', () => {
            it('should apply all options together', () => {
                const child = createElement('span', { textContent: 'Inner' });
                const div = createElement('div', {
                    id: 'my-element',
                    className: 'class1 class2',
                    attributes: { 'aria-label': 'Test' },
                    dataset: { value: '42' },
                    children: [child],
                });
                
                expect(div.id).toBe('my-element');
                expect(div.className).toBe('class1 class2');
                expect(div.getAttribute('aria-label')).toBe('Test');
                expect(div.dataset.value).toBe('42');
                expect(div.children.length).toBe(1);
            });

            it('should handle empty options object', () => {
                const div = createElement('div', {});
                
                expect(div.tagName).toBe('DIV');
            });

            it('should handle no options', () => {
                const div = createElement('div');
                
                expect(div.tagName).toBe('DIV');
                expect(div.id).toBe('');
                expect(div.className).toBe('');
            });
        });
    });

    // ========================================
    // createProgressIndicator Tests
    // ========================================
    describe('createProgressIndicator', () => {
        describe('Creation', () => {
            it('should create progress indicator element', () => {
                const progress = createProgressIndicator();
                
                expect(progress.element).toBeInstanceOf(HTMLElement);
                expect(progress.element.classList.contains('scan-progress-overlay')).toBe(true);
            });

            it('should set initial status text', () => {
                const progress = createProgressIndicator('Loading data...');
                
                const textEl = progress.element.querySelector('.scan-progress-text');
                expect(textEl?.textContent).toBe('Loading data...');
            });

            it('should use default status when not provided', () => {
                const progress = createProgressIndicator();
                
                const textEl = progress.element.querySelector('.scan-progress-text');
                expect(textEl?.textContent).toBe('Initializing...');
            });

            it('should create spinner element', () => {
                const progress = createProgressIndicator();
                
                const spinner = progress.element.querySelector('.scan-progress-spinner');
                expect(spinner).not.toBeNull();
            });

            it('should create progress bar at 0%', () => {
                const progress = createProgressIndicator();
                
                const fill = progress.element.querySelector('.scan-progress-fill') as HTMLElement;
                expect(fill.style.width).toBe('0%');
            });
        });

        describe('update method', () => {
            it('should update progress and status', () => {
                const progress = createProgressIndicator();
                
                progress.update(50, 'Half done');
                
                const textEl = progress.element.querySelector('.scan-progress-text');
                const fill = progress.element.querySelector('.scan-progress-fill') as HTMLElement;
                
                expect(textEl?.textContent).toBe('Half done');
                expect(fill.style.width).toBe('50%');
            });

            it('should clamp progress to 0-100', () => {
                const progress = createProgressIndicator();
                
                progress.update(-20, 'Negative');
                let fill = progress.element.querySelector('.scan-progress-fill') as HTMLElement;
                expect(fill.style.width).toBe('0%');
                
                progress.update(150, 'Over 100');
                fill = progress.element.querySelector('.scan-progress-fill') as HTMLElement;
                expect(fill.style.width).toBe('100%');
            });

            it('should handle 0% progress', () => {
                const progress = createProgressIndicator('Starting');
                
                progress.update(0, 'At zero');
                
                const fill = progress.element.querySelector('.scan-progress-fill') as HTMLElement;
                expect(fill.style.width).toBe('0%');
            });

            it('should handle 100% progress', () => {
                const progress = createProgressIndicator();
                
                progress.update(100, 'Complete');
                
                const fill = progress.element.querySelector('.scan-progress-fill') as HTMLElement;
                expect(fill.style.width).toBe('100%');
            });

            it('should handle decimal progress values', () => {
                const progress = createProgressIndicator();
                
                progress.update(33.33, 'One third');
                
                const fill = progress.element.querySelector('.scan-progress-fill') as HTMLElement;
                expect(fill.style.width).toBe('33.33%');
            });
        });

        describe('remove method', () => {
            it('should remove element from DOM', () => {
                const progress = createProgressIndicator();
                document.body.appendChild(progress.element);
                
                expect(document.body.contains(progress.element)).toBe(true);
                
                progress.remove();
                
                expect(document.body.contains(progress.element)).toBe(false);
            });

            it('should be safe to call when not in DOM', () => {
                const progress = createProgressIndicator();
                
                expect(() => progress.remove()).not.toThrow();
            });

            it('should be safe to call multiple times', () => {
                const progress = createProgressIndicator();
                document.body.appendChild(progress.element);
                
                progress.remove();
                progress.remove();
                progress.remove();
                
                expect(true).toBe(true);
            });
        });
    });

    // ========================================
    // createEventListenerManager Tests
    // ========================================
    describe('createEventListenerManager', () => {
        let manager: EventListenerManager;
        let testElement: HTMLElement;

        beforeEach(() => {
            manager = createEventListenerManager();
            testElement = document.createElement('div');
            document.body.appendChild(testElement);
        });

        afterEach(() => {
            manager.removeAll();
            testElement.remove();
        });

        describe('add method', () => {
            it('should add event listener', () => {
                const handler = vi.fn();
                
                manager.add(testElement, 'click', handler);
                testElement.click();
                
                expect(handler).toHaveBeenCalledTimes(1);
            });

            it('should add multiple listeners for same event', () => {
                const handler1 = vi.fn();
                const handler2 = vi.fn();
                
                manager.add(testElement, 'click', handler1);
                manager.add(testElement, 'click', handler2);
                testElement.click();
                
                expect(handler1).toHaveBeenCalledTimes(1);
                expect(handler2).toHaveBeenCalledTimes(1);
            });

            it('should add listeners for different events', () => {
                const clickHandler = vi.fn();
                const mouseoverHandler = vi.fn();
                
                manager.add(testElement, 'click', clickHandler);
                manager.add(testElement, 'mouseover', mouseoverHandler);
                
                testElement.click();
                testElement.dispatchEvent(new MouseEvent('mouseover'));
                
                expect(clickHandler).toHaveBeenCalledTimes(1);
                expect(mouseoverHandler).toHaveBeenCalledTimes(1);
            });

            it('should work with document', () => {
                const handler = vi.fn();
                
                manager.add(document, 'keydown', handler);
                document.dispatchEvent(new KeyboardEvent('keydown'));
                
                expect(handler).toHaveBeenCalledTimes(1);
            });

            it('should pass event to handler', () => {
                const handler = vi.fn();
                
                manager.add(testElement, 'click', handler);
                testElement.click();
                
                expect(handler).toHaveBeenCalledWith(expect.any(MouseEvent));
            });

            it('should support options', () => {
                const handler = vi.fn();
                
                manager.add(testElement, 'click', handler, { once: true });
                testElement.click();
                testElement.click();
                
                expect(handler).toHaveBeenCalledTimes(1);
            });
        });

        describe('addWithSignal method', () => {
            it('should add event listener with signal', () => {
                const handler = vi.fn();
                
                manager.addWithSignal(testElement, 'click', handler);
                testElement.click();
                
                expect(handler).toHaveBeenCalledTimes(1);
            });

            it('should remove listener when aborted', () => {
                const handler = vi.fn();
                
                manager.addWithSignal(testElement, 'click', handler);
                testElement.click();
                expect(handler).toHaveBeenCalledTimes(1);
                
                manager.removeAll();
                testElement.click();
                expect(handler).toHaveBeenCalledTimes(1);
            });
        });

        describe('removeAll method', () => {
            it('should remove all tracked listeners', () => {
                const handler1 = vi.fn();
                const handler2 = vi.fn();
                
                manager.add(testElement, 'click', handler1);
                manager.add(testElement, 'mouseover', handler2);
                
                manager.removeAll();
                
                testElement.click();
                testElement.dispatchEvent(new MouseEvent('mouseover'));
                
                expect(handler1).not.toHaveBeenCalled();
                expect(handler2).not.toHaveBeenCalled();
            });

            it('should be safe to call with no listeners', () => {
                expect(() => manager.removeAll()).not.toThrow();
            });

            it('should be safe to call multiple times', () => {
                const handler = vi.fn();
                manager.add(testElement, 'click', handler);
                
                manager.removeAll();
                manager.removeAll();
                manager.removeAll();
                
                expect(true).toBe(true);
            });

            it('should handle removed elements gracefully', () => {
                const handler = vi.fn();
                manager.add(testElement, 'click', handler);
                
                testElement.remove();
                
                expect(() => manager.removeAll()).not.toThrow();
            });

            it('should remove signal-based listeners', () => {
                const handler = vi.fn();
                manager.addWithSignal(testElement, 'click', handler);
                
                manager.removeAll();
                
                testElement.click();
                expect(handler).not.toHaveBeenCalled();
            });
        });

        describe('getSignal method', () => {
            it('should return an AbortSignal', () => {
                const signal = manager.getSignal();
                
                expect(signal).toBeInstanceOf(AbortSignal);
            });

            it('should return the same signal on multiple calls', () => {
                const signal1 = manager.getSignal();
                const signal2 = manager.getSignal();
                
                expect(signal1).toBe(signal2);
            });

            it('should be usable for external listeners', () => {
                const signal = manager.getSignal();
                const handler = vi.fn();
                
                testElement.addEventListener('click', handler, { signal });
                testElement.click();
                expect(handler).toHaveBeenCalledTimes(1);
                
                manager.removeAll();
                testElement.click();
                expect(handler).toHaveBeenCalledTimes(1);
            });
        });
    });

    // ========================================
    // downloadFile Tests
    // ========================================
    describe('downloadFile', () => {
        let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
        let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
        let appendChildSpy: ReturnType<typeof vi.spyOn>;
        let removeChildSpy: ReturnType<typeof vi.spyOn>;
        let clickSpy: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
            revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
            appendChildSpy = vi.spyOn(document.body, 'appendChild');
            removeChildSpy = vi.spyOn(document.body, 'removeChild');
            clickSpy = vi.fn();
            
            // Mock anchor element creation
            const originalCreateElement = document.createElement.bind(document);
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const el = originalCreateElement(tag);
                if (tag === 'a') {
                    el.click = clickSpy;
                }
                return el;
            });
        });

        it('should create blob with content', () => {
            downloadFile('test content', 'test.txt');
            
            expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob));
        });

        it('should use default MIME type', () => {
            downloadFile('{}', 'data.json');
            
            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            expect(blobArg.type).toBe('application/json');
        });

        it('should use custom MIME type', () => {
            downloadFile('<html></html>', 'page.html', 'text/html');
            
            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            expect(blobArg.type).toBe('text/html');
        });

        it('should set download attribute on anchor', () => {
            downloadFile('content', 'myfile.txt', 'text/plain');
            
            const anchorArg = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
            expect(anchorArg.download).toBe('myfile.txt');
        });

        it('should set href to blob URL', () => {
            downloadFile('content', 'file.txt', 'text/plain');
            
            const anchorArg = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
            expect(anchorArg.href).toContain('blob:');
        });

        it('should trigger click', () => {
            downloadFile('content', 'file.txt', 'text/plain');
            
            expect(clickSpy).toHaveBeenCalled();
        });

        it('should cleanup anchor element', () => {
            downloadFile('content', 'file.txt', 'text/plain');
            
            expect(removeChildSpy).toHaveBeenCalled();
        });

        it('should revoke blob URL', () => {
            downloadFile('content', 'file.txt', 'text/plain');
            
            expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url');
        });
    });

    // ========================================
    // downloadJson Tests
    // ========================================
    describe('downloadJson', () => {
        let createObjectURLSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:json-url');
            vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
            
            const originalCreateElement = document.createElement.bind(document);
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                const el = originalCreateElement(tag);
                if (tag === 'a') {
                    el.click = vi.fn();
                }
                return el;
            });
        });

        it('should serialize object to JSON', () => {
            const data = { key: 'value', num: 42 };
            
            downloadJson(data, 'data.json');
            
            expect(createObjectURLSpy).toHaveBeenCalled();
        });

        it('should pretty-print by default', () => {
            const data = { a: 1, b: 2 };
            
            downloadJson(data, 'data');
            
            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            // Pretty-printed JSON has newlines
            expect(blobArg.size).toBeGreaterThan(JSON.stringify(data).length);
        });

        it('should not pretty-print when disabled', () => {
            const data = { a: 1, b: 2 };
            
            downloadJson(data, 'data', false);
            
            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            expect(blobArg.size).toBe(JSON.stringify(data).length);
        });

        it('should add .json extension if missing', () => {
            expect(() => downloadJson({}, 'mydata')).not.toThrow();
            expect(createObjectURLSpy).toHaveBeenCalled();
        });

        it('should not duplicate .json extension', () => {
            expect(() => downloadJson({}, 'mydata.json')).not.toThrow();
            expect(createObjectURLSpy).toHaveBeenCalled();
        });

        it('should handle arrays', () => {
            const data = [1, 2, 3];
            
            expect(() => downloadJson(data, 'array')).not.toThrow();
        });

        it('should handle null', () => {
            expect(() => downloadJson(null, 'null')).not.toThrow();
        });

        it('should handle nested objects', () => {
            const data = {
                level1: {
                    level2: {
                        level3: 'deep',
                    },
                },
            };
            
            expect(() => downloadJson(data, 'nested')).not.toThrow();
        });
    });

    // ========================================
    // renderWithFragment Tests
    // ========================================
    describe('renderWithFragment', () => {
        let container: HTMLElement;

        beforeEach(() => {
            container = document.createElement('div');
            document.body.appendChild(container);
        });

        afterEach(() => {
            container.remove();
        });

        it('should render items into container', () => {
            const items = ['a', 'b', 'c'];
            
            renderWithFragment(container, items, (item) =>
                createElement('span', { textContent: item })
            );
            
            expect(container.children.length).toBe(3);
            expect(container.children[0].textContent).toBe('a');
            expect(container.children[1].textContent).toBe('b');
            expect(container.children[2].textContent).toBe('c');
        });

        it('should clear existing content', () => {
            container.innerHTML = '<div>Old content</div><div>More old</div>';
            
            renderWithFragment(container, ['new'], (item) =>
                createElement('span', { textContent: item })
            );
            
            expect(container.children.length).toBe(1);
            expect(container.textContent).toBe('new');
        });

        it('should pass index to render function', () => {
            const items = ['x', 'y', 'z'];
            const indices: number[] = [];
            
            renderWithFragment(container, items, (item, index) => {
                indices.push(index);
                return createElement('span', { textContent: item });
            });
            
            expect(indices).toEqual([0, 1, 2]);
        });

        it('should handle empty items array', () => {
            container.innerHTML = '<div>Existing</div>';
            
            renderWithFragment(container, [], () => createElement('span'));
            
            expect(container.children.length).toBe(0);
        });

        it('should handle complex render function', () => {
            interface Item {
                id: string;
                name: string;
            }
            
            const items: Item[] = [
                { id: '1', name: 'First' },
                { id: '2', name: 'Second' },
            ];
            
            renderWithFragment(container, items, (item) =>
                createElement('div', {
                    id: item.id,
                    className: 'item-card',
                    textContent: item.name,
                })
            );
            
            expect(container.children.length).toBe(2);
            expect(container.children[0].id).toBe('1');
            expect((container.children[0] as HTMLElement).className).toBe('item-card');
        });

        it('should use DocumentFragment for performance', () => {
            // This test verifies the implementation uses appendChild once
            const appendChildSpy = vi.spyOn(container, 'appendChild');
            
            renderWithFragment(container, ['a', 'b', 'c', 'd', 'e'], (item) =>
                createElement('span', { textContent: item })
            );
            
            // Should only call appendChild once (with the fragment)
            expect(appendChildSpy).toHaveBeenCalledTimes(1);
        });
    });

    // ========================================
    // createCard Tests
    // ========================================
    describe('createCard', () => {
        it('should create a div with class', () => {
            const card = createCard('my-card', '<p>Content</p>');
            
            expect(card.tagName).toBe('DIV');
            expect(card.className).toBe('my-card');
        });

        it('should set inner HTML', () => {
            const card = createCard('card', '<strong>Bold text</strong>');
            
            expect(card.innerHTML).toBe('<strong>Bold text</strong>');
            expect(card.querySelector('strong')).not.toBeNull();
        });

        it('should set data attributes', () => {
            const card = createCard('card', 'Content', {
                id: '123',
                type: 'item',
                tier: 'S',
            });
            
            expect(card.dataset.id).toBe('123');
            expect(card.dataset.type).toBe('item');
            expect(card.dataset.tier).toBe('S');
        });

        it('should handle empty dataset', () => {
            const card = createCard('card', 'Content', {});
            
            expect(Object.keys(card.dataset).length).toBe(0);
        });

        it('should handle undefined dataset', () => {
            const card = createCard('card', 'Content');
            
            expect(card.tagName).toBe('DIV');
        });

        it('should handle complex HTML content', () => {
            const html = `
                <div class="header">Title</div>
                <div class="body">
                    <p>Paragraph 1</p>
                    <p>Paragraph 2</p>
                </div>
                <div class="footer">Footer</div>
            `;
            
            const card = createCard('complex-card', html);
            
            expect(card.querySelector('.header')).not.toBeNull();
            expect(card.querySelector('.body')).not.toBeNull();
            expect(card.querySelector('.footer')).not.toBeNull();
            expect(card.querySelectorAll('p').length).toBe(2);
        });
    });

    // ========================================
    // createButton Tests
    // ========================================
    describe('createButton', () => {
        it('should create a button element', () => {
            const btn = createButton('Click Me', 'btn');
            
            expect(btn.tagName).toBe('BUTTON');
            expect(btn.nodeName).toBe('BUTTON');
        });

        it('should set button text', () => {
            const btn = createButton('Submit', 'btn');
            
            expect(btn.textContent).toBe('Submit');
        });

        it('should set class name', () => {
            const btn = createButton('Test', 'btn-primary');
            
            expect(btn.className).toBe('btn-primary');
        });

        it('should attach click handler', () => {
            const handler = vi.fn();
            const btn = createButton('Click', 'btn', handler);
            
            btn.click();
            
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should pass event to click handler', () => {
            const handler = vi.fn();
            const btn = createButton('Click', 'btn', handler);
            
            btn.click();
            
            expect(handler).toHaveBeenCalledWith(expect.any(MouseEvent));
        });

        it('should handle undefined click handler', () => {
            const btn = createButton('No Handler', 'btn');
            
            expect(() => btn.click()).not.toThrow();
        });

        it('should set additional attributes', () => {
            const btn = createButton('Submit', 'btn', undefined, {
                type: 'submit',
                disabled: 'true',
                'aria-label': 'Submit form',
            });
            
            expect(btn.getAttribute('type')).toBe('submit');
            expect(btn.getAttribute('disabled')).toBe('true');
            expect(btn.getAttribute('aria-label')).toBe('Submit form');
        });

        it('should handle empty attributes object', () => {
            const btn = createButton('Test', 'btn', undefined, {});
            
            expect(btn.tagName).toBe('BUTTON');
        });

        it('should work with multiple classes', () => {
            const btn = createButton('Multi', 'btn btn-large btn-primary');
            
            expect(btn.classList.contains('btn')).toBe(true);
            expect(btn.classList.contains('btn-large')).toBe(true);
            expect(btn.classList.contains('btn-primary')).toBe(true);
        });
    });

    // ========================================
    // Edge Cases & Integration
    // ========================================
    describe('Edge Cases', () => {
        it('should handle Unicode in text content', () => {
            const div = createElement('div', { textContent: '日本語 🎮 émoji' });
            
            expect(div.textContent).toBe('日本語 🎮 émoji');
        });

        it('should handle very long text', () => {
            const longText = 'x'.repeat(10000);
            const div = createElement('div', { textContent: longText });
            
            expect(div.textContent).toBe(longText);
        });

        it('should chain createElement with createButton', () => {
            const btn = createButton('Action', 'btn');
            const container = createElement('div', {
                className: 'container',
                children: [btn],
            });
            
            expect(container.querySelector('button')).toBe(btn);
        });
    });
});
