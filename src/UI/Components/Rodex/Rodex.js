/**
 * RodEx mailbox and client-side attachment status.
 */
import DB from 'DB/DBManager.js';
import Configs from 'Core/Configs.js';
import Preferences from 'Core/Preferences.js';
import Session from 'Engine/SessionStorage.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './Rodex.html?raw&v=mailpanel20261119';
import cssText from './Rodex.css?raw&v=mailpanel20261119';

const MAIL_TYPE_ZENY = 0x2;
const MAIL_TYPE_ITEM = 0x4;
const MAIL_ATTACHMENT_MASK = MAIL_TYPE_ZENY | MAIL_TYPE_ITEM;
const SECONDS_PER_DAY = 86400;
const pendingClaims = new Map();
const claims = Preferences.get('RodexClaims', { confirmed: {} }, 1);
const sentDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const Rodex = new GUIComponent('Rodex', cssText);
Rodex.list = [];
Rodex.pageSize = 6;
Rodex.page = 0;
Rodex.openType = 0;
Rodex.render = () => htmlText;
Rodex.captureKeyEvents = true;
Rodex.MAIL_TYPE_ITEM = MAIL_TYPE_ITEM;
Rodex.MAIL_TYPE_ZENY = MAIL_TYPE_ZENY;
let activeSearch = null;

function claimKey(mailID) {
	return `${Session.AID}:${mailID}`;
}

function renderPage() {
	if (Rodex.__active) {
		Rodex.createRodexList();
	}
}

function getVisibleMail() {
	if (activeSearch) {
		const { field, term } = activeSearch;
		return Rodex.list.filter(mail => String(mail[field] ?? '').toLowerCase().includes(term));
	}

	return Rodex.list.filter(mail => Number(mail.openType ?? 0) === Rodex.openType);
}

function setFolder(folder) {
	const root = Rodex.getRoot();
	for (const tab of root.querySelectorAll('.nav-item')) {
		tab.setAttribute('aria-pressed', String(Number(tab.dataset.tab) === folder));
	}
}

function showWindow() {
	Rodex._host.style.display = '';
	Rodex.focus();
}

Rodex.init = function init() {
	const root = this.getRoot();
	root.querySelector('.close').addEventListener('click', () => this.toggle());
	root.querySelector('.refresh').addEventListener('click', () => this.requestRefreshRodexPage(this.openType));
	root.querySelector('.write').addEventListener('click', () => this.requestOpenWriteRodex());
	root.querySelector('.delete-all').addEventListener('click', () => {
		UIManager.showPromptBox(DB.getMessage(3590), 'ok', 'cancel', () => this.deleteAll());
	});
	root.querySelector('.retrieve-all').addEventListener('click', () => {
		UIManager.showPromptBox(DB.getMessage(3594), 'ok', 'cancel', () => this.getAll());
	});
	root.querySelector('.previous-page').addEventListener('click', () => {
		this.page--;
		this.createRodexList(true);
	});
	root.querySelector('.next-page').addEventListener('click', () => {
		this.page++;
		this.createRodexList(true);
	});
	for (const tab of root.querySelectorAll('.nav-item')) {
		tab.addEventListener('click', () => {
			this.openType = Number(tab.dataset.tab);
			this.page = 0;
			activeSearch = null;
			root.querySelector('.search').value = '';
			setFolder(this.openType);
			this.createRodexList(true);
			if (this.serverFolder !== null && this.serverFolder !== this.openType) {
				this.requestRefreshRodexPage(this.openType);
			}
		});
	}
	root.querySelector('.searchbar').addEventListener('submit', event => {
		event.preventDefault();
		const term = root.querySelector('.search').value.trim().toLowerCase();
		const field = root.querySelector('.search-field').value === '1' ? 'title' : 'SenderName';
		activeSearch = term ? { field, term } : null;
		setFolder(activeSearch ? null : this.openType);
		this.page = 0;
		this.createRodexList(true);
	});
};

Rodex.onAppend = function onAppend() {
	const root = this.getRoot();
	root.querySelector('.search').value = '';
	root.querySelector('.search-field').value = '1';
	this.openType = 0;
	this.serverFolder = null;
	this.page = 0;
	activeSearch = null;
	setFolder(this.openType);
	this.createRodexList(true);
};

