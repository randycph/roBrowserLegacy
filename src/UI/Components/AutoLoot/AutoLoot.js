import Session from 'Engine/SessionStorage.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import GUIComponent from 'UI/GUIComponent.js';
import UIManager from 'UI/UIManager.js';
import Renderer from 'Renderer/Renderer.js';
import htmlText from './AutoLoot.html?raw&v=classic2';
import cssText from './AutoLoot.css?raw&v=classic2';

const AutoLoot = new GUIComponent('AutoLoot', cssText);
AutoLoot.render = () => htmlText;
AutoLoot.captureKeyEvents = true;

let accountId = null;
let enabled = false;
let position = { x: 220, y: 170 };

function storageKey() {
	return `ragnarokforever.autoloot.${Session.AID}`;
}

function sendSetting(value) {
	if (!Session.Entity || typeof ChatBox.onRequestTalk !== 'function') return;
	ChatBox.onRequestTalk('', `@autoloot ${value ? 100 : 0}`, ChatBox.TYPE.PUBLIC);
}

AutoLoot.init = function init() {
	const root = this.getRoot();
	root.querySelector('.close').addEventListener('click', () => { this._host.style.display = 'none'; });
	root.querySelector('.autoloot-toggle').addEventListener('change', event => {
		AutoLoot.setEnabled(event.target.checked);
	});
	this.draggable('.titlebar');
};

AutoLoot.onAppend = function onAppend() {
	this._host.style.left = Math.max(0, Math.min(position.x, Renderer.width - 280)) + 'px';
	this._host.style.top = Math.max(0, Math.min(position.y, Renderer.height - 99)) + 'px';
	this._host.style.display = 'none';
	if (accountId !== Session.AID) {
		accountId = Session.AID;
		try { enabled = localStorage.getItem(storageKey()) === '1'; } catch (_error) { enabled = false; }
	}
	this.getRoot().querySelector('.autoloot-toggle').checked = enabled;
};

AutoLoot.getEnabled = function getEnabled() { return enabled; };
AutoLoot.setEnabled = function setEnabled(value) {
 enabled = Boolean(value);
 try { localStorage.setItem(storageKey(), enabled ? '1' : '0'); } catch (_error) { /* Storage is optional. */ }
 if (this._host) this.getRoot().querySelector('.autoloot-toggle').checked = enabled;
 sendSetting(enabled);
};

AutoLoot.restore = function restore() {
	if (enabled) sendSetting(true);
};

AutoLoot.toggle = function toggle() {
	if (this._host.style.display === 'none') {
		this._host.style.display = '';
		this.focus();
	} else {
		this._host.style.display = 'none';
	}
};

AutoLoot.onRemove = function onRemove() {
	position = { x: parseInt(this._host.style.left, 10) || 220, y: parseInt(this._host.style.top, 10) || 170 };
};

export default UIManager.addComponent(AutoLoot);
