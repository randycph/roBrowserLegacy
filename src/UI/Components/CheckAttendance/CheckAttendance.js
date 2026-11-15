/**
 * UI/Components/CheckAttendance/CheckAttendance.js
 *
 * Manage interface for Attendance
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import DB from 'DB/DBManager.js';
import Preferences from 'Core/Preferences.js';
import Renderer from 'Renderer/Renderer.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import { setToolbarNotice } from 'UI/ToolbarNotifications.js';
import htmlText from './CheckAttendance.html?raw&v=attendance3';
import cssText from './CheckAttendance.css?raw&v=attendance6';
import 'UI/Elements/Elements.js';

/**
 * Create Component
 */
const CheckAttendance = new GUIComponent('CheckAttendance', cssText);

CheckAttendance.render = () => htmlText;

/**
 * @var {object} _checkAttendanceData
 */
let _checkAttendanceData;
let _attendancePending = false;
let _attendanceMapReady = false;

function currentPeriod() {
	const now = new Date();
	const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	const anchor = Date.UTC(2026, 10, 14);
	const cycle = Math.max(0, Math.floor((today - anchor) / (20 * 86400000)));
	const start = new Date(anchor + cycle * 20 * 86400000);
	const end = new Date(start.getTime() + 19 * 86400000);
	const dateKey = date => date.toISOString().slice(0, 10).replaceAll('-', '');
	return { start, end, today, StartDate: dateKey(start), EndDate: dateKey(end) };
}

/**
 * @var {object} _CheckAttendanceInfo
 */
let _CheckAttendanceInfo;

/**
 * @var {Preferences} structure
 */
const _preferences = Preferences.get(
	'CheckAttendance',
	{
		x: 200,
		y: 200
	},
	1.0
);

/**
 * Initialize the component (event listener, etc.)
 */
CheckAttendance.init = function init() {
	// Match the server's repeating 20-day attendance periods.
	const rewardItems = [
		[501, 10], [601, 5], [502, 5], [602, 2], [503, 5],
		[506, 5], [504, 3], [601, 10], [505, 2], [602, 3],
		[503, 10], [504, 5], [506, 10], [601, 15], [505, 3],
		[504, 8], [602, 5], [610, 1], [505, 5], [608, 1]
	];
	const period = currentPeriod();
	_CheckAttendanceInfo = {
		Config: { StartDate: period.StartDate, EndDate: period.EndDate },
		Rewards: rewardItems.map(([item_id, quantity], index) => ({ day: index + 1, item_id, quantity }))
	};
	const root = this.getRoot();

	const baseEl = root.querySelector('.base');
	if (baseEl) {
		baseEl.addEventListener('mousedown', event => {
			event.stopImmediatePropagation();
			event.preventDefault();
		});
	}

	root.querySelector('.close-container-btn').addEventListener('click', () => {
		CheckAttendance._host.style.display = 'none';
	});

	this.draggable(root.querySelector('.titlebar'));
};

/**
 * Once append to the DOM, start to position the UI
 */
CheckAttendance.onAppend = function onAppend() {
	Object.assign(this._host.style, {
		top: `${Math.min(Math.max(0, _preferences.y), Renderer.height - this._host.getBoundingClientRect().height)}px`,
		left: `${Math.min(Math.max(0, _preferences.x), Renderer.width - this._host.getBoundingClientRect().width)}px`
	});

	this._host.style.display = 'none';
	CheckAttendance.openIfReady();
};

/**
 * Window Shortcuts
 */
CheckAttendance.onShortCut = function onShortCut(key) {
	switch (key.cmd) {
		case 'TOGGLE':
			if (this._host.style.display === 'none') {
				this._host.style.display = '';
				this.focus();
			} else {
				this._host.style.display = 'none';
			}
			break;
	}
};

/**
 * Show/Hide UI
 */
CheckAttendance.toggle = function toggle() {
	if (this._host.style.display !== 'none') {
		this._host.style.display = 'none';
	} else {
		const _pkt = new PACKET.CZ.UI_OPEN();
		_pkt.UIType = 5;
		Network.sendPacket(_pkt);
	}
};

/**
 * Set Data to Attendance
 */
CheckAttendance.setData = function setData(data) {
	_checkAttendanceData = data;
	setToolbarNotice('attendance', data >= 0 && data % 10 === 0 && Math.floor(data / 10) < 20);
	_attendancePending = true;
	CheckAttendance.openIfReady();
};

CheckAttendance.mapLoading = function mapLoading() {
	_attendanceMapReady = false;
	if (this._host) this._host.style.display = 'none';
};

CheckAttendance.mapReady = function mapReady() {
	_attendanceMapReady = true;
	CheckAttendance.openIfReady();
};

CheckAttendance.openIfReady = function openIfReady() {
	if (!_attendancePending || !_attendanceMapReady || !this._host?.isConnected) return;
	_attendancePending = false;
	this.updateUI();
	this._host.style.display = '';
	this.focus();
};

/**
 * Update CheckAttendance UI
 */
