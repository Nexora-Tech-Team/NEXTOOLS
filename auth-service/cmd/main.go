package main

import (
	"log"
	"os"
	"strings"

	"auth-service/internal/database"
	"auth-service/internal/handler"
	"auth-service/internal/middleware"
	"auth-service/internal/repository"
	"auth-service/internal/service"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	database.Connect()
	database.Migrate()

	// Repositories
	userRepo        := repository.NewUserRepository(database.DB)
	projectRepo     := repository.NewProjectRepository(database.DB)
	taskRepo        := repository.NewTaskRepository(database.DB)
	taskHistRepo    := repository.NewTaskHistoryRepository(database.DB)
	projectMemberRepo := repository.NewProjectMemberRepository(database.DB)

	// Services
	authSvc          := service.NewAuthService(userRepo)
	userSvc          := service.NewUserService(userRepo)
	projectSvc       := service.NewProjectService(projectRepo, taskRepo, projectMemberRepo)
	taskSvc          := service.NewTaskService(taskRepo, projectRepo, taskHistRepo)
	taskHistSvc      := service.NewTaskHistoryService(taskHistRepo)
	projectMemberSvc := service.NewProjectMemberService(projectMemberRepo, projectRepo, userRepo)

	// Handlers
	authHandler          := handler.NewAuthHandler(authSvc)
	userHandler          := handler.NewUserHandler(userSvc)
	projectHandler       := handler.NewProjectHandler(projectSvc)
	taskHandler          := handler.NewTaskHandler(taskSvc, taskHistSvc)
	projectMemberHandler := handler.NewProjectMemberHandler(projectMemberSvc)

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			return strings.HasPrefix(origin, "http://localhost")
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "auth-service"})
	})

	// Auth routes (public)
	auth := r.Group("/api/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
		auth.GET("/me", middleware.AuthRequired(), authHandler.Me)
	}

	// Protected routes
	api := r.Group("/api")
	api.Use(middleware.AuthRequired())
	{
		// Users (admin-only for delete)
		api.GET("/users",     userHandler.GetAll)
		api.GET("/users/:id", userHandler.GetByID)
		api.PUT("/users/:id", userHandler.Update)
		api.DELETE("/users/:id", middleware.AdminOnly(), userHandler.Delete)

		// Projects
		api.POST("/projects",    projectHandler.Create)
		api.GET("/projects",     projectHandler.GetAll)
		api.GET("/projects/:id", projectHandler.GetByID)
		api.PUT("/projects/:id", projectHandler.Update)
		api.DELETE("/projects/:id", projectHandler.Delete)

		// Project members
		memberGuard := middleware.ProjectMemberOnly(projectMemberRepo)
		api.GET("/projects/:id/members",              memberGuard, projectMemberHandler.GetMembers)
		api.POST("/projects/:id/members",             memberGuard, projectMemberHandler.AddMember)
		api.DELETE("/projects/:id/members/:userID",   memberGuard, projectMemberHandler.RemoveMember)

		// Tasks (nested under project)
		api.POST("/projects/:id/tasks", taskHandler.Create)
		api.GET("/projects/:id/tasks",  taskHandler.GetByProject)

		// Tasks (standalone)
		api.GET("/tasks/:id",         taskHandler.GetByID)
		api.PUT("/tasks/:id",         taskHandler.Update)
		api.DELETE("/tasks/:id",      taskHandler.Delete)
		api.GET("/tasks/:id/history", taskHandler.GetHistory)
	}

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8090"
	}

	log.Printf("Auth service running on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
