using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecruiterReply.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    password_hash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    first_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    last_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    profile_picture_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    last_login = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "messages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    subject = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    body = table.Column<string>(type: "text", nullable: false),
                    sender_email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    sender_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    company_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    received_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_messages", x => x.id);
                    table.ForeignKey(
                        name: "FK_messages_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "offer_comparisons",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_offer_comparisons", x => x.id);
                    table.ForeignKey(
                        name: "FK_offer_comparisons_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "opportunities",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    position_title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    recruiter_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    recruiter_email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    job_description = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    salary_min = table.Column<int>(type: "integer", nullable: true),
                    salary_max = table.Column<int>(type: "integer", nullable: true),
                    job_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    location = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    remote_flexibility = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    start_date = table.Column<DateOnly>(type: "date", nullable: true),
                    source = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    last_contact_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    next_followup_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_opportunities", x => x.id);
                    table.ForeignKey(
                        name: "FK_opportunities_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "message_analyses",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    message_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    competitiveness_score = table.Column<int>(type: "integer", nullable: true),
                    compensation_evaluation = table.Column<string>(type: "jsonb", nullable: true),
                    red_flags = table.Column<string>(type: "jsonb", nullable: true),
                    analysis_summary = table.Column<string>(type: "text", nullable: true),
                    suggested_tone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_message_analyses", x => x.id);
                    table.CheckConstraint("CK_message_analyses_competitiveness_score", "competitiveness_score >= 1 AND competitiveness_score <= 10");
                    table.ForeignKey(
                        name: "FK_message_analyses_messages_message_id",
                        column: x => x.message_id,
                        principalTable: "messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_message_analyses_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "comparison_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    comparison_id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    position_title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    salary = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    hourly_rate = table.Column<decimal>(type: "numeric(8,2)", precision: 8, scale: 2, nullable: true),
                    signing_bonus = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    annual_bonus = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    stock_options = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    health_insurance = table.Column<bool>(type: "boolean", nullable: true),
                    dental_insurance = table.Column<bool>(type: "boolean", nullable: true),
                    vision_insurance = table.Column<bool>(type: "boolean", nullable: true),
                    retirement_401k = table.Column<bool>(type: "boolean", nullable: true),
                    pto_days = table.Column<int>(type: "integer", nullable: true),
                    commute_minutes = table.Column<int>(type: "integer", nullable: true),
                    remote_flexibility = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    contract_length_months = table.Column<int>(type: "integer", nullable: true),
                    start_date = table.Column<DateOnly>(type: "date", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_comparison_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_comparison_items_offer_comparisons_comparison_id",
                        column: x => x.comparison_id,
                        principalTable: "offer_comparisons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "generated_replies",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    analysis_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reply_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    tone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    is_used = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_generated_replies", x => x.id);
                    table.ForeignKey(
                        name: "FK_generated_replies_message_analyses_analysis_id",
                        column: x => x.analysis_id,
                        principalTable: "message_analyses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_generated_replies_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_comparison_items_comparison_id",
                table: "comparison_items",
                column: "comparison_id");

            migrationBuilder.CreateIndex(
                name: "IX_generated_replies_analysis_id",
                table: "generated_replies",
                column: "analysis_id");

            migrationBuilder.CreateIndex(
                name: "IX_generated_replies_user_id",
                table: "generated_replies",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_message_analyses_message_id",
                table: "message_analyses",
                column: "message_id");

            migrationBuilder.CreateIndex(
                name: "IX_message_analyses_user_id",
                table: "message_analyses",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_message_analyses_user_id_created_at",
                table: "message_analyses",
                columns: new[] { "user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_messages_created_at",
                table: "messages",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "IX_messages_user_id",
                table: "messages",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_messages_user_id_created_at",
                table: "messages",
                columns: new[] { "user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_offer_comparisons_user_id",
                table: "offer_comparisons",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_opportunities_created_at",
                table: "opportunities",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "IX_opportunities_status",
                table: "opportunities",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_opportunities_user_id",
                table: "opportunities",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_opportunities_user_id_status",
                table: "opportunities",
                columns: new[] { "user_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_users_email",
                table: "users",
                column: "email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "comparison_items");

            migrationBuilder.DropTable(
                name: "generated_replies");

            migrationBuilder.DropTable(
                name: "opportunities");

            migrationBuilder.DropTable(
                name: "offer_comparisons");

            migrationBuilder.DropTable(
                name: "message_analyses");

            migrationBuilder.DropTable(
                name: "messages");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
