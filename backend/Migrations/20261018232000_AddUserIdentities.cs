using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecruiterReply.Migrations;

public partial class AddUserIdentities : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "user_identities",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                user_id = table.Column<Guid>(type: "uuid", nullable: false),
                provider = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                subject = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                last_used_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_user_identities", x => x.id);
                table.ForeignKey("FK_user_identities_users_user_id", x => x.user_id, "users", "id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex("IX_user_identities_provider_subject", "user_identities", new[] { "provider", "subject" }, unique: true);
        migrationBuilder.CreateIndex("IX_user_identities_user_id_provider", "user_identities", new[] { "user_id", "provider" }, unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(name: "user_identities");
}
