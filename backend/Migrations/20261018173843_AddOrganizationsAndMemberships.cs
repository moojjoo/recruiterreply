using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecruiterReply.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationsAndMemberships : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "personal_organization_id",
                table: "users",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "organizations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_organizations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "organization_members",
                columns: table => new
                {
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_organization_members", x => new { x.organization_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_organization_members_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_organization_members_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Create one isolated personal workspace for every existing user.
            // This is additive and preserves all existing user/resource rows.
            migrationBuilder.Sql("""
                DO $$
                DECLARE
                    user_row RECORD;
                    organization_id uuid;
                    workspace_name text;
                BEGIN
                    FOR user_row IN SELECT id, email, first_name, last_name FROM users
                    WHERE personal_organization_id IS NULL LOOP
                        organization_id := gen_random_uuid();
                        workspace_name := COALESCE(
                            NULLIF(trim(concat_ws(' ', user_row.first_name, user_row.last_name)), ''),
                            split_part(user_row.email, '@', 1)
                        ) || ' workspace';
                        INSERT INTO organizations (id, name, created_at, updated_at)
                        VALUES (organization_id, workspace_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
                        UPDATE users SET personal_organization_id = organization_id
                        WHERE id = user_row.id;
                        INSERT INTO organization_members
                            (organization_id, user_id, role, status, created_at, updated_at)
                        VALUES
                            (organization_id, user_row.id, 'owner', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
                    END LOOP;
                END $$;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_users_personal_organization_id",
                table: "users",
                column: "personal_organization_id");

            migrationBuilder.AddForeignKey(
                name: "FK_users_organizations_personal_organization_id",
                table: "users",
                column: "personal_organization_id",
                principalTable: "organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.CreateIndex(
                name: "IX_organization_members_user_id_status",
                table: "organization_members",
                columns: new[] { "user_id", "status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_users_organizations_personal_organization_id",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_users_personal_organization_id",
                table: "users");

            migrationBuilder.DropTable(
                name: "organization_members");

            migrationBuilder.DropTable(
                name: "organizations");

            migrationBuilder.DropColumn(
                name: "personal_organization_id",
                table: "users");
        }
    }
}
