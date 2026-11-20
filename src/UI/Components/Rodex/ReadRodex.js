/**
 * UI/Components/Rodex/ReadRodex.js
 *
 * Chararacter ReadRodex
 *
 * @author Alisonrag
 *
 */

import DB from 'DB/DBManager.js';
import Preferences from 'Core/Preferences.js';
import Client from 'Core/Client.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './ReadRodex.html?raw&v=popup-headings';
import cssText from './ReadRodex.css?raw&v=popup-headings';
import Rodex from 'UI/Components/Rodex/Rodex.js';

/**
 * Create Component
 */
const ReadRodex = new GUIComponent('ReadRodex', cssText);

ReadRodex.MailID = 0;
ReadRodex.openType = 0;

/**
 * @var {Preferences} structure
 */
const _preferences = Preferences.get(
	'ReadRodex',
	{
		show: false
	},
	1.0
);

/**
 * Helper: query inside shadow root
 */
function _root() {
	return ReadRodex._shadow || ReadRodex._host;
}

/**
 * Render HTML
 */
ReadRodex.render = () => htmlText;

/**
 * Initialize Component
 */
ReadRodex.init = function init() {
	const root = _root();
	root.querySelector('.close').addEventListener('click', onClickClose);
	root.querySelector('.get-content').addEventListener('click', onClickGetItems);
	root.querySelector('.get-zeny').addEventListener('click', onClickGetZeny);
	root.querySelector('.delete').addEventListener('click', onClickDelete);
};

/**
 * Remove Mail from window (and so clean up items)
 */
ReadRodex.onRemove = function OnRemove() {
	_preferences.show = this._host.style.display !== 'none';
	_preferences.save();
};

ReadRodex.initData = function initData(data, mail) {
	const root = _root();

	ReadRodex.MailID = mail.MailID;
	ReadRodex.openType = mail.openType;

	const nameEl = root.querySelector('.name');
	if (nameEl) {
		nameEl.textContent = 'From: ' + (mail.SenderName || 'Unknown sender');
	}
	root.querySelector('.sent-date').textContent = 'Sent: ' + Rodex.formatSentDate(mail);
	const titleEl = root.querySelector('.title-text');
	if (titleEl) {
		titleEl.textContent = mail.title || '(No subject)';
	}
	const contentEl = root.querySelector('.content-text');
	if (contentEl) {
		contentEl.textContent = data.Textcontent;
	}
	const valueEl = root.querySelector('.value');
	if (valueEl) {
		valueEl.textContent = data.zeny > 0 ? prettifyZeny(data.zeny) + ' zeny' : '';
	}

	const content = root.querySelector('.item-list');
	content.innerHTML = '';

	for (let i = 0; i < data.ItemList.length; i++) {
		const item = data.ItemList[i];
		const it = DB.getItemInfo(item.ITID);
		content.insertAdjacentHTML(
			'beforeend',
			`<div class="item" data-index="${i}">` +
				'<div class="icon"></div>' +
				`<div class="amount"><span class="count">${item.count || 1}</span></div>` +
				'</div>'
		);
		Client.loadFile(`${DB.INTERFACE_PATH}item/${it.identifiedResourceName}.bmp`, url => {
			const icon = root.querySelector(`.item[data-index="${i}"] .icon`);
			if (icon && ReadRodex.MailID === mail.MailID) {
				icon.style.backgroundImage = `url(${url})`;
			}
		});
	}

	Rodex.onClaimStateChanged?.(mail.MailID);
	root.querySelector('.message-scroll').scrollTop = 0;

	this._host.style.display = '';
	this.focus();
};

function onClickClose(e) {
	e.stopImmediatePropagation();
	ReadRodex.MailID = 0;
	ReadRodex.openType = 0;
	ReadRodex._host.style.display = 'none';
}

function onClickGetItems(e) {
	e.stopImmediatePropagation();
	const mail = Rodex.getMailByID(ReadRodex.MailID);
	if (mail) {
		Rodex.claimMail(mail, Rodex.MAIL_TYPE_ITEM);
	}
}

function onClickGetZeny(e) {
	e.stopImmediatePropagation();
	const mail = Rodex.getMailByID(ReadRodex.MailID);
	if (mail) {
		Rodex.claimMail(mail, Rodex.MAIL_TYPE_ZENY);
	}
}

function onClickDelete(e) {
	e.stopImmediatePropagation();
	const { openType, MailID } = ReadRodex;
	UIManager.showPromptBox(DB.getMessage(356), 'ok', 'cancel', () => {
		Rodex.requestDeleteRodex(openType, MailID);
	});
}

Rodex.onClaimStateChanged = function onClaimStateChanged(mailID) {
	if (!ReadRodex.__active || String(ReadRodex.MailID) !== String(mailID)) {
		return;
	}
	const mail = Rodex.getMailByID(mailID);
	if (!mail) {
		return;
	}
	const state = Rodex.getClaimState(mail);
	const root = _root();
	for (const [selector, type, label] of [
		['.get-content', Rodex.MAIL_TYPE_ITEM, 'Claim items'],
		['.get-zeny', Rodex.MAIL_TYPE_ZENY, 'Claim zeny']
	]) {
		const button = root.querySelector(selector);
		const pending = Boolean(state.pending & type);
		const remaining = Boolean(state.remaining & type);
		button.hidden = !remaining && !(state.confirmed & type);
		button.disabled = pending || !remaining;
		button.textContent = pending ? 'Claiming…' : remaining ? label : 'Claimed';
	}
	root.querySelector('.delete').disabled = Boolean(state.remaining || state.pending);
};

ReadRodex.clearItemList = function clearItemList() {
	const root = _root();
	const itemList = root.querySelector('.item-list');
	if (itemList) {
		itemList.innerHTML = '';
	}
};

ReadRodex.clearZeny = function clearZeny() {
	const root = _root();
	const valueEl = root.querySelector('.value');
	if (valueEl) {
		valueEl.textContent = '';
	}
};

ReadRodex.close = function close() {
	ReadRodex.MailID = 0;
	ReadRodex.openType = 0;
	if (ReadRodex._host) {
		ReadRodex._host.style.display = 'none';
	}
};

/**
 * Prettify number (15000 -> 15,000)
 *
 * @param {number}
 * @return {string}
 */
function prettifyZeny(value) {
	const num = String(value);
	let i = 0;
	const len = num.length;
	let out = '';

	while (i < len) {
		out = num[len - i - 1] + out;
		if ((i + 1) % 3 === 0 && i + 1 !== len) {
			out = ',' + out;
		}
		++i;
	}

	return out;
}

/**
 * Create component and export it
 */
export default UIManager.addComponent(ReadRodex);
