using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RecruiterReply.Data;

#nullable disable
namespace RecruiterReply.Migrations;

[DbContext(typeof(RecruiterReplyDbContext))]
[Migration("20261011170000_AddStripePaidInvoices")]
public partial class AddStripePaidInvoices : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE stripe_paid_invoices (
                id uuid PRIMARY KEY,
                stripe_invoice_id text NOT NULL UNIQUE,
                stripe_event_id text NOT NULL,
                stripe_customer_id text NOT NULL,
                amount_paid bigint NOT NULL CHECK (amount_paid > 0),
                currency varchar(3) NOT NULL,
                paid_at timestamp with time zone NOT NULL,
                created_at timestamp with time zone NOT NULL DEFAULT now()
            );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("stripe_paid_invoices");
    }
}
