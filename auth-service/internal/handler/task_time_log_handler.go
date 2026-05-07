package handler

import (
	"net/http"
	"strconv"
	"time"

	"auth-service/internal/service"

	"github.com/gin-gonic/gin"
)

type TaskTimeLogHandler struct {
	svc service.TaskTimeLogService
}

func NewTaskTimeLogHandler(svc service.TaskTimeLogService) *TaskTimeLogHandler {
	return &TaskTimeLogHandler{svc: svc}
}

// POST /api/tasks/:id/clock-in
func (h *TaskTimeLogHandler) ClockIn(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}
	userID := c.GetUint("user_id")

	var req struct {
		ClockIn *string `json:"clock_in"` // optional: "2006-01-02T15:04"
	}
	_ = c.ShouldBindJSON(&req)

	var clockIn *time.Time
	if req.ClockIn != nil && *req.ClockIn != "" {
		t, err := time.ParseInLocation("2006-01-02T15:04", *req.ClockIn, time.Local)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid clock_in format, use YYYY-MM-DDTHH:MM"})
			return
		}
		clockIn = &t
	}

	log, err := h.svc.ClockIn(uint(taskID), userID, clockIn)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "clock in recorded", "data": log})
}

// POST /api/tasks/:id/clock-out
func (h *TaskTimeLogHandler) ClockOut(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}
	userID := c.GetUint("user_id")

	var req struct {
		ClockOut *string `json:"clock_out"` // optional: "2006-01-02T15:04"
	}
	_ = c.ShouldBindJSON(&req)

	var clockOut *time.Time
	if req.ClockOut != nil && *req.ClockOut != "" {
		t, err := time.ParseInLocation("2006-01-02T15:04", *req.ClockOut, time.Local)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid clock_out format, use YYYY-MM-DDTHH:MM"})
			return
		}
		clockOut = &t
	}

	log, err := h.svc.ClockOut(uint(taskID), userID, clockOut)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "clock out recorded", "data": log})
}

// POST /api/tasks/:id/time-logs (manual entry)
func (h *TaskTimeLogHandler) CreateManual(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}
	userID := c.GetUint("user_id")

	var req struct {
		ClockIn  string `json:"clock_in" binding:"required"`
		ClockOut string `json:"clock_out" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	clockIn, err := time.ParseInLocation("2006-01-02T15:04", req.ClockIn, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid clock_in format"})
		return
	}
	clockOut, err := time.ParseInLocation("2006-01-02T15:04", req.ClockOut, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid clock_out format"})
		return
	}
	if !clockOut.After(clockIn) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "clock_out must be after clock_in"})
		return
	}

	log, err := h.svc.CreateManual(uint(taskID), userID, clockIn, clockOut)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "time log created", "data": log})
}

// GET /api/tasks/:id/time-logs
func (h *TaskTimeLogHandler) GetLogs(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}
	userID := c.GetUint("user_id")

	result, err := h.svc.GetLogs(uint(taskID), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GET /api/me/time-logs?from=YYYY-MM-DD&to=YYYY-MM-DD
func (h *TaskTimeLogHandler) GetMyLogs(c *gin.Context) {
	userID := c.GetUint("user_id")
	from := c.Query("from")
	to := c.Query("to")
	if from == "" || to == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "from and to query params required (YYYY-MM-DD)"})
		return
	}
	result, err := h.svc.GetByDateRange(userID, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GET /api/time-logs?from=YYYY-MM-DD&to=YYYY-MM-DD  (all users, authenticated)
func (h *TaskTimeLogHandler) GetAllLogs(c *gin.Context) {
	from := c.Query("from")
	to := c.Query("to")
	if from == "" || to == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "from and to query params required (YYYY-MM-DD)"})
		return
	}
	result, err := h.svc.GetAllByDateRange(from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// DELETE /api/tasks/:id/time-logs/:logId
func (h *TaskTimeLogHandler) DeleteLog(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}
	logID, err := strconv.ParseUint(c.Param("logId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid log id"})
		return
	}
	userID := c.GetUint("user_id")

	if err := h.svc.DeleteLog(uint(logID), uint(taskID), userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "time log deleted"})
}
