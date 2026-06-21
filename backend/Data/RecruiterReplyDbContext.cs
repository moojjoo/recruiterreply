using Microsoft.EntityFrameworkCore;
using RecruiterReply.Entities;

namespace RecruiterReply.Data;

public class RecruiterReplyDbContext : DbContext
{
    public RecruiterReplyDbContext(DbContextOptions<RecruiterReplyDbContext> options)
        : base(options)
    {
    }

    public DbSet<UserEntity> Users => Set<UserEntity>();
    public DbSet<MessageEntity> Messages => Set<MessageEntity>();
    public DbSet<MessageAnalysisEntity> MessageAnalyses => Set<MessageAnalysisEntity>();
    public DbSet<GeneratedReplyEntity> GeneratedReplies => Set<GeneratedReplyEntity>();
    public DbSet<OpportunityEntity> Opportunities => Set<OpportunityEntity>();
    public DbSet<OfferComparisonEntity> OfferComparisons => Set<OfferComparisonEntity>();
    public DbSet<ComparisonItemEntity> ComparisonItems => Set<ComparisonItemEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserEntity>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Email).HasColumnName("email");
            entity.Property(e => e.PasswordHash).HasColumnName("password_hash");
            entity.Property(e => e.FirstName).HasColumnName("first_name");
            entity.Property(e => e.LastName).HasColumnName("last_name");
            entity.Property(e => e.ProfilePictureUrl).HasColumnName("profile_picture_url");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.LastLogin).HasColumnName("last_login");
            entity.Property(e => e.IsActive).HasColumnName("is_active");
        });

        modelBuilder.Entity<MessageEntity>(entity =>
        {
            entity.ToTable("messages");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.Subject).HasColumnName("subject");
            entity.Property(e => e.Body).HasColumnName("body");
            entity.Property(e => e.SenderEmail).HasColumnName("sender_email");
            entity.Property(e => e.SenderName).HasColumnName("sender_name");
            entity.Property(e => e.CompanyName).HasColumnName("company_name");
            entity.Property(e => e.ReceivedDate).HasColumnName("received_date");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<MessageAnalysisEntity>(entity =>
        {
            entity.ToTable("message_analyses");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MessageId).HasColumnName("message_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.CompetitivenessScore).HasColumnName("competitiveness_score");
            entity.Property(e => e.CompensationEvaluation).HasColumnName("compensation_evaluation").HasColumnType("jsonb");
            entity.Property(e => e.RedFlags).HasColumnName("red_flags").HasColumnType("jsonb");
            entity.Property(e => e.AnalysisSummary).HasColumnName("analysis_summary");
            entity.Property(e => e.SuggestedTone).HasColumnName("suggested_tone");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<GeneratedReplyEntity>(entity =>
        {
            entity.ToTable("generated_replies");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AnalysisId).HasColumnName("analysis_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.ReplyType).HasColumnName("reply_type");
            entity.Property(e => e.Content).HasColumnName("content");
            entity.Property(e => e.Tone).HasColumnName("tone");
            entity.Property(e => e.IsUsed).HasColumnName("is_used");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<OpportunityEntity>(entity =>
        {
            entity.ToTable("opportunities");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.CompanyName).HasColumnName("company_name");
            entity.Property(e => e.PositionTitle).HasColumnName("position_title");
            entity.Property(e => e.RecruiterName).HasColumnName("recruiter_name");
            entity.Property(e => e.RecruiterEmail).HasColumnName("recruiter_email");
            entity.Property(e => e.JobDescription).HasColumnName("job_description");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.SalaryMin).HasColumnName("salary_min");
            entity.Property(e => e.SalaryMax).HasColumnName("salary_max");
            entity.Property(e => e.JobType).HasColumnName("job_type");
            entity.Property(e => e.Location).HasColumnName("location");
            entity.Property(e => e.RemoteFlexibility).HasColumnName("remote_flexibility");
            entity.Property(e => e.StartDate).HasColumnName("start_date");
            entity.Property(e => e.Source).HasColumnName("source");
            entity.Property(e => e.LastContactDate).HasColumnName("last_contact_date");
            entity.Property(e => e.NextFollowupDate).HasColumnName("next_followup_date");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<OfferComparisonEntity>(entity =>
        {
            entity.ToTable("offer_comparisons");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.Title).HasColumnName("title");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<ComparisonItemEntity>(entity =>
        {
            entity.ToTable("comparison_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ComparisonId).HasColumnName("comparison_id");
            entity.Property(e => e.CompanyName).HasColumnName("company_name");
            entity.Property(e => e.PositionTitle).HasColumnName("position_title");
            entity.Property(e => e.Salary).HasColumnName("salary");
            entity.Property(e => e.HourlyRate).HasColumnName("hourly_rate");
            entity.Property(e => e.SigningBonus).HasColumnName("signing_bonus");
            entity.Property(e => e.AnnualBonus).HasColumnName("annual_bonus");
            entity.Property(e => e.StockOptions).HasColumnName("stock_options");
            entity.Property(e => e.HealthInsurance).HasColumnName("health_insurance");
            entity.Property(e => e.DentalInsurance).HasColumnName("dental_insurance");
            entity.Property(e => e.VisionInsurance).HasColumnName("vision_insurance");
            entity.Property(e => e.Retirement401k).HasColumnName("retirement_401k");
            entity.Property(e => e.PtoDays).HasColumnName("pto_days");
            entity.Property(e => e.CommuteMinutes).HasColumnName("commute_minutes");
            entity.Property(e => e.RemoteFlexibility).HasColumnName("remote_flexibility");
            entity.Property(e => e.ContractLengthMonths).HasColumnName("contract_length_months");
            entity.Property(e => e.StartDate).HasColumnName("start_date");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });
    }
}
