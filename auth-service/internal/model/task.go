package model

import "time"

type TaskStatus string
type TaskPriority string

const (
	StatusBacklog    TaskStatus = "backlog"
	StatusTodo       TaskStatus = "todo"
	StatusInProgress TaskStatus = "in_progress"
	StatusReview     TaskStatus = "review"
	StatusDone       TaskStatus = "done"
)

const (
	PriorityLow    TaskPriority = "low"
	PriorityMedium TaskPriority = "medium"
	PriorityHigh   TaskPriority = "high"
)

type Task struct {
	ID          uint         `gorm:"primaryKey;autoIncrement" json:"id"`
	Title       string       `gorm:"not null" json:"title"`
	Description string       `json:"description"`
	ProjectID   uint         `gorm:"not null;index" json:"project_id"`
	Project     Project      `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	AssigneeID  *uint        `gorm:"index" json:"assignee_id"`
	Assignee    *User        `gorm:"foreignKey:AssigneeID" json:"assignee,omitempty"`
	CreatorID   uint         `gorm:"not null" json:"creator_id"`
	Creator     User         `gorm:"foreignKey:CreatorID" json:"creator,omitempty"`
	Status      TaskStatus   `gorm:"type:varchar(20);default:'backlog'" json:"status"`
	Priority    TaskPriority `gorm:"type:varchar(10);default:'medium'" json:"priority"`
	DueDate     *time.Time   `json:"due_date"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

type CreateTaskRequest struct {
	Title       string       `json:"title" binding:"required,min=2"`
	Description string       `json:"description"`
	AssigneeID  *uint        `json:"assignee_id"`
	Status      TaskStatus   `json:"status"`
	Priority    TaskPriority `json:"priority"`
	DueDate     *string      `json:"due_date"` // "YYYY-MM-DD" or ""
}

type UpdateTaskRequest struct {
	Title       *string      `json:"title" binding:"omitempty,min=2"`
	Description *string      `json:"description"`
	AssigneeID  *uint        `json:"assignee_id"`   // null = unassign
	ClearAssignee bool       `json:"clear_assignee"`
	Status      TaskStatus   `json:"status"`
	Priority    TaskPriority `json:"priority"`
	DueDate     *string      `json:"due_date"`      // "" = clear due date
}

type TaskResponse struct {
	ID          uint          `json:"id"`
	Title       string        `json:"title"`
	Description string        `json:"description"`
	ProjectID   uint          `json:"project_id"`
	AssigneeID  *uint         `json:"assignee_id"`
	Assignee    *UserResponse `json:"assignee,omitempty"`
	CreatorID   uint          `json:"creator_id"`
	Creator     *UserResponse `json:"creator,omitempty"`
	Status      TaskStatus    `json:"status"`
	Priority    TaskPriority  `json:"priority"`
	DueDate     *time.Time    `json:"due_date"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

func (t *Task) ToResponse() *TaskResponse {
	resp := &TaskResponse{
		ID:          t.ID,
		Title:       t.Title,
		Description: t.Description,
		ProjectID:   t.ProjectID,
		AssigneeID:  t.AssigneeID,
		CreatorID:   t.CreatorID,
		Status:      t.Status,
		Priority:    t.Priority,
		DueDate:     t.DueDate,
		CreatedAt:   t.CreatedAt,
		UpdatedAt:   t.UpdatedAt,
	}
	if t.Assignee != nil {
		resp.Assignee = t.Assignee.ToResponse()
	}
	if t.Creator.ID != 0 {
		resp.Creator = t.Creator.ToResponse()
	}
	return resp
}
