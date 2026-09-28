CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY NOT NULL,
	"venue_id" uuid NOT NULL,
	"code" text NOT NULL,
	"qr_token" text NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tables_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_slug_unique" UNIQUE("slug");