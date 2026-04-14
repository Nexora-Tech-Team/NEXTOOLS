package handler

import (
	"net/http"
	"strconv"

	"auth-service/internal/model"
	"auth-service/internal/service"

	"github.com/gin-gonic/gin"
)

type ProjectHandler struct {
	projectService service.ProjectService
}

func NewProjectHandler(projectService service.ProjectService) *ProjectHandler {
	return &ProjectHandler{projectService: projectService}
}

// POST /api/projects
func (h *ProjectHandler) Create(c *gin.Context) {
	ownerID := c.GetUint("user_id")
	var req model.CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	project, err := h.projectService.Create(ownerID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "project created", "data": project})
}

// GET /api/projects
func (h *ProjectHandler) GetAll(c *gin.Context) {
	actorID   := c.GetUint("user_id")
	actorRole := c.GetString("role")
	projects, err := h.projectService.GetAll(actorID, actorRole)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": projects, "total": len(projects)})
}

// GET /api/projects/:id
func (h *ProjectHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	actorID   := c.GetUint("user_id")
	actorRole := c.GetString("role")
	project, err := h.projectService.GetByID(uint(id), actorID, actorRole)
	if err != nil {
		status := http.StatusNotFound
		if len(err.Error()) >= 9 && err.Error()[:9] == "forbidden" {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": project})
}

// PUT /api/projects/:id
func (h *ProjectHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	actorID   := c.GetUint("user_id")
	actorRole := c.GetString("role")
	var req model.UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	project, err := h.projectService.Update(uint(id), actorID, actorRole, &req)
	if err != nil {
		status := http.StatusBadRequest
		if len(err.Error()) >= 9 && err.Error()[:9] == "forbidden" {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "project updated", "data": project})
}

// DELETE /api/projects/:id
func (h *ProjectHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	actorID   := c.GetUint("user_id")
	actorRole := c.GetString("role")
	if err := h.projectService.Delete(uint(id), actorID, actorRole); err != nil {
		status := http.StatusNotFound
		if len(err.Error()) >= 9 && err.Error()[:9] == "forbidden" {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "project deleted"})
}
