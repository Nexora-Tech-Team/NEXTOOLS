package database

import (
	"fmt"
	"log"
	"os"

	"auth-service/internal/model"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect() {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable TimeZone=Asia/Jakarta",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Database connected successfully")
	DB = db
}

func Migrate() {
	err := DB.AutoMigrate(
		&model.User{},
		&model.Project{},
		&model.Task{},
		&model.TaskHistory{},
		&model.ProjectMember{},
		&model.ProjectColumnConfig{},
	)
	if err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Seed existing projects with owner membership (one-time safe upsert)
	DB.Exec(`
		INSERT INTO project_members (project_id, user_id, role, created_at)
		SELECT id, owner_id, 'owner', NOW()
		FROM projects
		WHERE NOT EXISTS (
			SELECT 1 FROM project_members
			WHERE project_members.project_id = projects.id
			  AND project_members.user_id    = projects.owner_id
		)
	`)

	log.Println("Database migration completed")
}
