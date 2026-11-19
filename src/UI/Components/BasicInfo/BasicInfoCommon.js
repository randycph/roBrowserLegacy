/**
 * UI/Components/BasicInfo/BasicInfoCommon.js
 *
 * Shared factory for the Character Basic Information windows.
 *
 * Collapses the near-identical BasicInfo version siblings into a single
 * createBasicInfo(config) factory. Each version file passes its own
 * htmlText/cssText plus capability flags describing its real differences.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import { syncToolbarNotices } from 'UI/ToolbarNotifications.js';
import DB from 'DB/DBManager.js';
import Configs from 'Core/Configs.js';
import PACKETVER from 'Network/PacketVerManager.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import MonsterTable from 'DB/Monsters/MonsterTable.js';
import Client from 'Core/Client.js';
import Preferences from 'Core/Preferences.js';
import Renderer from 'Renderer/Renderer.js';
import Camera from 'Renderer/Camera.js';
import SpriteRenderer from 'Renderer/SpriteRenderer.js';
import Session from 'Engine/SessionStorage.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import Equipment from 'UI/Components/Equipment/Equipment.js';
import PartyFriends from 'UI/Components/PartyFriends/PartyFriends.js';
import Guild from 'UI/Components/Guild/Guild.js';
import Bank from 'UI/Components/Bank/Bank.js';
import Escape from 'UI/Components/Escape/Escape.js';
import WorldMap from 'UI/Components/WorldMap/WorldMap.js';
import CheckAttendance from 'UI/Components/CheckAttendance/CheckAttendance.js';
import ChatRoomCreate from 'UI/Components/ChatRoomCreate/ChatRoomCreate.js';
import Rodex from 'UI/Components/Rodex/Rodex.js';
import WinStats from 'UI/Components/WinStats/WinStats.js';
import Navigation from 'UI/Components/Navigation/Navigation.js';
import SkillList from 'UI/Components/SkillList/SkillList.js';
import Quest from 'UI/Components/Quest/Quest.js';
import Achievement from 'UI/Components/Achievement/Achievement.js';
import Reputation from 'UI/Components/Reputation/Reputation.js';
import AutoLoot from 'UI/Components/AutoLoot/AutoLoot.js';
import AutoCombat from 'UI/Components/AutoCombat/AutoCombat.js';
import mobileExperienceCss from './MobileExperience.css?raw&v=desktophud20261118';
import mobileMenuCss from './MobileMenu.css?raw&v=seaglass20261119';
import mobileProfileCss from './MobileProfile.css?raw&v=desktophud20261118';
import CashShopIcon from 'UI/Components/CashShopIcon/CashShopIcon.js';

export function createBasicInfo(config) {
	let mobileExperience = null;
	let mobileMenu = null;
	let mobileProfile = null;
	let lastPortraitDraw = 0;
	const portraitAnimation = { tick: 0, frame: 0, repeat: true, play: true, next: false, delay: 0, save: false };
	const portraitCanvas = document.createElement('canvas');
	portraitCanvas.width = 180;
	portraitCanvas.height = 180;
	const portraitContext = portraitCanvas.getContext('2d', { willReadFrequently: true });

	function drawMobilePortrait() {
		if (!mobileProfile || !Session.Entity?.effectColor || !Session.Entity?.ACTION || !portraitContext) {
			return;
		}
		if (Date.now() - lastPortraitDraw < 1000) {
			return;
		}
		lastPortraitDraw = Date.now();
		const character = Session.Entity;
		const saved = {
			camera: Camera.direction,
			direction: character.direction,
			headDir: character.headDir,
			action: character.action,
			animation: character.animation,
			color: new Float32Array(character.effectColor),
			spriteRender: SpriteRenderer.render,
			spriteXSize: SpriteRenderer.xSize,
			spriteYSize: SpriteRenderer.ySize,
			spriteShadow: SpriteRenderer.shadow,
			spriteZIndex: SpriteRenderer.zIndex
		};
		try {
			Camera.direction = 4;
			character.direction = 4;
			character.headDir = 0;
			character.action = character.ACTION.IDLE;
			character.animation = portraitAnimation;
			character.effectColor.set([1, 1, 1, 1]);
			portraitContext.clearRect(0, 0, 180, 180);
			SpriteRenderer.bind2DContext(portraitContext, 90, 150);
			character.renderEntity();
			const pixels = portraitContext.getImageData(0, 0, 180, 180).data;
			let left = 180, right = -1, top = 180, bottom = -1;
			for (let y = 0; y < 180; y++) {
				for (let x = 0; x < 180; x++) {
					if (pixels[(y * 180 + x) * 4 + 3] > 16) {
						left = Math.min(left, x);
						right = Math.max(right, x);
						top = Math.min(top, y);
						bottom = Math.max(bottom, y);
					}
				}
			}
			if (right >= left && bottom >= top) {
				const side = Math.min(180, Math.max(right - left + 1, Math.round((bottom - top + 1) * 0.6), 32));
				const sx = Math.max(0, Math.min(180 - side, Math.round((left + right - side) / 2)));
				const sy = Math.max(0, Math.min(180 - side, top));
				const canvas = mobileProfile.querySelector('canvas');
				const ctx = canvas.getContext('2d');
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.imageSmoothingEnabled = false;
				ctx.drawImage(portraitCanvas, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
			}
		} catch (error) {
			console.warn('Mobile profile portrait could not be drawn.', error);
		} finally {
			Camera.direction = saved.camera;
			character.direction = saved.direction;
			character.headDir = saved.headDir;
			character.action = saved.action;
			character.animation = saved.animation;
			character.effectColor.set(saved.color);
			SpriteRenderer.render = saved.spriteRender;
			SpriteRenderer.xSize = saved.spriteXSize;
			SpriteRenderer.ySize = saved.spriteYSize;
			SpriteRenderer.shadow = saved.spriteShadow;
			SpriteRenderer.zIndex = saved.spriteZIndex;
		}
	}

	function updateMobileGauge(type, value, maximum) {
		const gauge = mobileProfile?.querySelector(`[data-gauge="${type}"]`);
		if (!gauge) return;
		const valid = Number.isFinite(value) && Number.isFinite(maximum) && maximum > 0;
		const percent = valid ? Math.max(0, Math.min(100, (value / maximum) * 100)) : 0;
		gauge.querySelector('.mobile-profile-fill').style.width = `${percent}%`;
		gauge.querySelector('.mobile-profile-values').textContent = valid ? `${value} / ${maximum}` : '— / —';
	}
	const {
		name,
		htmlText,
		cssText,
		prefKey,
		reduceDefault = true,
		innerId,
		topbarItemSelector = '.topbar button',
		topbarDblClick = false,
		toggleButtonsEvent = 'mousedown',
		buttonsSelector = '.buttons button',
		buttonsEvent = 'mousedown',
		buttonKeyBy = 'class',
		infoOpensWinStats = true,
		hasToolbarToggle = false,
		miniLayout = false,
		hideIds = [],
		barScale = 1.27,
		hasApBar = false
	} = config;

	const Component = new GUIComponent(name, cssText);

	/**
	 * Stored data
	 */
	Component.base_exp = 0;
	Component.base_exp_next = 1;
	Component.job_exp = 0;
	Component.job_exp_next = -1;
	Component.weight = 0;
	Component.weight_max = 1;

	Component.render = () => htmlText;

	/**
	 * @let {Preferences} structure
	 */
	const _preferences = Preferences.get(
		prefKey,
		{
			x: 0,
			y: 0,
			reduce: reduceDefault,
			buttons: true,
			magnet_top: true,
			magnet_bottom: false,
			magnet_left: true,
			magnet_right: false
		},
		1.0
	);

	/**
	 * Dispatch a top-level shortcut button to its window.
	 *
	 * @param {string} key button identifier
	 */
	function dispatchButton(key) {
		switch (key) {
			case 'item':
				Inventory.toggle();
				break;
			case 'info':
				(infoOpensWinStats ? WinStats : Equipment).toggle();
				break;
			case 'equip':
				Equipment.toggle();
				break;
			case 'skill':
				SkillList.toggle();
				break;
			case 'option':
				Escape.ui.toggle();
				break;
			case 'party':
				PartyFriends.toggle();
				break;
			case 'guild':
				Guild.toggle();
				break;
			case 'chat':
				ChatRoomCreate.toggle();
				break;
			case 'map':
				WorldMap.toggle();
				break;
			case 'bank':
				Bank.toggle();
				break;
			case 'quest':
				Quest.toggle();
				break;
			case 'mail':
				Rodex.toggle();
				break;
			case 'navigation':
				Navigation.toggle();
				break;
			case 'attendance':
				if (Configs.get('enableCheckAttendance') && PACKETVER.value >= 20180307) {
					CheckAttendance.toggle();
				}
				break;
			case 'fieldshop': {
				const packet = new PACKET.CZ.REQUEST_CHAT();
				packet.msg = Session.Entity.display.name + ' : @fieldshop';
				Network.sendPacket(packet);
				break;
			}
			case 'cashshop':
				CashShopIcon.getRoot()?.querySelector('.cashshop-icon')?.click();
				break;
			case 'hotkeys':
				document.getElementById('MobileUI')?.shadowRoot?.querySelector('#f12Button')?.click();
				break;
			case 'autocombat':
				AutoCombat.toggle();
				break;
			case 'autoloot':
				AutoLoot.toggle();
				break;
			case 'achievment':
				if (Configs.get('enableAchievements') && PACKETVER.value >= 20150513) {
					Achievement.toggle();
				}
				break;
			case 'repute':
				Reputation.toggle();
				break;
		}
	}

	/**
	 * Apply the button-panel visibility for the toolbar layout (btn_open/btn_close).
	 */
	function applyToolbarButtons(root) {
		const buttons = root.querySelector('.buttons');
		const btnOpen = root.querySelector('.btn_open');
		const btnClose = root.querySelector('.btn_close');

		if (_preferences.buttons) {
			if (buttons) buttons.style.display = '';
			if (btnOpen) btnOpen.style.display = 'none';
			if (btnClose) btnClose.style.display = '';
		} else {
			if (buttons) buttons.style.display = 'none';
			if (btnOpen) btnOpen.style.display = '';
			if (btnClose) btnClose.style.display = 'none';
		}
	}

	/**
	 * Swap the `.toggle_btns` background between the view-on / view-off images.
	 */
	function loadViewToggleImage(root) {
		const type = _preferences.buttons ? 'off' : 'on';
		Client.loadFile(`${DB.INTERFACE_PATH}basic_interface/view${type}.bmp`, url => {
			const toggleBtn = root.querySelector('.toggle_btns');
			if (toggleBtn) {
				toggleBtn.style.backgroundImage = `url(${url})`;
			}
		});
	}

	/**
	 * Initialize UI
	 */
	Component.init = function init() {
		const root = this.getRoot();

		root.querySelectorAll(topbarItemSelector).forEach(el => {
			el.addEventListener('mousedown', e => e.stopImmediatePropagation());
		});

		if (topbarDblClick) {
			const topbar = root.querySelector('.topbar');
			if (topbar) {
				topbar.addEventListener('dblclick', () => Component.toggleMode());
			}
		}

		const rightBtn = root.querySelector('.topbar .right');
		if (rightBtn) {
			rightBtn.addEventListener('click', () => Component.toggleMode());
		}

		root.querySelectorAll('.toggle_btns').forEach(btn => {
			btn.addEventListener(toggleButtonsEvent, e => Component.toggleButtons(e));
		});

		root.querySelectorAll(buttonsSelector).forEach(el => {
			el.addEventListener(buttonsEvent, () => {
				const key = buttonKeyBy === 'id' ? el.id : el.className.split(' ')[0];
				dispatchButton(key);
			});
			if ((el.id === 'autoloot' || el.id === 'autocombat') && el.tagName !== 'BUTTON') {
				el.addEventListener('keydown', event => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						dispatchButton(el.id);
					}
				});
			}
		});

		this.draggable();
	};

	/**
	 * When append the element to html
	 * Execute elements in memory
	 */
	Component.onAppend = function onAppend() {
		const root = this.getRoot();
		mobileProfile = document.createElement('div');
		mobileProfile.className = 'mobile-profile';
		mobileProfile.innerHTML = `
			<style>${mobileProfileCss}</style>
			<div class="mobile-profile-avatar"><canvas width="96" height="96" aria-label="Character portrait"></canvas></div>
			<div class="mobile-profile-details">
				<div class="mobile-profile-name" data-profile-name></div>
				<div class="mobile-profile-meta">Lv.<span data-profile-level>—</span> <span data-profile-job></span></div>
				<div class="mobile-profile-gauge" data-gauge="hp"><span class="mobile-profile-label">HP</span><div class="mobile-profile-meter"><div class="mobile-profile-fill"></div><span class="mobile-profile-values">— / —</span></div></div>
				<div class="mobile-profile-gauge" data-gauge="sp"><span class="mobile-profile-label">SP</span><div class="mobile-profile-meter"><div class="mobile-profile-fill"></div><span class="mobile-profile-values">— / —</span></div></div>
				<div class="mobile-profile-zeny"><span class="mobile-profile-coin" aria-hidden="true">Z</span> Zeny <span data-profile-zeny>—</span></div>
			</div>`;
		document.body.appendChild(mobileProfile);
		mobileProfile.querySelector('[data-profile-name]').textContent = Session.Entity?.display?.name || '';
		mobileProfile.querySelector('[data-profile-level]').textContent = Session.Entity?.clevel ?? '—';
		mobileProfile.querySelector('[data-profile-job]').textContent = MonsterTable[Session.Entity?.job] || '';
		const currentZeny = Session.zeny ?? Session.Entity?.money;
		mobileProfile.querySelector('[data-profile-zeny]').textContent = Number.isFinite(currentZeny) ? currentZeny.toLocaleString('en-US') : '—';
		updateMobileGauge('hp', Session.Entity?.life?.hp, Session.Entity?.life?.hp_max);
		updateMobileGauge('sp', Session.Entity?.life?.sp, Session.Entity?.life?.sp_max);
		Renderer.render(drawMobilePortrait);
		const menuEntries = [
			{ key: 'info', label: 'Stats', icon: 'stats', enabled: true },
			{ key: 'item', label: 'Inventory', icon: 'inventory', enabled: true },
			{ key: 'skill', label: 'Skills', icon: 'skills', enabled: true },
			{ key: 'fieldshop', label: 'Mini Store', icon: 'mini-store', enabled: true },
			{ key: 'option', label: 'Options', icon: 'options', enabled: true },
			{ key: 'attendance', label: 'Attendance', icon: 'attendance', enabled: Configs.get('enableCheckAttendance') && PACKETVER.value >= 20180307 },
			{ key: 'cashshop', label: 'Shop', icon: 'shop', enabled: Configs.get('enableCashShop') },
			{ key: 'mail', label: 'Mail', icon: 'mail', enabled: true },
			{ key: 'equip', label: 'Equip', icon: 'equip', enabled: true },
			{ key: 'skill', label: 'Skill Tree', icon: 'skill-tree', enabled: true },
			{ key: 'party', label: 'Party', icon: 'party', enabled: true },
			{ key: 'guild', label: 'Guild', icon: 'guild', enabled: true },
			{ key: 'map', label: 'World Map', icon: 'world-map', enabled: true },
			{ key: 'navigation', label: 'Navigation', icon: 'navigation', enabled: true },
			{ key: 'quest', label: 'Quest', icon: null, enabled: true },
			{ key: 'bank', label: 'Bank', icon: null, enabled: true },
			{ key: 'achievment', label: 'Achievement', icon: null, enabled: Configs.get('enableAchievements') && PACKETVER.value >= 20150513 },
			{ key: 'autoloot', label: 'Auto Loot', icon: null, enabled: true },
			{ key: 'autocombat', label: 'Auto Combat', icon: null, enabled: true },
			{ key: 'hotkeys', label: 'Hotkeys', icon: 'skills', enabled: true }
		];
		const renderMenuButton = (entry, top = false) => `
			<button type="button" class="mobile-menu-button" data-action="${entry.key}"
				${entry.enabled ? '' : 'disabled title="Currently unavailable"'}>
				${entry.icon ? `<img src="/src/UI/Components/BasicInfo/mobile-icons/${top ? 'top/' : ''}${entry.icon}.png" alt="" />` : ''}
				<span>${entry.label}</span>
			</button>`;
		mobileMenu = document.createElement('div');
		mobileMenu.className = 'mobile-menu';
		for (const type of ['mousedown', 'mouseup']) {
			mobileMenu.addEventListener(type, event => {
				if (event.target.closest('button')) event.stopPropagation();
			});
		}
		mobileMenu.innerHTML = `
			<style>${mobileMenuCss}</style>
			<div class="mobile-menu-top">${menuEntries.slice(0, 5).map(entry => renderMenuButton(entry, true)).join('')}</div>
			<div class="mobile-menu-panel" id="mobile-menu-panel" hidden>${menuEntries.slice(5).map(entry => renderMenuButton(entry)).join('')}</div>
			<button type="button" class="mobile-menu-toggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="mobile-menu-panel">‹</button>`;
		mobileMenu.querySelectorAll('[data-action]').forEach(button => {
			if (!button.querySelector('img')) {
				const originalIcon = root.querySelector(`#${button.dataset.action} svg`);
				if (originalIcon) {
					button.prepend(originalIcon.cloneNode(true));
				}
			}
			button.addEventListener('click', event => {
				event.stopPropagation();
				dispatchButton(button.dataset.action);
			});
		});
		mobileMenu.querySelector('.mobile-menu-toggle').addEventListener('click', event => {
			const panel = mobileMenu.querySelector('.mobile-menu-panel');
			panel.hidden = !panel.hidden;
			event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
			event.currentTarget.textContent = panel.hidden ? '‹' : '›';
		});
		document.body.appendChild(mobileMenu);
		mobileExperience = document.createElement('div');
		mobileExperience.className = 'mobile-experience';
		mobileExperience.innerHTML = `
			<style>${mobileExperienceCss}</style>
			<div class="mobile-experience-track" data-type="bexp" aria-label="Base experience">
				<div class="mobile-experience-fill mobile-experience-base"></div>
				<span class="mobile-experience-level">Base Lv. <span data-level="blvl">—</span></span>
				<span class="mobile-experience-percent">—</span>
			</div>
			<div class="mobile-experience-track" data-type="jexp" aria-label="Job experience">
				<div class="mobile-experience-fill mobile-experience-job"></div>
				<span class="mobile-experience-level">Job Lv. <span data-level="jlvl">—</span></span>
				<span class="mobile-experience-percent">—</span>
			</div>`;
		document.body.appendChild(mobileExperience);
		mobileExperience.querySelector('[data-level="blvl"]').textContent = Session.Entity?.clevel ?? '—';
		mobileExperience.querySelector('[data-level="jlvl"]').textContent = Session.Entity?.joblevel ?? '—';
		syncToolbarNotices(root);
		const hostRect = this._host.getBoundingClientRect();
		root.querySelector('.status-dot')?.classList.toggle('visible', (Session.availableStatusPoints || 0) > 0);

		this._host.style.top = `${Math.min(Math.max(0, _preferences.y), Renderer.height - hostRect.height)}px`;
		this._host.style.left = `${Math.min(Math.max(0, _preferences.x), Renderer.width - hostRect.width)}px`;

		this.magnet.TOP = _preferences.magnet_top;
		this.magnet.BOTTOM = _preferences.magnet_bottom;
		this.magnet.LEFT = _preferences.magnet_left;
		this.magnet.RIGHT = _preferences.magnet_right;

		const inner = root.querySelector(innerId);
		if (inner) {
			inner.classList.remove('small', 'large');
			inner.classList.add(_preferences.reduce ? 'small' : 'large');
		}

		if (hasToolbarToggle) {
			applyToolbarButtons(root);
		} else if (inner) {
			const buttons = root.querySelector('.buttons');
			if (_preferences.reduce) {
				if (miniLayout) {
					if (buttons) buttons.style.display = 'none';
					const bgAttr = inner.dataset.miniBackground;
					if (bgAttr) {
						Client.loadFile(DB.INTERFACE_PATH + bgAttr, url => {
							inner.style.backgroundImage = `url(${url})`;
						});
					}
				} else if (buttons) {
					buttons.style.display = _preferences.buttons ? '' : 'none';
				}
			} else if (miniLayout && buttons) {
				buttons.style.display = '';
			}
		}

		hideIds.forEach(id => {
			const el = root.querySelector(`#${id}`);
			if (el) {
				el.style.display = 'none';
			}
		});
	};

	/**
	 * Once remove, save preferences
	 */
	Component.onRemove = function onRemove() {
		Renderer.stop(drawMobilePortrait);
		mobileProfile?.remove();
		mobileProfile = null;
		mobileMenu?.remove();
		mobileMenu = null;
		mobileExperience?.remove();
		mobileExperience = null;
		const root = this.getRoot();
		const inner = root.querySelector(innerId);
		const buttons = root.querySelector('.buttons');

		_preferences.x = parseInt(this._host.style.left, 10);
		_preferences.y = parseInt(this._host.style.top, 10);
		_preferences.reduce = inner ? inner.classList.contains('small') : _preferences.reduce;
		_preferences.buttons = buttons ? buttons.style.display !== 'none' : _preferences.buttons;
		_preferences.magnet_top = this.magnet.TOP;
		_preferences.magnet_bottom = this.magnet.BOTTOM;
		_preferences.magnet_left = this.magnet.LEFT;
		_preferences.magnet_right = this.magnet.RIGHT;
		_preferences.save();
	};

	/**
	 * Process shortcut
	 *
	 * @param {object} key
	 */
	Component.onShortCut = function onShortCut(key) {
		switch (key.cmd) {
			case 'EXTEND':
				this.toggleMode();
				break;
		}
	};

	/**
	 * Switch window size
	 */
	Component.toggleMode = function toggleMode() {
		const root = this.getRoot();
		const inner = root.querySelector(innerId);
		if (!inner) {
			return;
		}

		inner.classList.toggle('small');
		inner.classList.toggle('large');

		if (hasToolbarToggle) {
			applyToolbarButtons(root);
			return;
		}

		const buttons = root.querySelector('.buttons');

		if (inner.classList.contains('large')) {
			if (buttons) {
				buttons.style.display = '';
			}
			if (miniLayout) {
				const bgAttr = inner.dataset.background;
				if (bgAttr) {
					Client.loadFile(DB.INTERFACE_PATH + bgAttr, url => {
						inner.style.backgroundImage = `url(${url})`;
					});
				}
			}
			return;
		}

		if (miniLayout) {
			const bgAttr = inner.dataset.miniBackground;
			if (bgAttr) {
				Client.loadFile(DB.INTERFACE_PATH + bgAttr, url => {
					inner.style.backgroundImage = `url(${url})`;
				});
			}
			if (buttons) {
				buttons.style.display = 'none';
			}
		} else {
			if (buttons) {
				buttons.style.display = _preferences.buttons ? '' : 'none';
			}
			loadViewToggleImage(root);
		}
	};

	/**
	 * Toggle the list of buttons
	 */
	Component.toggleButtons = function toggleButtons(event) {
		const root = this.getRoot();
		const buttons = root.querySelector('.buttons');
		if (!buttons) {
			return;
		}

		_preferences.buttons = buttons.style.display === 'none';

		if (hasToolbarToggle) {
			applyToolbarButtons(root);
		} else {
			buttons.style.display = _preferences.buttons ? '' : 'none';
			loadViewToggleImage(root);
		}

		event.stopImmediatePropagation();
	};

	/**
	 * Update a gauge bar (hp / sp / ap) and its numeric readouts
	 *
	 * @param {string} type gauge identifier
	 * @param {number} val1 current value
	 * @param {number} val2 maximum value
	 * @param {string} color bar color prefix
	 */
	function updateBar(root, type, val1, val2, color) {
		const perc = Math.floor((val1 * 100) / val2);

		root.querySelectorAll(`.${type}_value`).forEach(el => {
			el.textContent = val1;
		});
		root.querySelectorAll(`.${type}_max_value`).forEach(el => {
			el.textContent = val2;
		});
		root.querySelectorAll(`.${type}_perc`).forEach(el => {
			el.textContent = `${perc}%`;
		});

		if (perc <= 0) {
			root.querySelectorAll(`.${type}_bar div`).forEach(el => {
				el.style.backgroundImage = 'none';
			});
			return;
		}

		Client.loadFile(`${DB.INTERFACE_PATH}basic_interface/gze${color}_left.bmp`, url => {
			const el = root.querySelector(`.${type}_bar_left`);
			if (el) {
				el.style.backgroundImage = `url(${url})`;
			}
		});

		Client.loadFile(`${DB.INTERFACE_PATH}basic_interface/gze${color}_mid.bmp`, url => {
			const el = root.querySelector(`.${type}_bar_middle`);
			if (el) {
				el.style.backgroundImage = `url(${url})`;
				el.style.width = `${Math.floor(Math.min(perc, 100) * barScale)}px`;
			}
		});

		Client.loadFile(`${DB.INTERFACE_PATH}basic_interface/gze${color}_right.bmp`, url => {
			const el = root.querySelector(`.${type}_bar_right`);
			if (el) {
				el.style.backgroundImage = `url(${url})`;
				el.style.left = `${Math.floor(Math.min(perc, 100) * barScale)}px`;
			}
		});
	}

	/**
	 * Update UI elements
	 *
	 * @param {string} type identifier
	 * @param {number} val1
	 * @param {number} val2 (optional)
	 */
	Component.update = function update(type, val1, val2) {
		const root = this.getRoot();
		if (!root) {
			return;
		}

		switch (type) {
			case 'name':
			case 'blvl':
			case 'jlvl':
				if (type === 'name' && mobileProfile) {
					mobileProfile.querySelector('[data-profile-name]').textContent = val1;
				}
				if (type === 'blvl' && mobileProfile) {
					mobileProfile.querySelector('[data-profile-level]').textContent = val1;
				}
				if (type === 'blvl' || type === 'jlvl') {
					const level = mobileExperience?.querySelector(`[data-level="${type}"]`);
					if (level) {
						level.textContent = val1;
					}
				}
				root.querySelectorAll(`.${type}_value`).forEach(el => {
					el.textContent = val1;
				});
				break;

			case 'zeny': {
				const zeny = val1 || 0;
				Session.zeny = zeny;
				const list = zeny.toString().split('');
				const count = list.length;
				let str = '';
				for (let i = 0; i < count; i++) {
					str = list[count - i - 1] + (i && i % 3 === 0 ? ',' : '') + str;
				}
				if (mobileProfile) {
					mobileProfile.querySelector('[data-profile-zeny]').textContent = str;
				}
				root.querySelectorAll(`.${type}_value`).forEach(el => {
					el.textContent = str;
				});
				break;
			}
			case 'job':
				if (mobileProfile) {
					mobileProfile.querySelector('[data-profile-job]').textContent = MonsterTable[val1] || '';
				}
				root.querySelectorAll('.job_value').forEach(el => {
					el.textContent = MonsterTable[val1];
				});
				break;

			case 'bexp':
			case 'jexp': {
				const mobileTrack = mobileExperience?.querySelector(`[data-type="${type}"]`);
				if (mobileTrack) {
					const valid = Number.isFinite(val1) && Number.isFinite(val2) && val2 >= 0;
					const maxed = valid && (val2 === 0 || val1 >= val2);
					const percent = maxed ? 100 : valid ? Math.max(0, (val1 / val2) * 100) : 0;
					const label = maxed ? 'MAX' : valid ? `Exp. ${(Math.floor(percent * 10) / 10).toFixed(1)}%` : '—';
					mobileTrack.querySelector('.mobile-experience-percent').textContent = label;
					mobileTrack.querySelector('.mobile-experience-fill').style.width = `${percent}%`;
					mobileTrack.title = valid ? label : 'Experience unavailable';
				}
				const expEl = root.querySelector(`.${type}`);
				if (!val2) {
					if (expEl) {
						expEl.style.display = 'none';
					}
					break;
				}
				if (expEl) {
					expEl.style.display = '';
					const bar = expEl.querySelector('div');
					if (bar) {
						bar.style.width = `${Math.min(100, Math.floor((val1 * 100) / val2))}%`;
					}
					expEl.title = `${((val1 / val2) * 100).toFixed(1)}%`;
				}
				root.querySelectorAll(`.${type}_value`).forEach(el => {
					el.textContent = `${Math.min(100, (Math.floor((val1 * 1000) / val2) * 0.1).toFixed(1))}%`;
				});
				break;
			}

			case 'weight':
				root.querySelectorAll('.weight_value').forEach(el => {
					el.textContent = (val1 / 10) | 0;
				});
				root.querySelectorAll('.weight_total').forEach(el => {
					el.textContent = (val2 / 10) | 0;
				});
				root.querySelectorAll('.weight').forEach(el => {
					el.style.color = val1 < val2 / 2 ? '' : 'red';
					el.title = `${((val1 / val2) * 100).toFixed(1)}%`;
				});
				break;

			case 'hp':
			case 'sp': {
				updateMobileGauge(type, val1, val2);
				const perc = Math.floor((val1 * 100) / val2);
				updateBar(root, type, val1, val2, perc < 25 ? 'red' : 'blue');
				break;
			}
			case 'ap': {
				if (!hasApBar) {
					break;
				}
				const perc = Math.floor((val1 * 100) / val2);
				updateBar(root, type, val1, val2, perc === 100 ? 'red' : 'blue');
				break;
			}
		}
	};

	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(Component);
}
