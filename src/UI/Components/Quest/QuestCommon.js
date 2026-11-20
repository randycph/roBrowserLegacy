/**
 * Shared quest journal and packet-driven state for both client versions.
 * Based on ROBrowser's Quest List by Vincent Thibault.
 */

import DB from 'DB/DBManager.js';
import Preferences from 'Core/Preferences.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import Session from 'Engine/SessionStorage.js';
import { bindQuestPanel } from './QuestPanel.js?v=quest-journal';
import panelCss from '../RpgPanel.css?raw&v=popup-headings';
import htmlText from './QuestPanel.html?raw&v=popup-headings';
import cssText from './QuestPanel.css?raw&v=popup-headings';

export function createQuest({ name, questWindow = null }) {
	const Quest = new GUIComponent(name, panelCss + cssText);
	const preferences = Preferences.get(name, {
		x: 200,
		y: 200,
		show: false,
		showwindow: true
	}, 1.0);

	let quests = [];
	let updatePanel;
	const hiddenFromTracker = [];

	Quest.render = () => htmlText;

	Quest._setupScrollbars = function setupScrollbars() {
		// Native scrolling preserves touch gestures in the nested journal panes.
	};

	function refreshTracker() {
		if (questWindow) {
			questWindow.ClearQuestList();
			questWindow.setQuestList(quests, hiddenFromTracker);
		}
	}

	function refresh() {
		updatePanel?.(quests);
		refreshTracker();
	}

	function statusOf(quest) {
		if (questWindow && quest.end_time > Date.now() / 1000) {
			return 'cooldown';
		}
		return Number(quest.active) === 1 ? 'active' : 'inactive';
	}

	function toggleActive(quest) {
		const packet = new PACKET.CZ.ACTIVE_QUEST();
		packet.questID = quest.questID;
		packet.active = Number(quest.active) === 1 ? 0 : 1;
		Network.sendPacket(packet);
	}

	Quest.init = function init() {
		questWindow?.prepare();
		updatePanel = bindQuestPanel(this.getRoot(), {
			close: () => this.ui.hide(),
			statusOf,
			toggleActive,
			hasTracker: Boolean(questWindow),
			showTracker: () => preferences.showwindow,
			setShowTracker(show) {
				if (show) {
					questWindow.ui.show();
				} else {
					questWindow.ui.hide();
				}
				preferences.showwindow = show;
				preferences.save();
			},
			isTracked(id) {
				return !hiddenFromTracker.includes(id);
			},
			setTracked(id, tracked) {
				const index = hiddenFromTracker.indexOf(id);
				if (tracked && index !== -1) {
					hiddenFromTracker.splice(index, 1);
				} else if (!tracked && index === -1) {
					hiddenFromTracker.push(id);
				}
				refreshTracker();
			}
		});
		updatePanel(quests);
	};

	Quest.onAppend = function onAppend() {
		if (!preferences.show) {
			this.ui.hide();
		}
		questWindow?.append();
		refresh();
	};

	Quest.onRemove = function onRemove() {
		preferences.show = getComputedStyle(this._host).display !== 'none';
		preferences.save();
	};

	Quest.clean = function clean() {
		quests = [];
		refresh();
		this.ui.hide();
	};

	Quest.onShortCut = function onShortCut(key) {
		if (key.cmd === 'TOGGLE') {
			this.toggle();
		}
	};

	Quest.toggle = function toggle() {
		if (getComputedStyle(this._host).display === 'none') {
			this.ui.show();
			this.focus();
			updatePanel?.(quests);
		} else {
			this.ui.hide();
		}
	};

	Quest.setQuestList = function setQuestList(nextQuests) {
		quests = nextQuests;
		refresh();
	};

	Quest.addQuest = function addQuest(quest, questID) {
		quests[questID] = quest;
		refresh();
	};

	Quest.updateMissionHunt = function updateMissionHunt(huntInfo, questID, huntID) {
		const quest = quests[questID];
		if (!quest) {
			return;
		}

		const hunt = quest.hunt_list[huntID] || (quest.hunt_list[huntID] = {
			mobName: huntInfo.mobName,
			huntCount: 0,
			maxCount: 0
		});
		const prevCount = hunt.huntCount;
		const prevMax = hunt.maxCount;

		if (huntInfo.huntIDCount) {
			hunt.huntIDCount = huntInfo.huntIDCount;
		}
		if (huntInfo.maxCount) {
			hunt.maxCount = huntInfo.maxCount;
		}
		if (typeof huntInfo.huntCount === 'number') {
			hunt.huntCount = huntInfo.huntCount;
		}
		if (huntInfo.mobGID) {
			hunt.mobGID = huntInfo.mobGID;
		}
		if (huntInfo.mobName) {
			hunt.mobName = huntInfo.mobName;
		}

		refresh();

		// The server can send identical counts in consecutive packets.
		if (hunt.huntCount === prevCount && hunt.maxCount === prevMax) {
			return;
		}
		const mobName = hunt.mobName || 'Monster';
		const progress = `${hunt.huntCount}/${hunt.maxCount}`;
		const questInfo = DB.getQuestInfo(questID);
		const title = questInfo.Title || quest.title;
		const message = `Mission [${title}], you killed [${mobName}]. (${progress})`;
		ChatBox.addText(message, ChatBox.TYPE.ADMIN | ChatBox.TYPE.SELF, ChatBox.FILTER.QUEST);
		if (Session.Entity) {
			const label = hunt.huntCount === hunt.maxCount ? 'Completed' : progress;
			Session.Entity.dialog.set(`${mobName} [${label}]`, 'yellow');
		}
	};

	Quest.removeQuest = function removeQuest(questID) {
		delete quests[questID];
		refresh();
	};

	Quest.toggleQuestActive = function toggleQuestActive(questID, active) {
		if (quests[questID]) {
			quests[questID].active = active;
			refresh();
		}
	};

	Quest.getQuestIDByServerID = function getQuestIDByServerID(id) {
		for (const questID in quests) {
			if (quests[questID].hunt_list[id] !== undefined) {
				return questID;
			}
		}
		return -1;
	};

	Quest.questExists = function questExists(questID) {
		return quests[questID] !== undefined;
	};

	return UIManager.addComponent(Quest);
}
