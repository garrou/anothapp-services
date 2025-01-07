/**
 * @param {any[]} arr
 * @param {string} attribute
 * @returns {number[]}
 */
const cumulate = (arr, attribute) => {
    const result = new Array(arr.length + 1).fill(0);
    arr.forEach((s, i) => result[i+1] = result[i] + s[attribute]);
    return result;
}

export {
    cumulate,
}