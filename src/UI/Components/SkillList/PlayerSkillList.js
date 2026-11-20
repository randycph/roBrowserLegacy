import Client from 'Core/Client.js';
import DB from 'DB/DBManager.js';
import Preferences from 'Core/Preferences.js';
import SkillInfo from 'DB/Skills/SkillInfo.js';
import SkillTreeView from 'DB/Skills/SkillTreeView.js';
import Session from 'Engine/SessionStorage.js';
import GUIComponent from 'UI/GUIComponent.js';
import UIManager from 'UI/UIManager.js';
import { _formatROText } from 'UI/Components/SkillDescription/SkillDescription.js';
import SkillTargetSelection from 'UI/Components/SkillTargetSelection/SkillTargetSelection.js';
import { attachTouchDrag } from '../../TouchDrag.js?v=skills-panel';
import { createSkillUpgradeOrder, resolveSkillRequirements, stageSkillPlan } from './SkillRequirements.js';
import panelCss from '../RpgPanel.css?raw';
import htmlText from './PlayerSkillList.html?raw&v=skills-panel';
import cssText from './PlayerSkillList.css?raw&v=skills-panel';
import 'UI/Elements/Elements.js';

const jobLabels = ['Other', '1st Job', '2nd Job', '3rd Job', '4th Job'];
const bookIcon = new URL('../BasicInfo/mobile-icons/top/skills.png', import.meta.url).href;

function node(tag, className, text) {
	const element = document.createElement(tag);
	element.className = className;
	if (text !== undefined) {
		element.textContent = text;
	}
	return element;
}

function button(className, text, onClick) {
	const element = node('button', className, text);
	element.type = 'button';
	element.addEventListener('click', onClick);
	return element;
}

function getSkillGroups(job) {
	const groups = new Map();
	const visited = new Set();

	while (job != null && !visited.has(job)) {
		visited.add(job);
		const tree = SkillTreeView[job];
		if (!tree) {
			break;
		}
		for (const key of Object.keys(tree)) {
			const id = Number(key);
			if (SkillInfo[id] && !groups.has(id)) {
				groups.set(id, tree.list);
			}
		}
		job = tree.beforeJob;
	}

	return groups;
}

function formatDescription(id, job) {
	const value = DB.getSkillDescription(id);
	if (!value || value === '...') {
		return '';
	}
	const template = document.createElement('template');
	template.innerHTML = _formatROText(value, job);
	for (const lineBreak of template.content.querySelectorAll('br')) {
		lineBreak.replaceWith('\n');
	}
	const lines = template.content.textContent.trim().split('\n');
	if (lines[0].trim().toLowerCase() === SkillInfo[id].SkillName.toLowerCase()) {
		lines.shift();
	}
	return lines.join('\n').trim();
}

function appendFact(list, label, value) {
	const fact = node('div', 'skills-fact');
	fact.append(node('dt', '', label), node('dd', '', value));
	list.append(fact);
}

function targetLabel(type) {
	const flags = SkillTargetSelection.TYPE;
	if (type & (flags.PLACE | flags.TRAP)) {
		return 'Ground Target';
	}
	if (type & (flags.ENEMY | flags.FRIEND)) {
		return 'Single Target';
	}
	if (type & flags.SELF) {
		return 'Self';
	}
	return '';
}

