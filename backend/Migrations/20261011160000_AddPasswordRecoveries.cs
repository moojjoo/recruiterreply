using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RecruiterReply.Data;

#nullable disable
namespace RecruiterReply.Migrations;

[DbContext(typeof(RecruiterReplyDbContext))]
[Migration("20261011160000_AddPasswordRecoveries")]
public partial class AddPasswordRecoveries : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "password_recoveries",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                user_id = table.Column<Guid>(type: "uuid", nullable: false),
                token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                code_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                consumed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                attempts = table.Column<int>(type: "integer", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_password_recoveries", x => x.id);
                table.ForeignKey("FK_password_recoveries_users_user_id", x => x.user_id,
                    "users", "id", onDelete: ReferentialAction.Cascade);
            });
        migrationBuilder.CreateIndex("IX_password_recoveries_user_id_created_at", "password_recoveries",
            new[] { "user_id", "created_at" });
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("password_recoveries");
    }
}
