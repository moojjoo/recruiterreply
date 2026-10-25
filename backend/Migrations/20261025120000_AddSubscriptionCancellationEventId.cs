using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RecruiterReply.Data;

#nullable disable
namespace RecruiterReply.Migrations;

[DbContext(typeof(RecruiterReplyDbContext))]
[Migration("20261025120000_AddSubscriptionCancellationEventId")]
public partial class AddSubscriptionCancellationEventId : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.AddColumn<Guid>("subscription_cancellation_event_id", "users", type: "uuid", nullable: true);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropColumn("subscription_cancellation_event_id", "users");
}
