/**
 * Quest journal with the renewal quest tracker.
 */

import { createQuest } from '../QuestCommon.js?v=popup-headings';
import QuestWindow from './QuestWindow.js';

export default createQuest({
	name: 'Quest',
	questWindow: QuestWindow
});
