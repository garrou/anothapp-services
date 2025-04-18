export default class Stat {

    constructor(obj) {
        this.label = obj.label ?? "Aucun";
        this.value = obj.value ? parseInt(obj.value) : 0;
    }

    /**
     * @param {string} label 
     * @param {number} value 
     * @returns Stat
     */
    static from = (label, value) => new this({ label, value });
}