class Platform {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj.pid;
        this.name = obj.name;
        this.logo = obj.logo;
    }
}

export default Platform;