CheckAttendance.updateUI = function updateUI() {
	const root = this.getRoot();
	let already_requested = 0;
	let attendance_count = 0;
	let current_day = 1;

	if (_CheckAttendanceInfo.Config) {
		const period = currentPeriod();
		_CheckAttendanceInfo.Config.StartDate = period.StartDate;
		_CheckAttendanceInfo.Config.EndDate = period.EndDate;
		const dateLabel = date => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
		const period_string = `Attendance period: ${dateLabel(period.start)} – ${dateLabel(period.end)} (UTC)`;
		const periodEl = root.querySelector('.top-panel-period');
		if (periodEl) {
			periodEl.textContent = period_string;
		}

		if (_checkAttendanceData >= 0) {
			already_requested = _checkAttendanceData % 10;
			attendance_count = parseInt(_checkAttendanceData / 10);
			current_day = attendance_count + 1;
			const total_days_string =
				attendance_count >= 20 || already_requested
					? `${attendance_count} Day attendance success`
					: `Click the item to claim day ${current_day} reward`;

			const remaining_days = Math.max(0, Math.ceil((period.end.getTime() - period.today) / 86400000));

			const totalDaysEl = root.querySelector('.total-days');
			if (totalDaysEl) {
				totalDaysEl.innerHTML = total_days_string;
			}
			const remainingEl = root.querySelector('.remaining-day-text');
			if (remainingEl) {
				remainingEl.textContent = remaining_days;
			}
		}
	}

	if (_CheckAttendanceInfo.Rewards) {
		const daysList = root.querySelector('.days-list');
		// onAppend runs this on every map change: rebuild the list, don't add 20 more days each time
		if (daysList) {
			daysList.innerHTML = '';
		}
		for (let i = 0; i < 20; i++) {
			const item = DB.getItemInfo(_CheckAttendanceInfo.Rewards[i].item_id);
			const day = i + 1;
			const background =
				!already_requested && day == current_day
					? `data-background="check_attendance/bt_slot_a.bmp" data-down="check_attendance/bt_slot_press.bmp"`
					: '';
			const checked = day <= attendance_count ? 'checked' : 'checked-hidden';
			const slot_off = already_requested ? attendance_count - 1 : attendance_count;
			const slot_complete_string = day > slot_off ? 'bt_slot_complete' : 'bt_slot_off';
			const item_slot =
				`<li id="attendance_day_${i}" class="attendance-item" ${background}>` +
				`<div class="item" data-background="item/${item.identifiedResourceName}.bmp">` +
				`<span class="item-quantity">${_CheckAttendanceInfo.Rewards[i].quantity}</span>` +
				`<span class="name">${item.identifiedDisplayName}</span>` +
				`<div class="${checked}" data-background="check_attendance/${slot_complete_string}.tga"></div>` +
				'</div>' +
				`<div class="day">${day} Day</div>` +
				'</li>';
			if (daysList) {
				daysList.insertAdjacentHTML('beforeend', item_slot);
			}
			if (!already_requested && day == current_day) {
				const dayEl = root.querySelector(`#attendance_day_${i}`);
				if (dayEl) {
					dayEl.addEventListener('click', onClickAttendance);
					dayEl.classList.add('event_add_cursor');
				}
			}
		}

		const dataAttrSelector = '[data-background],[data-hover],[data-down],[data-active],[data-text],[data-preload]';
		if (daysList) {
			daysList.querySelectorAll(dataAttrSelector).forEach(node => {
				GUIComponent.processDataAttrs(node);
			});
		}
	}
};

/**
 * Clean CheckAttendance UI
 */
CheckAttendance.cleanUI = function cleanUI() {
	const root = CheckAttendance.getRoot();
	const periodEl = root.querySelector('.top-panel-period');
	if (periodEl) {
		periodEl.innerHTML = '';
	}
	const daysListEl = root.querySelector('.days-list');
	if (daysListEl) {
		daysListEl.innerHTML = '';
	}
	const totalDaysEl = root.querySelector('.total-days');
	if (totalDaysEl) {
		totalDaysEl.innerHTML = '';
	}
	const remainingEl = root.querySelector('.remaining-day-text');
	if (remainingEl) {
		remainingEl.innerHTML = '';
	}
};

/**
 * Close the window
 */
CheckAttendance.onClose = function onClose() {
	CheckAttendance._host.style.display = 'none';
};

/**
 * Request Attendance Item
 */
function onClickAttendance(e) {
	const root = CheckAttendance.getRoot();
	const el = e.currentTarget;
	const id = el.id;
	// one claim per day: a second click would send the request and advance the count again
	el.removeEventListener('click', onClickAttendance);
	el.classList.remove('event_add_cursor');
	const checkedHidden = root.querySelector(`#${id} .checked-hidden`);
	if (checkedHidden) {
		checkedHidden.className = 'checked';
	}

	const current_day = parseInt(_checkAttendanceData / 10) + 1;
	// keep the claim when updateUI rebuilds the list on a map change; the next server data overwrites it
	_checkAttendanceData = current_day * 10 + 1;
	setToolbarNotice('attendance', false);
	const total_days_string = `${current_day} Day attendance success`;
	const totalDaysEl = root.querySelector('.total-days');
	if (totalDaysEl) {
		totalDaysEl.innerHTML = total_days_string;
	}
	const _pkt = new PACKET.CZ.REQ_CHECK_ATTENDANCE();
	Network.sendPacket(_pkt);
}

/**
 * Export
 */
export default UIManager.addComponent(CheckAttendance);
