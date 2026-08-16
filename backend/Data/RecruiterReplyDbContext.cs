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
    public DbSet<GmailConnectionEntity> GmailConnections => Set<GmailConnectionEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserEntity>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(255).IsRequired();
            entity.Property(e => e.PasswordHash).HasColumnName("password_hash").HasMaxLength(255).IsRequired();
            entity.Property(e => e.FirstName).HasColumnName("first_name").HasMaxLength(100);
            entity.Property(e => e.LastName).HasColumnName("last_name").HasMaxLength(100);
            entity.Property(e => e.ProfilePictureUrl).HasColumnName("profile_picture_url").HasMaxLength(2048);
            entity.Property(e => e.AuthProvider).HasColumnName("auth_provider").HasMaxLength(50).HasDefaultValue("email");
            entity.Property(e => e.ProviderUserId).HasColumnName("provider_user_id").HasMaxLength(255);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.LastLogin).HasColumnName("last_login");
            entity.Property(e => e.IsActive).HasColumnName("is_active");
            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => new { e.AuthProvider, e.ProviderUserId }).IsUnique();
        });

        modelBuilder.Entity<MessageEntity>(entity =>
        {
            entity.ToTable("messages");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.Subject).HasColumnName("subject").HasMaxLength(500);
            entity.Property(e => e.Body).HasColumnName("body").IsRequired();
            entity.Property(e => e.SenderEmail).HasColumnName("sender_email").HasMaxLength(255);
            entity.Property(e => e.SenderName).HasColumnName("sender_name").HasMaxLength(255);
            entity.Property(e => e.CompanyName).HasColumnName("company_name").HasMaxLength(255);
            entity.Property(e => e.ReceivedDate).HasColumnName("received_date");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.HasOne<UserEntity>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => new { e.UserId, e.CreatedAt });
        });

        modelBuilder.Entity<MessageAnalysisEntity>(entity =>
        {
            entity.ToTable("message_analyses", t =>
                t.HasCheckConstraint("CK_message_analyses_competitiveness_score", "competitiveness_score >= 1 AND competitiveness_score <= 10"));
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MessageId).HasColumnName("message_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.CompetitivenessScore).HasColumnName("competitiveness_score");
            entity.Property(e => e.CompensationEvaluation).HasColumnName("compensation_evaluation").HasColumnType("jsonb");
            entity.Property(e => e.RedFlags).HasColumnName("red_flags").HasColumnType("jsonb");
            entity.Property(e => e.AnalysisSummary).HasColumnName("analysis_summary");
            entity.Property(e => e.SuggestedTone).HasColumnName("suggested_tone").HasMaxLength(50);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne<MessageEntity>().WithMany().HasForeignKey(e => e.MessageId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<UserEntity>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.MessageId);
            entity.HasIndex(e => new { e.UserId, e.CreatedAt });
        });

        modelBuilder.Entity<GeneratedReplyEntity>(entity =>
        {
            entity.ToTable("generated_replies");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AnalysisId).HasColumnName("analysis_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.ReplyType).HasColumnName("reply_type").HasMaxLength(50).IsRequired();
            entity.Property(e => e.Content).HasColumnName("content").IsRequired();
            entity.Property(e => e.Tone).HasColumnName("tone").HasMaxLength(50);
            entity.Property(e => e.IsUsed).HasColumnName("is_used");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.HasOne<MessageAnalysisEntity>().WithMany().HasForeignKey(e => e.AnalysisId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<UserEntity>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.AnalysisId);
        });

        modelBuilder.Entity<OpportunityEntity>(entity =>
        {
            entity.ToTable("opportunities");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.CompanyName).HasColumnName("company_name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.PositionTitle).HasColumnName("position_title").HasMaxLength(255).IsRequired();
            entity.Property(e => e.RecruiterName).HasColumnName("recruiter_name").HasMaxLength(255);
            entity.Property(e => e.RecruiterEmail).HasColumnName("recruiter_email").HasMaxLength(255);
            entity.Property(e => e.JobDescription).HasColumnName("job_description");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50).IsRequired();
            entity.Property(e => e.SalaryMin).HasColumnName("salary_min");
            entity.Property(e => e.SalaryMax).HasColumnName("salary_max");
            entity.Property(e => e.JobType).HasColumnName("job_type").HasMaxLength(50);
            entity.Property(e => e.Location).HasColumnName("location").HasMaxLength(255);
            entity.Property(e => e.RemoteFlexibility).HasColumnName("remote_flexibility").HasMaxLength(50);
            entity.Property(e => e.StartDate).HasColumnName("start_date");
            entity.Property(e => e.Source).HasColumnName("source").HasMaxLength(100);
            entity.Property(e => e.LastContactDate).HasColumnName("last_contact_date");
            entity.Property(e => e.NextFollowupDate).HasColumnName("next_followup_date");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne<UserEntity>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => new { e.UserId, e.Status });
        });

        modelBuilder.Entity<OfferComparisonEntity>(entity =>
        {
            entity.ToTable("offer_comparisons");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.Title).HasColumnName("title").HasMaxLength(255).IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne<UserEntity>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.UserId);
        });

        modelBuilder.Entity<ComparisonItemEntity>(entity =>
        {
            entity.ToTable("comparison_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ComparisonId).HasColumnName("comparison_id");
            entity.Property(e => e.CompanyName).HasColumnName("company_name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.PositionTitle).HasColumnName("position_title").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Salary).HasColumnName("salary").HasPrecision(12, 2);
            entity.Property(e => e.HourlyRate).HasColumnName("hourly_rate").HasPrecision(8, 2);
            entity.Property(e => e.SigningBonus).HasColumnName("signing_bonus").HasPrecision(12, 2);
            entity.Property(e => e.AnnualBonus).HasColumnName("annual_bonus").HasPrecision(12, 2);
            entity.Property(e => e.StockOptions).HasColumnName("stock_options").HasMaxLength(255);
            entity.Property(e => e.HealthInsurance).HasColumnName("health_insurance");
            entity.Property(e => e.DentalInsurance).HasColumnName("dental_insurance");
            entity.Property(e => e.VisionInsurance).HasColumnName("vision_insurance");
            entity.Property(e => e.Retirement401k).HasColumnName("retirement_401k");
            entity.Property(e => e.PtoDays).HasColumnName("pto_days");
            entity.Property(e => e.CommuteMinutes).HasColumnName("commute_minutes");
            entity.Property(e => e.RemoteFlexibility).HasColumnName("remote_flexibility").HasMaxLength(50);
            entity.Property(e => e.ContractLengthMonths).HasColumnName("contract_length_months");
            entity.Property(e => e.StartDate).HasColumnName("start_date");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne<OfferComparisonEntity>().WithMany().HasForeignKey(e => e.ComparisonId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.ComparisonId);
        });

        modelBuilder.Entity<GmailConnectionEntity>(entity =>
        {
            entity.ToTable("gmail_connections");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.GoogleAccountEmail).HasColumnName("google_account_email").HasMaxLength(255).IsRequired();
            entity.Property(e => e.AccessTokenEncrypted).HasColumnName("access_token_encrypted").IsRequired();
            entity.Property(e => e.RefreshTokenEncrypted).HasColumnName("refresh_token_encrypted").IsRequired();
            entity.Property(e => e.TokenExpiresAt).HasColumnName("token_expires_at");
            entity.Property(e => e.GrantedScopes).HasColumnName("granted_scopes").HasMaxLength(500).IsRequired();
            entity.Property(e => e.HistoryId).HasColumnName("history_id").HasMaxLength(50);
            entity.Property(e => e.LastSyncedAt).HasColumnName("last_synced_at");
            entity.Property(e => e.LastSyncStatus).HasColumnName("last_sync_status").HasMaxLength(20);
            entity.Property(e => e.LastSyncError).HasColumnName("last_sync_error");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
            entity.Property(e => e.LabelIds).HasColumnName("label_ids").HasColumnType("jsonb");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne<UserEntity>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.UserId).IsUnique();
            entity.HasIndex(e => e.Status);
        });
    }
}
