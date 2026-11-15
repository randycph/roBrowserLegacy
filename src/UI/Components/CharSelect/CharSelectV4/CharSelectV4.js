/**
 * UI/Components/CharSelect/CharSelectV4/CharSelectV4.js
 *
 * Chararacter Selection windows
 *
 * This file is part of ROBrowser, Ragnarok Online in the Web Browser (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import htmlText from './CharSelectV4.html?raw&v=carousel7';
import cssText from './CharSelectV4.css?raw&v=carousel7';
import { createCharSelect } from '../CharSelectCommon.js?v=carousel7';

export default createCharSelect({
	name: 'CharSelectV4',
	htmlText,
	cssText,
	gridLayout: true,
	deleteReservation: true,
	defaultMaxSlots: 18
});
