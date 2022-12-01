const Self = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Self.imports.utils;

var JSONPathParser = function () {

	/**
	 * Access a simple json path expression of an object.
	 * Returns the accessed value or null if the access was not possible.
	 *
	 * @param inputObject the object to access
	 * @param inputString the json path expression
	 * @param randomElements the predefined random Elements
	 * @param newRandomness whether to ignore previously defined random Elements
	 * @returns {*}
	 */
	this.access = function (inputObject, inputString, randomElements = null, newRandomness = true) {
		if (inputObject === null || inputObject === undefined) {
			return null;
		}

		if (inputString.length === 0) {
			return {
				Object: inputObject,
				RandomElements: randomElements,
			};
		}

		if (randomElements === null) {
			randomElements = [];
			newRandomness = true;
		}

		let startDot = inputString.indexOf('.');
		if (startDot === -1) {
			startDot = inputString.length;
		}

		let keyString = inputString.slice(0, startDot);
		let inputStringTail = inputString.slice(startDot + 1);

		let startParentheses = keyString.indexOf('[');

		if (startParentheses === -1) {

			let targetObject = this._getTargetObject(inputObject, keyString);
			if (targetObject == null) {
				return null;
			}

			return this.access(targetObject, inputStringTail, randomElements, newRandomness);

		} else {

			let indexString = keyString.slice(startParentheses + 1, keyString.length - 1);
			keyString = keyString.slice(0, startParentheses);

			let targetObject = this._getTargetObject(inputObject, keyString);
			if (targetObject == null) {
				return null;
			}

			switch (indexString) {
				case "@random":
					let randomNumber = null;
					if (!newRandomness && randomElements.length >= 1) {
						// Take and remove first element
						randomNumber = randomElements.shift();
					} else if (!newRandomness && randomElements.length < 1) {
						randomNumber = this.randomElement(targetObject);
					} else {
						randomNumber = this.randomElement(targetObject);
						randomElements.push(randomNumber);
					}

					return this.access(randomNumber, inputStringTail, randomElements, newRandomness);
				// add special keywords here
				default:
					// expecting integer
					return this.access(targetObject[parseInt(indexString)], inputStringTail, randomElements, newRandomness);
			}

		}

	};

	/**
	 * Check validity of the key string and return the target object or null.
	 * @param inputObject
	 * @param keyString
	 * @returns {*}
	 * @private
	 */
	this._getTargetObject = function (inputObject, keyString) {
		if (!keyString.empty && keyString !== "$" && !inputObject.hasOwnProperty(keyString)) {
			return null;
		}

		return (keyString === "$") ? inputObject : inputObject[keyString];
	};

	/**
	 * Returns the value of a random key of a given object.
	 *
	 * @param inputObject
	 * @returns {*}
	 */
	this.randomElement = function (inputObject) {
		let keys = Object.keys(inputObject);
		let randomIndex = Utils.Utils.getRandomNumber(keys.length);

		return inputObject[keys[randomIndex]];
	}

};
