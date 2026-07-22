CREATE TABLE "bonus_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bonus_points" ADD CONSTRAINT "bonus_points_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bonus_points_batch_idx" ON "bonus_points" USING btree ("batch_id");