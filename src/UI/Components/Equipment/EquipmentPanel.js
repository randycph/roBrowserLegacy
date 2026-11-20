import BasicInfo from 'UI/Components/BasicInfo/BasicInfo.js';
import Session from 'Engine/SessionStorage.js';
import WinStats from 'UI/Components/WinStats/WinStats.js';

const base = ['STR', 'AGI', 'VIT', 'INT', 'DEX', 'LUK'];
const battle = ['ATK', 'MATK', 'DEF', 'MDEF', 'HIT', 'FLEE', 'CRIT', 'ASPD'];

function statRows(labels) {
	return labels.map(label => `
		<div class="equipment-stat-row">
			<dt>${label}</dt><dd data-stat="${label}">—</dd>
		</div>`).join('');
}

export function setupEquipmentPanel(component) {
	const root = component.getRoot();
	const window = root.querySelector('#' + component.name);
	const header = window.querySelector('.titlebar');
	const panel = window.querySelector('.panel');
	const tabs = window.querySelector('#tabs');
	const general = panel.querySelector('#general');
	const costume = panel.querySelector('#costume');
	const title = panel.querySelector('#title');
	const damage = panel.querySelector('#damageskin');
	const footer = panel.querySelector('.footer');
	window.classList.add('rpg-window', 'equipment-window');
	window.setAttribute('role', 'dialog');
	window.setAttribute('aria-labelledby', 'equipment-heading');
	header.innerHTML = `
		<img class="header-icon" src="/src/UI/Components/BasicInfo/mobile-icons/equip.png" alt="" />
		<h2 id="equipment-heading">Equipment</h2>
		<button class="close" type="button" aria-label="Close Equipment">×</button>`;

	const stage = document.createElement('section');
	stage.className = 'equipment-stage';
	stage.setAttribute('aria-label', 'Equipped character and item slots');
	stage.append(general, costume);
	const experience = document.createElement('div');
	experience.className = 'equipment-experience';
	experience.innerHTML = ['Base', 'Job'].map(label => `
		<div class="equipment-exp" data-exp="${label.toLowerCase()}">
			<strong data-level></strong><span>EXP</span>
			<div class="equipment-exp-track" role="progressbar" aria-label="${label} experience" aria-valuemin="0" aria-valuemax="100">
				<div data-fill></div><strong data-percent>—</strong>
			</div>
		</div>`).join('');
	stage.append(experience);

	const summary = document.createElement('section');
	summary.className = 'equipment-summary';
	summary.setAttribute('aria-label', 'Character stats');
	summary.innerHTML = `
		<div class="equipment-stat-cards">
			<section><h3>Base Stats</h3><dl>${statRows(base)}</dl></section>
			<section><h3>Battle Stats</h3><dl>${statRows(battle)}</dl></section>
		</div>
		<div class="equipment-points"><strong>Status Points</strong><span>—</span></div>`;

	const main = document.createElement('section');
	main.className = 'equipment-main';
	main.append(tabs, summary, title);
	if (damage) {
		main.append(damage);
	}
	panel.prepend(stage, main);
	panel.append(footer);

	for (const canvas of stage.querySelectorAll('canvas')) {
		canvas.width = 96;
		canvas.height = 144;
		canvas.setAttribute('aria-label', 'Character preview');
	}

	const labels = ['Upper headgear', 'Middle headgear', 'Lower headgear', 'Armor', 'Weapon', 'Shield',
		'Garment', 'Footgear', 'Accessory 1', 'Accessory 2'];
	for (const gear of [general, costume]) {
		for (const [index, cell] of [...gear.querySelectorAll('td.col1, td.col3')].entries()) {
			cell.dataset.slotLabel = labels[index];
			cell.setAttribute('aria-label', labels[index]);
		}
	}

	function setTab(tab) {
		panel.dataset.activeTab = tab;
		summary.hidden = tab === 'title' || tab === 'damageskin';
	}

	function update() {
		const values = WinStats.getEquipmentStats?.();
		if (values) {
			for (const [label, value] of [...values.base, ...values.battle]) {
				summary.querySelector(`[data-stat="${label}"]`).textContent = value;
			}
			summary.querySelector('.equipment-points span').textContent = values.points;
		}
		const entity = Session.Entity;
		for (const [key, name, level, current, next] of [
			['base', 'Base', entity?.clevel, BasicInfo.base_exp, BasicInfo.base_exp_next],
			['job', 'Job', entity?.joblevel, BasicInfo.job_exp, BasicInfo.job_exp_next]
		]) {
			const row = experience.querySelector(`[data-exp="${key}"]`);
			const available = Number.isFinite(current) && current >= 0 && next > 1;
			const percent = available ? Math.min(100, current / next * 100) : 0;
			row.querySelector('[data-level]').textContent = `${name} Lv. ${level ?? '—'}`;
			row.querySelector('[data-fill]').style.width = `${percent}%`;
			row.querySelector('[data-percent]').textContent = available ? `${percent.toFixed(1)}%` : '—';
			const track = row.querySelector('.equipment-exp-track');
			if (available) {
				track.setAttribute('aria-valuenow', percent.toFixed(1));
			} else {
				track.removeAttribute('aria-valuenow');
			}
		}
	}

	setTab('general');
	return { setTab, update };
}
