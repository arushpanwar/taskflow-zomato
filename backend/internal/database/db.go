package database

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"

	_ "github.com/golang-migrate/migrate/v4/database/postgres"

	"github.com/arushpanwar/taskflow/migrations"
)

func Connect(dsn string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse dsn: %w", err)
	}
	cfg.MaxConns = 25
	cfg.MinConns = 5
	cfg.MaxConnLifetime = time.Hour
	cfg.MaxConnIdleTime = 30 * time.Minute

	var pool *pgxpool.Pool
	for i := 0; i < 10; i++ {
		pool, err = pgxpool.NewWithConfig(context.Background(), cfg)
		if err == nil {
			if pingErr := pool.Ping(context.Background()); pingErr == nil {
				slog.Info("database connected")
				return pool, nil
			}
			pool.Close()
		}
		slog.Warn("waiting for database", "attempt", i+1)
		time.Sleep(2 * time.Second)
	}
	return nil, fmt.Errorf("could not connect to database after retries: %w", err)
}

func RunMigrations(dsn string) error {
	d, err := iofs.New(migrations.Files, ".")
	if err != nil {
		return fmt.Errorf("create migration source: %w", err)
	}

	m, err := migrate.NewWithSourceInstance("iofs", d, dsn)
	if err != nil {
		return fmt.Errorf("create migrator: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("run migrations: %w", err)
	}

	slog.Info("migrations applied")
	return nil
}
