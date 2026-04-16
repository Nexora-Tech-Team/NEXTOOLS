package handler

import (
	"net/http"
	"strconv"

	"auth-service/internal/model"
	"auth-service/internal/service"

	"github.com/gin-gonic/gin"
)

type TaskHandler struct {
	taskService    service.TaskService
	historyService service.TaskHistoryService
}

func NewTaskHandler(taskService service.TaskService, historyService service.TaskHistoryService) *TaskHandler {
	return &TaskHandler{taskService: taskService, historyService: historyService}
}

// POST /api/projects/:id/tasks
func (h *TaskHandler) Create(c *gin.Context) {
	projectID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	creatorID := c.GetUint("user_id")
	var req model.CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	task, err := h.taskService.Create(uint(projectID), creatorID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "task created", "data": task})
}

// GET /api/projects/:id/tasks
func (h *TaskHandler) GetByProject(c *gin.Context) {
	projectID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	tasks, err := h.taskService.GetByProject(uint(projectID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tasks, "total": len(tasks)})
}

// GET /api/tasks/:id
func (h *TaskHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}
	task, err := h.taskService.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": task})
}

// PUT /api/tasks/:id
func (h *TaskHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}
	actorID   := c.GetUint("user_id")
	actorRole := c.GetString("role")

	var req model.UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	task, err := h.taskService.Update(uint(id), actorID, actorRole, &req)
	if err != nil {
		status := http.StatusBadRequest
		if len(err.Error()) >= 9 && err.Error()[:9] == "forbidden" {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "task updated", "data": task})
}

// DELETE /api/tasks/:id
func (h *TaskHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}
	actorID   := c.GetUint("user_id")
	actorRole := c.GetString("role")

	if err := h.taskService.Delete(uint(id), actorID, actorRole); err != nil {
		status := http.StatusNotFound
		if len(err.Error()) >= 9 && err.Error()[:9] == "forbidden" {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "task deleted"})
}

// GET /api/tasks/:id/history
func (h *TaskHandler) GetHistory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}
	history, err := h.historyService.GetByTaskID(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": history, "total": len(history)})
}
