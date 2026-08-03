using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecruiterReply.Migrations
{
    /// <inheritdoc />
    public partial class AddGmailConnections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "gmail_connections",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    google_account_email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    access_token_encrypted = table.Column<string>(type: "text", nullable: false),
                    refresh_token_encrypted = table.Column<string>(type: "text", nullable: false),
                    token_expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    granted_scopes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    history_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    last_synced_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_sync_status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    last_sync_error = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    label_ids = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gmail_connections", x => x.id);
                    table.ForeignKey(
                        name: "FK_gmail_connections_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_gmail_connections_status",
                table: "gmail_connections",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_gmail_connections_user_id",
                table: "gmail_connections",
                column: "user_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "gmail_connections");
        }
    }
}
