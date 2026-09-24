// client/ui/renderList.js
// Builds list items with textContent so player- or server-supplied strings are never parsed as HTML.

/**
 * Replaces the children of `listElement` with one <li> per row.
 * @param {HTMLElement} listElement
 * @param {Array<{text: string, bold?: boolean}>} rows
 */
export function renderListItems(listElement, rows) {
    const items = rows.map(({ text, bold }) => {
        const li = document.createElement('li');
        li.textContent = text;
        if (bold) li.style.fontWeight = 'bold';
        return li;
    });
    listElement.replaceChildren(...items);
}