export function createPlayerSkillList(name) {
	const component = new GUIComponent(name, panelCss + cssText);
	const preferences = Preferences.get(name, { show: false }, 1.0);
	const skills = new Map();
	const iconCache = new Map();
	let groups = new Map();
	let jobId;
	let currentGroup;
	let selection;
	let points = 0;
	let plan = new Map();
	let cost = 0;
	let pending;
	let feedback = '';
	let notice;
	let draggingSkill = false;
	let renderAfterDrag = false;

	function options() {
		return {
			plan,
			ownedSkills: skills,
			skillInfo: SkillInfo,
			skillTreeView: SkillTreeView,
			jobId,
			availablePoints: points
		};
	}

	function setJob() {
		const entity = Session.Entity;
		const nextJob = entity ? (entity._job || entity.job) : 0;
		if (jobId !== nextJob) {
			jobId = nextJob;
			groups = getSkillGroups(jobId);
			currentGroup = undefined;
			selection = undefined;
			resetPlan();
			finishPending();
		}
	}

	function icon(id, draggable = false) {
		const img = node('img', 'skills-icon');
		img.alt = '';
		img.draggable = draggable;
		if (draggable) {
			img.dataset.dragSkill = id;
		}

		if (!iconCache.has(id)) {
			const resource = SkillInfo[id].Name;
			const image = new Promise(resolve => {
				Client.loadFile(`${DB.INTERFACE_PATH}item/${resource}.bmp`, resolve, () => resolve(null));
			});
			iconCache.set(id, image);
		}
		iconCache.get(id).then(source => {
			if (source) {
				img.src = source;
			}
		});
		return img;
	}

	function currentLevel(id) {
		return skills.get(id)?.level ?? 0;
	}

	function previewLevel(id) {
		return Math.max(currentLevel(id), plan.get(id)?.count ?? 0);
	}

	function canRaise(id) {
		const info = SkillInfo[id];
		const known = skills.get(id);
		return info.Type !== 'Quest' &&
			previewLevel(id) < info.MaxLv &&
			(known ? Boolean(known.upgradable) : groups.has(id));
	}

	function stage(id) {
		if (pending || !canRaise(id)) {
			return;
		}
		const result = stageSkillPlan({ ...options(), skillId: id });
		if (!result || Array.from(result.plan).some(([skillId, choice]) => {
			const owned = skills.get(skillId);
			return choice.count > currentLevel(skillId) &&
				(owned ? !owned.upgradable : !groups.has(skillId));
		})) {
			feedback = 'There are not enough points or an upgrade is unavailable.';
			render();
			return;
		}

		selection = id;
		plan = result.plan;
		cost = result.cost;
		feedback = '';
		render();
	}

	function resetPlan() {
		plan = new Map();
		cost = 0;
		feedback = '';
	}

	function finishPending(message = '') {
		clearTimeout(pending?.timer);
		pending = undefined;
		feedback = message;
	}

	function acknowledge(pointsUpdated = false) {
		if (!pending) {
			return;
		}
		const levelsReached = Array.from(pending.targets).every(([id, level]) => currentLevel(id) >= level);
		if (levelsReached && (pointsUpdated || points <= pending.expectedPoints)) {
			finishPending();
		}
	}

	function reconcilePlan() {
		if (!cost) {
			return;
		}
		for (const [id, choice] of plan) {
			if (choice.count <= currentLevel(id)) {
				plan.delete(id);
			}
		}
		const order = createSkillUpgradeOrder(options());
		if (!order) {
			resetPlan();
			feedback = 'Skill points changed. Choose your upgrades again.';
		} else {
			cost = order.length;
		}
	}

	function confirm() {
		if (pending || !cost) {
			return;
		}
		const order = createSkillUpgradeOrder(options());
		if (!order?.length) {
			resetPlan();
			feedback = 'Skill points changed. Choose your upgrades again.';
			render();
			return;
		}

		pending = {
			targets: new Map(Array.from(plan, ([id, choice]) => [id, choice.count])),
			expectedPoints: points - order.length,
			timer: setTimeout(() => {
				finishPending('Some upgrades could not be confirmed. Check your skill levels.');
				render();
			}, 5000)
		};
		resetPlan();
		feedback = 'Applying upgrades…';
		render();
		for (const id of order) {
			component.onIncreaseSkill(id);
		}
	}

	function hide() {
		resetPlan();
		component.ui.hide();
		render();
	}

	function renderDetails(detail, id) {
		const info = SkillInfo[id];
		const learned = skills.get(id);
		const level = currentLevel(id);
		const preview = previewLevel(id);
		const heading = node('div', 'skills-detail-heading');
		const labels = node('div', '');
		labels.append(node('h3', '', info.SkillName));

		const type = learned ? (learned.type ? 'Active' : 'Passive') : 'Locked';
		labels.append(node('span', 'skills-badge', type));
		heading.append(icon(id), labels);
		detail.append(heading);

		const facts = node('dl', 'skills-facts');
		const maximum = info.MaxLv ? ` / ${info.MaxLv}` : '';
		appendFact(facts, 'Current Level', `${level}${maximum}`);
		if (preview > level) {
			appendFact(facts, 'Pending Level', `${preview}${maximum}`);
		}
		const sp = learned?.spcost;
		if (learned?.type && Number.isFinite(sp)) {
			appendFact(facts, 'SP Cost', sp);
		}
		const target = targetLabel(learned?.type);
		if (target) {
			appendFact(facts, 'Target', target);
		}
		detail.append(facts);

		const description = formatDescription(id, jobId);
		if (description) {
			detail.append(node('div', 'skills-description', description));
		}

		const requirements = resolveSkillRequirements(info, jobId, SkillTreeView)
			.filter(([required, needed]) => currentLevel(required) < needed);
		if (requirements.length) {
			const list = node('ul', 'skills-requirements');
			for (const [required, needed] of requirements) {
				const name = SkillInfo[required]?.SkillName || DB.getSkillName(required);
				list.append(node('li', '', `${name} Lv. ${needed}`));
			}
			detail.append(node('strong', '', 'Requirements'), list);
		}

		if (info.MaxLv > 0 && level >= info.MaxLv) {
			detail.append(node('div', 'skills-max', 'Max Level'));
		}

		if (learned?.type && info.bSeperateLv && level > 1) {
			const label = node('label', 'skills-cast-level', 'Cast level ');
			const select = node('select', 'pill');
			for (let castLevel = level; castLevel >= 1; --castLevel) {
				const option = node('option', '', castLevel);
				option.value = castLevel;
				select.append(option);
			}
			select.value = Math.min(learned.selectedLevel || level, level);
			select.addEventListener('change', () => {
				learned.selectedLevel = Number(select.value);
			});
			label.append(select);
			detail.append(label);
		}
	}

	function render() {
		if (draggingSkill) {
			renderAfterDrag = true;
			return;
		}
		const root = component.getRoot();
		if (!root) {
			return;
		}

		const jobButtons = root.querySelector('.skills-jobs');
		const list = root.querySelector('.skills-list');
		const detail = root.querySelector('.skills-detail-content');
		const message = root.querySelector('.skills-feedback');
		const listScroll = list.scrollTop;
		const detailScroll = detail.scrollTop;
		const focusedControl = root.activeElement?.dataset.skillControl;
		const entries = new Map();

		for (const id of new Set([...groups.keys(), ...skills.keys()])) {
			const group = groups.get(id) ?? 0;
			if (!entries.has(group)) {
				entries.set(group, []);
			}
			entries.get(group).push(id);
		}

		const jobGroups = Array.from(entries.keys()).sort((a, b) => (a || 99) - (b || 99));
		if (!entries.has(currentGroup)) {
			currentGroup = jobGroups.find(group => group > 0) ?? jobGroups[0];
		}
		const visible = entries.get(currentGroup) ?? [];
		if (!visible.includes(selection)) {
			selection = visible.find(id => currentLevel(id) > 0) ?? visible[0];
		}

		jobButtons.replaceChildren();
		for (const group of jobGroups) {
			const selected = group === currentGroup;
			const control = button(`pill${selected ? ' selected' : ''}`, jobLabels[group] || `Job ${group}`, () => {
				currentGroup = group;
				selection = undefined;
				list.scrollTop = 0;
				detail.scrollTop = 0;
				render();
			});
			control.setAttribute('aria-pressed', String(selected));
			control.dataset.skillControl = `group-${group}`;
			jobButtons.append(control);
		}

		list.replaceChildren();
		for (const id of visible) {
			const info = SkillInfo[id];
			const learned = skills.get(id);
			const selected = id === selection;
			const row = node('div', `skills-row${selected ? ' selected' : ''}`);
			const open = button('skills-row-select', '', () => {
				if (selection !== id) {
					detail.scrollTop = 0;
					selection = id;
					render();
				}
			});
			open.draggable = false;
			open.dataset.skillId = id;
			open.dataset.skillControl = `select-${id}`;
			open.setAttribute('aria-pressed', String(selected));
			const title = node('span', 'skills-row-name');
			const level = previewLevel(id);
			const label = level > currentLevel(id) ? `Lv. ${level} · Pending` : `Lv. ${level}`;
			title.append(node('strong', '', info.SkillName), node('span', 'skills-level', label));
			open.append(icon(id, Boolean(learned?.level && learned.type)), title);
			row.append(open);

			if (canRaise(id)) {
				const upgrade = button('pill skills-add', '+', () => stage(id));
				upgrade.setAttribute('aria-label', `Upgrade ${info.SkillName}`);
				upgrade.dataset.skillControl = `upgrade-${id}`;
				upgrade.disabled = Boolean(pending) || points <= cost;
				row.append(upgrade);
			}
			list.append(row);
		}
		list.scrollTop = listScroll;

		detail.replaceChildren();
		if (selection == null) {
			detail.append(node('p', '', 'No skills available.'));
		} else {
			renderDetails(detail, selection);
		}
		detail.scrollTop = detailScroll;

		root.querySelector('.skills-points strong').textContent = pending
			? Math.min(points, pending.expectedPoints)
			: Math.max(0, points - cost);
		root.querySelector('.skills-confirm').disabled = Boolean(pending) || !cost;
		root.querySelector('.skills-reset').disabled = Boolean(pending) || !cost;
		message.hidden = !feedback;
		message.textContent = feedback;
		if (focusedControl) {
			root.querySelector(`[data-skill-control="${focusedControl}"]`)?.focus({ preventScroll: true });
		}
	}

	function payload(image) {
		const data = skills.get(Number(image?.dataset.dragSkill));
		if (data?.level && data.type) {
			return { type: 'skill', from: 'SkillList', data };
		}
		return null;
	}

	function markDragging(dragging) {
		draggingSkill = dragging;
		component._host.style.opacity = dragging ? '.25' : '';
		component._host.style.pointerEvents = dragging ? 'none' : '';
		if (!dragging && renderAfterDrag) {
			renderAfterDrag = false;
			render();
		}
	}

	component.render = () => htmlText;
	component._setupScrollbars = function setupScrollbars() {
		// Use native scrolling for the independent list and detail panes.
	};

	component.init = function init() {
		const root = this.getRoot();
		root.querySelector('.header-icon').src = bookIcon;
		root.querySelector('.close').addEventListener('click', hide);
		root.querySelector('.skills-confirm').addEventListener('click', confirm);
		root.querySelector('.skills-reset').addEventListener('click', () => {
			resetPlan();
			render();
		});
		root.addEventListener('wheel', event => event.stopPropagation());

		notice = root.querySelector('#lvlup_job');
		Object.assign(notice.style, {
			position: 'fixed',
			bottom: '0',
			right: '0',
			width: '43px',
			height: '43px',
			zIndex: '51'
		});
		notice.remove();
		notice.addEventListener('click', () => this.toggle());

		const list = root.querySelector('.skills-list');
		attachTouchDrag(list, {
			itemSelector: '[data-drag-skill]',
			getPayload: payload,
			onDragChange: markDragging
		});
		list.addEventListener('dragstart', event => {
			const drag = payload(event.target.closest('[data-drag-skill]'));
			if (!drag) {
				event.preventDefault();
				return;
			}
			window._OBJ_DRAG_ = drag;
			event.dataTransfer.setData('Text', JSON.stringify(drag));
			requestAnimationFrame(() => {
				if (window._OBJ_DRAG_ === drag) {
					markDragging(true);
				}
			});
		});
		list.addEventListener('dragend', () => {
			delete window._OBJ_DRAG_;
			markDragging(false);
		});
		list.addEventListener('dblclick', event => {
			const id = Number(event.target.closest('[data-skill-id]')?.dataset.skillId);
			const skill = skills.get(id);
			if (skill?.level && skill.type) {
				hide();
				this.useSkillID(id);
			}
		});
		setJob();
		render();
	};

	component.onAppend = function onAppend() {
		if (!preferences.show) {
			this.ui.hide();
		}
	};

	component.onRemove = function onRemove() {
		notice?.remove();
		preferences.show = this.ui.is(':visible');
		preferences.save();
		resetPlan();
		finishPending();
		renderAfterDrag = false;
		markDragging(false);
	};

	component.toggle = function toggle() {
		if (this.ui.is(':visible')) {
			hide();
		} else {
			notice?.remove();
			this.ui.show();
			this.focus();
			render();
		}
	};

	component.onShortCut = function onShortCut(key) {
		if (key.cmd === 'TOGGLE') {
			this.toggle();
		}
	};

	component.setSkills = function setSkills(skillList) {
		setJob();
		const previous = new Map(skills);
		skills.clear();
		for (const skill of skillList) {
			const id = skill.SKID;
			if (SkillInfo[id]) {
				const selected = previous.get(id)?.selectedLevel;
				skills.set(id, { ...skill, selectedLevel: selected ? Math.min(selected, skill.level) : undefined });
			}
		}
		for (const id of previous.keys()) {
			if (!skills.has(id)) {
				this.onUpdateSkill(id, 0);
			}
		}
		for (const [id, skill] of skills) {
			this.onUpdateSkill(id, skill.level);
		}
		acknowledge();
		reconcilePlan();
		render();
	};

	component.updateSkill = function updateSkill(skill) {
		const id = skill.SKID;
		if (!SkillInfo[id]) {
			return;
		}
		const existing = skills.get(id);
		const updated = { ...existing, ...skill };
		if (!Number.isInteger(skill.type) && existing) {
			updated.type = existing.type;
		}
		if (updated.selectedLevel) {
			updated.selectedLevel = Math.min(updated.selectedLevel, updated.level);
		}
		skills.set(id, updated);
		this.onUpdateSkill(id, updated.level);
		acknowledge();
		reconcilePlan();
		render();
	};

	component.addSkill = component.updateSkill;

	component.setPoints = function setPoints(amount) {
		points = amount;
		acknowledge(true);
		reconcilePlan();
		render();
	};

	component.getSkillById = function getSkillById(id) {
		return skills.get(id) ?? null;
	};

	component.useSkillID = function useSkillID(id, level) {
		const skill = this.getSkillById(id);
		if (skill?.level && skill.type) {
			this.useSkill(skill, level || skill.selectedLevel || skill.level);
		}
	};

	component.useSkill = function useSkill(skill, level = skill.level) {
		if (skill.type & SkillTargetSelection.TYPE.SELF) {
			this.onUseSkill(skill.SKID, level);
		}
		skill.useLevel = level;
		if (skill.type & SkillTargetSelection.TYPE.TARGET) {
			SkillTargetSelection.append();
			SkillTargetSelection.set(skill, skill.type);
		}
	};

	component.onLevelUp = function onLevelUp() {
		if (notice && !this.ui.is(':visible')) {
			document.body.appendChild(notice);
		}
	};

	component.onUseSkill = function onUseSkill() {};
	component.onIncreaseSkill = function onIncreaseSkill() {};
	component.onUpdateSkill = function onUpdateSkill() {};

	return UIManager.addComponent(component);
}
