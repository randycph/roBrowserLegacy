import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import ItemInfo from 'UI/Components/ItemInfo/ItemInfo.js';
import Navigation from 'UI/Components/Navigation/Navigation.js';

const categories = new Map([
	['main', 'Main'],
	['sub', 'Sub'],
	['side', 'Sub'],
	['daily', 'Daily'],
	['event', 'Event']
]);
const iconCategories = new Map([
	['ico_ep.bmp', 'Main'],
	['ico_nq.bmp', 'Sub'],
	['ico_jq.bmp', 'Sub'],
	['ico_dq.bmp', 'Daily'],
	['ico_ev.bmp', 'Event']
]);
const questLink = /<(NAVI|ITEM)>([^<]+)<INFO>([^<]+)<\/INFO><\/\1>/gi;
const destinationPattern = /^[\w@-]+,\s*\d+,\s*\d+(?:,.*)?$/;
const numberFormat = new Intl.NumberFormat();

function node(tag, className, text) {
	const element = document.createElement(tag);
	element.className = className;
	if (text !== undefined) {
		element.textContent = text;
	}
	return element;
}

function formatText(text) {
	const value = Array.isArray(text) ? text.join('\n') : (text ?? '');
	return String(value)
		.replace(/\^[\da-f]{6}/gi, '')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/?(?:b|i|font)\b[^>]*>/gi, '');
}

function plainText(text) {
	return formatText(text).replace(questLink, '$2').trim();
}

function questTitle(quest) {
	return plainText(quest.title) || `Quest #${quest.questID}`;
}

function categoryOf(quest) {
	const info = DB.getQuestInfo(quest.questID);
	const category = info.Category || info.Group;
	// Only use the source icon. The packet adapter also uses ico_nq.bmp as a fallback.
	const icon = String(info.IconName || info.Image || '').toLowerCase();
	return categories.get(String(category || '').trim().toLowerCase()) || iconCategories.get(icon);
}

function badge(category) {
	const label = node('span', 'quest-badge', category);
	label.dataset.kind = category;
	return label;
}

function validDestination(value) {
	const target = typeof value === 'string' ? value.trim() : '';
	return destinationPattern.test(target) ? target : '';
}

function destinationOf(quest) {
	const metadata = validDestination(quest.npc_navi);
	if (metadata) {
		return { target: metadata, label: questTitle(quest) };
	}

	const body = [formatText(quest.description), formatText(quest.summary)].join('\n');
	for (const [, type, label, value] of body.matchAll(questLink)) {
		const target = type.toUpperCase() === 'NAVI' && validDestination(value);
		if (target) {
			return { target, label };
		}
	}

	const map = String(quest.npc_navi || '').trim();
	if (map && Number(quest.npc_pos_x) > 0 && Number(quest.npc_pos_y) > 0) {
		const target = validDestination(`${map},${quest.npc_pos_x},${quest.npc_pos_y}`);
		if (target) {
			return { target, label: questTitle(quest) };
		}
	}

	return null;
}

function locationOf(destination) {
	if (!destination) {
		return '';
	}
	const map = destination.target.split(',')[0];
	return DB.getMapName(map, map) || map;
}

function button(className, text, action) {
	const control = node('button', className, text);
	control.type = 'button';
	control.addEventListener('click', action);
	return control;
}

function appendQuestText(parent, value, navigate, inspectItem) {
	const text = formatText(value);
	let previousEnd = 0;
	for (const match of text.matchAll(questLink)) {
		const [markup, type, label, info] = match;
		parent.append(text.slice(previousEnd, match.index));
		const target = validDestination(info);
		if (type.toUpperCase() === 'NAVI' && target) {
			parent.append(button('quest-link', label, () => navigate({ target, label })));
		} else if (type.toUpperCase() === 'ITEM' && /^\d+$/.test(info.trim())) {
			parent.append(button('quest-link', label, () => inspectItem(Number(info))));
		} else {
			parent.append(label);
		}
		previousEnd = match.index + markup.length;
	}
	parent.append(text.slice(previousEnd));
}

function loadIcon(img, path) {
	Client.loadFile(`${DB.INTERFACE_PATH}${path}`, data => {
		if (data) {
			img.src = data;
			img.style.visibility = '';
		}
	});
}

