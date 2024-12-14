package models

type DiscoverApiShows struct {
	Shows []ApiShow `json:"shows"`
}

type DisplayApiShow struct {
	Show ApiShow `json:"show"`
}

type ApiShow struct {
	Id     int    `json:"id"`
	Title  string `json:"title"`
	Images struct {
		Banner string `json:"banner,omitempty"`
		Box    string `json:"box,omitempty"`
		Poster string `json:"poster,omitempty"`
		Show   string `json:"show,omitempty"`
	} `json:"images"`
	Description string `json:"description"`
	Episodes    string `json:"episodes"`
	Seasons     []struct {
		Number   int `json:"number"`
		Episodes int `json:"episodes"`
	} `json:"seasons_details"`
	Creation  string      `json:"creation"`
	Genres    interface{} `json:"genres"`
	Length    string      `json:"length"`
	Status    string      `json:"status"`
	Notes     interface{} `json:"notes"`
	Platforms struct {
		Streaming []struct {
			Name string `json:"name"`
			Logo string `json:"logo"`
		} `json:"svods"`
	} `json:"platforms"`
}

func (show ApiShow) GetImageUrl() string {
	if show.Images.Poster != "" {
		return show.Images.Poster
	}
	if show.Images.Show != "" {
		return show.Images.Show
	}
	if show.Images.Banner != "" {
		return show.Images.Banner
	}
	if show.Images.Box != "" {
		return show.Images.Box
	}
	return ""
}
