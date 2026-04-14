package repository

import (
	"auth-service/internal/model"

	"gorm.io/gorm"
)

type ProjectRepository interface {
	Create(project *model.Project) error
	FindAll() ([]model.Project, error)
	FindByIDs(ids []uint) ([]model.Project, error)
	FindByID(id uint) (*model.Project, error)
	Update(project *model.Project) error
	Delete(id uint) error
}

type projectRepository struct {
	db *gorm.DB
}

func NewProjectRepository(db *gorm.DB) ProjectRepository {
	return &projectRepository{db: db}
}

func (r *projectRepository) Create(project *model.Project) error {
	return r.db.Create(project).Error
}

func (r *projectRepository) FindAll() ([]model.Project, error) {
	var projects []model.Project
	err := r.db.Preload("Owner").Order("created_at desc").Find(&projects).Error
	return projects, err
}

func (r *projectRepository) FindByIDs(ids []uint) ([]model.Project, error) {
	if len(ids) == 0 {
		return []model.Project{}, nil
	}
	var projects []model.Project
	err := r.db.Preload("Owner").Where("id IN ?", ids).Order("created_at desc").Find(&projects).Error
	return projects, err
}

func (r *projectRepository) FindByID(id uint) (*model.Project, error) {
	var project model.Project
	err := r.db.Preload("Owner").First(&project, id).Error
	if err != nil {
		return nil, err
	}
	return &project, nil
}

func (r *projectRepository) Update(project *model.Project) error {
	return r.db.Save(project).Error
}

func (r *projectRepository) Delete(id uint) error {
	return r.db.Delete(&model.Project{}, id).Error
}
