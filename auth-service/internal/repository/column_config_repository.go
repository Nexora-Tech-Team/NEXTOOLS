package repository

import (
	"auth-service/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ColumnConfigRepository interface {
	Get(projectID uint) (*model.ProjectColumnConfig, error)
	Upsert(config *model.ProjectColumnConfig) error
}

type columnConfigRepository struct {
	db *gorm.DB
}

func NewColumnConfigRepository(db *gorm.DB) ColumnConfigRepository {
	return &columnConfigRepository{db: db}
}

func (r *columnConfigRepository) Get(projectID uint) (*model.ProjectColumnConfig, error) {
	var cfg model.ProjectColumnConfig
	err := r.db.First(&cfg, "project_id = ?", projectID).Error
	if err == gorm.ErrRecordNotFound {
		return &model.ProjectColumnConfig{ProjectID: projectID, Labels: "{}", CustomCols: "[]"}, nil
	}
	return &cfg, err
}

func (r *columnConfigRepository) Upsert(config *model.ProjectColumnConfig) error {
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "project_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"labels", "custom_cols"}),
	}).Create(config).Error
}
