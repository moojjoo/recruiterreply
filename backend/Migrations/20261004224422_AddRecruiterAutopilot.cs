using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecruiterReply.Migrations
{
    /// <inheritdoc />
    public partial class AddRecruiterAutopilot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "career_profiles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_titles = table.Column<List<string>>(type: "text[]", nullable: false),
                    skills = table.Column<List<string>>(type: "text[]", nullable: false),
                    min_w2_hourly_rate = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    min_c2c_hourly_rate = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    min_salary = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    employment_types = table.Column<List<string>>(type: "text[]", nullable: false),
                    work_modes = table.Column<List<string>>(type: "text[]", nullable: false),
                    allowed_locations = table.Column<List<string>>(type: "text[]", nullable: false),
                    min_contract_months = table.Column<int>(type: "integer", nullable: true),
                    deal_breaker_keywords = table.Column<List<string>>(type: "text[]", nullable: false),
                    blocked_companies = table.Column<List<string>>(type: "text[]", nullable: false),
                    must_know_fields = table.Column<List<string>>(type: "text[]", nullable: false),
                    tone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    signature = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    disclose_min_rate = table.Column<bool>(type: "boolean", nullable: false),
                    auto_send_request_info = table.Column<bool>(type: "boolean", nullable: false),
                    auto_send_decline = table.Column<bool>(type: "boolean", nullable: false),
                    daily_send_cap = table.Column<int>(type: "integer", nullable: false),
                    paused = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_career_profiles", x => x.id);
                    table.ForeignKey(
                        name: "FK_career_profiles_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "recruiter_threads",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    gmail_thread_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    subject = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    recruiter_email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    state = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    facts = table.Column<string>(type: "jsonb", nullable: true),
                    missing_fields = table.Column<string>(type: "jsonb", nullable: true),
                    reasons = table.Column<string>(type: "jsonb", nullable: true),
                    last_message_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_recruiter_threads", x => x.id);
                    table.ForeignKey(
                        name: "FK_recruiter_threads_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "recruiter_emails",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    thread_id = table.Column<Guid>(type: "uuid", nullable: true),
                    gmail_message_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    gmail_thread_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    direction = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    from_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    subject = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    error = table.Column<string>(type: "text", nullable: true),
                    received_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_recruiter_emails", x => x.id);
                    table.ForeignKey(
                        name: "FK_recruiter_emails_recruiter_threads_thread_id",
                        column: x => x.thread_id,
                        principalTable: "recruiter_threads",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_recruiter_emails_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_career_profiles_user_id",
                table: "career_profiles",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_recruiter_emails_thread_id",
                table: "recruiter_emails",
                column: "thread_id");

            migrationBuilder.CreateIndex(
                name: "IX_recruiter_emails_user_id_gmail_message_id",
                table: "recruiter_emails",
                columns: new[] { "user_id", "gmail_message_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_recruiter_threads_user_id_gmail_thread_id",
                table: "recruiter_threads",
                columns: new[] { "user_id", "gmail_thread_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_recruiter_threads_user_id_state",
                table: "recruiter_threads",
                columns: new[] { "user_id", "state" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "career_profiles");

            migrationBuilder.DropTable(
                name: "recruiter_emails");

            migrationBuilder.DropTable(
                name: "recruiter_threads");
        }
    }
}
