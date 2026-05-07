package model

import "time"

type TaskTimeLog struct {
	ID          uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	TaskID      uint       `gorm:"not null;index" json:"task_id"`
	UserID      uint       `gorm:"not null;index" json:"user_id"`
	User        User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
	ClockIn     time.Time  `gorm:"not null" json:"clock_in"`
	ClockOut    *time.Time `json:"clock_out"`
	Duration    int64      `gorm:"default:0" json:"duration"` // seconds
	// enriched fields (not in DB)
	TaskTitle    string `gorm:"-" json:"-"`
	ProjectID    uint   `gorm:"-" json:"-"`
	ProjectName  string `gorm:"-" json:"-"`
	TaskCategory string `gorm:"-" json:"-"`
	TaskPriority string `gorm:"-" json:"-"`
	TaskStatus   string `gorm:"-" json:"-"`
}

type TaskTimeLogResponse struct {
	ID           uint          `json:"id"`
	TaskID       uint          `json:"task_id"`
	TaskTitle    string        `json:"task_title,omitempty"`
	TaskCategory string        `json:"category,omitempty"`
	TaskPriority string        `json:"priority,omitempty"`
	TaskStatus   string        `json:"status,omitempty"`
	ProjectID    uint          `json:"project_id,omitempty"`
	ProjectName  string        `json:"project_name,omitempty"`
	UserID       uint          `json:"user_id"`
	User         *UserResponse `json:"user,omitempty"`
	ClockIn      time.Time     `json:"clock_in"`
	ClockOut     *time.Time    `json:"clock_out"`
	Duration     int64         `json:"duration"`
}

type TaskTimeLogsResponse struct {
	Logs          []*TaskTimeLogResponse `json:"logs"`
	TotalDuration int64                  `json:"total_duration"` // seconds
	ActiveLog     *TaskTimeLogResponse   `json:"active_log"`     // current user's open session
}

func (l *TaskTimeLog) ToResponse() *TaskTimeLogResponse {
	r := &TaskTimeLogResponse{
		ID:       l.ID,
		TaskID:   l.TaskID,
		UserID:   l.UserID,
		ClockIn:  l.ClockIn,
		ClockOut: l.ClockOut,
		Duration: l.Duration,
	}
	if l.User.ID != 0 {
		r.User = l.User.ToResponse()
	}
	if l.TaskTitle != "" {
		r.TaskTitle    = l.TaskTitle
		r.ProjectID    = l.ProjectID
		r.ProjectName  = l.ProjectName
		r.TaskCategory = l.TaskCategory
		r.TaskPriority = l.TaskPriority
		r.TaskStatus   = l.TaskStatus
	}
	return r
}