function sectionTitle(text) {
	const heading = node('h4', 'quest-section-title');
	heading.append(node('span', '', text));
	return heading;
}

function appendRewards(parent, quest, inspectItem) {
	const rewards = node('div', 'quest-rewards');
	for (const [label, amount] of [
		['Base EXP', quest.reward_exp_base],
		['Job EXP', quest.reward_exp_job]
	]) {
		if (amount > 0) {
			const tile = node('div', 'quest-reward');
			tile.append(node('span', '', label), node('strong', '', numberFormat.format(amount)));
			rewards.append(tile);
		}
	}

	for (const reward of quest.reward_item_list || []) {
		const itemId = reward.ItemID;
		const item = DB.getItemInfo(itemId);
		const name = plainText(item?.identifiedDisplayName) || `Item #${itemId}`;
		const tile = button('quest-reward', '', () => inspectItem(itemId));
		const amount = numberFormat.format(reward.ItemNum);
		tile.title = name;
		tile.setAttribute('aria-label', `${name} × ${amount}`);

		if (item?.identifiedResourceName) {
			const icon = node('img', '');
			icon.alt = '';
			icon.style.visibility = 'hidden';
			loadIcon(icon, `item/${item.identifiedResourceName}.bmp`);
			tile.append(icon);
		} else {
			tile.append(node('span', '', name));
		}

		tile.append(node('strong', '', amount));
		rewards.append(tile);
	}

	if (rewards.childElementCount) {
		parent.append(sectionTitle('Rewards'), rewards);
	}
}

function appendObjectives(parent, quest, navigate, inspectItem) {
	const objectives = node('ul', 'quest-objectives');
	for (const hunt of Object.values(quest.hunt_list || {})) {
		const row = node('li', '');
		const monster = hunt.mobType && DB.getMonsterName(hunt.mobType);
		const name = plainText(hunt.mobName) || (monster !== 'Unknown' && monster);
		const label = node('span', '', name || 'Hunt objective');
		row.append(label);

		if (hunt.maxCount > 0) {
			const amount = node('span', 'progress', `${hunt.huntCount} / ${hunt.maxCount}`);
			amount.classList.toggle('complete', hunt.huntCount >= hunt.maxCount);
			row.append(amount);
		}
		objectives.append(row);
	}

	if (!objectives.childElementCount && plainText(quest.summary)) {
		const row = node('li', '');
		const text = node('span', '');
		appendQuestText(text, quest.summary, navigate, inspectItem);
		row.append(text);
		objectives.append(row);
	}

	if (objectives.childElementCount) {
		parent.append(sectionTitle('Quest Objective'), objectives);
	}
}

