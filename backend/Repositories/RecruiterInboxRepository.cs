using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;

namespace RecruiterReply.Repositories;

public class RecruiterInboxRepository : IRecruiterInboxRepository
{
    private readonly RecruiterReplyDbContext _dbContext;

    public RecruiterInboxRepository(RecruiterReplyDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<bool> EmailExistsAsync(Guid userId, string gmailMessageId, CancellationToken cancellationToken = default)
    {
        return _dbContext.RecruiterEmails.AnyAsync(e => e.UserId == userId && e.GmailMessageId == gmailMessageId, cancellationToken);
    }

    public async Task AddEmailAsync(RecruiterEmailEntity email, CancellationToken cancellationToken = default)
    {
        _dbContext.RecruiterEmails.Add(email);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public Task<RecruiterThreadEntity?> GetThreadByGmailIdAsync(Guid userId, string gmailThreadId, CancellationToken cancellationToken = default)
    {
        return _dbContext.RecruiterThreads.FirstOrDefaultAsync(t => t.UserId == userId && t.GmailThreadId == gmailThreadId, cancellationToken);
    }

    public Task<RecruiterThreadEntity?> GetThreadAsync(Guid userId, Guid threadId, CancellationToken cancellationToken = default)
    {
        return _dbContext.RecruiterThreads.AsNoTracking().FirstOrDefaultAsync(t => t.UserId == userId && t.Id == threadId, cancellationToken);
    }

    public Task<List<RecruiterThreadEntity>> ListThreadsAsync(Guid userId, string? state, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.RecruiterThreads.AsNoTracking().Where(t => t.UserId == userId);
        if (!string.IsNullOrWhiteSpace(state))
        {
            query = query.Where(t => t.State == state);
        }

        return query.OrderByDescending(t => t.LastMessageAt).Take(200).ToListAsync(cancellationToken);
    }

    public async Task SaveThreadAsync(RecruiterThreadEntity thread, CancellationToken cancellationToken = default)
    {
        if (_dbContext.Entry(thread).State == EntityState.Detached)
        {
            _dbContext.RecruiterThreads.Add(thread);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public Task<CareerProfileEntity?> GetProfileAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return _dbContext.CareerProfiles.FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);
    }

    public async Task SaveProfileAsync(CareerProfileEntity profile, CancellationToken cancellationToken = default)
    {
        if (_dbContext.Entry(profile).State == EntityState.Detached)
        {
            _dbContext.CareerProfiles.Add(profile);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
