let JSONPathParser = function () {

	/**
	 * Access a simple json path expression of an object.
	 * Returns the accessed value or null if the access was not possible.
	 *
	 * @param inputObject the object to access
	 * @param inputString the json path expression
	 * @returns {*}
	 */
	this.access = function(inputObject, inputString) {
		if (inputObject === null || inputObject === undefined) {
			return null;
		}

		if (inputString.length === 0) {
			return inputObject;
		}

		let startDot = inputString.indexOf('.');
		if (startDot === -1) {
			startDot = inputString.length;
		}

		let keyString = inputString.slice(0, startDot);
		let inputStringTail = inputString.slice(startDot+1);

		let startParentheses = keyString.indexOf('[');

		if (startParentheses === -1) {

			if (!keyString.empty && !inputObject.hasOwnProperty(keyString)) {
				return null;
			}

			return this.access(inputObject[keyString], inputStringTail)

		} else {

			let indexString = keyString.slice(startParentheses+1, keyString.length-1);
			keyString = keyString.slice(0, startParentheses);

			if (!keyString.empty && !inputObject.hasOwnProperty(keyString)) {
				return null;
			}

			switch (indexString) {
			case "@random":
				return this.access(this.randomElement(inputObject[keyString]), inputStringTail);
				// add special keywords here
			default:
				// expecting integer
				return this.access(inputObject[keyString][parseInt(indexString)], inputStringTail);
			}

		}

	};

	/**
	 * Returns the value of a random key of a given object.
	 *
	 * @param inputObject
	 * @returns {*}
	 */
	this.randomElement = function(inputObject) {
		let keys = Object.keys(inputObject);
		let randomIndex = Math.floor(Math.random()*keys.length);

		return inputObject[keys[randomIndex]];
	}

};