export function bindQuestPanel(root, actions) {
	const filters = root.querySelector('.quest-categories');
	const status = root.querySelector('.quest-status');
	const list = root.querySelector('.quest-list');
	const empty = root.querySelector('.quest-empty');
	const detail = root.querySelector('.quest-detail-content');
	const go = root.querySelector('.quest-go');
	const tracker = root.querySelector('.quest-tracker');
	let quests = [];
	let category = 'All';
	let selectedId = null;
	let destination = null;

	function navigate({ target, label }) {
		actions.close();
		Navigation.show();
		Navigation.uid = target;
		Navigation.setNaviInfo(target, label);
	}

	function inspectItem(itemId) {
		actions.close();
		ItemInfo.append();
		ItemInfo.uid = itemId;
		ItemInfo.setItem({ ITID: itemId, IsIdentified: true });
		ItemInfo.focus();
	}

	function renderDetail(quest) {
		const scroll = detail.scrollTop;
		detail.replaceChildren();
		destination = quest && destinationOf(quest);
		go.hidden = !destination;

		if (!quest) {
			detail.append(node('p', 'quest-empty', 'Select a quest to see its details.'));
			return;
		}

		const heading = node('div', 'quest-detail-title');
		const kind = categoryOf(quest);
		if (kind) {
			heading.append(badge(kind));
		}
		heading.append(node('h3', '', questTitle(quest)));
		detail.append(heading);

		if (destination) {
			detail.append(node('p', 'quest-location', locationOf(destination)));
		}
		if (plainText(quest.description)) {
			const description = node('p', '');
			appendQuestText(description, quest.description, navigate, inspectItem);
			detail.append(description);
		}

		appendObjectives(detail, quest, navigate, inspectItem);
		appendRewards(detail, quest, inspectItem);

		const options = node('div', 'quest-options');
		const state = actions.statusOf(quest);
		if (quest.end_time > 0) {
			const until = new Date(quest.end_time * 1000);
			detail.append(node('p', 'quest-deadline', `Deadline: ${until.toLocaleString()}`));
		}
		if (state !== 'cooldown' && Number(quest.active) <= 1) {
			const isActive = Number(quest.active) === 1;
			options.append(button('pill', isActive ? 'Deactivate' : 'Activate', () => actions.toggleActive(quest)));
		}
		if (actions.hasTracker && state === 'active') {
			const label = node('label', 'quest-option');
			const check = document.createElement('input');
			check.type = 'checkbox';
			check.checked = actions.isTracked(quest.questID);
			check.addEventListener('change', () => actions.setTracked(quest.questID, check.checked));
			label.append(check, 'Track quest');
			options.append(label);
		}
		if (options.childElementCount) {
			detail.append(options);
		}
		detail.scrollTop = scroll;
	}

	function select(quest) {
		selectedId = quest?.questID ?? null;
		for (const row of list.querySelectorAll('.quest-row')) {
			row.setAttribute('aria-pressed', String(row.dataset.questId === String(selectedId)));
		}
		detail.scrollTop = 0;
		renderDetail(quest);
	}

	function renderList() {
		const oldScroll = list.scrollTop;
		const visible = quests.filter(quest =>
			(category === 'All' || categoryOf(quest) === category) &&
			(status.value === 'all' || actions.statusOf(quest) === status.value)
		);
		const selected = visible.find(quest => quest.questID === selectedId) || visible[0];
		const selectionChanged = selected?.questID !== selectedId;
		selectedId = selected?.questID ?? null;
		list.replaceChildren();
		empty.hidden = visible.length > 0;
		empty.textContent = quests.length ? 'No quests match these filters.' : 'No quests in your journal yet.';

		for (const quest of visible) {
			const row = button('quest-row', '', () => select(quest));
			row.dataset.questId = quest.questID;
			row.setAttribute('aria-pressed', String(quest.questID === selectedId));
			const icon = node('img', 'quest-row-icon');
			icon.alt = '';
			icon.style.visibility = 'hidden';
			const iconName = quest.icon || 'ico_nq.bmp';
			const path = actions.hasTracker
				? `renew_questui/${iconName}`
				: `item/${iconName.startsWith('ico_') ? 'SG_FEEL.bmp' : iconName}`;
			loadIcon(icon, path);

			const text = node('span', 'quest-row-text');
			const kind = categoryOf(quest);
			if (kind) {
				text.append(badge(kind));
			}
			text.append(node('strong', '', questTitle(quest)));
			const secondary = locationOf(destinationOf(quest)) || plainText(quest.summary);
			if (secondary) {
				text.append(node('span', 'quest-row-secondary', secondary));
			}
			row.append(icon, text);
			const item = node('li', '');
			item.append(row);
			list.append(item);
		}

		list.scrollTop = oldScroll;
		if (selectionChanged) {
			detail.scrollTop = 0;
		}
		renderDetail(selected);
	}

	filters.addEventListener('click', event => {
		const filter = event.target.closest('[data-category]');
		if (!filter) {
			return;
		}

		category = filter.dataset.category;
		for (const control of filters.querySelectorAll('[data-category]')) {
			control.classList.toggle('selected', control === filter);
			control.setAttribute('aria-pressed', String(control === filter));
		}
		list.scrollTop = 0;
		renderList();
	});

	status.addEventListener('change', () => {
		list.scrollTop = 0;
		renderList();
	});

	root.querySelector('.close').addEventListener('click', actions.close);
	root.addEventListener('wheel', event => event.stopPropagation());
	go.addEventListener('click', () => {
		if (destination) {
			navigate(destination);
		}
	});

	tracker.hidden = !actions.hasTracker;
	if (actions.hasTracker) {
		const check = tracker.querySelector('input');
		check.checked = actions.showTracker();
		check.addEventListener('change', () => actions.setShowTracker(check.checked));
	} else {
		status.querySelector('[value="cooldown"]').remove();
	}

	return function update(nextQuests) {
		quests = Object.values(nextQuests);
		renderList();
	};
}
