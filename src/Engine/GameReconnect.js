import Network from 'Network/NetworkManager.js';
import Session from 'Engine/SessionStorage.js';
import UIManager from 'UI/UIManager.js';

const retryDelays = [1000, 3000, 8000, 15000, 30000];
const handshakeTimeout = 20000;
const mapLoadTimeout = 90000;

let login = null;
let showLogin = null;
let target = null;
let pending = null;
let attempt = null;
let attempts = 0;
let timer = null;
let dialog = null;

function clearTimer() {
	clearTimeout(timer);
	timer = null;
}

function closeDialog() {
	dialog?.remove();
	dialog = null;
}

function clearRecovery() {
	clearTimer();
	closeDialog();
	pending = null;
	attempt = null;
	attempts = 0;
}

function reset() {
	clearRecovery();
	login = null;
	showLogin = null;
	target = null;
}

function cancel() {
	showLogin?.();
}

function showStatus(message) {
	closeDialog();
	dialog = UIManager.showMessageBox(message, 'cancel', cancel);
}

function prompt(message) {
	closeDialog();
	dialog = UIManager.showPromptBox(message, 'ok', 'cancel', () => {
		attempts = 0;
		schedule(0);
	}, cancel);
}

function watchHandshake() {
	clearTimer();
	timer = setTimeout(retry, handshakeTimeout);
}

function waitForConnection() {
	if (navigator.onLine === false) {
		timer = setTimeout(waitForConnection, 3000);
		return;
	}
	startAttempt();
}

function startAttempt() {
	if (navigator.onLine === false) {
		showStatus('You’re offline. Reconnecting when the connection returns…');
		timer = setTimeout(waitForConnection, 3000);
		return;
	}

	attempts++;
	attempt = { ...target };
	showStatus(`Reconnecting to the game… (${attempts}/${retryDelays.length})`);
	Network.onDisconnect = retry;
	watchHandshake();
	try {
		login(attempt);
	} catch (error) {
		console.warn('[Reconnect] Could not open the login connection.', error);
		retry();
	}
}

function schedule(delay) {
	clearTimer();
	showStatus('Connection lost. Reconnecting…');
	timer = setTimeout(startAttempt, delay);
}

function retry() {
	if (!attempt) {
		return false;
	}

	attempt = null;
	clearTimer();
	Session.Playing = false;
	Network.close();
	UIManager.removeComponents();
	if (attempts < retryDelays.length) {
		schedule(retryDelays[attempts]);
	} else {
		prompt('Couldn’t reconnect. Try again?');
	}
	return true;
}

export default {
	rememberLogin(connect, returnToLogin) {
		reset();
		login = connect;
		showLogin = returnToLogin;
	},
	forgetCharacter() {
		clearRecovery();
		target = null;
	},
	get available() {
		return Boolean(login && target);
	},
	get attempt() {
		return attempt;
	},
	disconnected(combat) {
		pending = combat;
		if (combat.mobile.autoAttack || combat.mobile.autoTarget || combat.desktop) {
			schedule(retryDelays[0]);
		} else {
			prompt('Disconnected from the server. Reconnect to continue playing?');
		}
	},
	pauseForPin() {
		clearTimer();
		closeDialog();
	},
	continueAfterPin() {
		showStatus('Returning to your character…');
		watchHandshake();
	},
	mapAccepted(onTimeout) {
		clearTimer();
		closeDialog();
		timer = setTimeout(onTimeout, mapLoadTimeout);
	},
	mapReady(accountId, serverName, characterId) {
		const combat = pending;
		target = { accountId, serverName, characterId };
		clearRecovery();
		return combat;
	},
	retry,
	reset
};
