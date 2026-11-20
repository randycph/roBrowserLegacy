/**
 * Quest journal with the renewal quest tracker.
 */

import { createQuest } from '../QuestCommon.js?v=quest-journal';
import QuestWindow from './QuestWindow.js';

export default createQuest({
	name: 'Quest',
	questWindow: QuestWindow
});
