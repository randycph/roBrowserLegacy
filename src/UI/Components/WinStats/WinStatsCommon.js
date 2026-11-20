/**
 * Shared Character Status window for every protocol version.
 */
import BasicInfo from 'UI/Components/BasicInfo/BasicInfo.js';
import GUIComponent from 'UI/GUIComponent.js';
import MonsterTable from 'DB/Monsters/MonsterTable.js';
import Preferences from 'Core/Preferences.js';
import Session from 'Engine/SessionStorage.js';
import UIManager from 'UI/UIManager.js';
import htmlText from './CharacterStatus.html?raw';
import cssText from './CharacterStatus.css?raw';

const baseStats = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
const traitStats = ['pow', 'sta', 'wis', 'spl', 'con', 'crt'];
const baseBattle = [
	['ATK', 'atak', 'atak2'],
	['MATK', 'matak', 'matak2'],
	['DEF', 'def', 'def2'],
	['MDEF', 'mdef', 'mdef2'],
	['HIT', 'hit'],
	['FLEE', 'flee', 'flee2'],
	['CRIT', 'critical'],
	['ASPD', 'aspd']
];
const traitBattle = [
	['P.ATK', 'patk'],
	['S.MATK', 'smatk'],
	['RES', 'res'],
	['MRES', 'mres'],
	['H.PLUS', 'hplus'],
	['C.RATE', 'crate']
];
const defaultMessage = 'Tap + to allocate points.';

function statCost(value, renewal) {
	if (!renewal) {
		return 1 + Math.ceil(value / 10);
	}
	if (value < 100) {
		return 2 + Math.floor((value - 1) / 10);
	}
	return 16 + 4 * Math.floor((value - 100) / 5);
}

function formatBonus(value, range = false) {
	if (!Number.isFinite(value) || (value === 0 && !range)) {
		return '';
	}
	if (range) {
		return `~ ${value}`;
	}
	return value < 0 ? `- ${-value}` : `+ ${value}`;
}

function renderStatRow(stat) {
	const label = stat.toUpperCase();
	return `
		<div class="stat-row" data-stat="${stat}">
			<strong class="stat-label">${label}</strong>
			<div class="stat-value">
				<strong data-value>—</strong>
				<span data-cost title="Points needed for the next increase">—</span>
			</div>
			<button type="button" data-adjust="-1" aria-label="Undo one ${label} increase" disabled>−</button>
			<button type="button" data-adjust="1" aria-label="Increase ${label}" disabled>+</button>
		</div>`;
}

