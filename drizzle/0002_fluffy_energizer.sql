ALTER TABLE "players" ALTER COLUMN "username" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "avatar_url" text;