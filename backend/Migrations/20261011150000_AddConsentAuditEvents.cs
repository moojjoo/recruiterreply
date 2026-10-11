using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RecruiterReply.Data;

#nullable disable
namespace RecruiterReply.Migrations;

[DbContext(typeof(RecruiterReplyDbContext))]
[Migration("20261011150000_AddConsentAuditEvents")]
public partial class AddConsentAuditEvents : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "consent_audit_events",
            columns: table => new
            {
                event_id = table.Column<Guid>(type: "uuid", nullable: false),
                consent_id = table.Column<Guid>(type: "uuid", nullable: false),
                action = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                analytics_enabled = table.Column<bool>(type: "boolean", nullable: false),
                policy_version = table.Column<int>(type: "integer", nullable: false),
                created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_consent_audit_events", x => x.event_id));
        migrationBuilder.CreateIndex(name: "IX_consent_audit_events_created_at", table: "consent_audit_events", column: "created_at");
        migrationBuilder.CreateIndex(name: "IX_consent_audit_events_consent_id", table: "consent_audit_events", column: "consent_id");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "consent_audit_events");
    }
}
