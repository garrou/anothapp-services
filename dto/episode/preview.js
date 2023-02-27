class PreviewEpisodeDto {

    constructor(id, title, code, desc, date) {
        this.id = id;
        this.title = title;
        this.code = code;
        this.description = desc;
        this.date = date;
    }
}

module.exports = { PreviewEpisodeDto };