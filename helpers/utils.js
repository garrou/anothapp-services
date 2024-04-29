/**
 * @param {Array} arr
 * @returns Array<number>
 */
const cumulate = (arr) => {
    const result = new Array(arr.length + 1).fill(0);
    arr.forEach((s, i) => result[i+1] = result[i] + s.episodes);
    return result;
}

module.exports = {
    cumulate
}