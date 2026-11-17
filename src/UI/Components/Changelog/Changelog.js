import GUIComponent from 'UI/GUIComponent.js';
import UIManager from 'UI/UIManager.js';
import htmlText from './Changelog.html?raw';
import cssText from './Changelog.css?raw';

const Changelog = new GUIComponent('Changelog', cssText);

Changelog.render = () => htmlText;
Changelog.mouseMode = GUIComponent.MouseMode.STOP;

Changelog.init = function init() {
	const root = this.getRoot();

	root.querySelector('.close').addEventListener('click', () => {
		this.remove();
	});

	this.draggable(root.querySelector('.titlebar'));
};

Changelog.toggle = function toggle() {
	if (this._host?.isConnected) {
		this.remove();
		return;
	}

	this.append();
};

export default UIManager.addComponent(Changelog);