Rodex.onRemove = function onRemove() {
	this.list = [];
	for (const timer of pendingClaims.values()) {
		window.clearTimeout(timer);
	}
	pendingClaims.clear();
};

Rodex.initData = function initData(packet) {
	this.serverFolder = packet.openType ?? null;
	this.list = packet.MailList;
	this.createRodexList();
	showWindow();
};

Rodex.getListFailed = function getListFailed() {
	const root = this.getRoot();
	if (root && !this.list.length) {
		root.querySelector('.mail-empty').textContent = 'Mail could not be loaded. Try Refresh.';
	}
};

Rodex.getSentDate = function getSentDate(mail, now = Date.now()) {
	if (typeof mail.regDateTime === 'number' && mail.regDateTime >= 0) {
		return new Date(now - mail.regDateTime * 1000);
	}

	// Modern inbox packets send the countdown to expiry. rAthena schedules
	// regular and returned mail by adding the retention period to its timestamp.
	const folder = Number(mail.openType ?? 0);
	const retention = folder === 0
		? Configs.get('RodexReturnDays', 15)
		: folder === 2
			? Configs.get('RodexDeleteDays', 15)
			: 0;
	const lifetime = Number(retention) * SECONDS_PER_DAY;
	const remaining = mail.expireDateTime;
	if (typeof remaining === 'number' && remaining >= 0 && remaining <= lifetime && lifetime > 0 &&
		remaining !== 365 * SECONDS_PER_DAY) {
		return new Date(now - (lifetime - remaining) * 1000);
	}

	return null;
};

Rodex.formatSentDate = function formatSentDate(mail) {
	const date = this.getSentDate(mail);
	return date ? sentDateFormat.format(date) : 'Date unavailable';
};

Rodex.getMailByID = function getMailByID(mailID) {
	return this.list.find(mail => String(mail.MailID) === String(mailID));
};

Rodex.getClaimState = function getClaimState(mail) {
	const remaining = mail.type & MAIL_ATTACHMENT_MASK;
	const itemsPending = pendingClaims.has(`${mail.MailID}:${MAIL_TYPE_ITEM}`);
	const zenyPending = pendingClaims.has(`${mail.MailID}:${MAIL_TYPE_ZENY}`);
	const pending = (itemsPending ? MAIL_TYPE_ITEM : 0) | (zenyPending ? MAIL_TYPE_ZENY : 0);
	return { remaining, pending, confirmed: claims.confirmed[claimKey(mail.MailID)] || 0 };
};

Rodex.createRodexList = function createRodexList(resetScroll = false) {
	const root = this.getRoot();
	const viewport = root.querySelector('.rodex-list');
	const list = root.querySelector('.mail-list');
	const template = root.querySelector('.mail-row-template');
	const display = getVisibleMail();
	const pages = Math.max(1, Math.ceil(display.length / this.pageSize));
	this.page = Math.max(0, Math.min(this.page, pages - 1));
	const start = this.page * this.pageSize;
	const scrollPosition = resetScroll ? 0 : viewport.scrollTop;
	const fragment = document.createDocumentFragment();

	for (const mail of display.slice(start, start + this.pageSize)) {
		const row = template.content.cloneNode(true);
		const subject = row.querySelector('.mail-subject');
		const sender = row.querySelector('.mail-sender');
		const date = row.querySelector('.mail-date');
		const icon = row.querySelector('.mail-image');
		const button = row.querySelector('.mail-claim');
		const state = this.getClaimState(mail);
		const openType = mail.openType ?? 0;
		subject.textContent = mail.title || '(No subject)';
		subject.addEventListener('click', () => this.requestReadRodex(openType, mail.MailID));
		sender.textContent = `From: ${mail.SenderName || 'Unknown sender'}`;
		sender.disabled = !mail.SenderName;
		sender.addEventListener('click', () => this.requestOpenWriteRodex(mail.SenderName));
		date.textContent = `Sent: ${this.formatSentDate(mail)}`;
		const image = mail.Isread ? 'icon_status_mail_read' : 'icon_status_mail_received';
		icon.dataset.background = `basic_interface/rodexsystem/renewal/${image}.bmp`;
		GUIComponent.processDataAttrs(icon);

		button.hidden = !state.remaining && !state.confirmed;
		button.disabled = Boolean(state.pending) || !state.remaining;
		button.textContent = state.pending ? 'Claiming…' : state.remaining ? 'Claim' : 'Claimed';
		button.addEventListener('click', () => this.claimMail(mail));
		fragment.append(row);
	}
	list.replaceChildren(fragment);
	viewport.scrollTop = scrollPosition;
	const empty = root.querySelector('.mail-empty');
	empty.hidden = display.length > 0;
	empty.textContent = activeSearch ? 'No matching messages.' : 'No messages.';
	root.querySelector('.page-status').textContent = `${this.page + 1} / ${pages}`;
	root.querySelector('.previous-page').disabled = this.page === 0;
	root.querySelector('.next-page').disabled = this.page >= pages - 1;
	root.querySelector('.retrieve-all').disabled = !this.list.some(mail => {
		const { remaining, pending } = this.getClaimState(mail);
		return remaining & ~pending;
	});
	root.querySelector('.delete-all').disabled = !this.list.length;
};

