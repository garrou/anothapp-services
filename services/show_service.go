package services

import "anothapp-v3/repositories"

func ShowExists(id int) bool {
	return repositories.ShowExists(id).Error == nil
}
