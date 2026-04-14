package repository

import (
	"auth-service/internal/model"

	"gorm.io/gorm"
)

type ProjectMemberRepository interface {
	Add(member *model.ProjectMember) error
	Remove(projectID, userID uint) error
	FindByProjectID(projectID uint) ([]model.ProjectMember, error)
	FindProjectIDsByUserID(userID uint) ([]uint, error)
	IsMember(projectID, userID uint) bool
	GetRole(projectID, userID uint) string // "owner" | "member" | ""
}

type projectMemberRepository struct {
	db *gorm.DB
}

func NewProjectMemberRepository(db *gorm.DB) ProjectMemberRepository {
	return &projectMemberRepository{db: db}
}

func (r *projectMemberRepository) Add(member *model.ProjectMember) error {
	return r.db.Create(member).Error
}

func (r *projectMemberRepository) Remove(projectID, userID uint) error {
	return r.db.Where("project_id = ? AND user_id = ?", projectID, userID).
		Delete(&model.ProjectMember{}).Error
}

func (r *projectMemberRepository) FindByProjectID(projectID uint) ([]model.ProjectMember, error) {
	var members []model.ProjectMember
	err := r.db.Preload("User").
		Where("project_id = ?", projectID).
		Order("created_at asc").
		Find(&members).Error
	return members, err
}

func (r *projectMemberRepository) FindProjectIDsByUserID(userID uint) ([]uint, error) {
	var ids []uint
	err := r.db.Model(&model.ProjectMember{}).
		Where("user_id = ?", userID).
		Pluck("project_id", &ids).Error
	return ids, err
}

func (r *projectMemberRepository) IsMember(projectID, userID uint) bool {
	var count int64
	r.db.Model(&model.ProjectMember{}).
		Where("project_id = ? AND user_id = ?", projectID, userID).
		Count(&count)
	return count > 0
}

func (r *projectMemberRepository) GetRole(projectID, userID uint) string {
	var m model.ProjectMember
	err := r.db.Where("project_id = ? AND user_id = ?", projectID, userID).
		First(&m).Error
	if err != nil {
		return ""
	}
	return m.Role
}
