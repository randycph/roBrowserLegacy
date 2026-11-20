import DB from 'DB/DBManager.js';
import ItemType from 'DB/Items/ItemType.js';
import NpcStore from 'UI/Components/NpcStore/NpcStore.js';
import ShortCut from 'UI/Components/ShortCut/ShortCut.js';

const categories = [
	['all', 'All', 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'],
	['equipment', 'Equipment', 'M4 4l2 6 10 10 4-4L10 6z M20 4l-2 6-4 4 M9 15l-5 5 M17 13l4 4 M7 13l-4 4'],
	['consumable', 'Consumable', 'M9 3h6 M10 3v7l-4 4a4 4 0 004 7h4a4 4 0 004-7l-4-4V3 M8 14h8'],
	['material', 'Material', 'M12 3l6 4-2 7-7 1-4-5z M4 12l4 5-2 4-4-2 M17 14l5 2-1 4-6 1'],
	['card', 'Card', 'M5 3h14v18H5z M12 7l4 5-4 5-4-5z'],
	['pet', 'Pet', 'M12 4c2 4 8 5 8 10a8 6 0 01-16 0c0-5 6-6 8-10z M9 13h.1 M15 13h.1 M10 16q2 2 4 0'],
	['quest', 'Quest', 'M7 4h13v3H8a2 2 0 00-2 2v9 M7 18h12v2H6a3 3 0 010-6 M10 10h7 M10 13h7'],
	['misc', 'Misc', 'M5 12h.1 M12 12h.1 M19 12h.1'],
	['favorite', 'Favorites', 'M12 3l2.7 5.6 6.2.9-4.5 4.4 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.5-4.4 6.2-.9z']
];
const sidebarOrder = ['all', 'consumable', 'equipment', 'card', 'pet', 'material', 'quest', 'misc', 'favorite'];

function itemDescription(item, info) {
	const description = item.IsIdentified ? info.identifiedDescriptionName : info.unidentifiedDescriptionName;
	const lines = Array.isArray(description) ? description.join('\n') : String(description ?? '');
	return lines.replace(/\^[a-f0-9]{6}/gi, '').trim();
}

function itemCategory(item, info, description) {
	switch (item.type) {
		case ItemType.WEAPON:
		case ItemType.ARMOR:
		case ItemType.SHADOWGEAR:
			return 'equipment';
		case ItemType.HEALING:
		case ItemType.USABLE:
		case ItemType.DELAYCONSUME:
		case ItemType.CASH:
			return 'consumable';
		case ItemType.CARD:
			return 'card';
		case ItemType.PETEGG:
		case ItemType.PETARMOR:
			return 'pet';
		case ItemType.ETC:
			return info.questItem === true || /^\s*\[?quest item\]?\s*$/im.test(description) ? 'quest' : 'material';
		default:
			return 'misc';
	}
}

function canUse(item) {
	if (item.type === ItemType.DELAYCONSUME || item.type === ItemType.PETEGG) {
		return false;
	}
	const category = itemCategory(item, {}, '');
	if (category === 'equipment' || item.type === ItemType.PETARMOR || item.type === ItemType.AMMO) {
		return Boolean(item.IsIdentified && !item.IsDamaged);
	}
	return category === 'consumable' || category === 'card';
}

export function setupInventoryPanel(component, { favoriteTab, inspect, setFavorite, toggleSaleLock }) {
	const root = component.getRoot();
	const find = selector => root.querySelector(selector);
	const content = find('.content');
	const scroll = find('.scroll-host');
	const shortcuts = find('.shortcut-choices');
	const search = find('.inventory-search');
	const saleButton = find('.inventory-sell');
	const saleCancel = find('.inventory-sell-cancel');
	const chosen = new Set();
	const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
	let category = 'all';
	let selection = null;
	let sortDirection = 0;
	let selectingSale = false;
	let scheduled = false;

	function message(text = '') {
		const node = find('.inventory-message');
		node.hidden = !text;
		node.textContent = text;
	}

	function renderSelection(entry) {
		const selectionInfo = find('.selection-info');
		selectionInfo.hidden = !entry || selectingSale;
		find('.detail-placeholder').hidden = Boolean(entry) && !selectingSale;
		find('.detail-placeholder').textContent = selectingSale
			? 'Select the stacks you want to add to the merchant’s sale list.'
			: 'Select an item to view its details.';
		if (!entry || selectingSale) {
			shortcuts.hidden = true;
			return;
		}

		find('.detail-icon').style.backgroundImage = entry.node.querySelector('.icon').style.backgroundImage;
		find('.detail-name').textContent = entry.name;
		find('.detail-category').textContent = categories.find(([key]) => key === entry.category)?.[1] ?? 'Misc';
		find('.detail-quantity').textContent = `Qty: ${entry.item.count || 1}`;
		find('.detail-description').textContent = entry.description;
		const use = find('.use-selection');
		use.disabled = !canUse(entry.item);
		use.textContent = entry.category === 'equipment' || entry.item.type === ItemType.AMMO ? 'Equip' : 'Use';
	}

	function refresh() {
		const current = new Map(component.list.map(item => [item.index, item]));
		const query = search.value.trim().toLocaleLowerCase();
		const entries = [...content.querySelectorAll('.item')].flatMap(node => {
			const item = current.get(Number(node.dataset.index));
			if (!item) {
				return [];
			}
			const info = DB.getItemInfo(item.ITID);
			const name = DB.getItemName(item, { showItemOptions: false }).replace(/<\/?font\b[^>]*>/gi, '');
			const description = itemDescription(item, info);
			return [{ node, item, name, description, category: itemCategory(item, info, description) }];
		});
		if (sortDirection) {
			entries.sort((a, b) => sortDirection * collator.compare(a.name, b.name) || a.item.index - b.item.index);
		}
		let visible = 0;
		let selected = null;
		let first = null;
		for (const [index, entry] of entries.entries()) {
			const id = entry.item.index;
			const inCategory = category === 'all' || category === entry.category ||
				(category === 'favorite' && Boolean(entry.item.PlaceETCTab));
			entry.node.hidden = !inCategory || !entry.name.toLocaleLowerCase().includes(query);
			if (entry.node !== content.children[index]) {
				content.insertBefore(entry.node, content.children[index] ?? null);
			}
			entry.node.setAttribute('aria-label', entry.name);
			if (!entry.node.hidden) {
				visible++;
				first ||= entry;
				if (id === selection) {
					selected = entry;
				}
			}
			entry.node.toggleAttribute('data-sale-selected', chosen.has(id));
		}

		const focus = selected || first;
		if (selection !== (focus?.item.index ?? null)) {
			shortcuts.hidden = true;
		}
		selection = focus?.item.index ?? null;
		for (const entry of entries) {
			entry.node.setAttribute('aria-selected', String(!selectingSale && entry.item.index === selection));
		}
		const columns = Number(getComputedStyle(content).getPropertyValue('--inventory-columns').trim()) || 7;
		const emptySlots = Math.max(0, columns * 4 - visible);
		const filler = [...content.querySelectorAll('.empty-slot')];
		for (const slot of filler.slice(emptySlots)) {
			slot.remove();
		}
		for (let index = filler.length; index < emptySlots; index++) {
			const slot = document.createElement('span');
			slot.className = 'empty-slot';
			slot.setAttribute('aria-hidden', 'true');
			content.append(slot);
		}

		const empty = find('.inventory-empty');
		empty.hidden = visible > 0;
		empty.textContent = query ? 'No matching items.' : 'No items in this category.';
		renderSelection(focus);

		find('.item_drop_lock').setAttribute('aria-pressed', String(Boolean(component.itemlock)));
		find('.item_compare').setAttribute('aria-pressed', String(Boolean(component.itemcomp)));
		find('.inventory-deal-lock').setAttribute('aria-pressed', String(Boolean(component.npcsalelock)));
	}

	function scheduleRefresh() {
		if (!scheduled) {
			scheduled = true;
			queueMicrotask(() => {
				scheduled = false;
				refresh();
			});
		}
	}

	function filter(key) {
		category = key;
		selection = null;
		shortcuts.hidden = true;
		scroll.scrollTop = 0;
		for (const btn of root.querySelectorAll('[data-category]')) {
			btn.classList.toggle('selected', btn.dataset.category === key);
			btn.setAttribute('aria-pressed', String(btn.dataset.category === key));
		}
		refresh();
	}

	function createFilters(container, order, icons) {
		for (const key of order) {
			const [, label, path] = categories.find(([id]) => id === key);
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'pill';
			btn.dataset.category = key;
			if (icons) {
				btn.innerHTML = `<svg class="category-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" /></svg>`;
			}
			btn.append(icons && key === 'consumable' ? 'Use' : label);
			btn.addEventListener('click', () => filter(key));
			if (favoriteTab && (key === 'favorite' || key === 'all')) {
				btn.addEventListener('dragover', event => event.preventDefault());
				btn.addEventListener('drop', event => setFavorite(event, key === 'favorite'));
			}
			container.append(btn);
		}
	}

	function selectedItem() {
		return selection === null ? null : component.getItemByIndex(selection);
	}

	function choose(node) {
		const item = component.getItemByIndex(Number(node.dataset.index));
		if (!item) {
			return;
		}
		shortcuts.hidden = true;
		if (selectingSale) {
			if (!NpcStore.canQueueInventorySale(item)) {
				message('The merchant cannot buy this item.');
				return;
			}
			if (chosen.has(item.index)) {
				chosen.delete(item.index);
			} else {
				chosen.add(item.index);
			}
			saleButton.textContent = chosen.size ? `Review Sale (${chosen.size})` : 'Review Sale';
			saleButton.disabled = chosen.size === 0;
		} else {
			selection = item.index;
			message();
		}
		refresh();
	}

	function finishSaleSelection() {
		selectingSale = false;
		chosen.clear();
		saleButton.disabled = false;
		saleButton.textContent = 'Bulk Sell';
		saleCancel.hidden = true;
		refresh();
	}

	saleButton.addEventListener('click', () => {
		if (!NpcStore.isSellingInventory()) {
			finishSaleSelection();
			message('Open a merchant’s Sell window to use Bulk Sell.');
			return;
		}
		if (!selectingSale) {
			selectingSale = true;
			saleButton.textContent = 'Review Sale';
			saleButton.disabled = true;
			saleCancel.hidden = false;
			message();
			refresh();
			return;
		}

		let queued = 0;
		for (const index of chosen) {
			const item = component.getItemByIndex(index);
			if (NpcStore.canQueueInventorySale(item) && NpcStore.receiveInventoryItemStack(item)) {
				queued++;
			}
		}
		finishSaleSelection();
		if (queued) {
			NpcStore.focus();
			message(`Added ${queued} to the sale list. Confirm the sale with the merchant.`);
		} else {
			message('No selected items could be added to the sale list.');
		}
	});
	saleCancel.addEventListener('click', () => {
		finishSaleSelection();
		message();
	});

	find('.use-selection').addEventListener('click', () => {
		const item = selectedItem();
		if (item && canUse(item)) {
			component.useItem(item);
		}
	});
	find('.inspect-selection').addEventListener('click', event => {
		const node = content.querySelector(`.item[data-index="${selection}"]`);
		if (node) {
			inspect(node, event);
		}
	});
	find('.shortcut-selection').addEventListener('click', () => {
		if (!shortcuts.hidden) {
			shortcuts.hidden = true;
			return;
		}
		shortcuts.replaceChildren();
		const list = ShortCut.getList();
		for (let index = 0; index < 9; index++) {
			const slot = document.createElement('button');
			slot.type = 'button';
			slot.className = 'pill';
			slot.textContent = `F${index + 1}`;
			const assigned = list[index];
			if (assigned?.ID) {
				slot.title = 'Replace assigned shortcut';
				slot.setAttribute('aria-label', `Replace shortcut F${index + 1}`);
			}
			slot.addEventListener('click', () => {
				const item = selectedItem();
				if (item && ShortCut.assignInventoryItem(index, item)) {
					message(`Assigned to F${index + 1}.`);
					shortcuts.hidden = true;
				}
			});
			shortcuts.append(slot);
		}
		shortcuts.hidden = false;
	});
	find('.inventory-sort').addEventListener('click', event => {
		sortDirection = sortDirection === 1 ? -1 : 1;
		event.currentTarget.title = sortDirection === 1 ? 'Name, A to Z' : 'Name, Z to A';
		event.currentTarget.textContent = sortDirection === 1 ? 'Sort ↑' : 'Sort ↓';
		refresh();
	});
	find('.inventory-deal-lock').addEventListener('click', () => {
		toggleSaleLock();
		refresh();
	});
	for (const selector of ['.item_drop_lock', '.item_compare']) {
		find(selector).addEventListener('click', scheduleRefresh);
	}
	search.addEventListener('input', () => {
		selection = null;
		shortcuts.hidden = true;
		scroll.scrollTop = 0;
		refresh();
	});
	scroll.addEventListener('wheel', event => event.stopPropagation());
	const available = keys => keys.filter(key => favoriteTab || key !== 'favorite');
	createFilters(find('.inventory-sidebar'), available(sidebarOrder), true);
	createFilters(find('.inventory-filters'), available(categories.map(([key]) => key)), false);
	filter('all');

	const observer = new MutationObserver(scheduleRefresh);
	observer.observe(content, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style'] });

	return {
		choose,
		refresh: scheduleRefresh,
		get selectingSale() {
			return selectingSale;
		},
		reset() {
			search.value = '';
			selection = null;
			finishSaleSelection();
			filter('all');
			message();
		}
	};
}