export function createWinStats({ name, hasTraits }) {
	const component = new GUIComponent(name, cssText);
	const preferences = Preferences.get('WinStats', { show: false }, 1.0);
	const attributes = new Map(baseStats.map((stat, index) => [stat, { pool: 'base', id: 13 + index }]));
	const rows = new Map();
	const draft = new Map();
	const stack = [];
	let root;
	let values = {};
	let player;
	let applying = false;
	let waiting = null;
	let replyTimer;
	let profileTimer;
	let embedAnchor;
	let embedObserver;

	if (hasTraits) {
		traitStats.forEach((stat, index) => {
			attributes.set(stat, { pool: 'trait', id: 219 + index });
		});
	}

	component.render = () => htmlText;

	function setText(selector, text) {
		root.querySelector(selector).textContent = text;
	}

	function nextCost(stat, extra = 0) {
		const base = values[stat];
		const cost = values[stat + '3'];
		if (!Number.isFinite(base) || !(cost > 0)) {
			return 0;
		}
		if (attributes.get(stat).pool === 'trait') {
			return cost;
		}
		// Start with the server's price. Apply its regular cost curve to preview subsequent increases.
		return cost + statCost(base + extra, Session.isRenewal) - statCost(base, Session.isRenewal);
	}

	function remainingPoints() {
		const remaining = {
			base: values.statuspoint,
			trait: values.trait_point
		};
		for (const [stat, count] of draft) {
			const { pool } = attributes.get(stat);
			if (!nextCost(stat)) {
				remaining[pool] = -1;
				continue;
			}
			for (let extra = 0; extra < count; extra++) {
				remaining[pool] -= nextCost(stat, extra);
			}
		}
		return remaining;
	}

	function renderAllocations() {
		const remaining = remainingPoints();
		const locked = applying || Boolean(waiting);
		for (const [stat, row] of rows) {
			const count = draft.get(stat) ?? 0;
			const base = values[stat];
			const cost = nextCost(stat, count);
			const value = [base + count, formatBonus(values[stat + '2'])].filter(term => term !== '').join(' ');
			row.value.textContent = Number.isFinite(base) ? value : '—';
			row.value.toggleAttribute('data-preview', count > 0);
			row.cost.textContent = cost || '—';
			row.minus.disabled = locked || count === 0;
			row.plus.disabled = locked || !cost || !(cost <= remaining[attributes.get(stat).pool]);
		}

		setText('[data-points="base"]', Number.isFinite(remaining.base) ? Math.max(0, remaining.base) : '—');
		setText('[data-points="trait"]', Number.isFinite(remaining.trait) ? Math.max(0, remaining.trait) : '—');
		root.querySelector('.trait-details').hidden = !hasTraits || !(values.trait_point > 0 || traitStats.some(stat => values[stat] > 0));
		root.querySelector('.reset').disabled = locked || draft.size === 0;
		root.querySelector('.confirm').disabled = locked || draft.size === 0 || remaining.base < 0 || remaining.trait < 0;
	}

	function renderBattle() {
		for (const [, stat, bonus] of [...baseBattle, ...traitBattle]) {
			const el = root.querySelector(`[data-battle-value="${stat}"]`);
			if (!el) {
				continue;
			}
			el.textContent = battleValue(stat, bonus);
		}

		const guild = root.querySelector('.guild');
		guild.hidden = !values.guildname;
		guild.textContent = values.guildname || '';
	}

	function battleValue(stat, bonus) {
		const base = values[stat];
		if (!Number.isFinite(base)) {
			return '—';
		}
		const shown = stat === 'aspd' ? Math.floor(200 - base / 10) : base;
		const modifier = formatBonus(values[bonus], bonus === 'matak2' && !Session.isRenewal);
		return `${shown} ${modifier}`.trim();
	}

	component.getEquipmentStats = function getEquipmentStats() {
		const current = player === Session.Entity;
		return {
			base: baseStats.map(stat => {
				const bonus = formatBonus(values[stat + '2']);
				const cost = values[stat + '3'];
				const parts = [values[stat], bonus];
				if (cost > 0) {
					parts.push('▸ ' + cost);
				}
				return [stat.toUpperCase(), current && Number.isFinite(values[stat]) ? parts.filter(Boolean).join(' ') : '—'];
			}),
			battle: baseBattle.map(([label, stat, bonus]) => [label, current ? battleValue(stat, bonus) : '—']),
			points: current ? values.statuspoint ?? '—' : '—'
		};
	};

	function renderExperience(type, label, level, current, required) {
		const row = root.querySelector(`[data-exp="${type}"]`);
		row.querySelector('[data-level]').textContent = `${label} Lv. ${level ?? '—'}`;
		const track = row.querySelector('.exp-track');
		const valid = Number.isFinite(current) && current >= 0 && required > 1;
		const percent = valid ? Math.max(0, Math.min(100, current * 100 / required)) : 0;
		if (valid) {
			track.setAttribute('aria-valuenow', percent.toFixed(1));
		} else {
			track.removeAttribute('aria-valuenow');
		}
		track.querySelector('.exp-fill').style.width = `${percent}%`;
		track.querySelector('.exp-value').textContent = valid ? `${percent.toFixed(1)}%` : '—';
	}

	function refreshProfile() {
		const entity = Session.Entity;
		setText('.character-name', entity?.display?.name || '');
		setText('.character-job', MonsterTable[entity?.job] || '');
		setText('.level-badge', `Lv. ${entity?.clevel ?? '—'}`);
		renderExperience('base', 'Base', entity?.clevel, BasicInfo.base_exp, BasicInfo.base_exp_next);
		renderExperience('job', 'Job', entity?.joblevel, BasicInfo.job_exp, BasicInfo.job_exp_next);

		// Use the HUD's portrait of the equipped character to share its sprite rendering.
		const portrait = document.querySelector('.mobile-profile-avatar canvas');
		const canvas = root.querySelector('.portrait');
		const context = canvas.getContext('2d');
		context?.clearRect(0, 0, canvas.width, canvas.height);
		if (context && portrait) {
			context.imageSmoothingEnabled = false;
			context.drawImage(portrait, 0, 0, canvas.width, canvas.height);
		}
	}

	function clearDraft(message = defaultMessage) {
		draft.clear();
		setText('.allocation-message', message);
		renderAllocations();
	}

	function editDraft(stat, direction) {
		if (applying || waiting) {
			return;
		}
		const count = draft.get(stat) ?? 0;
		const price = nextCost(stat, count);
		if (direction > 0 && (!price || !(price <= remainingPoints()[attributes.get(stat).pool]))) {
			return;
		}
		const next = count + direction;
		if (next > 0) {
			draft.set(stat, next);
		} else {
			draft.delete(stat);
		}
		setText('.allocation-message', draft.size ? 'Confirm to spend your points.' : defaultMessage);
		renderAllocations();
	}

	function stopApplying(message) {
		applying = false;
		clearDraft(message);
	}

	function applyNext() {
		if (!applying) {
			return;
		}
		if (!draft.size) {
			stopApplying('Changes applied.');
			return;
		}

		const stat = draft.keys().next().value;
		const { id, pool } = attributes.get(stat);
		const available = pool === 'base' ? values.statuspoint : values.trait_point;
		const cost = nextCost(stat);
		if (Session.Entity !== player || !Session.Playing || !cost || !(cost <= available)) {
			stopApplying('Some changes could not be applied. Review your current stats.');
			return;
		}

		waiting = { id, stat };
		replyTimer = setTimeout(() => {
			// A delayed reply may still spend the requested point, so keep Confirm locked until it arrives.
			stopApplying('Waiting for the server. Remaining changes were skipped.');
		}, 10000);
		component.onRequestUpdate(id, 1);
	}

	component.onUpdateAnswer = function onUpdateAnswer(id, accepted) {
		if (waiting?.id !== id || Session.Entity !== player) {
			return;
		}
		clearTimeout(replyTimer);
		const { stat } = waiting;
		waiting = null;
		if (!applying) {
			setText('.allocation-message', 'Server response received. Review your current stats.');
			renderAllocations();
			return;
		}
		if (!accepted) {
			stopApplying('The server declined an increase. Review your current stats.');
			return;
		}

		const count = draft.get(stat);
		if (count > 1) {
			draft.set(stat, count - 1);
		} else {
			draft.delete(stat);
		}
		// Point totals and new costs can arrive alongside the acknowledgement.
		queueMicrotask(() => {
			renderAllocations();
			applyNext();
		});
	};

	function syncPlayer() {
		if (player === Session.Entity) {
			return;
		}
		player = Session.Entity;
		values = {};
		applying = false;
		waiting = null;
		clearTimeout(replyTimer);
		clearDraft();
	}

	function setVisible(visible) {
		clearInterval(profileTimer);
		component._host.style.display = visible ? '' : 'none';
		if (visible) {
			refreshProfile();
			profileTimer = setInterval(refreshProfile, 1000);
		}
	}

	function place() {
		const host = component._host;
		const viewport = document.documentElement;
		const size = host.getBoundingClientRect();
		if (!embedAnchor) {
			host.style.left = `${Math.max(8, (viewport.clientWidth - size.width) / 2)}px`;
			host.style.top = `${Math.max(8, (viewport.clientHeight - size.height) / 2)}px`;
			return;
		}

		const anchor = embedAnchor.getBoundingClientRect();
		const below = viewport.clientHeight - anchor.bottom - 8;
		const height = Math.max(160, below);
		host.style.setProperty('--stats-embed-height', `${Math.min(height, viewport.clientHeight - 16)}px`);
		host.style.left = `${Math.max(8, Math.min(anchor.left, viewport.clientWidth - size.width - 8))}px`;
		host.style.top = `${Math.max(8, Math.min(anchor.bottom, viewport.clientHeight - height - 8))}px`;
	}

	component.init = function init() {
		root = this.getRoot();
		for (const [pool, stats, battles] of [['base', baseStats, baseBattle], ['trait', traitStats, traitBattle]]) {
			if (pool === 'trait' && !hasTraits) {
				continue;
			}

			root.querySelector(`[data-attributes="${pool}"]`).innerHTML = stats.map(renderStatRow).join('');
			root.querySelector(`[data-battle="${pool}"]`).innerHTML = battles.map(([label, stat]) => `
				<div class="battle-row"><dt>${label}</dt><dd data-battle-value="${stat}">—</dd></div>`).join('');
		}
		for (const row of root.querySelectorAll('[data-stat]')) {
			const { stat } = row.dataset;
			const minus = row.querySelector('[data-adjust="-1"]');
			const plus = row.querySelector('[data-adjust="1"]');
			rows.set(stat, { minus, plus, value: row.querySelector('[data-value]'), cost: row.querySelector('[data-cost]') });
			minus.addEventListener('click', () => editDraft(stat, -1));
			plus.addEventListener('click', () => editDraft(stat, 1));
		}

		root.querySelector('.reset').addEventListener('click', () => clearDraft());
		root.querySelector('.confirm').addEventListener('click', () => {
			if (!draft.size || applying || waiting) {
				return;
			}
			applying = true;
			setText('.allocation-message', 'Applying changes…');
			renderAllocations();
			applyNext();
		});

		const close = root.querySelector('.close');
		close.addEventListener('mousedown', event => event.stopImmediatePropagation());
		close.addEventListener('click', () => setVisible(false));
		root.querySelector('.status-scroll').addEventListener('wheel', event => event.stopPropagation());
		this.draggable('.titlebar');
	};

	// Keep native touch scrolling in the panel on short screens.
	component._setupScrollbars = function setupScrollbars() {};

	component.update = function update(type, value) {
		if (!root) {
			stack.push([type, value]);
			return;
		}
		syncPlayer();
		values[type] = value;
		if (type === 'statuspoint' || type === 'trait_point' || attributes.has(type.replace(/[23]$/, ''))) {
			renderAllocations();
		} else {
			renderBattle();
		}
	};

	component.toggle = function toggle() {
		if (embedAnchor) {
			this.unembed();
			return;
		}
		if (this._host.style.display === 'none') {
			setVisible(true);
			place();
			this.focus();
		} else {
			setVisible(false);
		}
	};

	component.embed = function embed(anchor) {
		this.prepare();
		embedAnchor = anchor;
		this._host.classList.add('stats-embedded');
		if (!this._host.isConnected) {
			this.append();
		}
		setVisible(true);
		place();
		embedObserver?.disconnect();
		embedObserver = new MutationObserver(place);
		embedObserver.observe(anchor, { attributes: true, attributeFilter: ['style'] });
	};

	component.unembed = function unembed() {
		embedObserver?.disconnect();
		embedObserver = null;
		embedAnchor = null;
		this._host.classList.remove('stats-embedded');
		setVisible(false);
	};

	component.isEmbedded = function isEmbedded() {
		return Boolean(embedAnchor);
	};

	component.onAppend = function onAppend() {
		syncPlayer();
		for (const [type, value] of stack.splice(0)) {
			this.update(type, value);
		}
		renderAllocations();
		renderBattle();
		setVisible(preferences.show || Boolean(embedAnchor));
		if (this._host.style.display !== 'none') {
			place();
		}
	};

	component.onRemove = function onRemove() {
		const visible = this._host.style.display !== 'none';
		if (!embedAnchor) {
			preferences.show = visible;
			preferences.save();
		}
		this.unembed();
		stopApplying(waiting ? 'Waiting for the server. Remaining changes were skipped.' : defaultMessage);
	};

	component.onShortCut = function onShortCut(key) {
		if (key.cmd === 'TOGGLE') {
			this.toggle();
		}
	};

	const fixPositionOverflow = component._fixPositionOverflow;
	component._fixPositionOverflow = function () {
		if (embedAnchor) {
			place();
		} else {
			fixPositionOverflow.call(this);
		}
	};

	component.onRequestUpdate = function onRequestUpdate() {};

	return UIManager.addComponent(component);
}
