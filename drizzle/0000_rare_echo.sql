CREATE TABLE "code_pool" (
	"position" integer PRIMARY KEY NOT NULL,
	"code" char(6) NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	CONSTRAINT "code_pool_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" text NOT NULL,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"access_code" char(6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "players_email_unique" UNIQUE("email"),
	CONSTRAINT "players_username_unique" UNIQUE("username"),
	CONSTRAINT "players_access_code_unique" UNIQUE("access_code")
);
--> statement-breakpoint
CREATE TABLE "quiz_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"quest_id" text NOT NULL,
	"chosen_option_id" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_uuid" uuid NOT NULL,
	CONSTRAINT "quiz_answers_client_uuid_unique" UNIQUE("client_uuid")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"quest_id" text NOT NULL,
	"kind" text NOT NULL,
	"body_text" text,
	"media_url" text,
	"media_kind" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"client_uuid" uuid NOT NULL,
	CONSTRAINT "submissions_client_uuid_unique" UNIQUE("client_uuid")
);
--> statement-breakpoint
CREATE TABLE "username_pool" (
	"position" integer PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	CONSTRAINT "username_pool_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voter_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_voter_id_players_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_attempts_ip_time_idx" ON "login_attempts" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_answers_player_quest_unique" ON "quiz_answers" USING btree ("player_id","quest_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_player_quest_unique" ON "submissions" USING btree ("player_id","quest_id");--> statement-breakpoint
CREATE INDEX "submissions_quest_idx" ON "submissions" USING btree ("quest_id");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_voter_submission_unique" ON "votes" USING btree ("voter_id","submission_id");--> statement-breakpoint
CREATE INDEX "votes_submission_idx" ON "votes" USING btree ("submission_id");