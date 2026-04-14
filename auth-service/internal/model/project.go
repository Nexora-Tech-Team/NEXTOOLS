package model

import "time"

type Project struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string    `gorm:"not null" json:"name"`
	Description string    `json:"description"`
	OwnerID     uint      `gorm:"not null" json:"owner_id"`
	Owner       User      `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Tasks       []Task    `gorm:"foreignKey:ProjectID" json:"tasks,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateProjectRequest struct {
	Name        string `json:"name" binding:"required,min=2"`
	Description string `json:"description"`
}

type UpdateProjectRequest struct {
	Name        string `json:"name" binding:"omitempty,min=2"`
	Description string `json:"description"`
}

type ProjectResponse struct {
	ID          uint                     `json:"id"`
	Name        string                   `json:"name"`
	Description string                   `json:"description"`
	OwnerID     uint                     `json:"owner_id"`
	Owner       *UserResponse            `json:"owner,omitempty"`
	TaskCount   int                      `json:"task_count"`
	Members     []*ProjectMemberResponse `json:"members,omitempty"`
	MemberCount int                      `json:"member_count"`
	CreatedAt   time.Time                `json:"created_at"`
	UpdatedAt   time.Time                `json:"updated_at"`
}
