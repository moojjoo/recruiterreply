using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecruiterReply.Migrations
{
    /// <inheritdoc />
    public partial class google_sign_in : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "auth_provider",
                table: "users",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "email");

            migrationBuilder.AddColumn<string>(
                name: "provider_user_id",
                table: "users",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_auth_provider_provider_user_id",
                table: "users",
                columns: new[] { "auth_provider", "provider_user_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_auth_provider_provider_user_id",
                table: "users");

            migrationBuilder.DropColumn(
                name: "auth_provider",
                table: "users");

            migrationBuilder.DropColumn(
                name: "provider_user_id",
                table: "users");
        }
    }
}
