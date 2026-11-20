/**
 * RodEx mailbox and client-side attachment status.
 */
import Configs from 'Core/Configs.js';
import Preferences from 'Core/Preferences.js';
import Session from 'Engine/SessionStorage.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './Rodex.html?raw&v=popup-headings';
import cssText from './Rodex.css?raw&v=popup-headings';

const MAIL_TYPE_ZENY = 0x2;
const MAIL_TYPE_ITEM = 0x4;
const MAIL_ATTACHMENT_MASK = MAIL_TYPE_ZENY | MAIL_TYPE_ITEM;
const SECONDS_PER_DAY = 86400;
const pendingClaims = new Map();
const claims = Preferences.get('RodexClaims', { confirmed: {} }, 1);
const sentDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const relativeDateFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const Rodex = new GUIComponent('Rodex', cssText);
Rodex.list = [];
Rodex.render = () => htmlText;
Rodex.captureKeyEvents = true;
Rodex.MAIL_TYPE_ITEM = MAIL_TYPE_ITEM;
Rodex.MAIL_TYPE_ZENY = MAIL_TYPE_ZENY;

function claimKey(mailID) {
	return `${Session.AID}:${mailID}`;
}

function renderInbox() {
	if (Rodex.__active) {
		Rodex.createRodexList();
	}
}

function calendarDay(date) {
	return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / (SECONDS_PER_DAY * 1000);
}

