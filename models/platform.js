export default class Platform {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj.pid;
        this.name = obj.name;
        this.logo = obj.logo;
    }

    /**
     * @param {string} name 
     * @param {string} logo 
     * @returns Platform
     */
    static from = (name, logo) => new this({ name, logo })
}