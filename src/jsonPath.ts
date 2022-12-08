import * as Utils from './utils.js';

/**
 * Access a simple json path expression of an object.
 * Returns the accessed value or null if the access was not possible.
 * Accepts predefined number values to access the same elements as previously
 * and allows to override the use of these values.
 *
 * @param {unknown} inputObject A JSON object
 * @param {string} inputString JSONPath to follow, see wiki for syntax
 * @param {number[]} randomNumbers Array of pre-generated numbers
 * @param {boolean} newRandomness Whether to ignore a given randomNumbers array
 */
function getTarget(inputObject: unknown, inputString: string, randomNumbers?: number[], newRandomness?: boolean): { Object: unknown, RandomNumbers?: number[] } | null {
    if (!inputObject)
        return null;

    if (inputString.length === 0) {
        return {
            Object: inputObject,
            RandomNumbers: randomNumbers,
        };
    }

    if (!randomNumbers) {
        randomNumbers = [];
        newRandomness = true;
    }

    let startDot = inputString.indexOf('.');
    if (startDot === -1)
        startDot = inputString.length;

    let keyString = inputString.slice(0, startDot);
    const inputStringTail = inputString.slice(startDot + 1);

    const startParentheses = keyString.indexOf('[');

    if (startParentheses === -1) {
        // Expect Object here
        const targetObject = _getObjectMember(inputObject, keyString);
        if (!targetObject)
            return null;

        return getTarget(targetObject, inputStringTail, randomNumbers, newRandomness);
    } else {
        const indexString = keyString.slice(startParentheses + 1, keyString.length - 1);
        keyString = keyString.slice(0, startParentheses);

        // Expect an Array at this point
        const targetObject = _getObjectMember(inputObject, keyString);
        if (!targetObject || !Array.isArray(targetObject))
            return null;

        switch (indexString) {
        case '@random': {
            let randomNumber: number = -1;
            let randomElement: unknown = null;

            if (!newRandomness && randomNumbers.length > 0) {
                // Take and remove first element
                randomNumber = randomNumbers.shift() ?? -1;
                randomElement = targetObject[randomNumber];
            } else {
                [randomElement, randomNumber] = _randomElement(targetObject);

                if (newRandomness)
                    randomNumbers.push(randomNumber);
            }

            return getTarget(randomElement, inputStringTail, randomNumbers, newRandomness);
        }
        // add special keywords here
        default:
            // expecting integer
            return getTarget(targetObject[parseInt(indexString)], inputStringTail, randomNumbers, newRandomness);
        }
    }
}

/**
 * Check validity of the key string and return the target member or null.
 *
 * @param {object} inputObject JSON object
 * @param {string} keyString Name of the key in the object
 */
function _getObjectMember(inputObject: object, keyString: string): unknown | null {
    if (keyString === '$')
        return inputObject;

    for (const [key, value] of Object.entries(inputObject)) {
        if (key === keyString)
            return value;
    }

    return null;
}

/**
 * Returns the value of a random key of a given array.
 *
 * @param {Array<T>} array Array with values
 */
function _randomElement<T>(array: Array<T>): [T, number] {
    const randomNumber = Utils.getRandomNumber(array.length);
    return [array[randomNumber], randomNumber];
}

export {getTarget};