function syncMailViewport() {
	const viewport = window.visualViewport;
	if (!viewport) return;
	const style = Rodex._host.style;
	style.setProperty('--mail-viewport-height', `${viewport.height}px`);
	style.setProperty('--mail-viewport-top', `${viewport.offsetTop}px`);
	style.setProperty('--mail-viewport-bottom', `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
}

function showWindow() {
	Rodex._host.style.display = '';
	syncMailViewport();
	Rodex.focus();
}

Rodex.init = function init() {
	const root = this.getRoot();
	const panel = root.querySelector('#Rodex');
	panel.style.setProperty('--mail-collect-art', `url("${new URL('./mail-collect.webp', import.meta.url).href}")`);
	panel.style.setProperty('--mail-claimed-art', `url("${new URL('./mail-claimed.webp', import.meta.url).href}")`);
	panel.style.setProperty('--mail-gold-art', `url("${new URL('./mail-envelope-gold.webp', import.meta.url).href}")`);
	panel.style.setProperty('--mail-silver-art', `url("${new URL('./mail-envelope-silver.webp', import.meta.url).href}")`);

	// Mail readers, composers and confirmations must stay above the inbox backdrop.
	if (!document.querySelector('#mail-foreground-layers')) {
		const layers = document.createElement('style');
		layers.id = 'mail-foreground-layers';
		layers.textContent = `
			body > #ReadRodex { z-index: 2010 !important; }
			body > #WriteRodex { z-index: 2020 !important; }

			body:has(> :is(#Rodex, #ReadRodex, #WriteRodex):not([style*="display: none"]))
				> .win_popup_overlay { z-index: 2030 !important; }

			body:has(> :is(#Rodex, #ReadRodex, #WriteRodex):not([style*="display: none"]))
				> :is(#WinPrompt, #WinMSG, #WinError) { z-index: 2040 !important; }
		`;
		document.head.appendChild(layers);
	}

	root.querySelector('.close').addEventListener('click', () => this.toggle());
	// Keep inbox swipes away from the map's window-level touch handler.
	const inbox = root.querySelector('.rodex-list');
	for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
		inbox.addEventListener(type, event => event.stopPropagation(), { passive: true });
	}

	const backdrop = root.querySelector('.mail-backdrop');
	for (const type of ['mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'click']) {
		backdrop.addEventListener(type, event => event.stopPropagation());
	}
};

Rodex.onAppend = function onAppend() {
	window.visualViewport?.addEventListener('resize', syncMailViewport);
	window.visualViewport?.addEventListener('scroll', syncMailViewport);
	syncMailViewport();
	this.createRodexList(true);
};

Rodex.onRemove = function onRemove() {
	window.visualViewport?.removeEventListener('resize', syncMailViewport);
	window.visualViewport?.removeEventListener('scroll', syncMailViewport);
	this.list = [];
	for (const timer of pendingClaims.values()) {
		window.clearTimeout(timer);
	}
	pendingClaims.clear();
};

Rodex.initData = function initData(packet) {
	this.list = packet.MailList;
	renderInbox();
};

Rodex.getListFailed = function getListFailed() {
	const root = this.getRoot();
	if (root && !this.list.length) {
		root.querySelector('.mail-empty').textContent = 'Mail could not be loaded. Close and reopen Mail to try again.';
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
	const now = new Date();
	const scrollPosition = resetScroll ? 0 : viewport.scrollTop;
	const fragment = document.createDocumentFragment();

	for (const mail of this.list) {
		const row = template.content.cloneNode(true);
		const subject = row.querySelector('.mail-subject');
		const sender = row.querySelector('.mail-sender');
		const date = row.querySelector('.mail-date');
		const card = row.querySelector('.mail-item');
		const button = row.querySelector('.mail-claim');
		const state = this.getClaimState(mail);
		const openType = mail.openType ?? 0;
		subject.textContent = mail.title || '(No subject)';
		subject.addEventListener('click', () => this.requestReadRodex(openType, mail.MailID));
		sender.textContent = `From: ${mail.SenderName || 'Unknown sender'}`;
		const sentDate = this.getSentDate(mail, now.getTime());
		if (sentDate) {
			date.title = sentDateFormat.format(sentDate);
			const daysAgo = calendarDay(now) - calendarDay(sentDate);
			const relativeDate = relativeDateFormat.format(-daysAgo, 'day');
			date.textContent = relativeDate.charAt(0).toLocaleUpperCase() + relativeDate.slice(1);
		} else {
			date.hidden = true;
		}
		card.dataset.claimState = state.pending ? 'pending'
			: state.remaining ? 'available'
			: state.confirmed ? 'claimed'
			: 'none';

		button.hidden = !state.remaining && !state.confirmed;
		button.disabled = Boolean(state.pending) || !state.remaining;
		button.textContent = state.pending ? 'Collecting…' : state.remaining ? 'Collect' : 'Claimed';
		button.addEventListener('click', () => this.claimMail(mail));
		fragment.append(row);
	}
	list.replaceChildren(fragment);
	viewport.scrollTop = scrollPosition;
	const empty = root.querySelector('.mail-empty');
	empty.hidden = this.list.length > 0;
	empty.textContent = 'No messages.';
};

Rodex.claimMail = function claimMail(mail, requested = MAIL_ATTACHMENT_MASK) {
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
			renderInbox();
			this.onClaimStateChanged?.(mail.MailID);
		}, 12000);
		pendingClaims.set(key, timeout);
		if (type === MAIL_TYPE_ITEM) {
			this.requestItemsFromRodex(openType, mail.MailID);
		} else {
			this.requestZenyFromRodex(openType, mail.MailID);
		}
	}
	renderInbox();
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
	renderInbox();
	this.onClaimStateChanged?.(mailID);
};

Rodex.updateDeletedMailContent = function updateDeletedMailContent(openType, mailID) {
	this.list = this.list.filter(mail => String(mail.MailID) !== String(mailID));
	renderInbox();
};

Rodex.toggle = function toggle() {
	if (this.__active && this._host.style.display !== 'none') {
		this.closeRodexBox();
		this._host.style.display = 'none';
	} else {
		this.append();
		this.openRodexBox();
		showWindow();
	}
};

Rodex.onKeyDown = function onKeyDown(event) {
	if (event.key === 'Escape' && this._host.style.display !== 'none') {
		this.toggle();
	}
};

export default UIManager.addComponent(Rodex);
