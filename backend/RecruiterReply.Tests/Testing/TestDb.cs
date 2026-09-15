using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;

namespace RecruiterReply.Tests.Testing;

public static class TestDb
{
    public static RecruiterReplyDbContext Create()
    {
        var options = new DbContextOptionsBuilder<RecruiterReplyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new RecruiterReplyDbContext(options);
    }
}
