const { ImageShowDto } = require('./image');

class DetailsShowDto {

    constructor(
        id, 
        title, 
        description, 
        seasons, 
        episodes, 
        duration, 
        network, 
        note, 
        images,
        status,
        creation
    ) {
        this.id = id;
        this.title = title; 
        this.description = description;
        this.seasons = seasons;
        this.episodes = episodes;
        this.duration = duration;
        this.network = network;
        this.note = note;
        this.images = new ImageShowDto(images);
        this.status = status;
        this.creation = creation;
    }
}

module.exports = { DetailsShowDto };