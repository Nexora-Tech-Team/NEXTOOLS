package model

import "time"

type ProjectMember struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ProjectID uint      `gorm:"not null;uniqueIndex:uix_project_user" json:"project_id"`
	UserID    uint      `gorm:"not null;uniqueIndex:uix_project_user" json:"user_id"`
	User      User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Role      string    `gorm:"type:varchar(20);default:'member'" json:"role"` // owner | member
	CreatedAt time.Time `json:"created_at"`
}

type ProjectMemberResponse struct {
	ID        uint          `json:"id"`
	ProjectID uint          `json:"project_id"`
	UserID    uint          `json:"user_id"`
	User      *UserResponse `json:"user,omitempty"`
	Role      string        `json:"role"`
	CreatedAt time.Time     `json:"created_at"`
}

type AddMemberRequest struct {
	UserID uint `json:"user_id" binding:"required"`
}

func (m *ProjectMember) ToResponse() *ProjectMemberResponse {
	r := &ProjectMemberResponse{
		ID:        m.ID,
		ProjectID: m.ProjectID,
		UserID:    m.UserID,
		Role:      m.Role,
		CreatedAt: m.CreatedAt,
	}
	if m.User.ID != 0 {
		r.User = m.User.ToResponse()
	}
	return r
}