Rodex.claimMail = function claimMail(mail, requested = MAIL_ATTACHMENT_MASK, refresh = true) {
	const { remaining, pending } = this.getClaimState(mail);
	const available = remaining & requested & ~pending;
	const openType = mail.openType ?? 0;
	for (const type of [MAIL_TYPE_ITEM, MAIL_TYPE_ZENY]) {
		if (!(available & type)) {
			continue;
		}

		const key = `${mail.MailID}:${type}`;
		const timeout = window.setTimeout(() => {
			pendingClaims.delete(key);
			renderPage();
			this.onClaimStateChanged?.(mail.MailID);
		}, 12000);
		pendingClaims.set(key, timeout);
		if (type === MAIL_TYPE_ITEM) {
			this.requestItemsFromRodex(openType, mail.MailID);
		} else {
			this.requestZenyFromRodex(openType, mail.MailID);
		}
	}
	if (refresh) {
		renderPage();
	}
	this.onClaimStateChanged?.(mail.MailID);
};

Rodex.resolveClaim = function resolveClaim(mailID, type, succeeded) {
	const key = `${mailID}:${type}`;
	window.clearTimeout(pendingClaims.get(key));
	pendingClaims.delete(key);

	if (succeeded) {
		const mail = this.getMailByID(mailID);
		if (mail) {
			mail.type &= ~type;
		}
		const accountKey = claimKey(mailID);
		const previous = claims.confirmed[accountKey] || 0;
		delete claims.confirmed[accountKey];
		claims.confirmed[accountKey] = previous | type;
		const oldest = Object.keys(claims.confirmed);
		if (oldest.length > 300) {
			delete claims.confirmed[oldest[0]];
		}
		claims.save();
	}
	renderPage();
	this.onClaimStateChanged?.(mailID);
};

Rodex.getAll = function getAll() {
	for (const mail of this.list) {
		this.claimMail(mail, MAIL_ATTACHMENT_MASK, false);
	}
	renderPage();
};

Rodex.deleteAll = function deleteAll() {
	for (const mail of this.list) {
		if (!(mail.type & MAIL_ATTACHMENT_MASK)) {
			this.requestDeleteRodex(mail.openType ?? 0, mail.MailID);
		} else {
			ChatBox.addText(DB.getMessage(2612), ChatBox.TYPE.INFO_MAIL, ChatBox.FILTER.PUBLIC_LOG);
		}
	}
};

Rodex.updateDeletedMailContent = function updateDeletedMailContent(openType, mailID) {
	this.list = this.list.filter(mail => String(mail.MailID) !== String(mailID));
	renderPage();
};

Rodex.toggle = function toggle() {
	if (this.__active && this._host.style.display !== 'none') {
		this.closeRodexBox();
		this._host.style.display = 'none';
	} else {
		this.append();
		this.openRodexBox(this.openType);
		showWindow();
	}
};

Rodex.onKeyDown = function onKeyDown(event) {
	if (event.key === 'Escape' && this._host.style.display !== 'none') {
		this.toggle();
	}
};

export default UIManager.addComponent(Rodex);
